/**
 * Ruoli degli utenti dell'installazione.
 * Il titolare è anche un operatore; il cliente accede solo alla propria area.
 */
export const RUOLI = ['titolare', 'dipendente', 'cliente'] as const;

export type Ruolo = (typeof RUOLI)[number];

/** Ruoli che appartengono al personale del salone. */
export const RUOLI_PERSONALE: readonly Ruolo[] = ['titolare', 'dipendente'];

export function eDelPersonale(ruolo: Ruolo): boolean {
  return RUOLI_PERSONALE.includes(ruolo);
}
