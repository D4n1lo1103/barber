import { describe, expect, it } from 'vitest';
import { slotLiberi, verificaCollocazione, type Occupazione } from './disponibilita.js';
import { istanteDaDataLocale } from './fuso.js';

const MATTINA = { minutoInizio: 9 * 60, minutoFine: 13 * 60 };
const POMERIGGIO = { minutoInizio: 15 * 60, minutoFine: 19 * 60 };

function orari(slot: readonly Date[]): string[] {
  return slot.map((istante) => istante.toISOString());
}

describe('Slot liberi', () => {
  it('propone gli orari allineati alla granularità dentro le fasce di lavoro', () => {
    const slot = slotLiberi({
      giorno: '2026-07-15',
      durataMinuti: 30,
      granularitaMinuti: 15,
      fasceLavoro: [{ minutoInizio: 9 * 60, minutoFine: 10 * 60 }],
      occupazioni: [],
    });

    expect(orari(slot)).toEqual([
      '2026-07-15T07:00:00.000Z',
      '2026-07-15T07:15:00.000Z',
      '2026-07-15T07:30:00.000Z',
    ]);
  });

  it('non propone slot che sforano la fine della fascia', () => {
    const slot = slotLiberi({
      giorno: '2026-07-15',
      durataMinuti: 45,
      granularitaMinuti: 30,
      fasceLavoro: [{ minutoInizio: 9 * 60, minutoFine: 10 * 60 }],
      occupazioni: [],
    });

    expect(orari(slot)).toEqual(['2026-07-15T07:00:00.000Z']);
  });

  it('non unisce le fasce: la pausa pranzo resta esclusa', () => {
    const slot = slotLiberi({
      giorno: '2026-07-15',
      durataMinuti: 60,
      granularitaMinuti: 60,
      fasceLavoro: [MATTINA, POMERIGGIO],
      occupazioni: [],
    });

    expect(orari(slot)).toEqual([
      '2026-07-15T07:00:00.000Z',
      '2026-07-15T08:00:00.000Z',
      '2026-07-15T09:00:00.000Z',
      '2026-07-15T10:00:00.000Z',
      '2026-07-15T13:00:00.000Z',
      '2026-07-15T14:00:00.000Z',
      '2026-07-15T15:00:00.000Z',
      '2026-07-15T16:00:00.000Z',
    ]);
  });

  it('esclude gli orari che si sovrappongono a un appuntamento esistente', () => {
    const occupazione: Occupazione = {
      inizio: new Date('2026-07-15T07:30:00.000Z'),
      fine: new Date('2026-07-15T08:00:00.000Z'),
    };

    const slot = slotLiberi({
      giorno: '2026-07-15',
      durataMinuti: 30,
      granularitaMinuti: 30,
      fasceLavoro: [{ minutoInizio: 9 * 60, minutoFine: 11 * 60 }],
      occupazioni: [occupazione],
    });

    expect(orari(slot)).toEqual([
      '2026-07-15T07:00:00.000Z',
      '2026-07-15T08:00:00.000Z',
      '2026-07-15T08:30:00.000Z',
    ]);
  });

  it('rispetta il preavviso minimo e il limite massimo', () => {
    const slot = slotLiberi({
      giorno: '2026-07-15',
      durataMinuti: 30,
      granularitaMinuti: 30,
      fasceLavoro: [{ minutoInizio: 9 * 60, minutoFine: 11 * 60 }],
      occupazioni: [],
      nonPrimaDi: new Date('2026-07-15T07:45:00.000Z'),
      nonDopoDi: new Date('2026-07-15T08:30:00.000Z'),
    });

    expect(orari(slot)).toEqual(['2026-07-15T08:00:00.000Z']);
  });

  it('nei giorni di cambio dell’ora legale mantiene gli orari del salone', () => {
    const marzo = slotLiberi({
      giorno: '2026-03-29',
      durataMinuti: 60,
      granularitaMinuti: 60,
      fasceLavoro: [{ minutoInizio: 9 * 60, minutoFine: 11 * 60 }],
      occupazioni: [],
    });
    const ottobre = slotLiberi({
      giorno: '2026-10-25',
      durataMinuti: 60,
      granularitaMinuti: 60,
      fasceLavoro: [{ minutoInizio: 9 * 60, minutoFine: 11 * 60 }],
      occupazioni: [],
    });

    expect(orari(marzo)).toEqual(['2026-03-29T07:00:00.000Z', '2026-03-29T08:00:00.000Z']);
    expect(orari(ottobre)).toEqual(['2026-10-25T08:00:00.000Z', '2026-10-25T09:00:00.000Z']);
  });

  it('restituisce un elenco vuoto per dati non validi', () => {
    const comune = {
      granularitaMinuti: 15,
      fasceLavoro: [MATTINA],
      occupazioni: [],
    };

    expect(slotLiberi({ ...comune, giorno: '2026-07-15', durataMinuti: 0 })).toEqual([]);
    expect(slotLiberi({ ...comune, giorno: 'ieri', durataMinuti: 30 })).toEqual([]);
  });
});

describe('Verifica della collocazione di un appuntamento', () => {
  const comune = {
    durataMinuti: 30,
    granularitaMinuti: 15,
    fasceLavoro: [MATTINA],
    occupazioni: [],
  };

  it('accetta un orario dentro la fascia e allineato', () => {
    expect(
      verificaCollocazione({
        ...comune,
        inizio: istanteDaDataLocale('2026-07-15', 9 * 60 + 30)!,
      }),
    ).toEqual({ esito: 'valido' });
  });

  it('rifiuta un orario fuori dalle fasce di lavoro', () => {
    expect(
      verificaCollocazione({ ...comune, inizio: istanteDaDataLocale('2026-07-15', 14 * 60)! }),
    ).toEqual({ esito: 'fuori_orario' });
  });

  it('rifiuta un appuntamento che sfora la fine della fascia', () => {
    expect(
      verificaCollocazione({
        ...comune,
        inizio: istanteDaDataLocale('2026-07-15', 12 * 60 + 45)!,
        durataMinuti: 60,
      }),
    ).toEqual({ esito: 'fuori_orario' });
  });

  it('rifiuta un orario non allineato alla granularità', () => {
    expect(
      verificaCollocazione({ ...comune, inizio: istanteDaDataLocale('2026-07-15', 9 * 60 + 7)! }),
    ).toEqual({ esito: 'non_allineato' });
  });

  it('rifiuta un orario già occupato', () => {
    expect(
      verificaCollocazione({
        ...comune,
        inizio: istanteDaDataLocale('2026-07-15', 9 * 60)!,
        occupazioni: [
          {
            inizio: new Date('2026-07-15T07:15:00.000Z'),
            fine: new Date('2026-07-15T07:45:00.000Z'),
          },
        ],
      }),
    ).toEqual({ esito: 'occupato' });
  });
});
