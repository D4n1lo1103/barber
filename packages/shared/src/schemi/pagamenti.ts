import { z } from 'zod';
import { FORME_RESTITUZIONE } from '../dominio/caparra.js';

/** Pagamento della caparra da far completare al cliente. */
export const schemaPagamentoDaCompletare = z.object({
  urlPagamento: z.string(),
  importoCentesimi: z.number().int(),
  /** Istante oltre cui lo slot non è più tenuto, in ISO-8601. */
  scadeIl: z.string(),
});

export type PagamentoDaCompletare = z.infer<typeof schemaPagamentoDaCompletare>;

/** Movimento della caparra, come lo legge l'interfaccia. */
export interface MovimentoCaparra {
  id: string;
  appuntamentoId: string;
  tipo: string;
  importoCentesimi: number;
  motivo: string;
  autore: { nome: string; cognome: string } | null;
  creatoIl: string;
}

/** Movimento del credito del cliente: positivo in accredito. */
export interface MovimentoCredito {
  id: string;
  importoCentesimi: number;
  motivo: string;
  appuntamentoId: string | null;
  creatoIl: string;
}

/** Situazione economica di un cliente, per la sua scheda. */
export interface SituazioneCaparre {
  saldoCreditoCentesimi: number;
  movimentiCaparra: MovimentoCaparra[];
  movimentiCredito: MovimentoCredito[];
}

/** Restituzione discrezionale di una caparra trattenuta: solo il titolare. */
export const schemaRestituzioneDiscrezionale = z.object({
  forma: z.enum(FORME_RESTITUZIONE),
  /** Obbligatoria: senza motivazione l'operazione non è tracciabile. */
  motivo: z
    .string()
    .trim()
    .min(5, 'Indica il motivo della restituzione.')
    .max(500, 'Motivo troppo lungo.'),
});

export type DatiRestituzioneDiscrezionale = z.infer<typeof schemaRestituzioneDiscrezionale>;

/** Esito scelto sulla pagina di pagamento finta (solo fuori dalla produzione). */
export const schemaEsitoFinto = z.object({
  riferimento: z.string().min(1),
  esito: z.enum(['riuscito', 'fallito', 'scaduto']),
});

export type DatiEsitoFinto = z.infer<typeof schemaEsitoFinto>;

/** Come sono configurati i pagamenti in questa installazione. */
export interface ConfigurazionePagamenti {
  /** Vero quando i pagamenti non sono reali: l'interfaccia lo dichiara. */
  finto: boolean;
}
