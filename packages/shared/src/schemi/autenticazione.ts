import { z } from 'zod';
import { RUOLI } from '../dominio/ruoli.js';
import { schemaCognome, schemaEmail, schemaNome, schemaPassword } from './comuni.js';

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
