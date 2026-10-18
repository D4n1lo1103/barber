import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  calcolaCaparra,
  creditoDaUsare,
  trattamentoDellaCaparra,
  type FormaRestituzione,
  type MotivoAnnullamento,
} from '@barber/shared';
import type { Ambiente } from '../configurazione/ambiente.js';
import { ImpostazioniServizio } from '../impostazioni/impostazioni.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CaparraServizio } from './caparra.servizio.js';
import {
  FORNITORE_PAGAMENTI,
  type EventoPagamento,
  type FornitorePagamenti,
} from './fornitore-pagamenti.js';

/** Caparra richiesta su una nuova prenotazione, e quanto ne copre il credito. */
export interface CaparraPerPrenotazione {
  /** Caparra dovuta per intero. */
  caparraCentesimi: number;
  /** Parte coperta dal credito del cliente. */
  creditoUsatoCentesimi: number;
  /** Differenza da pagare con carta: zero se il credito copre tutto. */
  daPagareCentesimi: number;
}

/** Pagamento da far completare al cliente. */
export interface PagamentoDaCompletare {
  urlPagamento: string;
  importoCentesimi: number;
  scadeIl: string;
}

/**
 * Pagamento della caparra: avvio, esito e restituzioni.
 *
 * Due regole guidano tutto il servizio:
 *
 * 1. **Lo stato è definitivo solo dopo l'evento firmato del fornitore.** Il
 *    ritorno del browser non conferma nulla: l'appuntamento passa a
 *    `confermato` solo quando arriva l'evento.
 * 2. **Gli eventi sono idempotenti.** Ogni evento viene registrato per
 *    identificativo prima di essere elaborato: un secondo invio dello stesso
 *    evento, che i fornitori fanno di routine, non produce doppi movimenti.
 */
@Injectable()
export class PagamentiServizio {
  private readonly logger = new Logger(PagamentiServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caparra: CaparraServizio,
    private readonly impostazioni: ImpostazioniServizio,
    private readonly configurazione: ConfigService<Ambiente, true>,
    @Inject(FORNITORE_PAGAMENTI) private readonly fornitore: FornitorePagamenti,
  ) {}

  /** Caparra dovuta adesso su un prezzo, secondo le impostazioni correnti. */
  async caparraDovuta(prezzoTotaleCentesimi: number): Promise<number> {
    const regole = await this.impostazioni.leggiRegole();

    if (!regole.caparraAttiva) {
      return 0;
    }

    return calcolaCaparra(prezzoTotaleCentesimi, regole.caparraPercentuale);
  }

  /**
   * Caparra di una nuova prenotazione, già ripartita fra credito del cliente e
   * importo da pagare con carta. Il credito copre quello che può: il resto si
   * paga, così non resta credito fermo.
   */
  async caparraPerPrenotazione(
    clienteId: string,
    prezzoTotaleCentesimi: number,
  ): Promise<CaparraPerPrenotazione> {
    const caparraCentesimi = await this.caparraDovuta(prezzoTotaleCentesimi);

    if (caparraCentesimi <= 0) {
      return { caparraCentesimi: 0, creditoUsatoCentesimi: 0, daPagareCentesimi: 0 };
    }

    const saldo = await this.caparra.saldoCredito(clienteId);
    const creditoUsatoCentesimi = creditoDaUsare(caparraCentesimi, saldo);

    return {
      caparraCentesimi,
      creditoUsatoCentesimi,
      daPagareCentesimi: caparraCentesimi - creditoUsatoCentesimi,
    };
  }

  /**
   * Scala dal credito la parte di caparra che copre. Il credito speso vale
   * come caparra pagata: se poi il pagamento della differenza non arriva, la
   * scadenza del blocco lo restituisce.
   */
  async applicaCreditoAllaPrenotazione(parametri: {
    appuntamentoId: string;
    clienteId: string;
    creditoUsatoCentesimi: number;
  }): Promise<void> {
    if (parametri.creditoUsatoCentesimi <= 0) {
      return;
    }

    await this.caparra.registraCredito({
      clienteId: parametri.clienteId,
      appuntamentoId: parametri.appuntamentoId,
      importoCentesimi: -parametri.creditoUsatoCentesimi,
      motivo: 'Credito usato per la caparra di una prenotazione.',
    });

    await this.caparra.registra({
      appuntamentoId: parametri.appuntamentoId,
      clienteId: parametri.clienteId,
      tipo: 'pagata',
      importoCentesimi: parametri.creditoUsatoCentesimi,
      motivo: 'Caparra coperta dal credito del cliente.',
    });
  }

