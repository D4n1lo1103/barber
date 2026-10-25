import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  CONSEGNE_DISPONIBILI,
  ETICHETTE_STATO_ORDINE,
  MINIMO_PAGABILE_CENTESIMI,
  MINUTI_BLOCCO_ORDINE_PREDEFINITO,
  importiOrdine,
  recessoAperto,
  scadenzaRecesso,
  transizioneOrdineAmmessa,
  type DatiAnnullamentoOrdine,
  type DatiAvanzamentoOrdine,
  type DatiCreazioneOrdine,
  type DatiRicercaOrdini,
  type ElencoOrdini,
  type Ordine,
  type OrdineCreato,
  type StatoOrdine,
} from '@barber/shared';
import { CaparraServizio } from '../pagamenti/caparra.servizio.js';
import { PagamentiServizio } from '../pagamenti/pagamenti.servizio.js';
import {
  RegistroGestoriPagamento,
  type GestorePagamento,
} from '../pagamenti/registro-gestori.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScadenzaOrdiniAttivita } from './scadenza-ordini.attivita.js';

/** Dati inclusi per comporre la risposta di un ordine. */
const INCLUDI = {
  righe: { orderBy: { nome: 'asc' } },
  cliente: { select: { id: true, nome: true, cognome: true } },
  resi: {
    orderBy: { richiestoIl: 'desc' },
    include: {
      righe: { include: { rigaOrdine: { select: { nome: true } } } },
      decisaDa: { select: { nome: true, cognome: true } },
    },
  },
} as const;

/**
 * Ordini di prodotti acquistati online.
 *
 * Due regole guidano il servizio:
 *
 * 1. **La giacenza si prenota alla creazione**, non al pagamento. Finché
 *    l'ordine è `in_attesa_pagamento` i pezzi sono già scaricati, così non
 *    possono essere venduti anche al banco. Se il pagamento non arriva entro
 *    il blocco, l'ordine viene annullato e i pezzi tornano disponibili.
 * 2. **Lo stato del pagamento è definitivo solo dopo l'evento firmato** del
 *    fornitore: il ritorno del browser non conferma nulla.
 *
 * L'ordine non produce documenti fiscali: gli obblighi della vendita online
 * sono ancora da definire con il commercialista.
 */
@Injectable()
export class OrdiniServizio implements GestorePagamento, OnModuleInit {
  private readonly logger = new Logger(OrdiniServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagamenti: PagamentiServizio,
    private readonly caparra: CaparraServizio,
    private readonly registro: RegistroGestoriPagamento,
    private readonly scadenza: ScadenzaOrdiniAttivita,
  ) {}

  /**
   * Si registra come gestore dei pagamenti di tipo «ordine» e come esecutore
   * della scadenza del blocco.
   *
   * La dipendenza resta in una sola direzione: gli ordini conoscono i
   * pagamenti e la coda, non il contrario.
   */
  async onModuleInit(): Promise<void> {
    this.registro.registra('ordine', this);
    await this.scadenza.registraGestore(async (ordineId) => {
      await this.annullaNonPagato(ordineId);
    });
  }

  /** Vero quando il titolare ha attivato la vendita online in installazione. */
  async venditaOnlineAttiva(): Promise<boolean> {
    const installazione = await this.prisma.installazione.findFirst({
      select: { venditaOnlineAttiva: true },
    });

    return installazione?.venditaOnlineAttiva ?? false;
  }

  private async esigiVenditaOnlineAttiva(): Promise<void> {
    if (!(await this.venditaOnlineAttiva())) {
      throw new ForbiddenException('La vendita online non è attiva in questo salone.');
    }
  }

  private async minutiBlocco(): Promise<number> {
    const installazione = await this.prisma.installazione.findFirst({
      select: { minutiBloccoOrdine: true },
    });

    return installazione?.minutiBloccoOrdine ?? MINUTI_BLOCCO_ORDINE_PREDEFINITO;
  }

