import { clsx } from 'clsx';
import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface ProprietaCampo extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  etichetta: string;
  errore?: string;
  suggerimento?: string;
}

/** Campo di testo con etichetta, suggerimento ed errore collegati per gli screen reader. */
export function Campo({ etichetta, errore, suggerimento, className, ...resto }: ProprietaCampo) {
  const id = useId();
  const idSuggerimento = `${id}-suggerimento`;
  const idErrore = `${id}-errore`;
  const descrizioni = [suggerimento ? idSuggerimento : null, errore ? idErrore : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {etichetta}
      </label>
      <input
        id={id}
        aria-invalid={errore ? true : undefined}
        aria-describedby={descrizioni || undefined}
        className={clsx(
          'w-full rounded-[var(--radius-campo)] border bg-fondo-elevato px-3 py-2.5 text-sm',
          'transition-colors duration-[var(--durata-breve)] outline-none',
          errore ? 'border-errore' : 'border-bordo focus:border-accento',
          className,
        )}
        {...resto}
      />
      {suggerimento && (
        <p id={idSuggerimento} className="text-xs text-testo-tenue">
          {suggerimento}
        </p>
      )}
      {errore && (
        <p id={idErrore} className="text-xs text-errore">
          {errore}
        </p>
      )}
    </div>
  );
}
