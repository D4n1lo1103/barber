import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { clsx } from 'clsx';
import { usaSessione } from '../autenticazione/contesto-sessione';
import { usaInstallazione } from '../installazione/contesto-installazione';
import { Pulsante } from './pulsante';
import { PulsanteTema } from './pulsante-tema';

interface Voce {
  percorso: string;
  etichetta: string;
  soloTitolare?: boolean;
}

const VOCI: Voce[] = [
  { percorso: '/', etichetta: 'Pannello' },
  { percorso: '/agenda', etichetta: 'Agenda' },
  { percorso: '/clienti', etichetta: 'Clienti' },
  { percorso: '/vendite', etichetta: 'Vendite' },
  { percorso: '/impostazioni', etichetta: 'Impostazioni del salone', soloTitolare: true },
];

/**
 * Barra di navigazione del personale, presente su ogni pagina: senza, le
 * sezioni si raggiungevano solo tornando al pannello. Su schermo stretto le
 * voci stanno dietro un menu, per non rubare spazio all'agenda.
 */
export function IntestazionePersonale() {
  const { utente, esci } = usaSessione();
  const { stato } = usaInstallazione();
  const posizione = useLocation();
  const [menuAperto, impostaMenuAperto] = useState(false);

  if (!utente || utente.ruolo === 'cliente') {
    return null;
  }

  const voci = VOCI.filter((voce) => !voce.soloTitolare || utente.ruolo === 'titolare');

  function collegamenti(perMenu: boolean) {
    return voci.map((voce) => {
      const attiva =
        voce.percorso === '/'
          ? posizione.pathname === '/'
          : posizione.pathname.startsWith(voce.percorso);

      return (
        <Link
          key={voce.percorso}
          to={voce.percorso}
          onClick={() => impostaMenuAperto(false)}
          aria-current={attiva ? 'page' : undefined}
          className={clsx(
            'rounded-[var(--radius-pillola)] px-3 py-2 text-sm font-medium transition-colors duration-[var(--durata-breve)]',
            perMenu && 'block',
            attiva ? 'bg-accento text-su-accento' : 'text-testo-tenue hover:text-testo',
          )}
        >
          {voce.etichetta}
        </Link>
      );
    });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-bordo bg-superficie backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="truncate text-sm font-semibold">
          {stato?.nomeSalone ?? 'Il tuo salone'}
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sezioni del gestionale">
          {collegamenti(false)}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <PulsanteTema />
          <Pulsante variante="discreto" onClick={() => void esci()}>
            Esci
          </Pulsante>
        </div>

        <Pulsante
          variante="secondario"
          className="md:hidden"
          aria-expanded={menuAperto}
          aria-controls="menu-personale"
          onClick={() => impostaMenuAperto((aperto) => !aperto)}
        >
          {menuAperto ? 'Chiudi' : 'Menu'}
        </Pulsante>
      </div>

      {menuAperto && (
        <div id="menu-personale" className="border-t border-bordo px-4 py-3 md:hidden">
          <nav className="space-y-1" aria-label="Sezioni del gestionale">
            {collegamenti(true)}
          </nav>
          <div className="mt-3 flex items-center gap-2">
            <PulsanteTema />
            <Pulsante variante="discreto" onClick={() => void esci()}>
              Esci
            </Pulsante>
          </div>
        </div>
      )}
    </header>
  );
}