  /**
   * Crea un ordine: prenota la giacenza, scala il credito e apre il pagamento
   * del residuo.
   *
   * Prenotazione e creazione avvengono nella **stessa transazione**, con
   * aggiornamento condizionato sulla giacenza: due clienti che comprano
   * nello stesso istante l'ultimo pezzo non possono riuscirci entrambi.
   */
  async crea(dati: DatiCreazioneOrdine, clienteId: string): Promise<OrdineCreato> {
    await this.esigiVenditaOnlineAttiva();
    await this.scadiOrdiniNonPagati();

    if (!CONSEGNE_DISPONIBILI.includes(dati.tipoConsegna)) {
      throw new BadRequestException(
        'La spedizione a domicilio non è ancora disponibile: scegli il ritiro in negozio.',
      );
    }

    const prodotti = await this.prisma.prodotto.findMany({
      where: { id: { in: dati.righe.map((riga) => riga.prodottoId) } },
    });

    if (prodotti.length !== dati.righe.length) {
      throw new NotFoundException('Uno dei prodotti scelti non esiste.');
    }

    const righe = dati.righe.map((riga) => {
      const prodotto = prodotti.find((candidato) => candidato.id === riga.prodottoId)!;

      if (!prodotto.attivo) {
        throw new BadRequestException(`Il prodotto «${prodotto.nome}» non è più in vendita.`);
      }

      if (prodotto.giacenza < riga.quantita) {
        throw new ConflictException(
          prodotto.giacenza === 0
            ? `«${prodotto.nome}» è esaurito.`
            : `Di «${prodotto.nome}» restano ${prodotto.giacenza} pezzi.`,
        );
      }

      // Nome e prezzo vengono copiati: il listino può cambiare domani.
      return {
        prodottoId: prodotto.id,
        nome: prodotto.nome,
        prezzoCentesimi: prodotto.prezzoCentesimi,
        quantita: riga.quantita,
      };
    });

    const saldoCredito = dati.usaCredito ? await this.caparra.saldoCredito(clienteId) : 0;
    const importi = importiOrdine({ righe, saldoCredito });

    // Un residuo sotto il minimo del fornitore verrebbe rifiutato: l'ordine
    // non si apre, invece di arenarsi in attesa di un pagamento impossibile.
    if (importi.daPagareCentesimi > 0 && importi.daPagareCentesimi < MINIMO_PAGABILE_CENTESIMI) {
      throw new BadRequestException(
        'L’importo dell’ordine è troppo basso per essere pagato online.',
      );
    }

    const scadeIl = new Date(Date.now() + (await this.minutiBlocco()) * 60_000);

    const creato = await this.prisma.$transaction(async (transazione) => {
      const ordine = await transazione.ordine.create({
        data: {
          clienteId,
          tipoConsegna: dati.tipoConsegna,
          totaleRigheCentesimi: importi.totaleRigheCentesimi,
          speseConsegnaCentesimi: importi.speseConsegnaCentesimi,
          creditoUsatoCentesimi: importi.creditoUsatoCentesimi,
          daPagareCentesimi: importi.daPagareCentesimi,
          note: dati.note,
          bloccoScadeIl: scadeIl,
          righe: { create: righe },
        },
      });

      for (const riga of righe) {
        // Aggiornamento condizionato: se nel frattempo la giacenza è scesa,
        // nessuna riga viene toccata e l'ordine non si chiude.
        const esito = await transazione.prodotto.updateMany({
          where: { id: riga.prodottoId, giacenza: { gte: riga.quantita } },
          data: { giacenza: { decrement: riga.quantita } },
        });

        if (esito.count === 0) {
          throw new ConflictException(
            `Di «${riga.nome}» non ci sono più abbastanza pezzi: qualcuno li ha presi ora.`,
          );
        }

        const prodotto = await transazione.prodotto.findUniqueOrThrow({
          where: { id: riga.prodottoId },
          select: { giacenza: true },
        });

        await transazione.movimentoMagazzino.create({
          data: {
            prodottoId: riga.prodottoId,
            causa: 'prenotazione_ordine',
            quantita: -riga.quantita,
            giacenzaFinale: prodotto.giacenza,
            motivo: `Ordine online numero ${ordine.numero}.`,
            ordineId: ordine.id,
          },
        });
      }

      if (importi.creditoUsatoCentesimi > 0) {
        await transazione.movimentoCredito.create({
          data: {
            clienteId,
            ordineId: ordine.id,
            importoCentesimi: -importi.creditoUsatoCentesimi,
            motivo: `Credito usato per l’ordine numero ${ordine.numero}.`,
          },
        });
      }

      return ordine;
    });

    this.logger.log(
      `Ordine ${creato.numero} creato: ${righe.length} prodotti, ` +
        `${importi.daPagareCentesimi} centesimi da pagare.`,
    );

    await this.scadenza.programma(creato.id, scadeIl);

    // Il credito copre tutto: non c'è nulla da pagare, l'ordine si conferma
    // subito perché nessun evento del fornitore arriverà mai.
    if (importi.daPagareCentesimi === 0) {
      await this.confermaPagamento(creato.id, 0);

      return { ordine: await this.leggi(creato.id), pagamento: null };
    }

    const cliente = await this.prisma.utente.findUnique({
      where: { id: clienteId },
      select: { email: true },
    });

    const pagamento = await this.pagamenti.avviaPagamentoOrdine({
      ordineId: creato.id,
      clienteId,
      importoCentesimi: importi.daPagareCentesimi,
      descrizione: `Ordine numero ${creato.numero}`,
      emailCliente: cliente?.email ?? undefined,
      scadeIl,
    });

    return { ordine: await this.leggi(creato.id), pagamento };
  }

