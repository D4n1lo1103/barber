import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

/**
 * Pannello modale accessibile: chiude con Esc o dal pulsante, sposta il fuoco
 * al suo interno e lo riporta all'elemento di partenza alla chiusura.
 */
export function Modale({
  aperto,
  titolo,
  descrizione,
  onChiudi,
  children,
}: {
  aperto: boolean;
  titolo: string;
  descrizione?: string;
  onChiudi: () => void;
  children: ReactNode;
}) {
  const pannello = useRef<HTMLDivElement>(null);
  const fuocoPrecedente = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!aperto) {
      return;
    }

    fuocoPrecedente.current = document.activeElement as HTMLElement | null;
    pannello.current?.focus();

    function alTasto(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        onChiudi();
      }
    }

    document.addEventListener('keydown', alTasto);

    return () => {
      document.removeEventListener('keydown', alTasto);
      fuocoPrecedente.current?.focus();
    };
  }, [aperto, onChiudi]);

  return (
    <AnimatePresence>
      {aperto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) {
              onChiudi();
            }
          }}
        >
          <motion.div
            ref={pannello}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={titolo}
            className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[var(--radius-superficie)] border border-bordo bg-superficie-solida p-6 shadow-sollevata outline-none sm:rounded-[var(--radius-superficie)]"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{titolo}</h2>
                {descrizione && <p className="mt-1 text-sm text-testo-tenue">{descrizione}</p>}
              </div>
              <button
                type="button"
                onClick={onChiudi}
                aria-label="Chiudi la finestra"
                className="rounded-[var(--radius-campo)] p-1.5 text-testo-tenue transition-colors hover:bg-fondo-elevato hover:text-testo"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
