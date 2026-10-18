/** Canale su cui consegnare un messaggio di servizio. */
export type Canale = 'whatsapp' | 'email' | 'nessuno';

export interface DestinatarioMessaggio {
  nome: string;
  email: string | null;
  numeroWhatsapp: string | null;
  /** Consenso ai messaggi WhatsApp: senza, si usa l'e-mail. */
  consensoWhatsapp: boolean;
}

/**
 * Canale da tentare per primo.
 *
 * WhatsApp richiede tre cose insieme: che il salone l'abbia attivato, che il
 * cliente abbia dato il **consenso** e che ci sia un numero. Se manca una
 * qualsiasi delle tre si usa l'e-mail, che resta anche il ripiego quando
 * l'invio WhatsApp fallisce. Senza nessuno dei due recapiti non c'è canale: il
 * chiamante lo registra e tira avanti, senza far fallire l'operazione.
 */
export function canaleDaUsare(parametri: {
  whatsappAttivo: boolean;
  destinatario: DestinatarioMessaggio;
}): Canale {
  const { whatsappAttivo, destinatario } = parametri;

  if (whatsappAttivo && destinatario.consensoWhatsapp && destinatario.numeroWhatsapp) {
    return 'whatsapp';
  }

  if (destinatario.email) {
    return 'email';
  }

  return 'nessuno';
}
