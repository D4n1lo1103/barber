import { z } from 'zod';

/**
 * Impostazioni dei messaggi WhatsApp.
 *
 * Qui c'è solo ciò che **non è un segreto**: attivazione, identificativo del
 * numero mittente e nomi dei modelli approvati da Meta. Il token di accesso
 * vive nelle variabili d'ambiente, come le altre credenziali, e non passa mai
 * dal database né dall'interfaccia.
 */
const schemaNomeModello = z
  .string()
  .trim()
  .min(1, 'Indica il nome del modello approvato.')
  .max(80, 'Nome del modello troppo lungo.')
  // Meta accetta nomi in minuscolo, con numeri e trattini bassi.
  .regex(/^[a-z0-9_]+$/, 'Il nome del modello usa solo minuscole, numeri e trattini bassi.');

export const schemaModelliWhatsapp = z.object({
  confermaPrenotazione: schemaNomeModello,
  promemoria: schemaNomeModello,
  invitoAttivazione: schemaNomeModello,
  verificaNumero: schemaNomeModello,
});

export type ModelliWhatsapp = z.infer<typeof schemaModelliWhatsapp>;

/**
 * Nomi con cui i modelli vengono registrati presso Meta. Sono i valori
 * iniziali: ogni salone registra i propri e può cambiarli dalle impostazioni.
 */
export const MODELLI_WHATSAPP_PREDEFINITI: ModelliWhatsapp = {
  confermaPrenotazione: 'conferma_prenotazione',
  promemoria: 'promemoria_appuntamento',
  invitoAttivazione: 'invito_attivazione',
  verificaNumero: 'verifica_numero',
};

/** Messaggi WhatsApp disattivati: la configurazione di partenza. */
export const WHATSAPP_DISATTIVO = {
  attivo: false,
  idNumero: '',
  modelli: MODELLI_WHATSAPP_PREDEFINITI,
} as const;

export const schemaImpostazioniWhatsapp = z
  .object({
    /** Se falso nessun messaggio WhatsApp parte: si usa solo l'e-mail. */
    attivo: z.boolean(),
    /**
     * Identificativo del numero mittente presso Meta (Phone Number ID): lo si
     * legge dalla console di Meta e non è un segreto.
     */
    idNumero: z
      .string()
      .trim()
      .max(40, 'Identificativo troppo lungo.')
      .regex(/^[0-9]*$/, 'L’identificativo del numero è composto da sole cifre.'),
    modelli: schemaModelliWhatsapp,
  })
  .refine((dati) => !dati.attivo || dati.idNumero.length > 0, {
    message: 'Per attivare WhatsApp serve l’identificativo del numero mittente.',
    path: ['idNumero'],
  });

export type DatiImpostazioniWhatsapp = z.infer<typeof schemaImpostazioniWhatsapp>;

/** Stato dei messaggi WhatsApp, come lo legge l'interfaccia del titolare. */
export interface StatoWhatsapp extends DatiImpostazioniWhatsapp {
  /**
   * Vero quando il token è presente nell'ambiente. Senza token i messaggi non
   * partono: l'interfaccia lo dice invece di far credere il contrario.
   */
  tokenConfigurato: boolean;
  /** Vero quando i messaggi vengono solo registrati, non inviati. */
  finto: boolean;
}

/** Esito di un invio di prova, per verificare la configurazione. */
export interface EsitoInvioDiProva {
  inviato: boolean;
  /** Canale effettivamente usato. */
  canale: 'whatsapp' | 'email' | 'nessuno';
  dettaglio: string;
}

export const schemaInvioDiProva = z.object({
  /** Numero a cui inviare la prova, in formato internazionale. */
  numeroWhatsapp: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{7,14}$/, 'Indica il numero in formato internazionale, es. +39333…'),
});

export type DatiInvioDiProva = z.infer<typeof schemaInvioDiProva>;

/** Verifica del numero del cliente con un codice ricevuto su WhatsApp. */
export const schemaCodiceVerificaNumero = z.object({
  codice: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Il codice è composto da sei cifre.'),
});

export type DatiCodiceVerificaNumero = z.infer<typeof schemaCodiceVerificaNumero>;

/** Esito della richiesta di un codice di verifica. */
export interface EsitoRichiestaCodice {
  /** Canale su cui è stato inviato il codice. */
  canale: 'whatsapp' | 'email';
  /** Istante oltre cui il codice non è più valido, in ISO-8601. */
  scadeIl: string;
}
