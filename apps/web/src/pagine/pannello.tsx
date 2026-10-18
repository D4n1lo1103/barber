import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, Navigate } from 'react-router';
import { CONFIGURAZIONI_PROFILO } from '@barber/shared';
import { usaSessione } from '../autenticazione/contesto-sessione';
import { Pulsante } from '../componenti/pulsante';
import { Superficie } from '../componenti/superficie';
import { usaInstallazione } from '../installazione/contesto-installazione';
import { applicaTema, leggiTemaSalvato, type Tema } from '../tema/tema';

const ETICHETTE_RUOLO: Record<string, string> = {
  titolare: 'Titolare',
  dipendente: 'Dipendente',
  cliente: 'Cliente',
};

export function PaginaPannello() {
  const { utente, esci } = usaSessione();
  const { stato } = usaInstallazione();
  const [tema, impostaTema] = useState<Tema>(() => leggiTemaSalvato());

  useEffect(() => {
    applicaTema(tema);
  }, [tema]);

  if (!utente) {
    return null;
  }

  // Il cliente ha un'area propria: il pannello è del personale.
  if (utente.ruolo === 'cliente') {
    return <Navigate to="/area-cliente" replace />;
  }

  const profilo = stato?.profilo ? CONFIGURAZIONI_PROFILO[stato.profilo] : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Superficie className="p-8" sollevata>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-testo-tenue">
                {ETICHETTE_RUOLO[utente.ruolo] ?? utente.ruolo}
                {profilo && ` · ${profilo.etichetta}`}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Ciao {utente.nome} {utente.cognome}
              </h1>
              {stato?.nomeSalone && (
                <p className="mt-1 text-sm text-testo-tenue">{stato.nomeSalone}</p>
              )}
            </div>

            <Pulsante
              variante="secondario"
              onClick={() => impostaTema(tema === 'scuro' ? 'chiaro' : 'scuro')}
              aria-label={`Passa al tema ${tema === 'scuro' ? 'chiaro' : 'scuro'}`}
            >
              Tema {tema === 'scuro' ? 'chiaro' : 'scuro'}
            </Pulsante>
          </div>

          <p className="mt-6 text-sm text-testo-tenue">
            Da qui apri l’agenda, le schede clienti e, se sei il titolare, le impostazioni del
            salone.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/agenda">
              <Pulsante>Agenda</Pulsante>
            </Link>
            <Link to="/clienti">
              <Pulsante variante="secondario">Clienti</Pulsante>
            </Link>
            <Link to="/vendite">
              <Pulsante variante="secondario">Vendite</Pulsante>
            </Link>
            {utente.ruolo === 'titolare' && (
              <Link to="/impostazioni">
                <Pulsante variante="secondario">Impostazioni del salone</Pulsante>
              </Link>
            )}
            <Pulsante variante="secondario" onClick={() => void esci()}>
              Esci
            </Pulsante>
          </div>
        </Superficie>
      </motion.div>
    </main>
  );
}
