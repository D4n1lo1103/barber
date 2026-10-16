import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { StatoInstallazione } from '@barber/shared';
import { leggiStatoInstallazione } from '../servizi/installazione';

interface ValoreInstallazione {
  stato: StatoInstallazione | null;
  inCaricamento: boolean;
  errore: string | null;
  aggiorna: () => Promise<void>;
}

const ContestoInstallazione = createContext<ValoreInstallazione | undefined>(undefined);

/**
 * Carica lo stato dell'installazione e applica l'accento del profilo
 * all'elemento radice, così che i token del tema valgano per tutta l'app.
 */
export function FornitoreInstallazione({ children }: { children: ReactNode }) {
  const [stato, impostaStato] = useState<StatoInstallazione | null>(null);
  const [inCaricamento, impostaInCaricamento] = useState(true);
  const [errore, impostaErrore] = useState<string | null>(null);

  const aggiorna = useCallback(async () => {
    try {
      impostaStato(await leggiStatoInstallazione());
      impostaErrore(null);
    } catch {
      impostaErrore('Impossibile contattare il servizio. Riprova fra poco.');
    } finally {
      impostaInCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void aggiorna();
  }, [aggiorna]);

  useEffect(() => {
    if (stato?.profilo) {
      document.documentElement.dataset.profilo = stato.profilo;
    }
  }, [stato?.profilo]);

  const valore = useMemo(
    () => ({ stato, inCaricamento, errore, aggiorna }),
    [stato, inCaricamento, errore, aggiorna],
  );

  return <ContestoInstallazione.Provider value={valore}>{children}</ContestoInstallazione.Provider>;
}

export function usaInstallazione(): ValoreInstallazione {
  const valore = useContext(ContestoInstallazione);

  if (!valore) {
    throw new Error('usaInstallazione richiede il FornitoreInstallazione.');
  }

  return valore;
}
