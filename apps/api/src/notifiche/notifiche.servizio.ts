import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FUSO_SALONE } from '@barber/shared';
import { CODA_EMAIL, CodaServizio } from '../attivita/coda.servizio.js';
import type { Ambiente } from '../configurazione/ambiente.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MITTENTE_EMAIL, type MessaggioEmail, type MittenteEmail } from './mittente-email.js';
import {
  modelloConfermaPrenotazione,
  modelloInvitoAttivazione,
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
    private readonly coda: CodaServizio,
    private readonly prisma: PrismaService,
    private readonly configurazione: ConfigService<Ambiente, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.coda.registra(CODA_EMAIL, (dati) => this.mittente.invia(dati as MessaggioEmail));

    this.logger.log(`Invio e-mail: ${this.mittente.descrizione}.`);
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

  async inviaInvitoAttivazione(destinatario: DestinatarioEmail, token: string): Promise<void> {
    const salone = await this.contestoSalone();

    await this.accoda(
      modelloInvitoAttivazione(salone, destinatario, this.collegamento('/attivazione', token)),
    );
  }

  async inviaConfermaPrenotazione(
    destinatario: DestinatarioEmail,
    appuntamento: AppuntamentoDaConfermare,
  ): Promise<void> {
    const salone = await this.contestoSalone();

    await this.accoda(
      modelloConfermaPrenotazione(salone, destinatario, {
        quando: FORMATO_QUANDO.format(appuntamento.inizio),
        servizi: appuntamento.servizi.map((servizio) => servizio.nome).join(' + '),
        operatore: `${appuntamento.operatore.nome} ${appuntamento.operatore.cognome}`,
        durata: `${appuntamento.durataMinuti} minuti`,
        totale: FORMATO_EURO.format(appuntamento.prezzoTotaleCentesimi / 100),
      }),
    );
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
