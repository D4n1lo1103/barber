import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  azioniDelCliente,
  type AppuntamentoCliente,
  type Appuntamento,
  type DatiEvasioneRichiesta,
  type DatiModificaProfilo,
  type EsportazioneDati,
  type ProfiloCliente,
  type RichiestaCancellazione,
} from '@barber/shared';
import { ImpostazioniServizio } from '../impostazioni/impostazioni.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AreaClienteServizio {
  private readonly logger = new Logger(AreaClienteServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly impostazioni: ImpostazioniServizio,
  ) {}

  async leggiProfilo(clienteId: string): Promise<ProfiloCliente> {
    const cliente = await this.prisma.utente.findUniqueOrThrow({ where: { id: clienteId } });

    return {
      id: cliente.id,
      nome: cliente.nome,
      cognome: cliente.cognome,
      email: cliente.email,
      numeroWhatsapp: cliente.numeroWhatsapp,
      emailVerificata: cliente.emailVerificata,
      numeroVerificato: cliente.numeroVerificato,
      consensoTrattamentoIl: cliente.consensoTrattamentoIl?.toISOString() ?? null,
      consensoWhatsappIl: cliente.consensoWhatsappIl?.toISOString() ?? null,
      creatoIl: cliente.creatoIl.toISOString(),
    };
  }

  /**
   * Il cliente aggiorna i propri dati di contatto e il consenso ai messaggi
   * WhatsApp, che può revocare in qualsiasi momento. L'indirizzo e-mail non si
   * cambia da qui: servirebbe una nuova verifica.
   */
  async modificaProfilo(clienteId: string, dati: DatiModificaProfilo): Promise<ProfiloCliente> {
    if (dati.numeroWhatsapp) {
      const altro = await this.prisma.utente.findFirst({
        where: { numeroWhatsapp: dati.numeroWhatsapp, id: { not: clienteId } },
      });

      if (altro) {
        throw new ConflictException('Questo numero è già collegato a un altro account.');
      }
    }

    const attuale = await this.prisma.utente.findUniqueOrThrow({ where: { id: clienteId } });
    const numeroCambiato =
      dati.numeroWhatsapp !== undefined && dati.numeroWhatsapp !== attuale.numeroWhatsapp;

    await this.prisma.utente.update({
      where: { id: clienteId },
      data: {
        nome: dati.nome,
        cognome: dati.cognome,
        numeroWhatsapp: dati.numeroWhatsapp,
        // Un numero nuovo torna da verificare (il codice arriva in fase 7).
        numeroVerificato: numeroCambiato ? false : undefined,
        consensoWhatsappIl:
          dati.consensoWhatsapp === undefined
            ? undefined
            : dati.consensoWhatsapp
              ? (attuale.consensoWhatsappIl ?? new Date())
              : null,
      },
    });

    return this.leggiProfilo(clienteId);
  }

  /** Aggiunge alle righe dell'appuntamento ciò che il cliente può ancora fare. */
  async componiPerCliente(appuntamenti: Appuntamento[]): Promise<AppuntamentoCliente[]> {
    const regole = await this.impostazioni.leggiRegole();
    const adesso = new Date();

    return appuntamenti.map((appuntamento) => {
      const azioni = azioniDelCliente({
        stato: appuntamento.stato,
        inizio: new Date(appuntamento.inizio),
        adesso,
        oreLimitePreavviso: regole.oreLimitePreavviso,
      });

      return {
        id: appuntamento.id,
        stato: appuntamento.stato,
        inizio: appuntamento.inizio,
        fine: appuntamento.fine,
        durataMinuti: appuntamento.durataMinuti,
        prezzoTotaleCentesimi: appuntamento.prezzoTotaleCentesimi,
        operatore: appuntamento.operatore,
        servizi: appuntamento.servizi.map((servizio) => ({
          nome: servizio.nome,
          prezzoCentesimi: servizio.prezzoCentesimi,
        })),
        servizioIds: appuntamento.servizi
          .map((servizio) => servizio.servizioId)
          .filter((servizioId): servizioId is string => servizioId !== null),
        puoAnnullare: azioni.puoAnnullare,
        puoSpostare: azioni.puoSpostare,
      };
    });
  }

  /** Copia dei propri dati: diritto di accesso previsto dal GDPR. */
  async esportaDati(clienteId: string): Promise<EsportazioneDati> {
    const profilo = await this.leggiProfilo(clienteId);
    const appuntamenti = await this.prisma.appuntamento.findMany({
      where: { clienteId },
      orderBy: { inizio: 'asc' },
      include: {
        operatore: { select: { nome: true, cognome: true } },
        servizi: { orderBy: { ordine: 'asc' }, select: { nome: true } },
      },
    });

    return {
      profilo,
      appuntamenti: appuntamenti.map((appuntamento) => ({
        inizio: appuntamento.inizio.toISOString(),
        fine: appuntamento.fine.toISOString(),
        stato: appuntamento.stato,
        operatore: `${appuntamento.operatore.nome} ${appuntamento.operatore.cognome}`,
        servizi: appuntamento.servizi.map((servizio) => servizio.nome),
        prezzoTotaleCentesimi: appuntamento.prezzoTotaleCentesimi,
      })),
      esportatoIl: new Date().toISOString(),
    };
  }

  /**
   * Richiesta di cancellazione dei dati. La evade il titolare: i dati
   * personali vengono rimossi e lo storico resta in forma anonima, così il
   * salone mantiene la contabilità.
   */
  async richiediCancellazione(clienteId: string, motivo: string): Promise<RichiestaCancellazione> {
    const inAttesa = await this.prisma.richiestaCancellazione.findFirst({
      where: { clienteId, stato: 'in_attesa' },
    });

    if (inAttesa) {
      throw new ConflictException(
        'Hai già una richiesta di cancellazione in attesa: il salone la sta valutando.',
      );
    }

    const creata = await this.prisma.richiestaCancellazione.create({
      data: { clienteId, motivo },
    });

    this.logger.log('Nuova richiesta di cancellazione dei dati.');

    return this.componiRichiesta(creata.id);
  }

  async leggiRichiestaCorrente(clienteId: string): Promise<RichiestaCancellazione | null> {
    const richiesta = await this.prisma.richiestaCancellazione.findFirst({
      where: { clienteId },
      orderBy: { richiestaIl: 'desc' },
    });

    return richiesta ? this.componiRichiesta(richiesta.id) : null;
  }

  async componiRichiesta(id: string): Promise<RichiestaCancellazione> {
    const richiesta = await this.prisma.richiestaCancellazione.findUniqueOrThrow({
      where: { id },
      include: {
        cliente: { select: { id: true, nome: true, cognome: true, email: true } },
      },
    });

    const appuntamentiFuturi = await this.prisma.appuntamento.count({
      where: {
        clienteId: richiesta.clienteId,
        stato: { in: ['in_attesa_pagamento', 'confermato'] },
        inizio: { gte: new Date() },
      },
    });

    return {
      id: richiesta.id,
      stato: richiesta.stato,
      motivo: richiesta.motivo,
      notaTitolare: richiesta.notaTitolare,
      richiestaIl: richiesta.richiestaIl.toISOString(),
      evasaIl: richiesta.evasaIl?.toISOString() ?? null,
      cliente: richiesta.cliente,
      appuntamentiFuturi,
    };
  }

  /** Richieste di cancellazione, per il titolare: le più recenti per prime. */
  async elencaRichieste(): Promise<RichiestaCancellazione[]> {
    const righe = await this.prisma.richiestaCancellazione.findMany({
      orderBy: [{ richiestaIl: 'desc' }],
      select: { id: true },
    });

    return Promise.all(righe.map((riga) => this.componiRichiesta(riga.id)));
  }

  /**
   * Il titolare evade la richiesta: anonimizza la scheda oppure la rifiuta,
   * in entrambi i casi con una nota e il tracciamento di autore e momento.
   */
  async evadiRichiesta(
    id: string,
    dati: DatiEvasioneRichiesta,
    titolareId: string,
    anonimizza: (clienteId: string) => Promise<void>,
  ): Promise<RichiestaCancellazione> {
    const richiesta = await this.prisma.richiestaCancellazione.findUnique({ where: { id } });

    if (!richiesta) {
      throw new NotFoundException('Richiesta non trovata.');
    }

    if (richiesta.stato !== 'in_attesa') {
      throw new ConflictException('Questa richiesta è già stata chiusa.');
    }

    if (dati.azione === 'anonimizza') {
      await anonimizza(richiesta.clienteId);
    }

    await this.prisma.richiestaCancellazione.update({
      where: { id },
      data: {
        stato: dati.azione === 'anonimizza' ? 'evasa' : 'rifiutata',
        notaTitolare: dati.nota,
        evasaIl: new Date(),
        evasaDaId: titolareId,
      },
    });

    this.logger.log(
      `Richiesta di cancellazione ${dati.azione === 'anonimizza' ? 'evasa' : 'rifiutata'}.`,
    );

    return this.componiRichiesta(id);
  }

  /** Verifica che la scheda non sia già stata anonimizzata. */
  async verificaSchedaUtilizzabile(clienteId: string): Promise<void> {
    const cliente = await this.prisma.utente.findUniqueOrThrow({ where: { id: clienteId } });

    if (cliente.anonimizzataIl) {
      throw new BadRequestException('Questa scheda è stata cancellata su richiesta del cliente.');
    }
  }
}
