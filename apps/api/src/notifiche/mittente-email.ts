/**
 * Invio e-mail dietro un'interfaccia: la logica di business non conosce il
 * provider, così si può cambiare (Brevo, altro SMTP) senza toccarla.
 */
export interface MessaggioEmail {
  /** Destinatario. */
  a: string;
  oggetto: string;
  /** Versione testuale, sempre presente. */
  testo: string;
  html?: string;
}

export interface MittenteEmail {
  invia(messaggio: MessaggioEmail): Promise<void>;
  /** Descrizione leggibile, usata nei log all'avvio. */
  readonly descrizione: string;
}

/** Token di iniezione: le classi dipendono dall'interfaccia, non dal provider. */
export const MITTENTE_EMAIL = 'MITTENTE_EMAIL';
