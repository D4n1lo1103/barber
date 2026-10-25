import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { applicaTema, leggiTemaSalvato, type Tema } from './tema';

interface ValoreTema {
  tema: Tema;
  alterna: () => void;
}

const ContestoTema = createContext<ValoreTema | undefined>(undefined);

/**
 * Tema dell'interfaccia, tenuto in un posto solo. Con lo stato dentro al
 * pulsante due pulsanti sullo stesso schermo si disallineavano, e le pagine
 * senza pulsante — accesso, registrazione, attivazione — ignoravano la
 * preferenza salvata.
 */
export function FornitoreTema({ children }: { children: ReactNode }) {
  const [tema, impostaTema] = useState<Tema>(() => leggiTemaSalvato());

  useEffect(() => {
    applicaTema(tema);
  }, [tema]);

  const alterna = useCallback(
    () => impostaTema((corrente) => (corrente === 'scuro' ? 'chiaro' : 'scuro')),
    [],
  );

  const valore = useMemo(() => ({ tema, alterna }), [tema, alterna]);

  return <ContestoTema.Provider value={valore}>{children}</ContestoTema.Provider>;
}

export function usaTema(): ValoreTema {
  const valore = useContext(ContestoTema);

  if (!valore) {
    throw new Error('usaTema richiede il FornitoreTema.');
  }

  return valore;
}
