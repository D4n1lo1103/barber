import { z } from 'zod';
import { RUOLI } from '../dominio/ruoli.js';
import {
  schemaCognome,
  schemaEmail,
  schemaNome,
  schemaNumeroWhatsapp,
  schemaPassword,
} from './comuni.js';

export const schemaAccesso = z.object({
  email: schemaEmail,
  password: z.string().min(1, 'Inserisci la password.'),
});

export type DatiAccesso = z.infer<typeof schemaAccesso>;

export const schemaCambioPassword = z
  .object({
    passwordAttuale: z.string().min(1, 'Inserisci la password attuale.'),
    passwordNuova: schemaPassword,
  })
  .refine((dati) => dati.passwordAttuale !== dati.passwordNuova, {
    message: 'La nuova password deve essere diversa da quella attuale.',
    path: ['passwordNuova'],
  });

export type DatiCambioPassword = z.infer<typeof schemaCambioPassword>;

/**
 * Registrazione autonoma del cliente. Il consenso al trattamento dei dati è
 * obbligatorio; quello ai messaggi WhatsApp è separato e facoltativo, come
 * richiede il GDPR.
 */
export const schemaRegistrazioneCliente = z.object({
  nome: schemaNome,
  cognome: schemaCognome,
  email: schemaEmail,
  numeroWhatsapp: schemaNumeroWhatsapp,
  password: schemaPassword,
  consensoTrattamento: z.literal(true, {
    message: 'Per registrarti devi accettare il trattamento dei dati.',
  }),
  consensoWhatsapp: z.boolean().default(false),
});

export type DatiRegistrazioneCliente = z.infer<typeof schemaRegistrazioneCliente>;

const schemaToken = z.string().min(16, 'Link non valido.').max(200, 'Link non valido.');

export const schemaVerificaEmail = z.object({ token: schemaToken });

export type DatiVerificaEmail = z.infer<typeof schemaVerificaEmail>;

export const schemaRichiestaReset = z.object({ email: schemaEmail });

export type DatiRichiestaReset = z.infer<typeof schemaRichiestaReset>;

export const schemaConfermaReset = z.object({
  token: schemaToken,
  password: schemaPassword,
});

export type DatiConfermaReset = z.infer<typeof schemaConfermaReset>;

/**
 * Esito della registrazione: dice al frontend cosa mostrare.
 *
 * Non dice se il numero indicato apparteneva già a una scheda del salone:
 * sarebbe una risposta diversa per un numero cliente e per uno sconosciuto, e
 * chiunque potrebbe scoprire così chi è cliente. Il collegamento alla scheda
 * esistente avviene dopo la verifica del numero, non qui.
 */
export const schemaEsitoRegistrazione = z.object({
  /** Indirizzo a cui è stata inviata la verifica. */
  email: z.string(),
});

export type EsitoRegistrazione = z.infer<typeof schemaEsitoRegistrazione>;

/** Utente autenticato restituito al frontend: nessun dato sensibile. */
export const schemaUtenteAutenticato = z.object({
  id: z.uuid(),
  /** Nulla per i clienti la cui scheda è stata creata dal personale col solo numero. */
  email: schemaEmail.nullable(),
  nome: schemaNome,
  cognome: schemaCognome,
  ruolo: z.enum(RUOLI),
  attivo: z.boolean(),
});

export type UtenteAutenticato = z.infer<typeof schemaUtenteAutenticato>;
