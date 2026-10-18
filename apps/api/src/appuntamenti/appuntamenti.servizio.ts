import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  dataLocale,
  fineGiornoLocale,
  giorniConsecutivi,
  GIORNI_MASSIMI_PRENOTAZIONE,
  GIORNI_PASSATO_PERSONALE,
  inizioGiornoLocale,
  orarioDaMinuti,
  partiData,
  transizioneAmmessa,
  verificaCollocazione,
  type Appuntamento,
  type DatiAnnullamentoDaPersonale,
  type DatiCreazioneAppuntamento,
  type DatiRicercaAgenda,
  type DatiSpostamentoAppuntamento,
  type StatoAppuntamento,
} from '@barber/shared';
import { ClientiServizio } from '../clienti/clienti.servizio.js';
import { NotificheServizio } from '../notifiche/notifiche.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DisponibilitaServizio } from './disponibilita.servizio.js';

const GIORNO_IN_MILLISECONDI = 24 * 60 * 60 * 1000;

/** Dati necessari a comporre la risposta per il frontend. */
const INCLUDI_COLLEGAMENTI = {
  cliente: { select: { id: true, nome: true, cognome: true, numeroWhatsapp: true } },
  operatore: { select: { id: true, nome: true, cognome: true } },
  servizi: { orderBy: { ordine: 'asc' } },
} as const;

@Injectable()
export class AppuntamentiServizio {
  private readonly logger = new Logger(AppuntamentiServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly disponibilita: DisponibilitaServizio,
    private readonly clienti: ClientiServizio,
    private readonly notifiche: NotificheServizio,
  ) {}

  /** Appuntamenti dell'intervallo di giorni richiesto, per l'agenda. */
  async elenca(dati: DatiRicercaAgenda): Promise<Appuntamento[]> {
    if (!partiData(dati.dal)) {
      throw new BadRequestException('Data non valida.');
    }

    const giorni = giorniConsecutivi(dati.dal, dati.giorni);
    const da = inizioGiornoLocale(giorni[0]!)!;
    const a = fineGiornoLocale(giorni.at(-1)!)!;

    const appuntamenti = await this.prisma.appuntamento.findMany({
      where: {
        operatoreId: dati.operatoreId,
        clienteId: dati.clienteId,
        inizio: { lt: a },
        fine: { gt: da },
      },
      orderBy: { inizio: 'asc' },
      include: INCLUDI_COLLEGAMENTI,
    });

    return appuntamenti.map((appuntamento) => this.componi(appuntamento));
  }

  /** Storico del cliente, dal più recente. */
  async elencaPerCliente(clienteId: string, limite = 50): Promise<Appuntamento[]> {
    await this.clienti.leggi(clienteId);

    const appuntamenti = await this.prisma.appuntamento.findMany({
      where: { clienteId },
      orderBy: { inizio: 'desc' },
      take: limite,
      include: INCLUDI_COLLEGAMENTI,
    });

    return appuntamenti.map((appuntamento) => this.componi(appuntamento));
  }

  async leggi(id: string): Promise<Appuntamento> {
    const appuntamento = await this.prisma.appuntamento.findUnique({
      where: { id },
      include: INCLUDI_COLLEGAMENTI,
    });

    if (!appuntamento) {
      throw new NotFoundException('Appuntamento non trovato.');
    }

    return this.componi(appuntamento);
  }

