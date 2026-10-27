import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  azioniDelCliente,
  caparraPagataDaMovimenti,
  caparraTrattenutaDaMovimenti,
  dataLocale,
  fineGiornoLocale,
  giorniConsecutivi,
  GIORNI_MASSIMI_PRENOTAZIONE,
  GIORNI_PASSATO_PERSONALE,
  inizioGiornoLocale,
  ORE_MINIME_PRENOTAZIONE_CLIENTE,
  orarioDaMinuti,
  partiData,
  transizioneAmmessa,
  verificaCollocazione,
  type Appuntamento,
  type DatiAnnullamentoDaPersonale,
  type DatiCreazioneAppuntamento,
  type DatiRicercaAgenda,
  type DatiPrenotazioneCliente,
  type DatiSpostamentoAppuntamento,
  type MovimentoPerTotali,
  type Ruolo,
  type StatoAppuntamento,
} from '@barber/shared';
import { ClientiServizio } from '../clienti/clienti.servizio.js';
import { ImpostazioniServizio } from '../impostazioni/impostazioni.servizio.js';
import { NotificheServizio } from '../notifiche/notifiche.servizio.js';
import { CaparraServizio } from '../pagamenti/caparra.servizio.js';
import { PagamentiServizio } from '../pagamenti/pagamenti.servizio.js';
import { ScadenzaBloccoAttivita } from '../pagamenti/scadenza-blocco.attivita.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DisponibilitaServizio } from './disponibilita.servizio.js';

const GIORNO_IN_MILLISECONDI = 24 * 60 * 60 * 1000;

/** Dati necessari a comporre la risposta per il frontend. */
const INCLUDI_COLLEGAMENTI = {
  cliente: { select: { id: true, nome: true, cognome: true, numeroWhatsapp: true } },
  operatore: { select: { id: true, nome: true, cognome: true } },
  servizi: { orderBy: { ordine: 'asc' } },
  // Serve a calcolare la caparra già pagata senza una query per appuntamento.
  movimentiCaparra: { select: { tipo: true, importoCentesimi: true } },
} as const;

