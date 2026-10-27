import {
  ErroreWhatsapp,
  type MessaggioWhatsapp,
  type MittenteWhatsapp,
} from './mittente-whatsapp.js';

/**
 * Mittente usato in produzione quando mancano le credenziali di Meta.
 *
 * Non registra nulla e rifiuta ogni invio: chi lo chiama ripiega sull'e-mail.
 * Serve a non far finire nei log di un salone vero i contenuti dei messaggi —
 * link di attivazione e codici di verifica sono credenziali a tutti gli
 * effetti — cosa che il mittente di sviluppo fa di proposito.
 */
export class MittenteWhatsappNonConfigurato implements MittenteWhatsapp {
  readonly finto = true;
  readonly descrizione = 'Non configurato (i messaggi vanno via e-mail)';

  invia(_messaggio: MessaggioWhatsapp): Promise<void> {
    return Promise.reject(
      new ErroreWhatsapp('WhatsApp non è configurato su questa installazione.', true),
    );
  }
}
