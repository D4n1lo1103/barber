import { describe, expect, it } from 'vitest';
import {
  fasceSiSovrappongono,
  fasciaContenutaIn,
  minutiDaOrario,
  NOMI_GIORNI,
  orarioDaMinuti,
  trovaSovrapposizione,
} from './orari.js';

describe('Conversione degli orari', () => {
  it.each([
    ['00:00', 0],
    ['09:30', 570],
    ['13:00', 780],
    ['23:59', 1439],
  ])('converte %s in %i minuti e viceversa', (orario, minuti) => {
    expect(minutiDaOrario(orario)).toBe(minuti);
    expect(orarioDaMinuti(minuti)).toBe(orario);
  });

  it.each(['24:00', '9:30', '09:60', 'mezzogiorno', '', '09.30'])(
    'rifiuta il valore non valido "%s"',
    (valore) => {
      expect(minutiDaOrario(valore)).toBeNull();
    },
  );

  it('ignora gli spazi attorno all orario', () => {
    expect(minutiDaOrario('  08:15 ')).toBe(495);
  });

  it('nomina tutti i giorni della settimana in italiano', () => {
    expect(NOMI_GIORNI[1]).toBe('Lunedì');
    expect(NOMI_GIORNI[7]).toBe('Domenica');
  });
});

describe('Sovrapposizione delle fasce', () => {
  const mattina = { minutoInizio: 540, minutoFine: 780 };

  it('riconosce due fasce che condividono dei minuti', () => {
    expect(fasceSiSovrappongono(mattina, { minutoInizio: 700, minutoFine: 900 })).toBe(true);
  });

  it('non considera sovrapposte due fasce consecutive', () => {
    expect(fasceSiSovrappongono(mattina, { minutoInizio: 780, minutoFine: 1200 })).toBe(false);
  });

  it('riconosce una fascia contenuta in un altra', () => {
    expect(fasceSiSovrappongono(mattina, { minutoInizio: 600, minutoFine: 700 })).toBe(true);
  });

  it('trova la prima coppia sovrapposta in un elenco disordinato', () => {
    const sovrapposizione = trovaSovrapposizione([
      { minutoInizio: 900, minutoFine: 1200 },
      { minutoInizio: 540, minutoFine: 780 },
      { minutoInizio: 1100, minutoFine: 1300 },
    ]);

    expect(sovrapposizione).not.toBeNull();
    expect(sovrapposizione?.[0].minutoInizio).toBe(900);
  });

  it('non segnala nulla su fasce separate', () => {
    expect(
      trovaSovrapposizione([
        { minutoInizio: 540, minutoFine: 780 },
        { minutoInizio: 900, minutoFine: 1200 },
      ]),
    ).toBeNull();
  });

  it('non segnala nulla su elenchi vuoti o con una sola fascia', () => {
    expect(trovaSovrapposizione([])).toBeNull();
    expect(trovaSovrapposizione([mattina])).toBeNull();
  });
});

describe('Fascia contenuta negli orari di apertura', () => {
  const apertura = [
    { minutoInizio: 540, minutoFine: 780 },
    { minutoInizio: 900, minutoFine: 1200 },
  ];

  it('accetta una fascia interna a una di apertura', () => {
    expect(fasciaContenutaIn({ minutoInizio: 600, minutoFine: 780 }, apertura)).toBe(true);
  });

  it('rifiuta una fascia che sborda la chiusura', () => {
    expect(fasciaContenutaIn({ minutoInizio: 700, minutoFine: 800 }, apertura)).toBe(false);
  });

  it('rifiuta una fascia a cavallo di due aperture', () => {
    expect(fasciaContenutaIn({ minutoInizio: 700, minutoFine: 1000 }, apertura)).toBe(false);
  });

  it('rifiuta qualsiasi fascia se il salone è chiuso', () => {
    expect(fasciaContenutaIn({ minutoInizio: 600, minutoFine: 700 }, [])).toBe(false);
  });
});
