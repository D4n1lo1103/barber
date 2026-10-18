import { Logger } from '@nestjs/common';
import type { MessaggioEmail, MittenteEmail } from './mittente-email.js';

/** Quanti messaggi conservare in memoria. */
const MESSAGGI_CONSERVATI = 50;

/**
 * Mittente usato quando SMTP non è configurato: il messaggio non parte, viene
 * scritto nei log e conservato in memoria. In sviluppo permette di seguire i
 * link di verifica e di reset; nei test permette di verificarne il contenuto.
 *
 * Non va usato in produzione: l'avvio registra un avviso se accade.
 */
export class MittenteRegistro implements MittenteEmail {
  private readonly logger = new Logger(MittenteRegistro.name);
  private readonly inviati: MessaggioEmail[] = [];

  readonly descrizione = 'registro locale (nessun invio reale)';

  invia(messaggio: MessaggioEmail): Promise<void> {
    this.inviati.push(messaggio);

    if (this.inviati.length > MESSAGGI_CONSERVATI) {
      this.inviati.shift();
    }

    this.logger.warn(
      `E-mail non inviata (SMTP non configurato) a ${messaggio.a}: «${messaggio.oggetto}»\n${messaggio.testo}`,
    );

    return Promise.resolve();
  }

  /** Messaggi registrati, dal più vecchio: usati dai test. */
  get messaggi(): readonly MessaggioEmail[] {
    return this.inviati;
  }

  /** Ultimo messaggio inviato a un indirizzo. */
  ultimoPer(indirizzo: string): MessaggioEmail | undefined {
    return [...this.inviati].reverse().find((messaggio) => messaggio.a === indirizzo);
  }

  svuota(): void {
    this.inviati.length = 0;
  }
}