  /**
   * Apre il pagamento della caparra di un appuntamento in attesa. Se un
   * pagamento era già stato avviato e non completato (il cliente ha chiuso la
   * pagina) viene chiuso e sostituito, così non restano due operazioni aperte
   * sullo stesso slot.
   */
  async avviaCaparra(appuntamentoId: string, clienteId: string): Promise<PagamentoDaCompletare> {
    const appuntamento = await this.prisma.appuntamento.findUnique({
      where: { id: appuntamentoId },
      include: { cliente: { select: { email: true, nome: true } }, servizi: true },
    });

    if (!appuntamento || appuntamento.clienteId !== clienteId) {
      throw new NotFoundException('Appuntamento non trovato.');
    }

    if (appuntamento.stato !== 'in_attesa_pagamento' || appuntamento.caparraCentesimi <= 0) {
      throw new BadRequestException('Questo appuntamento non è in attesa di pagamento.');
    }

    const scadeIl = appuntamento.bloccoScadeIl;

    if (!scadeIl || scadeIl.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Il tempo per pagare è scaduto e lo slot è stato liberato. Prenota di nuovo.',
      );
    }

    // Quello che il credito ha già coperto non si paga una seconda volta.
    const giaPagata = await this.caparra.caparraPagata(appuntamentoId);
    const daPagare = appuntamento.caparraCentesimi - giaPagata;

    if (daPagare <= 0) {
      throw new BadRequestException('La caparra di questo appuntamento è già coperta.');
    }

    await this.chiudiPagamentiAperti(appuntamentoId);

    const origine = this.configurazione.get('ORIGINE_WEB', { infer: true });
    const avviato = await this.fornitore.avvia({
      importoCentesimi: daPagare,
      descrizione: `Caparra per ${appuntamento.servizi.map((servizio) => servizio.nome).join(', ')}`,
      appuntamentoId,
      emailCliente: appuntamento.cliente.email ?? undefined,
      urlRitorno: new URL('/area-cliente?pagamento=riuscito', origine).toString(),
      urlAnnullamento: new URL('/area-cliente?pagamento=annullato', origine).toString(),
      scadeIl,
    });

    await this.prisma.pagamento.create({
      data: {
        appuntamentoId,
        clienteId,
        importoCentesimi: daPagare,
        riferimento: avviato.riferimento,
      },
    });

