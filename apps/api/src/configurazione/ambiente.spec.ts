import { describe, expect, it } from '@jest/globals';
import { ambienteBooleano, validaAmbiente } from './ambiente.js';

const AMBIENTE_MINIMO = {
  DATABASE_URL: 'postgresql://utente:password@localhost:5432/barber',
  SEGRETO_SESSIONE: 'un-segreto-di-almeno-trentadue-caratteri',
  ORIGINE_WEB: 'http://localhost:5180',
  CHIAVE_INSTALLAZIONE: 'chiave-di-installazione',
};

describe('Lettura delle variabili booleane', () => {
  it.each([
    ['true', true],
    [true, true],
    ['false', false],
    [false, false],
    [undefined, false],
  ])('converte %p in %p', (valore, atteso) => {
    expect(ambienteBooleano(valore as 'true' | 'false' | boolean | undefined)).toBe(atteso);
  });

  it('la stringa "false" non deve risultare vera', () => {
    // Il valore può arrivare come stringa: una condizione su di essa
    // sarebbe sempre vera, da qui la conversione esplicita.
    const ambiente = validaAmbiente({ ...AMBIENTE_MINIMO, CODA_ATTIVA: 'false' });

    expect(ambiente.CODA_ATTIVA).toBe('false');
    expect(ambienteBooleano(ambiente.CODA_ATTIVA)).toBe(false);
  });
});

describe('Validazione dell’ambiente', () => {
  it('accetta una configurazione minima e applica i valori predefiniti', () => {
    const ambiente = validaAmbiente(AMBIENTE_MINIMO);

    expect(ambiente.PORTA).toBe(3000);
    expect(ambiente.CODA_ATTIVA).toBe('true');
    expect(ambiente.SMTP_PORTA).toBe(587);
    expect(ambienteBooleano(ambiente.LIMITI_FREQUENZA_DISATTIVI)).toBe(false);
  });

  it('rifiuta un segreto di sessione troppo corto', () => {
    expect(() => validaAmbiente({ ...AMBIENTE_MINIMO, SEGRETO_SESSIONE: 'corto' })).toThrow(
      /SEGRETO_SESSIONE/,
    );
  });

  it('rifiuta una configurazione senza database', () => {
    const { DATABASE_URL: _ignorato, ...senzaDatabase } = AMBIENTE_MINIMO;

    expect(() => validaAmbiente(senzaDatabase)).toThrow(/DATABASE_URL/);
  });
});
