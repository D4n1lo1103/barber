import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type Tono = 'errore' | 'avviso' | 'conferma' | 'informazione';

const TONI: Record<Tono, string> = {
  errore: 'border-errore/60 text-errore',
  avviso: 'border-avviso/60 text-avviso',
  conferma: 'border-conferma/60 text-conferma',
  informazione: 'border-bordo text-testo-tenue',
};

const PREFISSI: Record<Tono, string> = {
  errore: 'Errore:',
  avviso: 'Attenzione:',
  conferma: 'Fatto:',
  informazione: '',
};

/**
 * Messaggio di stato. Il tono non è affidato al solo colore: ogni messaggio
 * porta anche un prefisso testuale, come richiede il criterio WCAG 1.4.1.
 */
export function Avviso({ tono, children }: { tono: Tono; children: ReactNode }) {
  return (
    <p
      role={tono === 'errore' ? 'alert' : 'status'}
      className={clsx(
        'rounded-[var(--radius-campo)] border bg-fondo-elevato/60 px-3 py-2 text-sm',
        TONI[tono],
      )}
    >
      {PREFISSI[tono] && <span className="font-semibold">{PREFISSI[tono]} </span>}
      {children}
    </p>
  );
}
