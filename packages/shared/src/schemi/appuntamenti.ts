import { z } from 'zod';
import {
  MOTIVI_ANNULLAMENTO,
  MOTIVI_ANNULLAMENTO_DA_PERSONALE,
  SERVIZI_MASSIMI_PER_APPUNTAMENTO,
  STATI_APPUNTAMENTO,
} from '../dominio/appuntamento.js';
import { schemaIdentificativo } from './servizi.js';

const schemaIstante = z.iso.datetime({ message: 'Data e ora non valide.' });

const schemaDataLocale = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica una data valida nel formato 2026-03-29.');

const schemaServiziScelti = z
  .array(schemaIdentificativo)
  .min(1, 'Scegli almeno un servizio.')
  .max(SERVIZI_MASSIMI_PER_APPUNTAMENTO, 'Troppi servizi in un solo appuntamento.')
  .refine(
    (servizi) => new Set(servizi).size === servizi.length,
    'Hai scelto due volte lo stesso servizio.',
  );

/**
 * Appuntamento inserito dal personale. Nessun preavviso minimo, ma la data
 * resta entro i limiti previsti; il flag "senza caparra" non è mai disponibile
 * al cliente.
 */
export const schemaCreazioneAppuntamento = z.object({
  clienteId: schemaIdentificativo,
  operatoreId: schemaIdentificativo,
  servizioIds: schemaServiziScelti,
  inizio: schemaIstante,
  senzaCaparra: z.boolean().default(false),
  note: z.string().trim().max(500, 'Le note sono troppo lunghe.').default(''),
});

export type DatiCreazioneAppuntamento = z.infer<typeof schemaCreazioneAppuntamento>;

/** Spostamento: nuovo orario e, se serve, nuovo operatore. */
export const schemaSpostamentoAppuntamento = z.object({
  inizio: schemaIstante,
  operatoreId: schemaIdentificativo.optional(),
});

export type DatiSpostamentoAppuntamento = z.infer<typeof schemaSpostamentoAppuntamento>;

/**
 * Annullamento registrato dal personale: è il personale a indicare se l'avviso
 * del cliente è stato tempestivo o tardivo.
 */
export const schemaAnnullamentoDaPersonale = z.object({
  motivo: z.enum(MOTIVI_ANNULLAMENTO_DA_PERSONALE, {
    message: 'Indica il motivo dell’annullamento.',
  }),
  note: z.string().trim().max(500, 'Le note sono troppo lunghe.').default(''),
});

export type DatiAnnullamentoDaPersonale = z.infer<typeof schemaAnnullamentoDaPersonale>;

/** Interrogazione dell'agenda: un intervallo di date locali del salone. */
export const schemaRicercaAgenda = z.object({
  operatoreId: schemaIdentificativo.optional(),
  clienteId: schemaIdentificativo.optional(),
  dal: schemaDataLocale,
  /** Numero di giorni mostrati: 1 per la vista giornaliera, 7 per la settimanale. */
  giorni: z.coerce.number().int().min(1).max(31).default(1),
});

export type DatiRicercaAgenda = z.infer<typeof schemaRicercaAgenda>;

/**
 * Richiesta degli slot liberi per un operatore e un insieme di servizi.
 * Essendo una query, i servizi arrivano come elenco separato da virgole
 * (`servizioIds=id1,id2`).
 */
export const schemaRichiestaDisponibilita = z.object({
  operatoreId: schemaIdentificativo,
  servizioIds: z.preprocess(
    (valore) =>
      typeof valore === 'string'
        ? valore
            .split(',')
            .map((parte) => parte.trim())
            .filter(Boolean)
        : valore,
    schemaServiziScelti,
  ),
  dal: schemaDataLocale,
  giorni: z.coerce.number().int().min(1).max(31).default(1),
  /** Esclude un appuntamento dal calcolo: serve quando lo si sta spostando. */
  escludiAppuntamentoId: schemaIdentificativo.optional(),
});

export type DatiRichiestaDisponibilita = z.infer<typeof schemaRichiestaDisponibilita>;

export const schemaServizioDellAppuntamento = z.object({
  servizioId: z.uuid().nullable(),
  nome: z.string(),
  prezzoCentesimi: z.number().int(),
  durataMinuti: z.number().int(),
});

export type ServizioDellAppuntamento = z.infer<typeof schemaServizioDellAppuntamento>;

const schemaPersonaCollegata = z.object({
  id: z.uuid(),
  nome: z.string(),
  cognome: z.string(),
});

export const schemaAppuntamento = z.object({
  id: z.uuid(),
  stato: z.enum(STATI_APPUNTAMENTO),
  motivoAnnullamento: z.enum(MOTIVI_ANNULLAMENTO).nullable(),
  cliente: schemaPersonaCollegata.extend({ numeroWhatsapp: z.string().nullable() }),
  operatore: schemaPersonaCollegata,
  inizio: z.string(),
  fine: z.string(),
  durataMinuti: z.number().int(),
  prezzoTotaleCentesimi: z.number().int(),
  senzaCaparra: z.boolean(),
  /** Caparra dovuta, calcolata alla prenotazione: zero se non richiesta. */
  caparraCentesimi: z.number().int(),
  /** Caparra effettivamente pagata e non restituita. */
  caparraPagataCentesimi: z.number().int(),
  /** Istante oltre cui lo slot non è più tenuto, mentre si attende il pagamento. */
  bloccoScadeIl: z.string().nullable(),
  note: z.string(),
  servizi: z.array(schemaServizioDellAppuntamento),
  creatoDaPersonale: z.boolean(),
  creatoIl: z.string(),
});

export type Appuntamento = z.infer<typeof schemaAppuntamento>;

/** Slot liberi raggruppati per giorno locale del salone. */
export const schemaDisponibilitaGiorno = z.object({
  giorno: z.string(),
  /** Istanti ISO in UTC. */
  slot: z.array(z.string()),
});

export type DisponibilitaGiorno = z.infer<typeof schemaDisponibilitaGiorno>;
