import { SetMetadata } from '@nestjs/common';

export const CHIAVE_LIMITE_FREQUENZA = 'limite_frequenza';

export interface LimiteFrequenza {
  /** Numero massimo di richieste consentite nella finestra. */
  massimo: number;
  /** Ampiezza della finestra, in secondi. */
  finestraSecondi: number;
}

/**
 * Limita la frequenza delle richieste a una rotta sensibile
 * (accesso, registrazione, reset password, verifica, prenotazione).
 */
export const LimiteDiFrequenza = (massimo: number, finestraSecondi: number) =>
  SetMetadata(CHIAVE_LIMITE_FREQUENZA, { massimo, finestraSecondi } satisfies LimiteFrequenza);
