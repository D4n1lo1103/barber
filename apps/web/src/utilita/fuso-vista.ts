/**
 * Ponte fra gli istanti UTC dell'API e i componenti che ragionano con l'ora
 * locale del dispositivo (l'agenda di react-big-calendar).
 *
 * Il salone lavora sempre nel fuso `Europe/Rome`, ma il browser può avere un
 * fuso diverso. Per non mostrare orari sbagliati, ogni istante viene convertito
 * in una "data di vista": una data la cui ora locale del dispositivo coincide
 * con l'ora di Roma. Le date di vista servono solo a disegnare la griglia e non
 * vengono mai inviate all'API: prima di ogni chiamata si torna all'istante
 * reale con `istanteDaDataDiVista`.
 */
import { istanteDaOraLocale, oraLocale } from '@barber/shared';

export function dataDiVista(istante: Date | string): Date {
  const reale = typeof istante === 'string' ? new Date(istante) : istante;
  const { anno, mese, giorno, ore, minuti } = oraLocale(reale);

  return new Date(anno, mese - 1, giorno, ore, minuti, 0, 0);
}

export function istanteDaDataDiVista(vista: Date): Date {
  return istanteDaOraLocale(
    vista.getFullYear(),
    vista.getMonth() + 1,
    vista.getDate(),
    vista.getHours() * 60 + vista.getMinutes(),
  );
}

/** Data locale del salone ("2026-03-29") corrispondente a una data di vista. */
export function giornoDaDataDiVista(vista: Date): string {
  const anno = String(vista.getFullYear()).padStart(4, '0');
  const mese = String(vista.getMonth() + 1).padStart(2, '0');
  const giorno = String(vista.getDate()).padStart(2, '0');

  return `${anno}-${mese}-${giorno}`;
}

/** Data di vista corrispondente alla mezzanotte di un giorno del salone. */
export function dataDiVistaDaGiorno(giorno: string): Date {
  const [anno, mese, resto] = giorno.split('-');

  return new Date(Number(anno), Number(mese) - 1, Number(resto), 0, 0, 0, 0);
}

/** Somma giorni a una data di vista, restando sulla mezzanotte locale. */
export function spostaDiGiorni(vista: Date, giorni: number): Date {
  return new Date(
    vista.getFullYear(),
    vista.getMonth(),
    vista.getDate() + giorni,
    vista.getHours(),
    vista.getMinutes(),
  );
}
