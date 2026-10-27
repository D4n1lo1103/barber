import { Logger } from '@nestjs/common';
import type { MessaggioWhatsapp, MittenteWhatsapp } from './mittente-whatsapp.js';

/**
 * Mittente WhatsApp finto: non invia nulla, tiene i messaggi in memoria. È
 * quello che viene usato senza credenziali di Meta in sviluppo e nei test; in
 * produzione, dove la riga di log finirebbe su disco e nei servizi di
 * monitoraggio, il modulo costruisce `MittenteWhatsappNonConfigurato`.
 *
 * Nei log resta solo il modello usato: l'anteprima contiene link di
 * attivazione e codici di verifica, che valgono quanto una password. Il testo
 * completo resta in memoria, dove lo leggono i test e lo sviluppatore.
 */
export class MittenteWhatsappRegistro implements MittenteWhatsapp {
  readonly finto = true;
  readonly descrizione = 'Registro nei log (nessun messaggio WhatsApp inviato)';

  private readonly logger = new Logger('MittenteWhatsapp');
  private readonly massimo = 50;
  readonly messaggi: MessaggioWhatsapp[] = [];

  invia(messaggio: MessaggioWhatsapp): Promise<void> {
    this.messaggi.push(messaggio);

    if (this.messaggi.length > this.massimo) {
      this.messaggi.shift();
    }

    // Né il numero del destinatario né l'anteprima finiscono nei log: il
    // primo è un dato personale, la seconda può contenere un codice o un link
    // di attivazione.
    this.logger.log(`WhatsApp non inviato (modello ${messaggio.modello}).`);

    return Promise.resolve();
  }

  /** Svuota il registro: usato fra un test e l'altro. */
  svuota(): void {
    this.messaggi.length = 0;
  }
}
