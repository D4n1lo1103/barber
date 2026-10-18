import { z } from 'zod';

/**
 * Regole di annullamento e spostamento, configurabili dal titolare.
 * Le regole sulla caparra arrivano con i pagamenti (fase 6).
 */
export const schemaRegoleSalone = z.object({
  /** Ore entro cui un annullamento del cliente è tempestivo. */
  oreLimitePreavviso: z
    .number()
    .int('Indica un numero di ore intero.')
    .min(0, 'Il limite non può essere negativo.')
    .max(336, 'Il limite non può superare le due settimane.'),
  /**
   * Se vero lo spostamento segue le regole dell'annullamento; se falso è
   * libero, purché entro il limite di preavviso.
   */
  spostamentoComeAnnullamento: z.boolean(),
  /** Anticipo del promemoria al cliente, in ore (fase 7). */
  oreAnticipoPromemoria: z
    .number()
    .int('Indica un numero di ore intero.')
    .min(1, 'Il promemoria deve precedere l’appuntamento di almeno un’ora.')
    .max(168, 'L’anticipo non può superare la settimana.'),
});

export type DatiRegoleSalone = z.infer<typeof schemaRegoleSalone>;

export type RegoleSalone = DatiRegoleSalone;
