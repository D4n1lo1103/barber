import { describe, expect, it } from 'vitest';
import { MINIMO_PAGABILE_CENTESIMI } from './caparra.js';
import {
  GIORNI_RECESSO,
  importiOrdine,
  recessoAperto,
  rimborsoDovuto,
  scadenzaRecesso,
  totaleOrdine,
  transizioneOrdineAmmessa,
} from './ordine.js';

describe('Totale di un ordine', () => {
  it('somma prezzo per quantità di ogni riga', () => {
    expect(
      totaleOrdine([
        { prezzoCentesimi: 1890, quantita: 2 },
        { prezzoCentesimi: 2500, quantita: 1 },
      ]),
    ).toBe(6280);
  });

  it('un carrello vuoto vale zero', () => {
    expect(totaleOrdine([])).toBe(0);
  });
});

describe('Importi di un ordine', () => {
  const righe = [{ prezzoCentesimi: 2000, quantita: 2 }];

  it('senza credito si paga tutto al fornitore', () => {
    expect(importiOrdine({ righe })).toEqual({
      totaleRigheCentesimi: 4000,
      speseConsegnaCentesimi: 0,
      creditoUsatoCentesimi: 0,
      daPagareCentesimi: 4000,
    });
  });

  it('il credito che copre tutto azzera il pagamento', () => {
    const importi = importiOrdine({ righe, saldoCredito: 5000 });

    expect(importi.creditoUsatoCentesimi).toBe(4000);
    expect(importi.daPagareCentesimi).toBe(0);
  });

  it('il credito parziale lascia il resto da pagare', () => {
    const importi = importiOrdine({ righe, saldoCredito: 1500 });

    expect(importi.creditoUsatoCentesimi).toBe(1500);
    expect(importi.daPagareCentesimi).toBe(2500);
  });

  it('non lascia da pagare un importo che il fornitore rifiuterebbe', () => {
    // Il credito coprirebbe quasi tutto: si usa un po' meno e si lascia da
    // pagare esattamente il minimo accettato.
    const importi = importiOrdine({ righe, saldoCredito: 3990 });

    expect(importi.daPagareCentesimi).toBe(MINIMO_PAGABILE_CENTESIMI);
    expect(importi.creditoUsatoCentesimi).toBe(4000 - MINIMO_PAGABILE_CENTESIMI);
  });

  it('le spese di consegna entrano nel dovuto', () => {
    const importi = importiOrdine({ righe, speseConsegnaCentesimi: 500 });

    expect(importi.daPagareCentesimi).toBe(4500);
  });

  it('gli importi restano coerenti come esige il vincolo del database', () => {
    const importi = importiOrdine({ righe, speseConsegnaCentesimi: 500, saldoCredito: 1000 });

    expect(importi.daPagareCentesimi).toBe(
      importi.totaleRigheCentesimi + importi.speseConsegnaCentesimi - importi.creditoUsatoCentesimi,
    );
  });
});

describe('Transizioni di stato di un ordine', () => {
  it('ammette il percorso del ritiro in negozio', () => {
    expect(transizioneOrdineAmmessa('in_attesa_pagamento', 'pagato')).toBe(true);
    expect(transizioneOrdineAmmessa('pagato', 'in_preparazione')).toBe(true);
    expect(transizioneOrdineAmmessa('in_preparazione', 'pronto_per_ritiro')).toBe(true);
    expect(transizioneOrdineAmmessa('pronto_per_ritiro', 'consegnato')).toBe(true);
  });

  it('non si salta il pagamento né si torna indietro', () => {
    expect(transizioneOrdineAmmessa('in_attesa_pagamento', 'in_preparazione')).toBe(false);
    expect(transizioneOrdineAmmessa('consegnato', 'in_preparazione')).toBe(false);
    expect(transizioneOrdineAmmessa('pagato', 'in_attesa_pagamento')).toBe(false);
  });

  it('un ordine rimborsato è chiuso', () => {
    expect(transizioneOrdineAmmessa('rimborsato', 'consegnato')).toBe(false);
    expect(transizioneOrdineAmmessa('rimborsato', 'annullato')).toBe(false);
  });

  it('solo un ordine consegnato o annullato si rimborsa', () => {
    expect(transizioneOrdineAmmessa('consegnato', 'rimborsato')).toBe(true);
    expect(transizioneOrdineAmmessa('annullato', 'rimborsato')).toBe(true);
    expect(transizioneOrdineAmmessa('in_preparazione', 'rimborsato')).toBe(false);
  });
});

describe('Finestra di recesso', () => {
  const consegna = new Date('2026-10-01T10:00:00.000Z');

  it('scade quattordici giorni dopo la consegna', () => {
    const scadenza = scadenzaRecesso(consegna);

    expect(scadenza.toISOString()).toBe('2026-10-15T10:00:00.000Z');
    expect(GIORNI_RECESSO).toBe(14);
  });

  it('è aperta il giorno della consegna e fino alla scadenza', () => {
    expect(
      recessoAperto({ stato: 'consegnato', consegnatoIl: consegna, adesso: consegna }),
    ).toBe(true);
    expect(
      recessoAperto({
        stato: 'consegnato',
        consegnatoIl: consegna,
        adesso: new Date('2026-10-15T09:59:00.000Z'),
      }),
    ).toBe(true);
  });

  it('è chiusa dopo la scadenza', () => {
    expect(
      recessoAperto({
        stato: 'consegnato',
        consegnatoIl: consegna,
        adesso: new Date('2026-10-15T10:00:01.000Z'),
      }),
    ).toBe(false);
  });

  it('un ordine non consegnato non si rende: si annulla', () => {
    expect(
      recessoAperto({ stato: 'pronto_per_ritiro', consegnatoIl: null, adesso: consegna }),
    ).toBe(false);
    expect(
      recessoAperto({ stato: 'rimborsato', consegnatoIl: consegna, adesso: consegna }),
    ).toBe(false);
  });
});

describe('Rimborso di un reso', () => {
  it('vale il prezzo dei pezzi resi', () => {
    expect(
      rimborsoDovuto([
        { prezzoCentesimi: 1890, quantita: 1 },
        { prezzoCentesimi: 2500, quantita: 2 },
      ]),
    ).toBe(6890);
  });
});
