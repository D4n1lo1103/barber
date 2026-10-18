import { describe, expect, it } from 'vitest';
import {
  dataLocale,
  fineGiornoLocale,
  giorniConsecutivi,
  giornoSettimanaLocale,
  inizioGiornoLocale,
  istanteDaDataLocale,
  minutiDelGiornoLocali,
  partiData,
} from './fuso.js';

describe('Ora locale del salone', () => {
  it('converte le 09:00 di gennaio (ora solare, UTC+1)', () => {
    const istante = istanteDaDataLocale('2026-01-15', 9 * 60);

    expect(istante?.toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });

  it('converte le 09:00 di luglio (ora legale, UTC+2)', () => {
    const istante = istanteDaDataLocale('2026-07-15', 9 * 60);

    expect(istante?.toISOString()).toBe('2026-07-15T07:00:00.000Z');
  });

  it('legge data, minuti e giorno della settimana di un istante', () => {
    const istante = new Date('2026-07-15T07:30:00.000Z');

    expect(dataLocale(istante)).toBe('2026-07-15');
    expect(minutiDelGiornoLocali(istante)).toBe(9 * 60 + 30);
    expect(giornoSettimanaLocale(istante)).toBe(3);
  });

  it('tiene la mezzanotte locale nel giorno giusto', () => {
    const istante = istanteDaDataLocale('2026-07-15', 0);

    expect(istante?.toISOString()).toBe('2026-07-14T22:00:00.000Z');
    expect(dataLocale(istante!)).toBe('2026-07-15');
    expect(minutiDelGiornoLocali(istante!)).toBe(0);
  });

  it('rifiuta le date non valide', () => {
    expect(partiData('2026-13-01')).toBeNull();
    expect(partiData('15/01/2026')).toBeNull();
    expect(istanteDaDataLocale('non una data', 540)).toBeNull();
  });

  it('elenca giorni consecutivi attraversando il cambio di mese', () => {
    expect(giorniConsecutivi('2026-03-30', 3)).toEqual(['2026-03-30', '2026-03-31', '2026-04-01']);
  });
});

describe('Giorni di cambio dell’ora legale', () => {
  // Nel 2026 l'ora legale inizia il 29 marzo e finisce il 25 ottobre.
  it('le 09:00 del giorno di passaggio all’ora legale sono alle 07:00 UTC', () => {
    expect(istanteDaDataLocale('2026-03-29', 9 * 60)?.toISOString()).toBe(
      '2026-03-29T07:00:00.000Z',
    );
  });

  it('le 09:00 del giorno di ritorno all’ora solare sono alle 08:00 UTC', () => {
    expect(istanteDaDataLocale('2026-10-25', 9 * 60)?.toISOString()).toBe(
      '2026-10-25T08:00:00.000Z',
    );
  });

  it('l’ora che non esiste scivola in avanti', () => {
    // Le 02:30 del 29 marzo non esistono: la notte salta dalle 02:00 alle 03:00.
    const istante = istanteDaDataLocale('2026-03-29', 2 * 60 + 30);

    expect(istante?.toISOString()).toBe('2026-03-29T01:30:00.000Z');
    expect(minutiDelGiornoLocali(istante!)).toBe(3 * 60 + 30);
  });

  it('il giorno di primavera dura 23 ore e quello d’autunno 25', () => {
    const marzo =
      (fineGiornoLocale('2026-03-29')!.getTime() - inizioGiornoLocale('2026-03-29')!.getTime()) /
      3_600_000;
    const ottobre =
      (fineGiornoLocale('2026-10-25')!.getTime() - inizioGiornoLocale('2026-10-25')!.getTime()) /
      3_600_000;

    expect(marzo).toBe(23);
    expect(ottobre).toBe(25);
  });
});
