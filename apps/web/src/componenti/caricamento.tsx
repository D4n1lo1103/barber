import { clsx } from 'clsx';

/** Indicatore di attesa. In versione compatta sta dentro un pannello. */
export function Caricamento({
  messaggio,
  compatto = false,
}: {
  messaggio: string;
  compatto?: boolean;
}) {
  return (
    <div
      className={clsx('flex items-center justify-center', compatto ? 'py-6' : 'min-h-dvh')}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-testo-tenue">{messaggio}…</p>
    </div>
  );
}
