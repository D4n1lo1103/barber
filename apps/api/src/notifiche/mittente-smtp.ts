import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { MessaggioEmail, MittenteEmail } from './mittente-email.js';

export interface ConfigurazioneSmtp {
  host: string;
  porta: number;
  utente?: string;
  password?: string;
  mittente: string;
  tlsImplicito: boolean;
}

/** Invio tramite un server SMTP configurabile (provider consigliato: Brevo). */
export class MittenteSmtp implements MittenteEmail {
  private readonly logger = new Logger(MittenteSmtp.name);
  private readonly trasporto: Transporter;

  readonly descrizione: string;

  constructor(private readonly configurazione: ConfigurazioneSmtp) {
    this.trasporto = createTransport({
      host: configurazione.host,
      port: configurazione.porta,
      secure: configurazione.tlsImplicito,
      auth: configurazione.utente
        ? { user: configurazione.utente, pass: configurazione.password }
        : undefined,
    });
    this.descrizione = `SMTP ${configurazione.host}:${configurazione.porta}`;
  }

  async invia(messaggio: MessaggioEmail): Promise<void> {
    await this.trasporto.sendMail({
      from: this.configurazione.mittente,
      to: messaggio.a,
      subject: messaggio.oggetto,
      text: messaggio.testo,
      html: messaggio.html,
    });

    // Nei log resta solo l'oggetto: il contenuto può includere dati personali
    // e i link dei token non vanno conservati.
    this.logger.log(`E-mail inviata: «${messaggio.oggetto}».`);
  }
}
