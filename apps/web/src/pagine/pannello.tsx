import { motion } from 'motion/react';
import { Link, Navigate } from 'react-router';
import { CONFIGURAZIONI_PROFILO } from '@barber/shared';
import { usaSessione } from '../autenticazione/contesto-sessione';
import { Pulsante } from '../componenti/pulsante';
import { RiquadroCambioPassword } from '../componenti/riquadro-cambio-password';
import { Superficie } from '../componenti/superficie';
import { usaInstallazione } from '../installazione/contesto-installazione';

const ETICHETTE_RUOLO: Record<string, string> = {
  titolare: 'Titolare',
  dipendente: 'Dipendente',
  cliente: 'Cliente',
};

export function PaginaPannello() {
  const { utente } = usaSessione();
  const { stato } = usaInstallazione();

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

          <p className="mt-6 text-sm text-testo-tenue">
            Le sezioni sono nella barra in alto: agenda, schede clienti, vendite
            {utente.ruolo === 'titolare' && ' e impostazioni del salone'}. Restano a portata di mano
            da qualunque pagina.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/agenda">
              <Pulsante>Apri l’agenda di oggi</Pulsante>
            </Link>
          </div>
        </Superficie>

        <div className="mt-4">
          <RiquadroCambioPassword />
        </div>
      </motion.div>
    </main>
  );
}
