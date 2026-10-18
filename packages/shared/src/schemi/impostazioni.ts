import { z } from 'zod';
import { FORME_RESTITUZIONE } from '../dominio/caparra.js';

/**
 * Regole di annullamento, spostamento e caparra, configurabili dal titolare.
 * Nessuna di queste regole è un valore fisso nel codice.
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
  /** Se vero la prenotazione online richiede il pagamento della caparra. */
  caparraAttiva: z.boolean(),
  /** Percentuale della caparra sul prezzo dei servizi. */
  caparraPercentuale: z
    .number()
    .int('Indica una percentuale intera.')
    .min(1, 'La percentuale deve essere almeno 1.')
    .max(100, 'La percentuale non può superare 100.'),
  /**
   * Come viene restituita la caparra di un annullamento tempestivo: rimborso
   * sul metodo di pagamento oppure credito. Le altre regole (trattenuta per
   * l'annullamento tardivo e la mancata presentazione, rimborso integrale per
   * l'annullamento dal salone) sono fissate dai requisiti.
   */
  restituzioneCaparra: z.enum(FORME_RESTITUZIONE),
});

export type DatiRegoleSalone = z.infer<typeof schemaRegoleSalone>;

export type RegoleSalone = DatiRegoleSalone;
