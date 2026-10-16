import { z } from 'zod';

export const schemaIdentificativo = z.uuid('Identificativo non valido.');

const schemaPrezzo = z
  .number()
  .int('Il prezzo deve essere un importo valido in centesimi.')
  .min(0, 'Il prezzo non può essere negativo.')
  .max(100_000_000, 'Il prezzo è troppo alto.');

const schemaDurata = z
  .number()
  .int('La durata deve essere in minuti interi.')
  .min(5, 'La durata minima è di 5 minuti.')
  .max(480, 'La durata massima è di 8 ore.');

export const schemaCreazioneServizio = z.object({
  nome: z.string().trim().min(2, 'Il nome del servizio è troppo corto.').max(80),
  descrizione: z.string().trim().max(300).default(''),
  prezzoCentesimi: schemaPrezzo,
  durataMinuti: schemaDurata,
  /** Operatori abilitati a erogare il servizio. */
  operatoriAbilitati: z.array(schemaIdentificativo).default([]),
});

export type DatiCreazioneServizio = z.infer<typeof schemaCreazioneServizio>;

export const schemaModificaServizio = schemaCreazioneServizio.partial().extend({
  attivo: z.boolean().optional(),
});

export type DatiModificaServizio = z.infer<typeof schemaModificaServizio>;

export const schemaRiordinoServizi = z.object({
  idOrdinati: z.array(schemaIdentificativo).min(1, 'Indica almeno un servizio.'),
});

export type DatiRiordinoServizi = z.infer<typeof schemaRiordinoServizi>;

export const schemaServizio = z.object({
  id: z.uuid(),
  nome: z.string(),
  descrizione: z.string(),
  prezzoCentesimi: z.number().int(),
  durataMinuti: z.number().int(),
  attivo: z.boolean(),
  ordine: z.number().int(),
  operatoriAbilitati: z.array(z.uuid()),
});

export type Servizio = z.infer<typeof schemaServizio>;
