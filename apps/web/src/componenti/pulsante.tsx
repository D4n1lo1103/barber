import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secondario' | 'discreto';

const VARIANTI: Record<Variante, string> = {
  primario: 'bg-accento text-su-accento hover:bg-accento-forte',
  secondario: 'border border-bordo-forte bg-fondo-elevato text-testo hover:border-accento',
  discreto: 'text-testo-tenue hover:text-testo',
};

interface ProprietaPulsante extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  children: ReactNode;
}

export function Pulsante({
  variante = 'primario',
  className,
  children,
  type = 'button',
  ...resto
}: ProprietaPulsante) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-campo)] px-4 py-2.5',
        'text-sm font-semibold transition-colors duration-[var(--durata-breve)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTI[variante],
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}
