import { jest } from '@jest/globals';
import { LimiteFrequenzaServizio } from './limite-frequenza.servizio.js';

describe('LimiteFrequenzaServizio', () => {
  let servizio: LimiteFrequenzaServizio;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-01T10:00:00Z'));
    servizio = new LimiteFrequenzaServizio();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('consente le richieste entro il limite e blocca quelle successive', () => {
    for (let tentativo = 1; tentativo <= 5; tentativo += 1) {
      expect(servizio.registra('ip:accesso', 5, 60)).toBe(true);
    }

    expect(servizio.registra('ip:accesso', 5, 60)).toBe(false);
  });

  it('conta le chiavi in modo indipendente', () => {
    expect(servizio.registra('primo:accesso', 1, 60)).toBe(true);
    expect(servizio.registra('primo:accesso', 1, 60)).toBe(false);
    expect(servizio.registra('secondo:accesso', 1, 60)).toBe(true);
  });

  it('riapre la finestra una volta scaduta', () => {
    expect(servizio.registra('ip:accesso', 1, 60)).toBe(true);
    expect(servizio.registra('ip:accesso', 1, 60)).toBe(false);

    jest.advanceTimersByTime(60_001);

    expect(servizio.registra('ip:accesso', 1, 60)).toBe(true);
  });

  it('indica quanti secondi attendere', () => {
    servizio.registra('ip:accesso', 1, 60);
    jest.advanceTimersByTime(10_000);

    expect(servizio.secondiDiAttesa('ip:accesso')).toBe(50);
    expect(servizio.secondiDiAttesa('chiave-sconosciuta')).toBe(0);
  });
});
