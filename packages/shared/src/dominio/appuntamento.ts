/** Stati del ciclo di vita di un appuntamento. */
export const STATI_APPUNTAMENTO = [
  'in_attesa_pagamento',
  'confermato',
  'completato',
  'annullato',
  'mancata_presentazione',
] as const;

export type StatoAppuntamento = (typeof STATI_APPUNTAMENTO)[number];

/** Motivo dell'annullamento, determina il trattamento della caparra. */
export const MOTIVI_ANNULLAMENTO = [
  'tempestivo',
  'tardivo',
  'dal_salone',
  'pagamento_non_completato',
] as const;

export type MotivoAnnullamento = (typeof MOTIVI_ANNULLAMENTO)[number];
