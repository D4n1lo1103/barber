import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FUSO_SALONE } from '@barber/shared';
import { CODA_EMAIL, CODA_WHATSAPP, CodaServizio } from '../attivita/coda.servizio.js';
import type { Ambiente } from '../configurazione/ambiente.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canaleDaUsare, type Canale, type DestinatarioMessaggio } from './canale.js';
import { MITTENTE_EMAIL, type MessaggioEmail, type MittenteEmail } from './mittente-email.js';
import {
  MITTENTE_WHATSAPP,
  type MessaggioWhatsapp,
  type MittenteWhatsapp,
} from './mittente-whatsapp.js';
import {
  NOMI_MODELLI_PREDEFINITI,
  modelloWhatsappConferma,
  modelloWhatsappInvito,
  modelloWhatsappPromemoria,
  modelloWhatsappVerificaNumero,
  type NomiModelliWhatsapp,
} from './modelli-whatsapp.js';
import {
  modelloCodiceVerificaNumero,
  modelloConfermaPrenotazione,
  modelloInvitoAttivazione,
  modelloPromemoria,
  modelloResetPassword,
  modelloVerificaEmail,
  type ContestoSalone,
  type DestinatarioEmail,
} from './modelli-email.js';

const FORMATO_QUANDO = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: FUSO_SALONE,
});

const FORMATO_EURO = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/** Lavoro in coda: messaggio WhatsApp e, quando c'è, il suo ripiego e-mail. */
interface LavoroWhatsapp {
  whatsapp: MessaggioWhatsapp;
  email: MessaggioEmail | null;
}

export interface AppuntamentoDaConfermare {
  inizio: Date;
  durataMinuti: number;
  prezzoTotaleCentesimi: number;
  operatore: { nome: string; cognome: string };
  servizi: { nome: string }[];
}

/**
 * Messaggi di servizio verso i clienti e il personale. I messaggi passano
 * dalla coda: un'e-mail che non parte viene ritentata e non fa fallire
 * l'operazione che l'ha generata (registrazione, prenotazione, invito).
 */
@Injectable()
export class NotificheServizio implements OnModuleInit {
  private readonly logger = new Logger(NotificheServizio.name);

  constructor(
    @Inject(MITTENTE_EMAIL) private readonly mittente: MittenteEmail,
    @Inject(MITTENTE_WHATSAPP) private readonly whatsapp: MittenteWhatsapp,
    private readonly coda: CodaServizio,
    private readonly prisma: PrismaService,
    private readonly configurazione: ConfigService<Ambiente, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.coda.registra(CODA_EMAIL, (dati) => this.mittente.invia(dati as MessaggioEmail));
    await this.coda.registra(CODA_WHATSAPP, (dati) =>
      this.inviaWhatsappConRipiego(dati as LavoroWhatsapp),
    );

    this.logger.log(`Invio e-mail: ${this.mittente.descrizione}.`);
    this.logger.log(`Invio WhatsApp: ${this.whatsapp.descrizione}.`);
  }

  /**
   * Invio WhatsApp con ripiego sull'e-mail.
   *
   * Un messaggio WhatsApp che non parte **non** viene ritentato: si passa
   * subito all'e-mail, così il cliente riceve una comunicazione sola e
   * sicuramente. Ritentare WhatsApp e poi ripiegare rischierebbe di
   * consegnarne due.
   */
  private async inviaWhatsappConRipiego(lavoro: LavoroWhatsapp): Promise<void> {
    try {
      await this.whatsapp.invia(lavoro.whatsapp);

      return;
    } catch (errore) {
      this.logger.warn(
        `Messaggio WhatsApp non consegnato (modello ${lavoro.whatsapp.modello}): ` +
          `${errore instanceof Error ? errore.message : 'errore non identificato'}`,
      );
    }

    if (!lavoro.email) {
      this.logger.error('Nessun recapito di ripiego: il messaggio non è stato consegnato.');

      return;
    }

    await this.mittente.invia(lavoro.email);
  }

  /**
   * Consegna un messaggio di servizio sul canale che spetta al destinatario.
   * L'e-mail, quando c'è, è sempre pronta come ripiego.
   */
  private async consegna(
    destinatario: DestinatarioMessaggio,
    componi: (canale: Canale) => { whatsapp?: MessaggioWhatsapp; email?: MessaggioEmail },
  ): Promise<Canale> {
    const whatsappAttivo = await this.whatsappAttivo();
    const canale = canaleDaUsare({ whatsappAttivo, destinatario });

    if (canale === 'nessuno') {
      this.logger.warn('Messaggio di servizio non inviato: il destinatario non ha recapiti.');

      return canale;
    }

    const messaggi = componi(canale);

    if (canale === 'whatsapp' && messaggi.whatsapp) {
      await this.accodaWhatsapp({ whatsapp: messaggi.whatsapp, email: messaggi.email ?? null });

      return canale;
    }

    if (messaggi.email) {
      await this.accoda(messaggi.email);

      return 'email';
    }

    return 'nessuno';
  }

