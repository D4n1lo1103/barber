import { usaSessione } from '../autenticazione/contesto-sessione';
import { Superficie } from '../componenti/superficie';

const ETICHETTE_RUOLO: Record<string, string> = {
  titolare: 'Titolare',
  dipendente: 'Dipendente',
  cliente: 'Cliente',
};

export function PaginaPannello() {
  const { utente, esci } = usaSessione();

  if (!utente) {
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Superficie className="p-8">
        <p className="text-sm text-testo-tenue">{ETICHETTE_RUOLO[utente.ruolo] ?? utente.ruolo}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Ciao {utente.nome} {utente.cognome}
        </h1>
        <p className="mt-4 text-sm text-testo-tenue">
          Le fondamenta sono pronte: accesso, sessioni e permessi sono attivi. Le prossime fasi
          aggiungeranno la configurazione del salone, l&apos;agenda e la prenotazione.
        </p>
        <button
          type="button"
          onClick={() => void esci()}
          className="mt-8 rounded-xl border border-bordo px-4 py-2 text-sm font-medium transition hover:border-accento"
        >
          Esci
        </button>
      </Superficie>
    </main>
  );
}
