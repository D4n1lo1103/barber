import { z } from 'zod';
import { schemaIdentificativo } from './servizi.js';

/** Quantità di pezzi: intera e dentro limiti ragionevoli per un salone. */
const schemaQuantita = z
  .number()
  .int('Indica un numero intero di pezzi.')
  .min(1, 'La quantità minima è un pezzo.')
  .max(1000, 'Quantità troppo alta.');

export const schemaCreazioneProdotto = z.object({
  nome: z.string().trim().min(2, 'Il nome del prodotto è troppo corto.').max(80),
  descrizione: z.string().trim().max(300).default(''),
  prezzoCentesimi: z
    .number()
    .int('Il prezzo deve essere un importo valido.')
    .min(0, 'Il prezzo non può essere negativo.')
    .max(100_000_000, 'Il prezzo è troppo alto.'),
  /** Giacenza iniziale: i carichi successivi passano dai movimenti. */
  giacenza: z
    .number()
    .int('La giacenza è un numero di pezzi.')
    .min(0, 'La giacenza non può essere negativa.')
    .max(100_000, 'Giacenza troppo alta.')
    .default(0),
  /** Zero disattiva l'avviso di scorta. */
  scortaMinima: z
    .number()
    .int('La scorta minima è un numero di pezzi.')
    .min(0, 'La scorta minima non può essere negativa.')
    .max(10_000, 'Scorta minima troppo alta.')
    .default(0),
});

export type DatiCreazioneProdotto = z.infer<typeof schemaCreazioneProdotto>;

/**
 * Modifica di un prodotto. La **giacenza non si cambia da qui**: si corregge
 * con un movimento motivato, così resta sempre una traccia di chi l'ha
 * cambiata e perché.
 */
export const schemaModificaProdotto = z.object({
  nome: z.string().trim().min(2, 'Il nome del prodotto è troppo corto.').max(80).optional(),
  descrizione: z.string().trim().max(300).optional(),
  prezzoCentesimi: z
    .number()
    .int('Il prezzo deve essere un importo valido.')
    .min(0, 'Il prezzo non può essere negativo.')
    .max(100_000_000, 'Il prezzo è troppo alto.')
    .optional(),
  scortaMinima: z
    .number()
    .int('La scorta minima è un numero di pezzi.')
    .min(0)
    .max(10_000)
    .optional(),
  attivo: z.boolean().optional(),
});

export type DatiModificaProdotto = z.infer<typeof schemaModificaProdotto>;

export const schemaProdotto = z.object({
  id: schemaIdentificativo,
  nome: z.string(),
  descrizione: z.string(),
  prezzoCentesimi: z.number().int(),
  giacenza: z.number().int(),
  scortaMinima: z.number().int(),
  /** Vero quando la giacenza è arrivata alla scorta minima o sotto. */
  sottoScorta: z.boolean(),
  attivo: z.boolean(),
  ordine: z.number().int(),
});

export type Prodotto = z.infer<typeof schemaProdotto>;

/** Carico o correzione della giacenza: solo il titolare, sempre motivata. */
export const schemaMovimentoGiacenza = z.object({
  /**
   * Variazione in pezzi: positiva in carico, negativa in scarico. Mai zero,
   * perché un movimento che non muove nulla non ha senso.
   */
  quantita: z
    .number()
    .int('Indica un numero intero di pezzi.')
    .min(-100_000, 'Variazione troppo grande.')
    .max(100_000, 'Variazione troppo grande.')
    .refine((valore) => valore !== 0, 'Indica una variazione diversa da zero.'),
  /** Carico di merce ricevuta oppure correzione dell'inventario. */
  causa: z.enum(['carico', 'correzione']),
  motivo: z
    .string()
    .trim()
    .min(3, 'Indica il motivo del movimento.')
    .max(300, 'Motivo troppo lungo.'),
});

export type DatiMovimentoGiacenza = z.infer<typeof schemaMovimentoGiacenza>;

export const CAUSE_MOVIMENTO_MAGAZZINO = [
  'vendita',
  'annullamento_vendita',
  'carico',
  'correzione',
] as const;

export type CausaMovimentoMagazzino = (typeof CAUSE_MOVIMENTO_MAGAZZINO)[number];

export const ETICHETTE_CAUSA_MOVIMENTO: Readonly<Record<CausaMovimentoMagazzino, string>> = {
  vendita: 'Vendita',
  annullamento_vendita: 'Vendita annullata',
  carico: 'Carico',
  correzione: 'Correzione',
};

export interface MovimentoMagazzino {
  id: string;
  causa: CausaMovimentoMagazzino;
  quantita: number;
  giacenzaFinale: number;
  motivo: string;
  autore: { nome: string; cognome: string } | null;
  creatoIl: string;
}

/** Vendita in negozio registrata dal personale. */
export const schemaRigaVenditaScelta = z.object({
  prodottoId: schemaIdentificativo,
  quantita: schemaQuantita,
});

export const schemaCreazioneVendita = z.object({
  righe: z
    .array(schemaRigaVenditaScelta)
    .min(1, 'Aggiungi almeno un prodotto.')
    .max(30, 'Troppi prodotti in una sola vendita.'),
  /** Cliente a cui associare la vendita: facoltativo. */
  clienteId: schemaIdentificativo.optional(),
  /** Appuntamento a cui associare la vendita: facoltativo. */
  appuntamentoId: schemaIdentificativo.optional(),
  note: z.string().trim().max(300, 'Le note sono troppo lunghe.').default(''),
});

export type DatiCreazioneVendita = z.infer<typeof schemaCreazioneVendita>;

export const schemaAnnullamentoVendita = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, 'Indica il motivo dell’annullamento.')
    .max(300, 'Motivo troppo lungo.'),
});

export type DatiAnnullamentoVendita = z.infer<typeof schemaAnnullamentoVendita>;

export interface RigaVendita {
  nome: string;
  prezzoCentesimi: number;
  quantita: number;
}

export interface Vendita {
  id: string;
  totaleCentesimi: number;
  righe: RigaVendita[];
  cliente: { id: string; nome: string; cognome: string } | null;
  appuntamentoId: string | null;
  note: string;
  registrataDa: { nome: string; cognome: string } | null;
  annullataIl: string | null;
  motivoAnnullamento: string;
  creataIl: string;
}

export const schemaRicercaVendite = z.object({
  /** Filtra per cliente, quando serve lo storico dei suoi acquisti. */
  clienteId: schemaIdentificativo.optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  perPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export type DatiRicercaVendite = z.infer<typeof schemaRicercaVendite>;

export interface ElencoVendite {
  vendite: Vendita[];
  totale: number;
  pagina: number;
  perPagina: number;
}

/**
 * Totale di una vendita, in centesimi. Vive nel pacchetto condiviso perché il
 * personale deve vedere lo stesso importo che il server registra.
 */
export function totaleVendita(
  righe: readonly { prezzoCentesimi: number; quantita: number }[],
): number {
  return righe.reduce((totale, riga) => totale + riga.prezzoCentesimi * riga.quantita, 0);
}
