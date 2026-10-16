import { describe, expect, it } from 'vitest';
import {
  centesimiDaPrezzo,
  formattaData,
  formattaDurata,
  formattaPrezzo,
  prezzoDaCentesimi,
} from './formati';

describe('Formati italiani', () => {
  /** Intl separa importo e simbolo con uno spazio unificatore. */
  function conSpaziNormali(valore: string): string {
    return valore.replace(/\u00a0/g, ' ');
  }

  it('formatta i prezzi in euro', () => {
    expect(conSpaziNormali(formattaPrezzo(2000))).toBe('20,00 €');
    expect(conSpaziNormali(formattaPrezzo(1250))).toBe('12,50 €');
    expect(conSpaziNormali(formattaPrezzo(0))).toBe('0,00 €');
  });

  it.each([
    ['20', 2000],
    ['12,50', 1250],
    ['12.50', 1250],
    ['0', 0],
    ['7,05', 705],
  ])('converte "%s" in %i centesimi', (valore, atteso) => {
    expect(centesimiDaPrezzo(valore)).toBe(atteso);
  });

  it.each(['', 'venti', '12,345', '-5', '1,2,3'])('rifiuta il prezzo non valido "%s"', (valore) => {
    expect(centesimiDaPrezzo(valore)).toBeNull();
  });

  it('riporta i centesimi in formato modificabile', () => {
    expect(prezzoDaCentesimi(1250)).toBe('12,50');
    expect(centesimiDaPrezzo(prezzoDaCentesimi(3399))).toBe(3399);
  });

  it('formatta le durate in ore e minuti', () => {
    expect(formattaDurata(30)).toBe('30 min');
    expect(formattaDurata(60)).toBe('1 h');
    expect(formattaDurata(90)).toBe('1 h 30 min');
    expect(formattaDurata(150)).toBe('2 h 30 min');
  });

  it('mostra le date nel fuso del salone', () => {
    // Istante invernale: a Roma è già il giorno successivo.
    expect(formattaData('2026-01-14T23:30:00.000Z')).toBe('15 gennaio 2026');
    // Istante estivo, con ora legale attiva.
    expect(formattaData('2026-07-14T22:30:00.000Z')).toBe('15 luglio 2026');
  });
});