  /** Pagamento confermato dall'evento firmato: l'ordine passa a `pagato`. */
  async pagamentoRiuscito(parametri: {
    oggettoId: string;
    importoCentesimi: number;
  }): Promise<string> {
    return this.confermaPagamento(parametri.oggettoId, parametri.importoCentesimi);
  }

  /**
   * Pagamento rifiutato: l'ordine resta in attesa fino alla scadenza del
   * blocco, così il cliente può ritentare con un altro metodo.
   */
  pagamentoFallito(parametri: { oggettoId: string; errore: string }): Promise<string> {
    this.logger.warn(`Pagamento rifiutato sull'ordine ${parametri.oggettoId}.`);

    return Promise.resolve('pagamento fallito, ordine ancora in attesa');
  }

  /** Pagamento scaduto o abbandonato: la giacenza torna disponibile. */
  async pagamentoScaduto(parametri: { oggettoId: string }): Promise<string> {
    const annullato = await this.annullaNonPagato(parametri.oggettoId);

    return annullato ? 'ordine annullato e giacenza rilasciata' : 'ordine non più in attesa';
  }

  private async confermaPagamento(ordineId: string, importoCentesimi: number): Promise<string> {
    const ordine = await this.prisma.ordine.findUnique({
      where: { id: ordineId },
      select: { stato: true, daPagareCentesimi: true, numero: true },
    });

    if (!ordine) {
      return 'ordine non trovato';
    }

    if (ordine.stato !== 'in_attesa_pagamento') {
      return `ordine già in stato ${ordine.stato}`;
    }

    // Un importo diverso da quello atteso non conferma l'ordine.
    if (importoCentesimi > 0 && importoCentesimi !== ordine.daPagareCentesimi) {
      this.logger.error(
        `Importo inatteso sull'ordine ${ordine.numero}: ` +
          `${importoCentesimi} invece di ${ordine.daPagareCentesimi}.`,
      );

      return 'importo non corrispondente';
    }

    const confermati = await this.prisma.ordine.updateMany({
      where: { id: ordineId, stato: 'in_attesa_pagamento' },
      data: { stato: 'pagato', pagatoIl: new Date(), bloccoScadeIl: null },
    });

    if (confermati.count === 0) {
      return 'ordine non più in attesa';
    }

    this.logger.log(`Ordine ${ordine.numero} pagato.`);

    return 'ordine pagato';
  }

  /**
   * Scadenza del blocco: l'ordine non pagato viene annullato e i pezzi
   * tornano disponibili. Ripetibile senza effetti: la chiamano l'attività in
   * background, l'evento del fornitore e la creazione di ogni nuovo ordine.
   */
  async annullaNonPagato(ordineId: string): Promise<boolean> {
    const annullato = await this.annulla({
      ordineId,
      motivo: 'Pagamento non completato entro il tempo previsto.',
      autoreId: null,
      soloSeInAttesa: true,
    });

    if (annullato) {
      await this.pagamenti.chiudiPagamentiApertiOrdine(ordineId);
    }

    return annullato;
  }

  /**
   * Annulla in blocco gli ordini il cui tempo di pagamento è finito.
   *
   * Viene chiamata prima di creare un ordine e prima di mostrare il catalogo:
   * così la giacenza mostrata è corretta anche se l'attività in background
   * non è passata.
   */
  async scadiOrdiniNonPagati(): Promise<void> {
    const scaduti = await this.prisma.ordine.findMany({
      where: { stato: 'in_attesa_pagamento', bloccoScadeIl: { lt: new Date() } },
      select: { id: true },
    });

    for (const ordine of scaduti) {
      await this.annullaNonPagato(ordine.id);
    }
  }