  /**
   * Appuntamento inserito dal personale: nessun preavviso minimo, ma l'orario
   * deve cadere negli orari di lavoro dell'operatore, fuori dalle sue assenze e
   * su uno slot libero. Il flag "senza caparra" è disponibile solo qui.
   */
  async crea(dati: DatiCreazioneAppuntamento, autoreId: string): Promise<Appuntamento> {
    await this.clienti.verificaCliente(dati.clienteId);
    await this.disponibilita.verificaOperatore(dati.operatoreId);

    const scelti = await this.disponibilita.leggiServiziScelti(dati.operatoreId, dati.servizioIds);
    const inizio = new Date(dati.inizio);

    this.verificaLimitiDiData(inizio);
    await this.verificaSlotLibero(dati.operatoreId, inizio, scelti.durataMinuti);

    const fine = new Date(inizio.getTime() + scelti.durataMinuti * 60_000);

    try {
      const creato = await this.prisma.appuntamento.create({
        data: {
          clienteId: dati.clienteId,
          operatoreId: dati.operatoreId,
          inizio,
          fine,
          durataMinuti: scelti.durataMinuti,
          prezzoTotaleCentesimi: scelti.prezzoTotaleCentesimi,
          // Finché la caparra non è attiva (fase 6) l'appuntamento inserito dal
          // personale nasce già confermato.
          stato: 'confermato',
          senzaCaparra: dati.senzaCaparra,
          note: dati.note,
          creatoDaId: autoreId,
          servizi: {
            create: scelti.servizi.map((servizio, indice) => ({
              servizioId: servizio.servizioId,
              nome: servizio.nome,
              prezzoCentesimi: servizio.prezzoCentesimi,
              durataMinuti: servizio.durataMinuti,
              ordine: indice,
            })),
          },
        },
        include: INCLUDI_COLLEGAMENTI,
      });

      await this.inviaConferma(creato);

      return this.componi(creato);
    } catch (errore) {
      throw this.traduciErroreDiSovrapposizione(errore);
    }
  }

  /** Conferma al cliente, se ha un indirizzo e-mail. */
  private async inviaConferma(appuntamento: {
    inizio: Date;
    durataMinuti: number;
    prezzoTotaleCentesimi: number;
    cliente: { nome: string };
    operatore: { nome: string; cognome: string };
    servizi: { nome: string }[];
    clienteId: string;
  }): Promise<void> {
    const cliente = await this.prisma.utente.findUnique({
      where: { id: appuntamento.clienteId },
      select: { email: true },
    });

    if (!cliente?.email) {
      return;
    }

    await this.notifiche.inviaConfermaPrenotazione(
      { nome: appuntamento.cliente.nome, email: cliente.email },
      appuntamento,
    );
  }

  /**
   * Spostamento registrato dal personale: la durata resta quella dei servizi
   * già scelti, l'operatore può cambiare solo se abilitato a tutti.
   */
  async sposta(
    id: string,
    dati: DatiSpostamentoAppuntamento,
    autoreId: string,
  ): Promise<Appuntamento> {
    const appuntamento = await this.prisma.appuntamento.findUnique({
      where: { id },
      include: { servizi: true },
    });

    if (!appuntamento) {
      throw new NotFoundException('Appuntamento non trovato.');
    }

    if (appuntamento.stato !== 'confermato' && appuntamento.stato !== 'in_attesa_pagamento') {
      throw new BadRequestException(
        'Si possono spostare solo gli appuntamenti confermati o in attesa di pagamento.',
      );
    }

    const operatoreId = dati.operatoreId ?? appuntamento.operatoreId;
    const inizio = new Date(dati.inizio);

    this.verificaLimitiDiData(inizio);

    if (operatoreId !== appuntamento.operatoreId) {
      await this.disponibilita.verificaOperatore(operatoreId);
      const serviziAncoraInCatalogo = appuntamento.servizi
        .map((servizio) => servizio.servizioId)
        .filter((servizioId): servizioId is string => servizioId !== null);

      // Il nuovo operatore deve essere abilitato a tutti i servizi scelti.
      await this.disponibilita.leggiServiziScelti(operatoreId, serviziAncoraInCatalogo);
    }

    await this.verificaSlotLibero(operatoreId, inizio, appuntamento.durataMinuti, id);

    try {
      const aggiornato = await this.prisma.appuntamento.update({
        where: { id },
        data: {
          operatoreId,
          inizio,
          fine: new Date(inizio.getTime() + appuntamento.durataMinuti * 60_000),
        },
        include: INCLUDI_COLLEGAMENTI,
      });

      this.logger.log(`Appuntamento ${id} spostato da ${autoreId}.`);

      return this.componi(aggiornato);
    } catch (errore) {
      throw this.traduciErroreDiSovrapposizione(errore);
    }
  }

