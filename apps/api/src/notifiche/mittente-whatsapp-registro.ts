import { Logger } from '@nestjs/common';
import type { MessaggioWhatsapp, MittenteWhatsapp } from './mittente-whatsapp.js';

/**
 * Mittente WhatsApp finto: non invia nulla, registra i messaggi nei log e in
 * memoria. È quello che viene usato senza credenziali di Meta, in sviluppo e
 * nei test, e non viene mai costruito in produzione.
 *
 * I messaggi restano in memoria così i test possono verificarne il contenuto;
 * l'elenco è limitato per non far crescere la memoria in sviluppo.
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

    // Il numero del destinatario è un dato personale: nei log resta solo il
    // modello usato, con l'anteprima del testo.
    this.logger.log(`WhatsApp non inviato (modello ${messaggio.modello}): ${messaggio.anteprima}`);

    return Promise.resolve();
  }

  /** Svuota il registro: usato fra un test e l'altro. */
  svuota(): void {
    this.messaggi.length = 0;
  }
}
