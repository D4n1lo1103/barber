import { describe, expect, it } from 'vitest';
import { schemaCreazioneVendita, schemaMovimentoGiacenza, totaleVendita } from './prodotti.js';

describe('Totale di una vendita', () => {
  it('somma prezzo per quantità di ogni riga', () => {
    expect(
      totaleVendita([
        { prezzoCentesimi: 1800, quantita: 2 },
        { prezzoCentesimi: 950, quantita: 1 },
      ]),
    ).toBe(4550);
  });

  it('vale zero senza righe', () => {
    expect(totaleVendita([])).toBe(0);
  });
});

describe('Validazione della vendita', () => {
  it('richiede almeno un prodotto', () => {
    const esito = schemaCreazioneVendita.safeParse({ righe: [] });

    expect(esito.success).toBe(false);
  });

  it('rifiuta quantità non positive', () => {
    const esito = schemaCreazioneVendita.safeParse({
      righe: [{ prodottoId: '5f1a1f3e-0000-4000-8000-000000000000', quantita: 0 }],
    });

    expect(esito.success).toBe(false);
  });
});

describe('Validazione del movimento di giacenza', () => {
  it('accetta un carico e una correzione motivati', () => {
    expect(
      schemaMovimentoGiacenza.safeParse({
        quantita: 12,
        causa: 'carico',
        motivo: 'Consegna del fornitore.',
      }).success,
    ).toBe(true);
    expect(
      schemaMovimentoGiacenza.safeParse({
        quantita: -2,
        causa: 'correzione',
        motivo: 'Due flaconi rotti in negozio.',
      }).success,
    ).toBe(true);
  });

  it('rifiuta una variazione nulla e un movimento senza motivo', () => {
    expect(
      schemaMovimentoGiacenza.safeParse({ quantita: 0, causa: 'carico', motivo: 'Niente.' })
        .success,
    ).toBe(false);
    expect(
      schemaMovimentoGiacenza.safeParse({ quantita: 5, causa: 'carico', motivo: '' }).success,
    ).toBe(false);
  });
});