  /**
   * Annullamento registrato dal personale, che indica se l'avviso del cliente è
   * stato tempestivo o tardivo. Il trattamento della caparra arriva nella
   * fase 6: qui vengono tracciati motivo, autore e momento.
   */
  async annulla(
    id: string,
    dati: DatiAnnullamentoDaPersonale,
    autoreId: string,
  ): Promise<Appuntamento> {
    const appuntamento = await this.cambiaStato(id, 'annullato', autoreId, {
      motivoAnnullamento: dati.motivo,
      annullatoDaId: autoreId,
      annullatoIl: new Date(),
      noteAnnullamento: dati.note,
    });

    this.logger.log(`Appuntamento ${id} annullato (${dati.motivo}) da ${autoreId}.`);

    return appuntamento;
  }

  /** La mancata presentazione la segna il personale: lo slot resta occupato. */
  segnaMancataPresentazione(id: string, autoreId: string): Promise<Appuntamento> {
    return this.cambiaStato(id, 'mancata_presentazione', autoreId);
  }

  /** Il completamento è sempre manuale: nessun automatismo a fine orario. */
  completa(id: string, autoreId: string): Promise<Appuntamento> {
    return this.cambiaStato(id, 'completato', autoreId, { completatoIl: new Date() });
  }

  private async cambiaStato(
    id: string,
    nuovo: StatoAppuntamento,
    autoreId: string,
    datiAggiuntivi: Record<string, unknown> = {},
  ): Promise<Appuntamento> {
    const appuntamento = await this.prisma.appuntamento.findUnique({ where: { id } });

    if (!appuntamento) {
      throw new NotFoundException('Appuntamento non trovato.');
    }

    if (!transizioneAmmessa(appuntamento.stato, nuovo)) {
      throw new BadRequestException(
        `Un appuntamento ${appuntamento.stato.replace(/_/g, ' ')} non può passare a ` +
          `${nuovo.replace(/_/g, ' ')}.`,
      );
    }

    const aggiornato = await this.prisma.appuntamento.update({
      where: { id },
      data: { stato: nuovo, ...datiAggiuntivi },
      include: INCLUDI_COLLEGAMENTI,
    });

    this.logger.log(`Appuntamento ${id}: stato ${nuovo} impostato da ${autoreId}.`);

    return this.componi(aggiornato);
  }

  /**
   * Il personale può regolarizzare l'agenda inserendo un appuntamento già
   * avvenuto, ma solo nel passato recente; in avanti vale il limite dei
   * 60 giorni valido anche per i clienti.
   */
  private verificaLimitiDiData(inizio: Date): void {
    const adesso = Date.now();

    if (inizio.getTime() < adesso - GIORNI_PASSATO_PERSONALE * GIORNO_IN_MILLISECONDI) {
      throw new BadRequestException(
        `Si possono registrare appuntamenti passati solo degli ultimi ${GIORNI_PASSATO_PERSONALE} giorni.`,
      );
    }

    if (inizio.getTime() > adesso + GIORNI_MASSIMI_PRENOTAZIONE * GIORNO_IN_MILLISECONDI) {
      throw new BadRequestException(
        `Si può prenotare al massimo ${GIORNI_MASSIMI_PRENOTAZIONE} giorni in avanti.`,
      );
    }
  }

