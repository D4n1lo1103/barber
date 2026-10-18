/**
 * Invio di messaggi WhatsApp dietro un'interfaccia, come per le e-mail: la
 * logica di business non conosce il fornitore, così si può cambiare senza
 * toccarla.
 *
 * I messaggi sono **solo di servizio** e usano modelli approvati da Meta: non
 * si inviano testi liberi, perché fuori dalla finestra di conversazione Meta
 * li rifiuta.
 */

/** Messaggio costruito su un modello approvato. */
export interface MessaggioWhatsapp {
  /** Numero del destinatario in formato internazionale (es. +39333...). */
  a: string;
  /** Nome del modello approvato da Meta. */
  modello: string;
  /** Lingua del modello, es. `it`. */
  lingua: string;
  /**
   * Parametri del corpo, nell'ordine in cui appaiono nel modello: Meta li
   * sostituisce a {{1}}, {{2}}, …
   */
  parametri: string[];
  /** Parametro del pulsante, quando il modello ne ha uno (es. un codice). */
  parametroPulsante?: string;
  /**
   * Testo equivalente, usato dal mittente finto nei log e dal ripiego via
   * e-mail: il modello vero lo compone Meta.
   */
  anteprima: string;
}

export interface MittenteWhatsapp {
  invia(messaggio: MessaggioWhatsapp): Promise<void>;
  /** Descrizione leggibile, usata nei log all'avvio. */
  readonly descrizione: string;
  /** Vero quando i messaggi non partono davvero. */
  readonly finto: boolean;
}

/** Token di iniezione: le classi dipendono dall'interfaccia, non dal fornitore. */
export const MITTENTE_WHATSAPP = 'MITTENTE_WHATSAPP';

/**
 * Errore di invio WhatsApp. Chi lo intercetta ripiega sull'e-mail: il
 * messaggio di servizio deve arrivare comunque.
 */
export class ErroreWhatsapp extends Error {
  constructor(
    messaggio: string,
    readonly permanente = false,
  ) {
    super(messaggio);
    this.name = 'ErroreWhatsapp';
  }
}
