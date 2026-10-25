import { z } from 'zod';
import {
  PEZZI_MASSIMI_PER_RIGA,
  RIGHE_MASSIME_PER_ORDINE,
  STATI_ORDINE,
  TIPI_CONSEGNA,
  type StatoOrdine,
  type StatoRichiestaReso,
  type TipoConsegna,
} from '../dominio/ordine.js';
import { schemaIdentificativo } from './servizi.js';

/** Riga scelta dal cliente nel carrello. */
export const schemaRigaCarrello = z.object({
  prodottoId: schemaIdentificativo,
  quantita: z
    .number()
    .int('Indica un numero intero di pezzi.')
    .min(1, 'La quantità minima è un pezzo.')
    .max(PEZZI_MASSIMI_PER_RIGA, `Puoi ordinare al massimo ${PEZZI_MASSIMI_PER_RIGA} pezzi.`),
});

export type RigaCarrello = z.infer<typeof schemaRigaCarrello>;

/**
 * Creazione di un ordine. Il cliente manda prodotti e quantità: prezzi,
 * totale e credito li calcola il server sul listino del momento, perché il
 * browser non è una fonte attendibile di importi.
 */
export const schemaCreazioneOrdine = z
  .object({
    righe: z
      .array(schemaRigaCarrello)
      .min(1, 'Il carrello è vuoto.')
      .max(RIGHE_MASSIME_PER_ORDINE, 'Troppi prodotti diversi in un solo ordine.'),
    tipoConsegna: z.enum(TIPI_CONSEGNA).default('ritiro_in_negozio'),
    note: z.string().trim().max(300, 'Le note sono troppo lunghe.').default(''),
    /** Vero quando il cliente vuole usare il credito disponibile. */
    usaCredito: z.boolean().default(true),
  })
  .refine(
    (dati) => new Set(dati.righe.map((riga) => riga.prodottoId)).size === dati.righe.length,
    'Lo stesso prodotto compare più volte nel carrello.',
  );

export type DatiCreazioneOrdine = z.infer<typeof schemaCreazioneOrdine>;

export const schemaAnnullamentoOrdine = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, 'Indica il motivo dell’annullamento.')
    .max(300, 'Motivo troppo lungo.'),
});

export type DatiAnnullamentoOrdine = z.infer<typeof schemaAnnullamentoOrdine>;

/** Avanzamento dell'ordine da parte del personale. */
export const schemaAvanzamentoOrdine = z.object({
  stato: z.enum(['in_preparazione', 'pronto_per_ritiro', 'consegnato']),
});

export type DatiAvanzamentoOrdine = z.infer<typeof schemaAvanzamentoOrdine>;

export const schemaRicercaOrdini = z.object({
  stato: z.enum(STATI_ORDINE).optional(),
  clienteId: schemaIdentificativo.optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  perPagina: z.coerce.number().int().min(1).max(100).default(25),
});

export type DatiRicercaOrdini = z.infer<typeof schemaRicercaOrdini>;

/** Richiesta di reso del cliente: il recesso non esige una motivazione. */
export const schemaRichiestaReso = z.object({
  righe: z
    .array(
      z.object({
        rigaOrdineId: schemaIdentificativo,
        quantita: z.number().int().min(1, 'La quantità minima è un pezzo.'),
      }),
    )
    .min(1, 'Scegli almeno un prodotto da restituire.')
    .max(RIGHE_MASSIME_PER_ORDINE),
  motivo: z.string().trim().max(300, 'Il motivo è troppo lungo.').default(''),
});

export type DatiRichiestaReso = z.infer<typeof schemaRichiestaReso>;

export const schemaDecisioneReso = z
  .object({
    approvato: z.boolean(),
    /** Obbligatorio sul rifiuto: senza, il cliente non saprebbe perché. */
    motivoRifiuto: z.string().trim().max(300, 'Motivo troppo lungo.').default(''),
  })
  .refine(
    (dati) => dati.approvato || dati.motivoRifiuto.length >= 3,
    'Indica il motivo del rifiuto.',
  );

export type DatiDecisioneReso = z.infer<typeof schemaDecisioneReso>;

export interface RigaOrdine {
  id: string;
  prodottoId: string | null;
  nome: string;
  prezzoCentesimi: number;
  quantita: number;
  /** Pezzi già resi o in attesa di decisione, per non renderli due volte. */
  quantitaResa: number;
}

export interface RigaResa {
  rigaOrdineId: string;
  nome: string;
  quantita: number;
}

export interface RichiestaReso {
  id: string;
  stato: StatoRichiestaReso;
  righe: RigaResa[];
  motivoCliente: string;
  motivoRifiuto: string;
  importoRimborsoCentesimi: number;
  creditoRestituitoCentesimi: number;
  richiestoIl: string;
  decisoIl: string | null;
  decisaDa: { nome: string; cognome: string } | null;
  rimborsatoIl: string | null;
}

export interface Ordine {
  id: string;
  numero: number;
  stato: StatoOrdine;
  tipoConsegna: TipoConsegna;
  righe: RigaOrdine[];
  totaleRigheCentesimi: number;
  speseConsegnaCentesimi: number;
  creditoUsatoCentesimi: number;
  daPagareCentesimi: number;
  note: string;
  cliente: { id: string; nome: string; cognome: string } | null;
  bloccoScadeIl: string | null;
  pagatoIl: string | null;
  prontoIl: string | null;
  consegnatoIl: string | null;
  annullatoIl: string | null;
  motivoAnnullamento: string;
  resi: RichiestaReso[];
  /** Vero quando il cliente può ancora chiedere il reso. */
  recessoAperto: boolean;
  /** Momento entro cui il recesso è esercitabile, se l'ordine è consegnato. */
  recessoScadeIl: string | null;
  creatoIl: string;
}

export interface ElencoOrdini {
  ordini: Ordine[];
  totale: number;
  pagina: number;
  perPagina: number;
}

/** Ordine appena creato, con il pagamento da completare quando serve. */
export interface OrdineCreato {
  ordine: Ordine;
  /** Nullo quando il credito copre tutto: non c'è nulla da pagare. */
  pagamento: { urlPagamento: string; importoCentesimi: number; scadeIl: string } | null;
}
