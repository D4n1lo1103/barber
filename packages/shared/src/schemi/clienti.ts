import { z } from 'zod';
import { schemaCognome, schemaEmail, schemaNome, schemaNumeroWhatsapp } from './comuni.js';
import { schemaIdentificativo } from './servizi.js';

/**
 * Scheda cliente creata dal personale (es. cliente al telefono). Bastano nome,
 * cognome e numero WhatsApp: l'e-mail è facoltativa e viene chiesta al cliente
 * quando attiva l'account. Il personale non imposta mai la password.
 */
export const schemaCreazioneCliente = z.object({
  nome: schemaNome,
  cognome: schemaCognome,
  numeroWhatsapp: schemaNumeroWhatsapp,
  email: schemaEmail.optional(),
  /**
   * Consenso ai messaggi WhatsApp dichiarato dal cliente al telefono o in
   * negozio: senza, l'invito ad attivare l'account e gli altri messaggi di
   * servizio vanno via e-mail. Il cliente può cambiarlo dalla propria area.
   */
  consensoWhatsapp: z.boolean().default(false),
  note: z.string().trim().max(500, 'Le note sono troppo lunghe.').default(''),
});

export type DatiCreazioneCliente = z.infer<typeof schemaCreazioneCliente>;

export const schemaModificaCliente = z.object({
  nome: schemaNome.optional(),
  cognome: schemaCognome.optional(),
  numeroWhatsapp: schemaNumeroWhatsapp.optional(),
  email: schemaEmail.nullable().optional(),
  note: z.string().trim().max(500, 'Le note sono troppo lunghe.').optional(),
});

export type DatiModificaCliente = z.infer<typeof schemaModificaCliente>;

export const schemaRicercaClienti = z.object({
  /** Cerca per nome, cognome, numero WhatsApp o e-mail. */
  cerca: z.string().trim().max(80).default(''),
  pagina: z.coerce.number().int().min(1).default(1),
  perPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export type DatiRicercaClienti = z.infer<typeof schemaRicercaClienti>;

export const schemaCliente = z.object({
  id: schemaIdentificativo,
  nome: z.string(),
  cognome: z.string(),
  numeroWhatsapp: z.string().nullable(),
  email: z.string().nullable(),
  note: z.string(),
  attivo: z.boolean(),
  /** Vero quando il cliente ha scelto la password e può accedere da solo. */
  accountAttivato: z.boolean(),
  /** Vero quando il cliente ha acconsentito ai messaggi WhatsApp. */
  consensoWhatsapp: z.boolean(),
  creatoIl: z.string(),
});

export type Cliente = z.infer<typeof schemaCliente>;

export const schemaElencoClienti = z.object({
  clienti: z.array(schemaCliente),
  totale: z.number().int(),
  pagina: z.number().int(),
  perPagina: z.number().int(),
});

export type ElencoClienti = z.infer<typeof schemaElencoClienti>;
