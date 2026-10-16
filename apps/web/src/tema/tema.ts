/**
 * Tema dell'interfaccia: scuro di default, chiaro disponibile.
 * La scelta resta sul dispositivo dell'utente.
 */
export const TEMI = ['scuro', 'chiaro'] as const;

export type Tema = (typeof TEMI)[number];

const CHIAVE_MEMORIA = 'barber.tema';

export function leggiTemaSalvato(): Tema {
  try {
    const salvato = localStorage.getItem(CHIAVE_MEMORIA);

    return salvato === 'chiaro' || salvato === 'scuro' ? salvato : 'scuro';
  } catch {
    // Spazio di archiviazione non disponibile: si usa il tema predefinito.
    return 'scuro';
  }
}

export function applicaTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;

  try {
    localStorage.setItem(CHIAVE_MEMORIA, tema);
  } catch {
    // La preferenza non viene ricordata, l'interfaccia resta comunque corretta.
  }
}
