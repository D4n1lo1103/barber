import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UtenteAutenticato } from '@barber/shared';
import { chiamaApi, ErroreApi } from '../servizi/client-api';

interface ValoreSessione {
  utente: UtenteAutenticato | null;
  inCaricamento: boolean;
  accedi: (email: string, password: string) => Promise<void>;
  esci: () => Promise<void>;
}

const ContestoSessione = createContext<ValoreSessione | undefined>(undefined);

export function FornitoreSessione({ children }: { children: ReactNode }) {
  const [utente, impostaUtente] = useState<UtenteAutenticato | null>(null);
  const [inCaricamento, impostaInCaricamento] = useState(true);

  useEffect(() => {
    let annullato = false;

    async function recuperaSessione() {
      try {
        const dati = await chiamaApi<{ utente: UtenteAutenticato }>('/autenticazione/io');

        if (!annullato) {
          impostaUtente(dati.utente);
        }
      } catch (errore) {
        // Un 401 all'avvio significa semplicemente che nessuno ha ancora effettuato l'accesso.
        if (!annullato && !(errore instanceof ErroreApi && errore.stato === 401)) {
          console.error(errore);
        }
      } finally {
        if (!annullato) {
          impostaInCaricamento(false);
        }
      }
    }

    void recuperaSessione();

    return () => {
      annullato = true;
    };
  }, []);

  const accedi = useCallback(async (email: string, password: string) => {
    const dati = await chiamaApi<{ utente: UtenteAutenticato }>('/autenticazione/accesso', {
      metodo: 'POST',
      corpo: { email, password },
    });

    impostaUtente(dati.utente);
  }, []);

  const esci = useCallback(async () => {
    try {
      await chiamaApi<void>('/autenticazione/uscita', { metodo: 'POST' });
    } finally {
      impostaUtente(null);
    }
  }, []);

  const valore = useMemo(
    () => ({ utente, inCaricamento, accedi, esci }),
    [utente, inCaricamento, accedi, esci],
  );

  return <ContestoSessione.Provider value={valore}>{children}</ContestoSessione.Provider>;
}

export function usaSessione(): ValoreSessione {
  const valore = useContext(ContestoSessione);

  if (!valore) {
    throw new Error('usaSessione richiede il FornitoreSessione.');
  }

  return valore;
}
