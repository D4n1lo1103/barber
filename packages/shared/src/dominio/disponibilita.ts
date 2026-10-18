/**
 * Calcolo della disponibilità di un operatore.
 *
 * Le fasce di lavoro sono minuti dalla mezzanotte locale del salone, mentre
 * appuntamenti e assenze sono istanti in UTC: ogni orario candidato viene
 * convertito singolarmente, così i giorni di cambio dell'ora legale non
 * spostano né l'apertura né gli appuntamenti già fissati.
 */
import { istanteDaDataLocale, minutiDelGiornoLocali, partiData } from './fuso.js';
import { fasciaContenutaIn, type Fascia } from './orari.js';

/** Intervallo di tempo occupato: comprende l'inizio ed esclude la fine. */
export interface Occupazione {
  inizio: Date;
  fine: Date;
}

export interface RichiestaDisponibilita {
  /** Data locale del salone, "2026-03-29". */
  giorno: string;
  /** Somma delle durate dei servizi scelti. */
  durataMinuti: number;
  /** Granularità degli slot dell'agenda, definita in installazione. */
  granularitaMinuti: number;
  /** Fasce di lavoro dell'operatore nel giorno richiesto. */
  fasceLavoro: readonly Fascia[];
  /** Appuntamenti e assenze già presenti. */
  occupazioni: readonly Occupazione[];
  /** Nessuno slot prima di questo istante (es. adesso più il preavviso minimo). */
  nonPrimaDi?: Date;
  /** Nessuno slot che inizi da questo istante in poi (es. 60 giorni). */
  nonDopoDi?: Date;
}

export function intervalliSiSovrappongono(primo: Occupazione, secondo: Occupazione): boolean {
  return primo.inizio < secondo.fine && secondo.inizio < primo.fine;
}

/**
 * Orari di inizio liberi per un appuntamento di `durataMinuti`, allineati alla
 * granularità a partire dall'inizio di ogni fascia di lavoro.
 */
export function slotLiberi(richiesta: RichiestaDisponibilita): Date[] {
  const { giorno, durataMinuti, granularitaMinuti, fasceLavoro, occupazioni } = richiesta;

  if (durataMinuti <= 0 || granularitaMinuti <= 0 || !partiData(giorno)) {
    return [];
  }

  const slot: Date[] = [];

  for (const fascia of [...fasceLavoro].sort((a, b) => a.minutoInizio - b.minutoInizio)) {
    for (
      let minuto = fascia.minutoInizio;
      minuto + durataMinuti <= fascia.minutoFine;
      minuto += granularitaMinuti
    ) {
      const inizio = istanteDaDataLocale(giorno, minuto);

      if (!inizio) {
        continue;
      }

      const candidato: Occupazione = {
        inizio,
        fine: new Date(inizio.getTime() + durataMinuti * 60_000),
      };

      if (richiesta.nonPrimaDi && candidato.inizio < richiesta.nonPrimaDi) {
        continue;
      }

      if (richiesta.nonDopoDi && candidato.inizio >= richiesta.nonDopoDi) {
        continue;
      }

      const occupato = occupazioni.some((occupazione) =>
        intervalliSiSovrappongono(candidato, occupazione),
      );

      if (!occupato) {
        slot.push(candidato.inizio);
      }
    }
  }

  return slot.sort((primo, secondo) => primo.getTime() - secondo.getTime());
}

/** Esito della verifica di un orario proposto per un appuntamento. */
export type EsitoCollocazione =
  | { esito: 'valido' }
  | { esito: 'non_allineato' }
  | { esito: 'fuori_orario' }
  | { esito: 'occupato' };

/**
 * Verifica che un appuntamento stia dentro una sola fascia di lavoro, sia
 * allineato alla granularità e non si sovrapponga a nulla di già presente.
 */
export function verificaCollocazione(parametri: {
  inizio: Date;
  durataMinuti: number;
  granularitaMinuti: number;
  fasceLavoro: readonly Fascia[];
  occupazioni: readonly Occupazione[];
}): EsitoCollocazione {
  const { inizio, durataMinuti, granularitaMinuti, fasceLavoro, occupazioni } = parametri;
  const minutoInizio = minutiDelGiornoLocali(inizio);
  const fascia: Fascia = { minutoInizio, minutoFine: minutoInizio + durataMinuti };
  const allineato = fasceLavoro.some(
    (lavoro) =>
      minutoInizio >= lavoro.minutoInizio &&
      (minutoInizio - lavoro.minutoInizio) % granularitaMinuti === 0,
  );

  if (!fasciaContenutaIn(fascia, fasceLavoro)) {
    return { esito: 'fuori_orario' };
  }

  if (!allineato) {
    return { esito: 'non_allineato' };
  }

  const candidato: Occupazione = {
    inizio,
    fine: new Date(inizio.getTime() + durataMinuti * 60_000),
  };

  if (occupazioni.some((occupazione) => intervalliSiSovrappongono(candidato, occupazione))) {
    return { esito: 'occupato' };
  }

  return { esito: 'valido' };
}