@Injectable()
export class AppuntamentiServizio {
  private readonly logger = new Logger(AppuntamentiServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly disponibilita: DisponibilitaServizio,
    private readonly clienti: ClientiServizio,
    private readonly notifiche: NotificheServizio,
    private readonly impostazioni: ImpostazioniServizio,
    private readonly pagamenti: PagamentiServizio,
    private readonly caparra: CaparraServizio,
    private readonly scadenzaBlocco: ScadenzaBloccoAttivita,
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

  /**
   * Prenotazione dall'area clienti: almeno due ore di preavviso, non oltre
   * 60 giorni, nessuna opzione "senza caparra" e sempre a proprio nome.
   */
  async prenotaComeCliente(
    clienteId: string,
    dati: DatiPrenotazioneCliente,
  ): Promise<Appuntamento> {
    const inizio = new Date(dati.inizio);
    const minimo = new Date(Date.now() + ORE_MINIME_PRENOTAZIONE_CLIENTE * 60 * 60 * 1000);

    if (inizio < minimo) {
      throw new BadRequestException(
        `Le prenotazioni online richiedono almeno ${ORE_MINIME_PRENOTAZIONE_CLIENTE} ore di preavviso. ` +
          'Per un appuntamento più vicino chiama il salone.',
      );
    }

    return this.crea(
      {
        clienteId,
        operatoreId: dati.operatoreId,
        servizioIds: dati.servizioIds,
        inizio: dati.inizio,
        senzaCaparra: false,
        forzato: false,
        note: '',
      },
      null,
    );
  }

  /**
   * Spostamento chiesto dal cliente: consentito solo entro il preavviso.
   *
   * Se il titolare ha scelto che lo spostamento sia **trattato come un
   * annullamento** e c'è una caparra pagata, lo spostamento non muove
   * l'appuntamento: annulla quello vecchio, restituendo la caparra secondo le
   * regole, e ne crea uno nuovo sull'orario scelto, che richiede una nuova
   * caparra. Con la regola dello spostamento libero, o senza caparra pagata,
   * l'appuntamento si sposta e la caparra resta dov'è.
   */
  async spostaComeCliente(id: string, clienteId: string, inizio: string): Promise<Appuntamento> {
    const appuntamento = await this.verificaAzioneDelCliente(id, clienteId, 'spostare');
    const nuovoInizio = new Date(inizio);
    const minimo = new Date(Date.now() + ORE_MINIME_PRENOTAZIONE_CLIENTE * 60 * 60 * 1000);

    if (nuovoInizio < minimo) {
      throw new BadRequestException(
        `Scegli un orario almeno ${ORE_MINIME_PRENOTAZIONE_CLIENTE} ore dopo adesso.`,
      );
    }

    const regole = await this.impostazioni.leggiRegole();
    const caparraPagata = await this.caparra.caparraPagata(appuntamento.id);

    if (regole.spostamentoComeAnnullamento && caparraPagata > 0) {
      return this.riprenotaDopoAnnullamento(appuntamento.id, clienteId, inizio);
    }

    return this.sposta(appuntamento.id, { inizio }, clienteId);
  }

  /**
   * Annulla e riprenota: l'annullamento è entro il limite di preavviso, quindi
   * tempestivo, e la caparra torna al cliente nella forma scelta dal salone.
   * Il nuovo appuntamento nasce con la propria caparra da pagare, che il
   * credito copre in tutto o in parte se la restituzione è in credito.
   */
  private async riprenotaDopoAnnullamento(
    id: string,
    clienteId: string,
    inizio: string,
  ): Promise<Appuntamento> {
    const vecchio = await this.prisma.appuntamento.findUniqueOrThrow({
      where: { id },
      select: {
        operatoreId: true,
        servizi: { select: { servizioId: true }, orderBy: { ordine: 'asc' } },
      },
    });

    const servizioIds = vecchio.servizi
      .map((servizio) => servizio.servizioId)
      .filter((servizioId): servizioId is string => servizioId !== null);

    if (servizioIds.length !== vecchio.servizi.length) {
      throw new BadRequestException(
        'Uno dei servizi prenotati non è più in catalogo: contatta il salone per lo spostamento.',
      );
    }

    // Prima si libera lo slot vecchio, altrimenti il nuovo orario potrebbe
    // sovrapporsi a quello che si sta lasciando.
    await this.annulla(
      id,
      { motivo: 'tempestivo', note: 'Spostamento chiesto dal cliente.' },
      clienteId,
    );

    return this.prenotaComeCliente(clienteId, {
      operatoreId: vecchio.operatoreId,
      servizioIds,
      inizio,
    });
  }

  /**
   * Annullamento dall'app: è possibile solo entro il limite di preavviso,
   * quindi è sempre tempestivo. Dopo il limite il cliente deve contattare il
   * salone, che registra l'annullamento tardivo.
   */
  async annullaComeCliente(id: string, clienteId: string): Promise<Appuntamento> {
    const appuntamento = await this.verificaAzioneDelCliente(id, clienteId, 'annullare');

    return this.annulla(appuntamento.id, { motivo: 'tempestivo', note: '' }, clienteId);
  }

  /** Appuntamenti del cliente con le azioni che può compiere adesso. */
  async elencaPerAreaCliente(clienteId: string): Promise<Appuntamento[]> {
    const appuntamenti = await this.prisma.appuntamento.findMany({
      where: { clienteId },
      orderBy: { inizio: 'desc' },
      include: INCLUDI_COLLEGAMENTI,
    });

    return appuntamenti.map((appuntamento) => this.componi(appuntamento));
  }

  /**
   * Verifica che l'appuntamento sia del cliente e che l'azione sia ancora
   * consentita dalle regole del salone.
   */
  private async verificaAzioneDelCliente(
    id: string,
    clienteId: string,
    azione: 'annullare' | 'spostare',
  ) {
    const appuntamento = await this.prisma.appuntamento.findUnique({ where: { id } });

    if (!appuntamento || appuntamento.clienteId !== clienteId) {
      throw new NotFoundException('Appuntamento non trovato.');
    }

    const regole = await this.impostazioni.leggiRegole();
    const azioni = azioniDelCliente({
      stato: appuntamento.stato,
      inizio: appuntamento.inizio,
      adesso: new Date(),
      oreLimitePreavviso: regole.oreLimitePreavviso,
    });

    const consentita = azione === 'annullare' ? azioni.puoAnnullare : azioni.puoSpostare;

    if (!consentita) {
      throw new BadRequestException(
        `Non è più possibile ${azione} questo appuntamento dall'app: ` +
          `il limite è di ${regole.oreLimitePreavviso} ore prima. Contatta il salone.`,
      );
    }

    return appuntamento;
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
  async crea(
    dati: DatiCreazioneAppuntamento,
    autoreId: string | null,
    ruoloAutore?: Ruolo,
  ): Promise<Appuntamento> {
    const forzato = this.verificaDeroga(dati.forzato, ruoloAutore);

    await this.clienti.verificaCliente(dati.clienteId);
    await this.disponibilita.verificaOperatore(dati.operatoreId);

    const scelti = await this.disponibilita.leggiServiziScelti(dati.operatoreId, dati.servizioIds);
    const inizio = new Date(dati.inizio);

    this.verificaLimitiDiData(inizio);
    // Uno slot tenuto da un pagamento mai completato non deve bloccare chi
    // prenota adesso.
    await this.pagamenti.liberaBlocchiScaduti();

    // Il titolare che forza salta orari, chiusure, assenze, allineamento e
    // sovrapposizioni: resta solo il controllo sui limiti di data.
    if (!forzato) {
      await this.verificaSlotLibero(dati.operatoreId, inizio, scelti.durataMinuti);
    }

    const fine = new Date(inizio.getTime() + scelti.durataMinuti * 60_000);
    const caparra = await this.caparraPerLaPrenotazione(
      dati,
      autoreId,
      scelti.prezzoTotaleCentesimi,
    );

    try {
      // Appuntamento e credito speso stanno nella stessa transazione: se il
      // credito nel frattempo è finito, lo slot non resta occupato da una
      // prenotazione che nessuno ha pagato.
      const creato = await this.prisma.$transaction(async (transazione) => {
        if (caparra.creditoUsato > 0) {
          // Prima di ogni scrittura: creare l'appuntamento prende da sé un
          // blocco condiviso sulla riga del cliente, e chiedere dopo quello
          // esclusivo manderebbe due prenotazioni simultanee in deadlock.
          await this.pagamenti.bloccaCreditoDelCliente(transazione, dati.clienteId);
        }

        const appuntamento = await transazione.appuntamento.create({
          data: {
            clienteId: dati.clienteId,
            operatoreId: dati.operatoreId,
            inizio,
            fine,
            durataMinuti: scelti.durataMinuti,
            prezzoTotaleCentesimi: scelti.prezzoTotaleCentesimi,
            // Con una caparra da pagare lo slot resta bloccato in attesa del
            // pagamento; senza caparra l'appuntamento nasce già confermato.
            // Con una differenza da pagare lo slot resta bloccato in attesa; se
            // il credito copre tutta la caparra l'appuntamento è già confermato.
            stato: caparra.scadeIl ? 'in_attesa_pagamento' : 'confermato',
            caparraCentesimi: caparra.centesimi,
            bloccoScadeIl: caparra.scadeIl,
            senzaCaparra: caparra.centesimi === 0,
            forzato,
            note: dati.note,
            // Nullo quando prenota il cliente stesso dall'area clienti.
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

        await this.pagamenti.applicaCreditoAllaPrenotazione(
          {
            appuntamentoId: appuntamento.id,
            clienteId: appuntamento.clienteId,
            creditoUsatoCentesimi: caparra.creditoUsato,
          },
          transazione,
        );

        return appuntamento;
      });

      if (forzato) {
        this.logger.warn(
          `Appuntamento ${creato.id} inserito da ${autoreId} in deroga ai vincoli dell'agenda.`,
        );
      }

      if (caparra.scadeIl) {
        await this.scadenzaBlocco.programma(creato.id, caparra.scadeIl);
      } else {
        // La conferma si invia a prenotazione confermata: con una differenza
        // da pagare parte quando il pagamento riesce.
        await this.inviaConferma(creato);
      }

      return this.leggi(creato.id);
    } catch (errore) {
      throw this.traduciErroreDiSovrapposizione(errore);
    }
  }

  /**
   * Caparra dovuta su una nuova prenotazione e scadenza del blocco dello slot.
   *
   * La caparra si paga **online al momento della prenotazione**, quindi la
   * richiede solo la prenotazione fatta dal cliente: un appuntamento preso al
   * telefono o in negozio non ha caparra, perché in quel momento il cliente non
   * può pagare (decisione del titolare del 18/10/2026). Per questo
   * `senzaCaparra` risulta vero su ogni appuntamento inserito dal personale.
   */
  private async caparraPerLaPrenotazione(
    dati: DatiCreazioneAppuntamento,
    autoreId: string | null,
    prezzoTotaleCentesimi: number,
  ): Promise<{ centesimi: number; creditoUsato: number; scadeIl: Date | null }> {
    const prenotaIlCliente = autoreId === null;

    if (!prenotaIlCliente || dati.senzaCaparra) {
      return { centesimi: 0, creditoUsato: 0, scadeIl: null };
    }

    const caparra = await this.pagamenti.caparraPerPrenotazione(
      dati.clienteId,
      prezzoTotaleCentesimi,
    );

    if (caparra.caparraCentesimi <= 0) {
      return { centesimi: 0, creditoUsato: 0, scadeIl: null };
    }

    // Lo slot si blocca solo se resta qualcosa da pagare: con la caparra
    // coperta dal credito non c'è alcuna attesa.
    const minutiBlocco = await this.disponibilita.minutiBloccoSlot();
    const scadeIl =
      caparra.daPagareCentesimi > 0 ? new Date(Date.now() + minutiBlocco * 60_000) : null;

    return {
      centesimi: caparra.caparraCentesimi,
      creditoUsato: caparra.creditoUsatoCentesimi,
      scadeIl,
    };
  }

  /**
   * Conferma al cliente, sul canale che gli spetta: WhatsApp se ha dato il
   * consenso e il salone l'ha attivo, altrimenti e-mail.
   */
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
      select: { nome: true, email: true, numeroWhatsapp: true, consensoWhatsappIl: true },
    });

    if (!cliente) {
      return;
    }

    await this.notifiche.inviaConfermaPrenotazione(
      {
        nome: cliente.nome,
        email: cliente.email,
        numeroWhatsapp: cliente.numeroWhatsapp,
        consensoWhatsapp: cliente.consensoWhatsappIl !== null,
      },
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
      bloccoScadeIl: null,
    });

    await this.pagamenti.applicaTrattamentoAnnullamento({
      appuntamentoId: appuntamento.id,
      clienteId: appuntamento.cliente.id,
      motivo: dati.motivo,
      autoreId,
    });

    this.logger.log(`Appuntamento ${id} annullato (${dati.motivo}) da ${autoreId}.`);

    return this.leggi(appuntamento.id);
  }

  /**
   * La mancata presentazione la segna il personale: lo slot resta occupato e
   * la caparra viene trattenuta.
   */
  async segnaMancataPresentazione(id: string, autoreId: string): Promise<Appuntamento> {
    const appuntamento = await this.cambiaStato(id, 'mancata_presentazione', autoreId);

    await this.pagamenti.trattieniPerMancataPresentazione({
      appuntamentoId: appuntamento.id,
      clienteId: appuntamento.cliente.id,
      autoreId,
    });

    return this.leggi(appuntamento.id);
  }

  /**
   * Il completamento è sempre manuale: nessun automatismo a fine orario. A
   * servizio concluso la caparra viene scalata dal totale.
   */
  async completa(id: string, autoreId: string): Promise<Appuntamento> {
    const appuntamento = await this.cambiaStato(id, 'completato', autoreId, {
      completatoIl: new Date(),
    });

    await this.pagamenti.scalaAlCompletamento({
      appuntamentoId: appuntamento.id,
      clienteId: appuntamento.cliente.id,
      autoreId,
    });

    return this.leggi(appuntamento.id);
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

    // Lo stato letto sopra deve essere ancora quello al momento della
    // scrittura: altrimenti due annullamenti simultanei passerebbero entrambi
    // il controllo e la caparra verrebbe restituita due volte.
    const esito = await this.prisma.appuntamento.updateMany({
      where: { id, stato: appuntamento.stato },
      data: { stato: nuovo, ...datiAggiuntivi },
    });

    if (esito.count === 0) {
      throw new ConflictException(
        'L’appuntamento è stato aggiornato da qualcun altro in questo momento: ' +
          'ricarica la pagina e riprova.',
      );
    }

    const aggiornato = await this.prisma.appuntamento.findUniqueOrThrow({
      where: { id },
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
  /**
   * Deroga ai vincoli dell'agenda: la può chiedere solo il titolare, anche
   * sull'agenda dei colleghi. Il cliente che prenota dall'area clienti non ha
   * ruolo autore e non può in nessun caso forzare.
   */
  private verificaDeroga(richiesta: boolean, ruoloAutore?: Ruolo): boolean {
    if (!richiesta) {
      return false;
    }

    if (ruoloAutore !== 'titolare') {
      throw new ForbiddenException(
        'Solo il titolare può inserire un appuntamento fuori dagli orari.',
      );
    }

    return true;
  }

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
    forzato: boolean;
    caparraCentesimi: number;
    bloccoScadeIl: Date | null;
    note: string;
    creatoDaId: string | null;
    creatoIl: Date;
    servizi: {
      servizioId: string | null;
      nome: string;
      prezzoCentesimi: number;
      durataMinuti: number;
    }[];
    movimentiCaparra: MovimentoPerTotali[];
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
      forzato: riga.forzato,
      caparraCentesimi: riga.caparraCentesimi,
      caparraPagataCentesimi: caparraPagataDaMovimenti(riga.movimentiCaparra),
      caparraTrattenutaCentesimi: caparraTrattenutaDaMovimenti(riga.movimentiCaparra),
      bloccoScadeIl: riga.bloccoScadeIl?.toISOString() ?? null,
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
