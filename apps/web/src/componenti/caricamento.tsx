export function Caricamento({ messaggio }: { messaggio: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <p className="text-sm text-testo-tenue">{messaggio}…</p>
    </div>
  );
}
