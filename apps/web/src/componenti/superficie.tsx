import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/**
 * Superficie traslucida con sfocatura: elemento di base del tema.
 * Il contrasto del testo resta conforme WCAG AA grazie ai token del tema.
 */
export function Superficie({
  children,
  className,
  sollevata = false,
}: {
  children: ReactNode;
  className?: string;
  sollevata?: boolean;
}) {
  return (
    <div
      className={clsx(
        'rounded-[var(--radius-superficie)] border border-bordo bg-superficie backdrop-blur-xl',
        sollevata ? 'shadow-sollevata' : 'shadow-superficie',
        className,
      )}
    >
      {children}
    </div>
  );
}
