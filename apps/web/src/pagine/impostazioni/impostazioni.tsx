import { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { CONFIGURAZIONI_PROFILO } from '@barber/shared';
import { Pulsante } from '../../componenti/pulsante';
import { usaInstallazione } from '../../installazione/contesto-installazione';
import { SchedaOrari } from './scheda-orari';
import { SchedaPersonale } from './scheda-personale';
import { SchedaServizi } from './scheda-servizi';

const SCHEDE = ['Servizi', 'Personale', 'Orari'] as const;

type Scheda = (typeof SCHEDE)[number];

export function PaginaImpostazioni() {
  const { stato } = usaInstallazione();
  const [scheda, impostaScheda] = useState<Scheda>('Servizi');
  const granularita = stato?.profilo
    ? CONFIGURAZIONI_PROFILO[stato.profilo].granularitaSlotMinuti
    : 15;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-testo-tenue">Impostazioni</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {stato?.nomeSalone ?? 'Il tuo salone'}
          </h1>
        </div>
        <Link to="/">
          <Pulsante variante="secondario">Torna al pannello</Pulsante>
        </Link>
      </div>

      <nav className="mt-6 flex gap-2" aria-label="Sezioni delle impostazioni">
        {SCHEDE.map((nome) => (
          <button
            key={nome}
            type="button"
            onClick={() => impostaScheda(nome)}
            aria-current={scheda === nome ? 'page' : undefined}
            className={`rounded-[var(--radius-pillola)] px-4 py-2 text-sm font-medium transition-colors duration-[var(--durata-breve)] ${
              scheda === nome
                ? 'bg-accento text-su-accento'
                : 'border border-bordo text-testo-tenue hover:text-testo'
            }`}
          >
            {nome}
          </button>
        ))}
      </nav>

      <motion.div
        key={scheda}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6"
      >
        {scheda === 'Servizi' && <SchedaServizi granularitaSlotMinuti={granularita} />}
        {scheda === 'Personale' && <SchedaPersonale />}
        {scheda === 'Orari' && <SchedaOrari />}
      </motion.div>
    </main>
  );
}
