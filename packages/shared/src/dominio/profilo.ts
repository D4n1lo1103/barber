/** Tipologia dell'attività, scelta in fase di installazione. */
export const PROFILI = ['barbiere', 'parrucchiere'] as const;

export type Profilo = (typeof PROFILI)[number];
