import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/**
 * Superficie traslucida con sfocatura: elemento di base del tema.
 * Il contrasto del testo resta conforme WCAG AA grazie al fondo scuro sottostante.
 */
export function Superficie({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-superficie)] border border-bordo bg-superficie',
        'shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
