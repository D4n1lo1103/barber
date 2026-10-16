/**
 * Gli orari ricorrenti sono espressi come minuti dalla mezzanotte nel fuso del
 * salone (Europe/Rome): "apre alle 9" resta alle 9 anche nei giorni di cambio
 * dell'ora legale. Gli istanti (assenze, appuntamenti) restano invece in UTC.
 */
export const GIORNI_SETTIMANA = [1, 2, 3, 4, 5, 6, 7] as const;

export type GiornoSettimana = (typeof GIORNI_SETTIMANA)[number];

export const NOMI_GIORNI: Readonly<Record<GiornoSettimana, string>> = {
  1: 'Lunedì',
  2: 'Martedì',
  3: 'Mercoledì',
  4: 'Giovedì',
  5: 'Venerdì',
  6: 'Sabato',
  7: 'Domenica',
};

export const MINUTI_IN_UN_GIORNO = 1440;

/** Converte "09:30" nei minuti dalla mezzanotte. Restituisce null se non valido. */
export function minutiDaOrario(orario: string): number | null {
  const corrispondenza = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(orario.trim());

  if (!corrispondenza) {
    return null;
  }

  return Number(corrispondenza[1]) * 60 + Number(corrispondenza[2]);
}

/** Converte i minuti dalla mezzanotte in "09:30". */
export function orarioDaMinuti(minuti: number): string {
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;

  return `${String(ore).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

export interface Fascia {
  minutoInizio: number;
  minutoFine: number;
}

/** Due fasce si sovrappongono se condividono almeno un minuto. */
export function fasceSiSovrappongono(prima: Fascia, seconda: Fascia): boolean {
  return prima.minutoInizio < seconda.minutoFine && seconda.minutoInizio < prima.minutoFine;
}

/** Cerca la prima coppia di fasce sovrapposte in un elenco. */
export function trovaSovrapposizione(fasce: readonly Fascia[]): [Fascia, Fascia] | null {
  const ordinate = [...fasce].sort((a, b) => a.minutoInizio - b.minutoInizio);

  for (let indice = 1; indice < ordinate.length; indice += 1) {
    const precedente = ordinate[indice - 1]!;
    const corrente = ordinate[indice]!;

    if (fasceSiSovrappongono(precedente, corrente)) {
      return [precedente, corrente];
    }
  }

  return null;
}

/**
 * Verifica che una fascia di lavoro rientri nelle fasce di apertura del salone:
 * l'operatore non può lavorare quando il salone è chiuso.
 */
export function fasciaContenutaIn(fascia: Fascia, contenitori: readonly Fascia[]): boolean {
  return contenitori.some(
    (contenitore) =>
      fascia.minutoInizio >= contenitore.minutoInizio &&
      fascia.minutoFine <= contenitore.minutoFine,
  );
}