  /**
   * Annullamento di un ordine: la giacenza prenotata torna disponibile, il
   * credito speso torna al cliente e quanto pagato con carta viene rimborsato.
   *
   * Restituisce falso quando non c'era nulla da annullare, così chi la chiama
   * può distinguere una corsa fra due richieste da un errore.
   */
  private async annulla(parametri: {
    ordineId: string;
    motivo: string;
    autoreId: string | null;
    soloSeInAttesa?: boolean;
  }): Promise<boolean> {
    const stati: StatoOrdine[] = parametri.soloSeInAttesa
      ? ['in_attesa_pagamento']
      : ['in_attesa_pagamento', 'pagato', 'in_preparazione', 'pronto_per_ritiro', 'spedito'];

    const ordine = await this.prisma.ordine.findUnique({
      where: { id: parametri.ordineId },
      include: { righe: true },
    });

    if (!ordine) {
      throw new NotFoundException('Ordine non trovato.');
    }

    if (!stati.includes(ordine.stato)) {
      return false;
    }

    const rilasciato = await this.prisma.$transaction(async (transazione) => {
      const esito = await transazione.ordine.updateMany({
        where: { id: parametri.ordineId, stato: { in: stati } },
        data: {
          stato: 'annullato',
          annullatoIl: new Date(),
          annullatoDaId: parametri.autoreId,
          motivoAnnullamento: parametri.motivo,
          bloccoScadeIl: null,
        },
      });

      if (esito.count === 0) {
        return false;
      }

      for (const riga of ordine.righe) {
        if (!riga.prodottoId) {
          // Prodotto eliminato dal catalogo: non c'è giacenza da ripristinare.
          continue;
        }

        const prodotto = await transazione.prodotto.update({
          where: { id: riga.prodottoId },
          data: { giacenza: { increment: riga.quantita } },
        });

        await transazione.movimentoMagazzino.create({
          data: {
            prodottoId: riga.prodottoId,
            causa: 'rilascio_ordine',
            quantita: riga.quantita,
            giacenzaFinale: prodotto.giacenza,
            motivo: parametri.motivo,
            ordineId: ordine.id,
            autoreId: parametri.autoreId,
          },
        });
      }

      // Il credito speso torna al cliente: non ha ricevuto nulla in cambio.
      if (ordine.creditoUsatoCentesimi > 0) {
        await transazione.movimentoCredito.create({
          data: {
            clienteId: ordine.clienteId,
            ordineId: ordine.id,
            importoCentesimi: ordine.creditoUsatoCentesimi,
            motivo: `Ordine numero ${ordine.numero} annullato: il credito usato torna al cliente.`,
            autoreId: parametri.autoreId,
          },
        });
      }

      return true;
    });

    if (!rilasciato) {
      return false;
    }

    this.logger.log(`Ordine ${ordine.numero} annullato: ${parametri.motivo}`);

    // Il rimborso di quanto pagato con carta avviene fuori dalla transazione:
    // una chiamata al fornitore non va tenuta dentro una transazione aperta.
    const pagato = await this.pagamenti.pagatoConCartaSullOrdine(parametri.ordineId);

    if (pagato > 0) {
      try {
        await this.pagamenti.rimborsaOrdine(parametri.ordineId, pagato);
        await this.prisma.ordine.update({
          where: { id: parametri.ordineId },
          data: { stato: 'rimborsato' },
        });
      } catch (errore) {
        // L'ordine resta annullato e il rimborso va ripreso a mano: il
        // titolare lo vede dallo stato, che non è passato a «rimborsato».
        this.logger.error(
          `Rimborso non riuscito sull'ordine ${ordine.numero}: ` +
            (errore instanceof Error ? errore.message : 'errore non identificato'),
        );
      }
    }

    return true;
  }

  /** Annullamento registrato dal personale, con motivo obbligatorio. */
  async annullaDalPersonale(
    ordineId: string,
    dati: DatiAnnullamentoOrdine,
    autoreId: string,
  ): Promise<Ordine> {
    const annullato = await this.annulla({
      ordineId,
      motivo: dati.motivo,
      autoreId,
    });

    if (!annullato) {
      throw new ConflictException('Questo ordine non si può più annullare.');
    }

    return this.leggi(ordineId);
  }

