import { describe, expect, it } from 'vitest';
import {
  CONFIGURAZIONI_PROFILO,
  configurazioneProfilo,
  GRANULARITA_SLOT_AMMESSE,
} from './configurazione-profilo.js';
import { PROFILI } from './profilo.js';

describe('Configurazione dei profili', () => {
  it('copre tutti i profili previsti', () => {
    expect(Object.keys(CONFIGURAZIONI_PROFILO).sort()).toEqual([...PROFILI].sort());
  });

  it.each(PROFILI)('il profilo %s usa una granularità ammessa e durate compatibili', (profilo) => {
    const configurazione = configurazioneProfilo(profilo);

    expect(GRANULARITA_SLOT_AMMESSE).toContain(configurazione.granularitaSlotMinuti);

    for (const servizio of configurazione.catalogoIniziale) {
      expect(servizio.durataMinuti % configurazione.granularitaSlotMinuti).toBe(0);
    }
  });

  it.each(PROFILI)('il catalogo iniziale di %s è coerente', (profilo) => {
    const { catalogoIniziale } = configurazioneProfilo(profilo);
    const nomi = catalogoIniziale.map((servizio) => servizio.nome);

    expect(catalogoIniziale.length).toBeGreaterThanOrEqual(4);
    expect(new Set(nomi).size).toBe(nomi.length);

    for (const servizio of catalogoIniziale) {
      expect(servizio.prezzoCentesimi).toBeGreaterThan(0);
      expect(servizio.descrizione.length).toBeGreaterThan(0);
    }
  });

  it('i due profili hanno accenti distinti', () => {
    expect(CONFIGURAZIONI_PROFILO.barbiere.accento.accento).not.toBe(
      CONFIGURAZIONI_PROFILO.parrucchiere.accento.accento,
    );
  });
});
