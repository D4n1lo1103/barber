import { describe, expect, it } from 'vitest';
import {
  dataDiVista,
  dataDiVistaDaGiorno,
  giornoDaDataDiVista,
  istanteDaDataDiVista,
  spostaDiGiorni,
} from './fuso-vista';

describe('Date di vista dell’agenda', () => {
  it('mostra un istante UTC con l’ora del salone', () => {
    // 07:00 UTC in luglio sono le 09:00 a Roma.
    const vista = dataDiVista('2026-07-15T07:00:00.000Z');

    expect(vista.getHours()).toBe(9);
    expect(vista.getMinutes()).toBe(0);
    expect(giornoDaDataDiVista(vista)).toBe('2026-07-15');
  });

  it('torna all’istante reale senza perdere l’orario', () => {
    const istante = '2026-07-15T07:30:00.000Z';

    expect(istanteDaDataDiVista(dataDiVista(istante)).toISOString()).toBe(istante);
  });

  it('funziona anche con l’ora solare', () => {
    const istante = '2026-01-15T08:00:00.000Z';
    const vista = dataDiVista(istante);

    expect(vista.getHours()).toBe(9);
    expect(istanteDaDataDiVista(vista).toISOString()).toBe(istante);
  });

  it('converte un giorno del salone in data di vista e viceversa', () => {
    const vista = dataDiVistaDaGiorno('2026-03-29');

    expect(giornoDaDataDiVista(vista)).toBe('2026-03-29');
    expect(vista.getHours()).toBe(0);
  });

  it('sposta di giorni attraversando il cambio di mese', () => {
    expect(giornoDaDataDiVista(spostaDiGiorni(dataDiVistaDaGiorno('2026-03-30'), 3))).toBe(
      '2026-04-02',
    );
    expect(giornoDaDataDiVista(spostaDiGiorni(dataDiVistaDaGiorno('2026-03-02'), -3))).toBe(
      '2026-02-27',
    );
  });
});