  /** Annullamento chiesto dal cliente, finché l'ordine non è pronto. */
  async annullaDalCliente(ordineId: string, clienteId: string): Promise<Ordine> {
    const ordine = await this.prisma.ordine.findUnique({
      where: { id: ordineId },
      select: { clienteId: true, stato: true },
    });

    if (!ordine || ordine.clienteId !== clienteId) {
      throw new NotFoundException('Ordine non trovato.');
    }

    // Una volta preparato o pronto per il ritiro l'annullamento passa dal
    // salone: la merce è già stata messa da parte.
    if (ordine.stato !== 'in_attesa_pagamento' && ordine.stato !== 'pagato') {
      throw new ConflictException(
        'L’ordine è già in preparazione: contatta il salone per annullarlo.',
      );
    }

    const annullato = await this.annulla({
      ordineId,
      motivo: 'Annullato dal cliente.',
      autoreId: clienteId,
    });

    if (!annullato) {
      throw new ConflictException('Questo ordine non si può più annullare.');
    }

    return this.leggi(ordineId);
  }

  /** Avanzamento dell'ordine da parte del personale. */
  async avanza(
    ordineId: string,
    dati: DatiAvanzamentoOrdine,
    autoreId: string,
  ): Promise<Ordine> {
    const ordine = await this.prisma.ordine.findUnique({
      where: { id: ordineId },
      select: { stato: true, numero: true },
    });

    if (!ordine) {
      throw new NotFoundException('Ordine non trovato.');
    }

    if (!transizioneOrdineAmmessa(ordine.stato, dati.stato)) {
      throw new ConflictException(
        `Un ordine «${ETICHETTE_STATO_ORDINE[ordine.stato]}» non può passare a ` +
          `«${ETICHETTE_STATO_ORDINE[dati.stato]}».`,
      );
    }

    const adesso = new Date();
    const aggiornati = await this.prisma.ordine.updateMany({
      where: { id: ordineId, stato: ordine.stato },
      data: {
        stato: dati.stato,
        prontoIl: dati.stato === 'pronto_per_ritiro' ? adesso : undefined,
        consegnatoIl: dati.stato === 'consegnato' ? adesso : undefined,
      },
    });

    if (aggiornati.count === 0) {
      throw new ConflictException('L’ordine è cambiato nel frattempo: ricarica la pagina.');
    }

    this.logger.log(`Ordine ${ordine.numero} passato a ${dati.stato} da ${autoreId}.`);

    return this.leggi(ordineId);
  }

  async leggi(id: string): Promise<Ordine> {
    const ordine = await this.prisma.ordine.findUnique({ where: { id }, include: INCLUDI });

    if (!ordine) {
      throw new NotFoundException('Ordine non trovato.');
    }

    return componiOrdine(ordine);
  }

  /** Lettura da parte del cliente: solo i propri ordini. */
  async leggiDelCliente(id: string, clienteId: string): Promise<Ordine> {
    const ordine = await this.prisma.ordine.findFirst({
      where: { id, clienteId },
      include: INCLUDI,
    });

    if (!ordine) {
      throw new NotFoundException('Ordine non trovato.');
    }

    return componiOrdine(ordine);
  }

  async elenca(dati: DatiRicercaOrdini): Promise<ElencoOrdini> {
    await this.scadiOrdiniNonPagati();

    const where = {
      ...(dati.stato ? { stato: dati.stato } : {}),
      ...(dati.clienteId ? { clienteId: dati.clienteId } : {}),
    };

    const [ordini, totale] = await Promise.all([
      this.prisma.ordine.findMany({
        where,
        orderBy: { creatoIl: 'desc' },
        skip: (dati.pagina - 1) * dati.perPagina,
        take: dati.perPagina,
        include: INCLUDI,
      }),
      this.prisma.ordine.count({ where }),
    ]);

    return {
      ordini: ordini.map((ordine) => componiOrdine(ordine)),
      totale,
      pagina: dati.pagina,
      perPagina: dati.perPagina,
    };
  }

  /** Ordini del cliente che ha fatto la richiesta. */
  async elencaDelCliente(clienteId: string): Promise<Ordine[]> {
    await this.scadiOrdiniNonPagati();

    const ordini = await this.prisma.ordine.findMany({
      where: { clienteId },
      orderBy: { creatoIl: 'desc' },
      include: INCLUDI,
    });

    return ordini.map((ordine) => componiOrdine(ordine));
  }
}

type RigaResaLetta = {
  rigaOrdineId: string;
  quantita: number;
  rigaOrdine: { nome: string };
};

