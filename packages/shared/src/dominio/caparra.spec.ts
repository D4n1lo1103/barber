import { describe, expect, it } from 'vitest';
import {
  accreditaCredito,
  calcolaCaparra,
  residuoDaSaldare,
  trattamentoDellaCaparra,
} from './caparra.js';

describe('Calcolo della caparra', () => {
  it('applica la percentuale e arrotonda al centesimo più vicino', () => {
    expect(calcolaCaparra(3000, 50)).toBe(1500);
    expect(calcolaCaparra(2500, 30)).toBe(750);
    // 1850 × 35% = 647,5 centesimi: arrotonda a 648.
    expect(calcolaCaparra(1850, 35)).toBe(648);
  });

  it('non supera mai il prezzo dei servizi', () => {
    expect(calcolaCaparra(2000, 100)).toBe(2000);
  });

  it('vale zero quando non c’è prezzo o percentuale', () => {
    expect(calcolaCaparra(0, 50)).toBe(0);
    expect(calcolaCaparra(3000, 0)).toBe(0);
  });

  it('il residuo da saldare è il prezzo meno la caparra', () => {
    expect(residuoDaSaldare(3000, 1500)).toBe(1500);
    // Un appuntamento senza caparra si salda per intero.
    expect(residuoDaSaldare(3000, 0)).toBe(3000);
    // Una caparra superiore al prezzo (prezzo ridotto dopo il pagamento) non
    // produce un residuo negativo.
    expect(residuoDaSaldare(1000, 1500)).toBe(0);
  });
});

describe('Trattamento della caparra all’annullamento', () => {
  it('l’annullamento tempestivo segue la forma scelta dal salone', () => {
    expect(trattamentoDellaCaparra({ motivo: 'tempestivo', forma: 'rimborso' })).toBe('rimborsata');
    expect(trattamentoDellaCaparra({ motivo: 'tempestivo', forma: 'credito' })).toBe(
      'convertita_in_credito',
    );
  });

  it('l’annullamento tardivo trattiene la caparra, qualunque sia la forma', () => {
    expect(trattamentoDellaCaparra({ motivo: 'tardivo', forma: 'rimborso' })).toBe('trattenuta');
    expect(trattamentoDellaCaparra({ motivo: 'tardivo', forma: 'credito' })).toBe('trattenuta');
  });

  it('l’annullamento dal salone rimborsa sempre per intero', () => {
    // Anche se il salone restituisce normalmente in credito: il disservizio è
    // suo, quindi il denaro torna indietro.
    expect(trattamentoDellaCaparra({ motivo: 'dal_salone', forma: 'credito' })).toBe('rimborsata');
  });

  it('se il pagamento non è stato completato non c’è nulla da restituire', () => {
    expect(trattamentoDellaCaparra({ motivo: 'pagamento_non_completato', forma: 'rimborso' })).toBe(
      'nessuno',
    );
  });

  it('solo la conversione in credito aumenta il credito del cliente', () => {
    expect(accreditaCredito('convertita_in_credito')).toBe(true);
    expect(accreditaCredito('rimborsata')).toBe(false);
    expect(accreditaCredito('trattenuta')).toBe(false);
  });
});
