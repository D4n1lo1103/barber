import { describe, expect, it } from 'vitest';
import {
  annullamentoTempestivo,
  azioniDelCliente,
  occupaLoSlot,
  transizioneAmmessa,
} from './appuntamento.js';

const ADESSO = new Date('2026-07-15T08:00:00.000Z');

function fraOre(ore: number): Date {
  return new Date(ADESSO.getTime() + ore * 60 * 60 * 1000);
}

describe('Stati dell’appuntamento', () => {
  it('solo gli appuntamenti annullati liberano lo slot', () => {
    expect(occupaLoSlot('confermato')).toBe(true);
    expect(occupaLoSlot('in_attesa_pagamento')).toBe(true);
    expect(occupaLoSlot('completato')).toBe(true);
    // La mancata presentazione tiene occupato il tempo: era impegnato comunque.
    expect(occupaLoSlot('mancata_presentazione')).toBe(true);
    expect(occupaLoSlot('annullato')).toBe(false);
  });

  it('ammette solo le transizioni previste', () => {
    expect(transizioneAmmessa('in_attesa_pagamento', 'confermato')).toBe(true);
    expect(transizioneAmmessa('confermato', 'completato')).toBe(true);
    expect(transizioneAmmessa('confermato', 'mancata_presentazione')).toBe(true);
    expect(transizioneAmmessa('completato', 'annullato')).toBe(false);
    expect(transizioneAmmessa('annullato', 'confermato')).toBe(false);
    expect(transizioneAmmessa('mancata_presentazione', 'completato')).toBe(false);
  });
});

describe('Limite di preavviso', () => {
  it('è tempestivo esattamente sul limite', () => {
    expect(annullamentoTempestivo(fraOre(24), ADESSO, 24)).toBe(true);
    expect(annullamentoTempestivo(fraOre(23), ADESSO, 24)).toBe(false);
  });

  it('con limite zero resta tempestivo fino all’orario dell’appuntamento', () => {
    expect(annullamentoTempestivo(fraOre(1), ADESSO, 0)).toBe(true);
    expect(annullamentoTempestivo(fraOre(-1), ADESSO, 0)).toBe(false);
  });
});

describe('Azioni disponibili al cliente', () => {
  it('entro il preavviso può annullare e spostare', () => {
    expect(
      azioniDelCliente({
        stato: 'confermato',
        inizio: fraOre(48),
        adesso: ADESSO,
        oreLimitePreavviso: 24,
      }),
    ).toEqual({ puoAnnullare: true, puoSpostare: true });
  });

  it('dopo il preavviso il pulsante non è più disponibile', () => {
    expect(
      azioniDelCliente({
        stato: 'confermato',
        inizio: fraOre(5),
        adesso: ADESSO,
        oreLimitePreavviso: 24,
      }),
    ).toEqual({ puoAnnullare: false, puoSpostare: false });
  });

  it('su un appuntamento già chiuso non si fa nulla', () => {
    for (const stato of ['completato', 'annullato', 'mancata_presentazione'] as const) {
      expect(
        azioniDelCliente({ stato, inizio: fraOre(48), adesso: ADESSO, oreLimitePreavviso: 24 }),
      ).toEqual({ puoAnnullare: false, puoSpostare: false });
    }
  });
});