/** Compone la risposta di un ordine a partire dalla riga del database. */
export function componiOrdine(ordine: {
  id: string;
  numero: number;
  stato: StatoOrdine;
  tipoConsegna: 'ritiro_in_negozio' | 'spedizione';
  totaleRigheCentesimi: number;
  speseConsegnaCentesimi: number;
  creditoUsatoCentesimi: number;
  daPagareCentesimi: number;
  note: string;
  bloccoScadeIl: Date | null;
  pagatoIl: Date | null;
  prontoIl: Date | null;
  consegnatoIl: Date | null;
  annullatoIl: Date | null;
  motivoAnnullamento: string;
  creatoIl: Date;
  righe: { id: string; prodottoId: string | null; nome: string; prezzoCentesimi: number; quantita: number }[];
  cliente: { id: string; nome: string; cognome: string } | null;
  resi: {
    id: string;
    stato: 'richiesto' | 'approvato' | 'rifiutato' | 'rimborsato';
    motivoCliente: string;
    motivoRifiuto: string;
    importoRimborsoCentesimi: number;
    creditoRestituitoCentesimi: number;
    richiestoIl: Date;
    decisoIl: Date | null;
    rimborsatoIl: Date | null;
    righe: RigaResaLetta[];
    decisaDa: { nome: string; cognome: string } | null;
  }[];
}): Ordine {
  const adesso = new Date();

  // Pezzi già impegnati in un reso: un rifiuto li libera, una richiesta in
  // corso o già rimborsata no.
  const resePerRiga = new Map<string, number>();

  for (const reso of ordine.resi) {
    if (reso.stato === 'rifiutato') {
      continue;
    }

    for (const riga of reso.righe) {
      resePerRiga.set(riga.rigaOrdineId, (resePerRiga.get(riga.rigaOrdineId) ?? 0) + riga.quantita);
    }
  }

  return {
    id: ordine.id,
    numero: ordine.numero,
    stato: ordine.stato,
    tipoConsegna: ordine.tipoConsegna,
    righe: ordine.righe.map((riga) => ({
      id: riga.id,
      prodottoId: riga.prodottoId,
      nome: riga.nome,
      prezzoCentesimi: riga.prezzoCentesimi,
      quantita: riga.quantita,
      quantitaResa: resePerRiga.get(riga.id) ?? 0,
    })),
    totaleRigheCentesimi: ordine.totaleRigheCentesimi,
    speseConsegnaCentesimi: ordine.speseConsegnaCentesimi,
    creditoUsatoCentesimi: ordine.creditoUsatoCentesimi,
    daPagareCentesimi: ordine.daPagareCentesimi,
    note: ordine.note,
    cliente: ordine.cliente,
    bloccoScadeIl: ordine.bloccoScadeIl?.toISOString() ?? null,
    pagatoIl: ordine.pagatoIl?.toISOString() ?? null,
    prontoIl: ordine.prontoIl?.toISOString() ?? null,
    consegnatoIl: ordine.consegnatoIl?.toISOString() ?? null,
    annullatoIl: ordine.annullatoIl?.toISOString() ?? null,
    motivoAnnullamento: ordine.motivoAnnullamento,
    resi: ordine.resi.map((reso) => ({
      id: reso.id,
      stato: reso.stato,
      righe: reso.righe.map((riga) => ({
        rigaOrdineId: riga.rigaOrdineId,
        nome: riga.rigaOrdine.nome,
        quantita: riga.quantita,
      })),
      motivoCliente: reso.motivoCliente,
      motivoRifiuto: reso.motivoRifiuto,
      importoRimborsoCentesimi: reso.importoRimborsoCentesimi,
      creditoRestituitoCentesimi: reso.creditoRestituitoCentesimi,
      richiestoIl: reso.richiestoIl.toISOString(),
      decisoIl: reso.decisoIl?.toISOString() ?? null,
      decisaDa: reso.decisaDa,
      rimborsatoIl: reso.rimborsatoIl?.toISOString() ?? null,
    })),
    recessoAperto: recessoAperto({
      stato: ordine.stato,
      consegnatoIl: ordine.consegnatoIl,
      adesso,
    }),
    recessoScadeIl: ordine.consegnatoIl
      ? scadenzaRecesso(ordine.consegnatoIl).toISOString()
      : null,
    creatoIl: ordine.creatoIl.toISOString(),
  };
}