  async inviaVerificaEmail(destinatario: DestinatarioEmail, token: string): Promise<void> {
    const salone = await this.contestoSalone();

    await this.accoda(
      modelloVerificaEmail(salone, destinatario, this.collegamento('/verifica-email', token)),
    );
  }

  async inviaResetPassword(destinatario: DestinatarioEmail, token: string): Promise<void> {
    const salone = await this.contestoSalone();

    await this.accoda(
      modelloResetPassword(salone, destinatario, this.collegamento('/reimposta-password', token)),
    );
  }

  /**
   * Invito ad attivare l'account, per le schede create dal personale: va al
   * cliente su WhatsApp se ha dato il consenso, altrimenti via e-mail.
   */
  async inviaInvitoAttivazione(
    destinatario: DestinatarioMessaggio,
    token: string,
  ): Promise<Canale> {
    const [salone, nomi] = await Promise.all([this.contestoSalone(), this.nomiModelli()]);
    const collegamento = this.collegamento('/attivazione', token);

    return this.consegna(destinatario, () => ({
      whatsapp: destinatario.numeroWhatsapp
        ? modelloWhatsappInvito(
            nomi,
            salone.nomeSalone,
            { nome: destinatario.nome, numeroWhatsapp: destinatario.numeroWhatsapp },
            collegamento,
          )
        : undefined,
      email: destinatario.email
        ? modelloInvitoAttivazione(
            salone,
            { nome: destinatario.nome, email: destinatario.email },
            collegamento,
          )
        : undefined,
    }));
  }

  async inviaConfermaPrenotazione(
    destinatario: DestinatarioMessaggio,
    appuntamento: AppuntamentoDaConfermare,
  ): Promise<Canale> {
    return this.inviaAvvisoAppuntamento('conferma', destinatario, appuntamento);
  }

  /** Promemoria prima dell'appuntamento, con l'anticipo scelto dal titolare. */
  async inviaPromemoria(
    destinatario: DestinatarioMessaggio,
    appuntamento: AppuntamentoDaConfermare,
  ): Promise<Canale> {
    return this.inviaAvvisoAppuntamento('promemoria', destinatario, appuntamento);
  }

  /**
   * Conferma e promemoria condividono i dati dell'appuntamento e cambiano solo
   * nel modello usato.
   */
  private async inviaAvvisoAppuntamento(
    tipo: 'conferma' | 'promemoria',
    destinatario: DestinatarioMessaggio,
    appuntamento: AppuntamentoDaConfermare,
  ): Promise<Canale> {
    const [salone, nomi] = await Promise.all([this.contestoSalone(), this.nomiModelli()]);
    const riepilogo = {
      quando: FORMATO_QUANDO.format(appuntamento.inizio),
      servizi: appuntamento.servizi.map((servizio) => servizio.nome).join(' + '),
      operatore: `${appuntamento.operatore.nome} ${appuntamento.operatore.cognome}`,
      durata: `${appuntamento.durataMinuti} minuti`,
      totale: FORMATO_EURO.format(appuntamento.prezzoTotaleCentesimi / 100),
    };
    const perWhatsapp = destinatario.numeroWhatsapp
      ? {
          nome: destinatario.nome,
          numeroWhatsapp: destinatario.numeroWhatsapp,
        }
      : null;

    return this.consegna(destinatario, () => ({
      whatsapp: perWhatsapp
        ? tipo === 'conferma'
          ? modelloWhatsappConferma(nomi, salone.nomeSalone, perWhatsapp, riepilogo)
          : modelloWhatsappPromemoria(nomi, salone.nomeSalone, perWhatsapp, riepilogo)
        : undefined,
      email: destinatario.email
        ? tipo === 'conferma'
          ? modelloConfermaPrenotazione(
              salone,
              { nome: destinatario.nome, email: destinatario.email },
              riepilogo,
            )
          : modelloPromemoria(
              salone,
              { nome: destinatario.nome, email: destinatario.email },
              riepilogo,
            )
        : undefined,
    }));
  }

