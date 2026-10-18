import { z } from 'zod';
import {
  schemaCognome,
  schemaEmail,
  schemaNome,
  schemaNumeroWhatsapp,
  schemaPassword,
} from './comuni.js';
import { schemaIdentificativo } from './servizi.js';

/**
 * Creazione dell'account di un dipendente. Il titolare non imposta la password:
 * il sistema genera un invito con cui il dipendente sceglie la propria.
 */
export const schemaCreazioneDipendente = z.object({
  nome: schemaNome,
  cognome: schemaCognome,
  email: schemaEmail,
  numeroWhatsapp: schemaNumeroWhatsapp.optional(),
});

export type DatiCreazioneDipendente = z.infer<typeof schemaCreazioneDipendente>;

export const schemaModificaOperatore = z.object({
  nome: schemaNome.optional(),
  cognome: schemaCognome.optional(),
  numeroWhatsapp: schemaNumeroWhatsapp.nullable().optional(),
});

export type DatiModificaOperatore = z.infer<typeof schemaModificaOperatore>;

export const schemaAttivazioneAccount = z.object({
  token: z.string().min(16, 'Link di attivazione non valido.'),
  password: schemaPassword,
  /**
   * Obbligatoria solo per i clienti la cui scheda è stata creata dal personale
   * con il solo numero WhatsApp: senza e-mail non potrebbero più accedere.
   */
  email: schemaEmail.optional(),
});

export type DatiAttivazioneAccount = z.infer<typeof schemaAttivazioneAccount>;

export const schemaOperatore = z.object({
  id: schemaIdentificativo,
  nome: z.string(),
  cognome: z.string(),
  email: z.string(),
  numeroWhatsapp: z.string().nullable(),
  ruolo: z.enum(['titolare', 'dipendente']),
  attivo: z.boolean(),
  accountAttivato: z.boolean(),
});

export type Operatore = z.infer<typeof schemaOperatore>;