  /**
   * Controllo applicativo: orari di lavoro, assenze, allineamento alla
   * granularità e sovrapposizioni. Il vincolo di esclusione del database
   * resta l'ultima difesa in caso di richieste simultanee.
   */
  private async verificaSlotLibero(
    operatoreId: string,
    inizio: Date,
    durataMinuti: number,
    escludiAppuntamentoId?: string,
  ): Promise<void> {
    const giorno = dataLocale(inizio);
    const fine = new Date(inizio.getTime() + durataMinuti * 60_000);
    const [fasceLavoro, occupazioni, granularitaMinuti] = await Promise.all([
      this.disponibilita.fasceLavoro(operatoreId, giorno),
      this.disponibilita.occupazioni(operatoreId, inizio, fine, escludiAppuntamentoId),
      this.disponibilita.granularitaSlot(),
    ]);

    const esito = verificaCollocazione({
      inizio,
      durataMinuti,
      granularitaMinuti,
      fasceLavoro,
      occupazioni,
    });

    if (esito.esito === 'fuori_orario') {
      const orari = fasceLavoro
        .map(
          (fascia) => `${orarioDaMinuti(fascia.minutoInizio)}–${orarioDaMinuti(fascia.minutoFine)}`,
        )
        .join(', ');

      throw new BadRequestException(
        orari
          ? `In questo giorno l’operatore lavora ${orari}: l’appuntamento non ci rientra.`
          : 'In questo giorno l’operatore non lavora.',
      );
    }

    if (esito.esito === 'non_allineato') {
      throw new BadRequestException(
        `L’orario deve essere allineato agli slot di ${granularitaMinuti} minuti.`,
      );
    }

    if (esito.esito === 'occupato') {
      throw new ConflictException(
        'In quell’orario l’operatore ha già un appuntamento o è assente.',
      );
    }
  }

  /**
   * Due richieste simultanee possono superare entrambe il controllo
   * applicativo: il vincolo di esclusione del database ne lascia passare una
   * sola. La seconda riceve la violazione del vincolo (23P01) oppure, se le due
   * transazioni si incrociano, un conflitto di scrittura (P2034): in questa
   * tabella l'unica causa possibile è la sovrapposizione.
   */
  private traduciErroreDiSovrapposizione(errore: unknown): unknown {
    const messaggio = (errore as { message?: string }).message ?? '';
    const codice = (errore as { code?: string }).code ?? '';

    if (
      messaggio.includes('appuntamenti_senza_sovrapposizioni') ||
      messaggio.includes('23P01') ||
      codice === 'P2034'
    ) {
      this.logger.warn('Prenotazione simultanea sullo stesso slot rifiutata dal database.');

      return new ConflictException(
        'Quell’orario è stato appena occupato da un altro appuntamento. Scegline un altro.',
      );
    }

    return errore;
  }

  private componi(riga: {
    id: string;
    stato: StatoAppuntamento;
    motivoAnnullamento: string | null;
    cliente: { id: string; nome: string; cognome: string; numeroWhatsapp: string | null };
    operatore: { id: string; nome: string; cognome: string };
    inizio: Date;
    fine: Date;
    durataMinuti: number;
    prezzoTotaleCentesimi: number;
    senzaCaparra: boolean;
    note: string;
    creatoDaId: string | null;
    creatoIl: Date;
    servizi: {
      servizioId: string | null;
      nome: string;
      prezzoCentesimi: number;
      durataMinuti: number;
    }[];
  }): Appuntamento {
    return {
      id: riga.id,
      stato: riga.stato,
      motivoAnnullamento: riga.motivoAnnullamento as Appuntamento['motivoAnnullamento'],
      cliente: {
        id: riga.cliente.id,
        nome: riga.cliente.nome,
        cognome: riga.cliente.cognome,
        numeroWhatsapp: riga.cliente.numeroWhatsapp,
      },
      operatore: {
        id: riga.operatore.id,
        nome: riga.operatore.nome,
        cognome: riga.operatore.cognome,
      },
      inizio: riga.inizio.toISOString(),
      fine: riga.fine.toISOString(),
      durataMinuti: riga.durataMinuti,
      prezzoTotaleCentesimi: riga.prezzoTotaleCentesimi,
      senzaCaparra: riga.senzaCaparra,
      note: riga.note,
      servizi: riga.servizi.map((servizio) => ({
        servizioId: servizio.servizioId,
        nome: servizio.nome,
        prezzoCentesimi: servizio.prezzoCentesimi,
        durataMinuti: servizio.durataMinuti,
      })),
      creatoDaPersonale: riga.creatoDaId !== null,
      creatoIl: riga.creatoIl.toISOString(),
    };
  }
}