  /**
   * Codice di verifica del numero di telefono: va per forza su WhatsApp, che è
   * il canale da verificare. Senza WhatsApp attivo il codice arriva via
   * e-mail, così la verifica resta possibile anche prima che il salone
   * configuri i messaggi.
   */
  async inviaCodiceVerificaNumero(
    destinatario: DestinatarioMessaggio,
    codice: string,
  ): Promise<Canale> {
    const [salone, nomi] = await Promise.all([this.contestoSalone(), this.nomiModelli()]);

    return this.consegna(destinatario, () => ({
      whatsapp: destinatario.numeroWhatsapp
        ? modelloWhatsappVerificaNumero(
            nomi,
            { nome: destinatario.nome, numeroWhatsapp: destinatario.numeroWhatsapp },
            codice,
          )
        : undefined,
      email: destinatario.email
        ? modelloCodiceVerificaNumero(
            salone,
            { nome: destinatario.nome, email: destinatario.email },
            codice,
          )
        : undefined,
    }));
  }

  /** Invio di prova, per verificare la configurazione dei messaggi. */
  async inviaProva(numeroWhatsapp: string): Promise<{ canale: Canale; dettaglio: string }> {
    const [salone, nomi] = await Promise.all([this.contestoSalone(), this.nomiModelli()]);
    const messaggio = modelloWhatsappVerificaNumero(
      nomi,
      { nome: 'prova', numeroWhatsapp },
      '000000',
    );

    try {
      await this.whatsapp.invia(messaggio);

      return {
        canale: 'whatsapp',
        dettaglio: this.whatsapp.finto
          ? `Messaggio registrato, non inviato: ${this.whatsapp.descrizione}. ` +
            `Il salone è «${salone.nomeSalone}».`
          : `Messaggio inviato con il modello «${messaggio.modello}».`,
      };
    } catch (errore) {
      return {
        canale: 'nessuno',
        dettaglio: errore instanceof Error ? errore.message : 'Invio non riuscito.',
      };
    }
  }

  private collegamento(percorso: string, token: string): string {
    const origine = this.configurazione.get('ORIGINE_WEB', { infer: true }).replace(/\/$/, '');

    return `${origine}${percorso}?token=${encodeURIComponent(token)}`;
  }

  private async contestoSalone(): Promise<ContestoSalone> {
    const installazione = await this.prisma.installazione.findFirst({
      select: { nomeSalone: true },
    });

    return {
      nomeSalone: installazione?.nomeSalone ?? 'Il tuo salone',
      origineWeb: this.configurazione.get('ORIGINE_WEB', { infer: true }).replace(/\/$/, ''),
    };
  }

  /** I messaggi WhatsApp partono solo se il salone li ha attivati. */
  private async whatsappAttivo(): Promise<boolean> {
    const installazione = await this.prisma.installazione.findFirst({
      select: { whatsappAttivo: true },
    });

    return installazione?.whatsappAttivo ?? false;
  }

  /** Nomi dei modelli approvati, con i valori dell'installazione. */
  private async nomiModelli(): Promise<NomiModelliWhatsapp> {
    const installazione = await this.prisma.installazione.findFirst({
      select: {
        whatsappModelloConferma: true,
        whatsappModelloPromemoria: true,
        whatsappModelloInvito: true,
        whatsappModelloVerifica: true,
      },
    });

    return {
      confermaPrenotazione:
        installazione?.whatsappModelloConferma ?? NOMI_MODELLI_PREDEFINITI.confermaPrenotazione,
      promemoria: installazione?.whatsappModelloPromemoria ?? NOMI_MODELLI_PREDEFINITI.promemoria,
      invitoAttivazione:
        installazione?.whatsappModelloInvito ?? NOMI_MODELLI_PREDEFINITI.invitoAttivazione,
      verificaNumero:
        installazione?.whatsappModelloVerifica ?? NOMI_MODELLI_PREDEFINITI.verificaNumero,
    };
  }

  /** Un messaggio WhatsApp non consegnato non deve far fallire l'operazione. */
  private async accodaWhatsapp(lavoro: LavoroWhatsapp): Promise<void> {
    try {
      await this.coda.accoda(CODA_WHATSAPP, lavoro);
    } catch (errore) {
      this.logger.error('Messaggio WhatsApp non accodato.', errore);
    }
  }

  /**
   * Un messaggio non consegnato non deve far fallire l'operazione dell'utente:
   * l'errore viene registrato e la coda ritenta.
   */
  private async accoda(messaggio: MessaggioEmail): Promise<void> {
    try {
      await this.coda.accoda(CODA_EMAIL, messaggio);
    } catch (errore) {
      this.logger.error(`E-mail non accodata: «${messaggio.oggetto}».`, errore);
    }
  }
}
