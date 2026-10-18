/**
 * Conversioni fra istanti UTC e ora locale del salone.
 *
 * Nel database tutto è in UTC, mentre gli orari ricorrenti (apertura, orari di
 * lavoro) sono minuti dalla mezzanotte nel fuso del salone. Per costruire o
 * leggere un appuntamento serve passare da una rappresentazione all'altra
 * tenendo conto dell'ora legale, senza dipendere dal fuso della macchina.
 */
import type { GiornoSettimana } from './orari.js';

export const FUSO_SALONE = 'Europe/Rome';

const FORMATTATORE = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_SALONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export interface OraLocale {
  anno: number;
  mese: number;
  giorno: number;
  ore: number;
  minuti: number;
  secondi: number;
}

/** Scompone un istante nell'ora locale del salone. */
export function oraLocale(istante: Date): OraLocale {
  const parti = new Map(
    FORMATTATORE.formatToParts(istante)
      .filter((parte) => parte.type !== 'literal')
      .map((parte) => [parte.type, Number(parte.value)]),
  );

  return {
    anno: parti.get('year') ?? 0,
    mese: parti.get('month') ?? 1,
    giorno: parti.get('day') ?? 1,
    // Alcuni ambienti formattano la mezzanotte come "24".
    ore: (parti.get('hour') ?? 0) % 24,
    minuti: parti.get('minute') ?? 0,
    secondi: parti.get('second') ?? 0,
  };
}

/** Data locale del salone in formato ISO "2026-03-29". */
export function dataLocale(istante: Date): string {
  const { anno, mese, giorno } = oraLocale(istante);

  return `${String(anno).padStart(4, '0')}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

/** Minuti dalla mezzanotte locale del salone. */
export function minutiDelGiornoLocali(istante: Date): number {
  const { ore, minuti } = oraLocale(istante);

  return ore * 60 + minuti;
}

/** Giorno della settimana ISO (1 = lunedì) nel fuso del salone. */
export function giornoSettimanaLocale(istante: Date): GiornoSettimana {
  const { anno, mese, giorno } = oraLocale(istante);
  const giornoJs = new Date(Date.UTC(anno, mese - 1, giorno)).getUTCDay();

  return (giornoJs === 0 ? 7 : giornoJs) as GiornoSettimana;
}

/** Scompone "2026-03-29" nelle sue parti; null se il formato non è valido. */
export function partiData(data: string): { anno: number; mese: number; giorno: number } | null {
  const corrispondenza = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.trim());

  if (!corrispondenza) {
    return null;
  }

  const anno = Number(corrispondenza[1]);
  const mese = Number(corrispondenza[2]);
  const giorno = Number(corrispondenza[3]);

  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) {
    return null;
  }

  return { anno, mese, giorno };
}

/** Differenza in minuti fra l'ora locale del salone e UTC in un dato istante. */
function scartoMinuti(istante: Date): number {
  const { anno, mese, giorno, ore, minuti, secondi } = oraLocale(istante);
  const comeSeFosseUtc = Date.UTC(anno, mese - 1, giorno, ore, minuti, secondi);

  return (comeSeFosseUtc - Math.floor(istante.getTime() / 1000) * 1000) / 60_000;
}

/**
 * Costruisce l'istante UTC corrispondente a un'ora locale del salone.
 *
 * Lo scarto da UTC viene calcolato due volte perché cambia nei giorni di
 * passaggio all'ora legale. Nell'ora che non esiste (la notte di primavera
 * fra le 02:00 e le 03:00) il risultato scivola in avanti di un'ora, e
 * nell'ora doppia dell'autunno viene scelta la prima occorrenza.
 */
export function istanteDaOraLocale(
  anno: number,
  mese: number,
  giorno: number,
  minutiDelGiorno: number,
): Date {
  const comeSeFosseUtc = Date.UTC(anno, mese - 1, giorno) + minutiDelGiorno * 60_000;
  const primoScarto = scartoMinuti(new Date(comeSeFosseUtc));
  const candidato = new Date(comeSeFosseUtc - primoScarto * 60_000);
  const secondoScarto = scartoMinuti(candidato);

  return secondoScarto === primoScarto
    ? candidato
    : new Date(comeSeFosseUtc - secondoScarto * 60_000);
}

/** Come `istanteDaOraLocale`, partendo da una data "2026-03-29". */
export function istanteDaDataLocale(data: string, minutiDelGiorno: number): Date | null {
  const parti = partiData(data);

  if (!parti) {
    return null;
  }

  return istanteDaOraLocale(parti.anno, parti.mese, parti.giorno, minutiDelGiorno);
}

/** Istante della mezzanotte locale del giorno indicato. */
export function inizioGiornoLocale(data: string): Date | null {
  return istanteDaDataLocale(data, 0);
}

/** Istante della mezzanotte locale del giorno successivo. */
export function fineGiornoLocale(data: string): Date | null {
  const parti = partiData(data);

  if (!parti) {
    return null;
  }

  const giornoDopo = new Date(Date.UTC(parti.anno, parti.mese - 1, parti.giorno + 1));

  return istanteDaOraLocale(
    giornoDopo.getUTCFullYear(),
    giornoDopo.getUTCMonth() + 1,
    giornoDopo.getUTCDate(),
    0,
  );
}

/** Elenco di date locali consecutive, dalla prima inclusa per `quanti` giorni. */
export function giorniConsecutivi(data: string, quanti: number): string[] {
  const parti = partiData(data);

  if (!parti || quanti < 1) {
    return [];
  }

  return Array.from({ length: quanti }, (_, scostamento) => {
    const giorno = new Date(Date.UTC(parti.anno, parti.mese - 1, parti.giorno + scostamento));

    return giorno.toISOString().slice(0, 10);
  });
}