    return {
      urlPagamento: avviato.urlPagamento,
      importoCentesimi: daPagare,
      scadeIl: scadeIl.toISOString(),
    };
  }

  /** Verifica la firma dell'evento e lo elabora. */
  async riceviEvento(corpo: Buffer, firma: string | undefined): Promise<void> {
    let evento: EventoPagamento;

    try {
      evento = this.fornitore.interpretaEvento(corpo, firma);
    } catch (errore) {
      // Un evento non verificabile non si elabora e non si registra: potrebbe
      // essere un tentativo di confermare un pagamento mai avvenuto.
      this.logger.warn(`Evento di pagamento rifiutato: ${messaggio(errore)}`);
      throw new BadRequestException('Evento non verificabile.');
    }

    await this.elaboraEvento(evento);
  }

  /**
   * Elabora un evento già verificato. La registrazione per identificativo
   * garantisce l'idempotenza: il secondo invio non produce nulla.
   */
  async elaboraEvento(evento: EventoPagamento): Promise<void> {
    try {
      await this.prisma.eventoPagamento.create({ data: { id: evento.id, tipo: evento.tipo } });
    } catch {
      this.logger.log(`Evento ${evento.id} già ricevuto: ignorato.`);

      return;
    }

    let esito = 'ignorato';

    try {
      switch (evento.esito) {
        case 'riuscito':
          esito = await this.registraPagamentoRiuscito(evento);
          break;
        case 'fallito':
          esito = await this.registraPagamentoFallito(evento);
          break;
        case 'scaduto':
          esito = await this.registraPagamentoScaduto(evento);
          break;
        case 'ignorato':
          break;
      }
    } finally {
      await this.prisma.eventoPagamento.update({
        where: { id: evento.id },
        data: { elaboratoIl: new Date(), esito },
      });
    }
  }

  private async registraPagamentoRiuscito(evento: EventoPagamento): Promise<string> {
    const pagamento = await this.trovaPagamento(evento);

    if (!pagamento) {
      return 'pagamento non trovato';
    }

    if (pagamento.stato === 'riuscito') {
      return 'già riuscito';
    }

    // Un importo diverso da quello atteso non conferma l'appuntamento: la
    // caparra deve corrispondere a quella calcolata alla prenotazione.
    if (
      evento.importoCentesimi !== null &&
      evento.importoCentesimi !== pagamento.importoCentesimi
    ) {
      this.logger.error(
        `Importo inatteso sul pagamento ${pagamento.id}: ` +
          `${evento.importoCentesimi} invece di ${pagamento.importoCentesimi}.`,
      );

      return 'importo non corrispondente';
    }

    await this.prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { stato: 'riuscito', erroreFornitore: '' },
    });

    await this.caparra.registra({
      appuntamentoId: pagamento.appuntamentoId,
      clienteId: pagamento.clienteId,
      tipo: 'pagata',
      importoCentesimi: pagamento.importoCentesimi,
      motivo: 'Caparra pagata online alla prenotazione.',
    });

    const confermati = await this.prisma.appuntamento.updateMany({
      where: { id: pagamento.appuntamentoId, stato: 'in_attesa_pagamento' },
      data: { stato: 'confermato', bloccoScadeIl: null },
    });

    if (confermati.count === 0) {
      // Lo slot era già stato liberato: la caparra risulta pagata e va
      // restituita, quindi il salone la vede fra i movimenti da sistemare.
      this.logger.warn(`Pagamento ${pagamento.id} riuscito su un appuntamento non più in attesa.`);

      return 'pagamento riuscito su appuntamento non più in attesa';
    }

    return 'appuntamento confermato';
  }

  private async registraPagamentoFallito(evento: EventoPagamento): Promise<string> {
    const pagamento = await this.trovaPagamento(evento);

    if (!pagamento) {
      return 'pagamento non trovato';
    }

    await this.prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { stato: 'fallito', erroreFornitore: evento.errore },
    });

    // L'appuntamento resta in attesa fino alla scadenza del blocco: il cliente
    // può ritentare con un altro metodo.
    return 'pagamento fallito';
  }

  private async registraPagamentoScaduto(evento: EventoPagamento): Promise<string> {
    const pagamento = await this.trovaPagamento(evento);

    if (pagamento && pagamento.stato === 'avviato') {
      await this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { stato: 'annullato' },
      });
    }

    const appuntamentoId = pagamento?.appuntamentoId ?? evento.appuntamentoId;

    if (!appuntamentoId) {
      return 'nessun appuntamento collegato';
    }

    await this.liberaSlotNonPagato(appuntamentoId);

    return 'slot liberato';
  }

  /**
   * Libera in blocco gli slot il cui tempo di pagamento è finito.
   *
   * Viene chiamata prima di calcolare la disponibilità e prima di occupare uno
   * slot: così la correttezza non dipende dall'attività in background, che
   * resta solo la via tempestiva.
   */
  async liberaBlocchiScaduti(): Promise<void> {
    const scaduti = await this.prisma.appuntamento.findMany({
      where: { stato: 'in_attesa_pagamento', bloccoScadeIl: { lt: new Date() } },
      select: { id: true },
    });

    for (const appuntamento of scaduti) {
      await this.liberaSlotNonPagato(appuntamento.id);
    }
  }

  /**
   * Scadenza del blocco: lo slot torna libero e l'appuntamento risulta
   * annullato per pagamento non completato. Viene chiamata dall'attività in
   * background e dall'evento di scadenza del fornitore, quindi deve essere
   * ripetibile senza effetti.
   */
  async scadiBlocco(appuntamentoId: string): Promise<void> {
    await this.chiudiPagamentiAperti(appuntamentoId);
    await this.liberaSlotNonPagato(appuntamentoId);
  }

  private async liberaSlotNonPagato(appuntamentoId: string): Promise<void> {
    const liberati = await this.prisma.appuntamento.updateMany({
      where: { id: appuntamentoId, stato: 'in_attesa_pagamento' },
      data: {
        stato: 'annullato',
        motivoAnnullamento: 'pagamento_non_completato',
        annullatoIl: new Date(),
        bloccoScadeIl: null,
      },
    });

    if (liberati.count === 0) {
      return;
    }

    this.logger.log(`Appuntamento ${appuntamentoId} annullato: caparra non pagata in tempo.`);
    await this.restituisciCreditoUsato(appuntamentoId);
  }

  /**
   * Se il credito aveva coperto una parte della caparra e il pagamento della
   * differenza non è arrivato, il credito torna al cliente: non ha ricevuto
   * nulla in cambio.
   */
  private async restituisciCreditoUsato(appuntamentoId: string): Promise<void> {
    const appuntamento = await this.prisma.appuntamento.findUnique({
      where: { id: appuntamentoId },
      select: { clienteId: true },
    });
    const pagata = await this.caparra.caparraPagata(appuntamentoId);

    if (!appuntamento || pagata <= 0) {
      return;
    }

    await this.caparra.registra({
      appuntamentoId,
      clienteId: appuntamento.clienteId,
      tipo: 'convertita_in_credito',
      importoCentesimi: pagata,
      motivo: 'Pagamento non completato: il credito usato torna al cliente.',
    });
  }

  /** Chiude presso il fornitore i pagamenti rimasti aperti su un appuntamento. */
  private async chiudiPagamentiAperti(appuntamentoId: string): Promise<void> {
    const aperti = await this.prisma.pagamento.findMany({
      where: { appuntamentoId, stato: 'avviato' },
    });

    for (const pagamento of aperti) {
      await this.fornitore.annulla(pagamento.riferimento);
      await this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { stato: 'annullato' },
      });
    }
  }

  /**
   * Trattamento della caparra quando un appuntamento viene annullato:
   * tempestivo nella forma scelta dal salone, tardivo trattenuto, dal salone
   * sempre rimborsato. Se non è stata pagata nessuna caparra non fa nulla.
   */
  async applicaTrattamentoAnnullamento(parametri: {
    appuntamentoId: string;
    clienteId: string;
    motivo: MotivoAnnullamento;
    autoreId: string | null;
  }): Promise<void> {
    const pagata = await this.caparra.caparraPagata(parametri.appuntamentoId);

    if (pagata <= 0) {
      return;
    }

    const regole = await this.impostazioni.leggiRegole();
    const trattamento = trattamentoDellaCaparra({
      motivo: parametri.motivo,
      forma: regole.restituzioneCaparra,
    });

    if (trattamento === 'nessuno') {
      return;
    }

    if (trattamento === 'rimborsata') {
      await this.rimborsaAlFornitore(parametri.appuntamentoId, pagata);
    }

    await this.caparra.registra({
      appuntamentoId: parametri.appuntamentoId,
      clienteId: parametri.clienteId,
      tipo: trattamento,
      importoCentesimi: pagata,
      motivo: MOTIVI_TRATTAMENTO[trattamento],
      autoreId: parametri.autoreId,
    });
  }

  /** Mancata presentazione: la caparra viene trattenuta. */
  async trattieniPerMancataPresentazione(parametri: {
    appuntamentoId: string;
    clienteId: string;
    autoreId: string;
  }): Promise<void> {
    const pagata = await this.caparra.caparraPagata(parametri.appuntamentoId);

    if (pagata <= 0) {
      return;
    }

    await this.caparra.registra({
      appuntamentoId: parametri.appuntamentoId,
      clienteId: parametri.clienteId,
      tipo: 'trattenuta',
      importoCentesimi: pagata,
      motivo: 'Mancata presentazione del cliente.',
      autoreId: parametri.autoreId,
    });
  }

  /** A servizio concluso la caparra viene scalata dal totale da pagare. */
  async scalaAlCompletamento(parametri: {
    appuntamentoId: string;
    clienteId: string;
    autoreId: string;
  }): Promise<void> {
    const pagata = await this.caparra.caparraPagata(parametri.appuntamentoId);

    if (pagata <= 0) {
      return;
    }

    await this.caparra.registra({
      appuntamentoId: parametri.appuntamentoId,
      clienteId: parametri.clienteId,
      tipo: 'scalata',
      importoCentesimi: pagata,
      motivo: 'Caparra scalata dal totale a servizio concluso.',
      autoreId: parametri.autoreId,
    });
  }

  /**
   * Restituzione discrezionale di una caparra trattenuta: solo il titolare, con
   * motivazione obbligatoria, nella forma che sceglie lui.
   */
  async restituisciInViaDiscrezionale(parametri: {
    appuntamentoId: string;
    forma: FormaRestituzione;
    motivo: string;
    titolareId: string;
  }): Promise<void> {
    const appuntamento = await this.prisma.appuntamento.findUnique({
      where: { id: parametri.appuntamentoId },
      select: { clienteId: true },
    });

    if (!appuntamento) {
      throw new NotFoundException('Appuntamento non trovato.');
    }

    const trattenuta = await this.caparra.trattenuta(parametri.appuntamentoId);

    if (trattenuta <= 0) {
      throw new BadRequestException('Su questo appuntamento non c’è una caparra trattenuta.');
    }

    if (parametri.forma === 'rimborso') {
      await this.rimborsaAlFornitore(parametri.appuntamentoId, trattenuta);
    } else {
      await this.caparra.registraCredito({
        clienteId: appuntamento.clienteId,
        appuntamentoId: parametri.appuntamentoId,
        importoCentesimi: trattenuta,
        motivo: parametri.motivo,
        autoreId: parametri.titolareId,
      });
    }

    await this.caparra.registra({
      appuntamentoId: parametri.appuntamentoId,
      clienteId: appuntamento.clienteId,
      tipo: 'restituita_discrezionale',
      importoCentesimi: trattenuta,
      motivo: parametri.motivo,
      autoreId: parametri.titolareId,
    });
  }

  /** Rimborso presso il fornitore del pagamento riuscito dell'appuntamento. */
  private async rimborsaAlFornitore(appuntamentoId: string, importoCentesimi: number) {
    const pagamento = await this.prisma.pagamento.findFirst({
      where: { appuntamentoId, stato: 'riuscito' },
      orderBy: { creatoIl: 'desc' },
    });

    if (!pagamento) {
      throw new BadRequestException(
        'Non risulta un pagamento riuscito da rimborsare su questo appuntamento.',
      );
    }

    const riferimentoRimborso = await this.fornitore.rimborsa(
      pagamento.riferimento,
      importoCentesimi,
    );

    await this.prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { stato: 'rimborsato', riferimentoRimborso },
    });
  }

  private trovaPagamento(evento: EventoPagamento) {
    if (evento.riferimento) {
      return this.prisma.pagamento.findUnique({ where: { riferimento: evento.riferimento } });
    }

    if (evento.appuntamentoId) {
      return this.prisma.pagamento.findFirst({
        where: { appuntamentoId: evento.appuntamentoId },
        orderBy: { creatoIl: 'desc' },
      });
    }

    return Promise.resolve(null);
  }
}

const MOTIVI_TRATTAMENTO: Readonly<Record<string, string>> = {
  rimborsata: 'Caparra rimborsata per annullamento.',
  convertita_in_credito: 'Caparra convertita in credito per annullamento tempestivo.',
  trattenuta: 'Caparra trattenuta per annullamento tardivo.',
};

function messaggio(errore: unknown): string {
  return errore instanceof Error ? errore.message : 'errore non identificato';
}
