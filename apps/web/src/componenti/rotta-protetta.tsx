import { Navigate, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import type { Ruolo } from '@barber/shared';
import { usaSessione } from '../autenticazione/contesto-sessione';
import { Caricamento } from './caricamento';

/**
 * Protegge una rotta: richiede una sessione attiva e, se indicato,
 * uno dei ruoli consentiti. Il controllo definitivo resta lato backend.
 */
export function RottaProtetta({
  children,
  ruoliConsentiti,
}: {
  children: ReactNode;
  ruoliConsentiti?: Ruolo[];
}) {
  const { utente, inCaricamento } = usaSessione();
  const posizione = useLocation();

  if (inCaricamento) {
    return <Caricamento messaggio="Verifica della sessione" />;
  }

  if (!utente) {
    return <Navigate to="/accesso" state={{ da: posizione.pathname }} replace />;
  }

  if (ruoliConsentiti && !ruoliConsentiti.includes(utente.ruolo)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
