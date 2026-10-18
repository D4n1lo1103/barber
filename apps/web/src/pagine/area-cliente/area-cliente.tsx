import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { CalendarPlus, ListChecks, UserRound } from 'lucide-react';
import type { AppuntamentoCliente, ProfiloCliente } from '@barber/shared';
import { usaSessione } from '../../autenticazione/contesto-sessione';
import { Avviso } from '../../componenti/avviso';
import { Caricamento } from '../../componenti/caricamento';
import { Pulsante } from '../../componenti/pulsante';
import { usaInstallazione } from '../../installazione/contesto-installazione';
import { ErroreApi } from '../../servizi/client-api';
import { leggiAppuntamentiCliente, leggiProfiloCliente } from '../../servizi/gestione';
import { MieiAppuntamenti } from './miei-appuntamenti';
import { Prenota } from './prenota';
import { ProfiloClienteScheda } from './profilo-cliente';

const SCHEDE = [
  { chiave: 'appuntamenti', etichetta: 'I miei appuntamenti', icona: ListChecks },
  { chiave: 'prenota', etichetta: 'Prenota', icona: CalendarPlus },
  { chiave: 'profilo', etichetta: 'Profilo e dati', icona: UserRound },
] as const;

type Scheda = (typeof SCHEDE)[number]['chiave'];

/** Area del cliente: appuntamenti, prenotazione e dati personali. */
export function PaginaAreaCliente() {
  const { utente, esci } = usaSessione();
  const { stato } = usaInstallazione();
  const [scheda, impostaScheda] = useState<Scheda>('appuntamenti');
  const [appuntamenti, impostaAppuntamenti] = useState<AppuntamentoCliente[]>([]);
  const [profilo, impostaProfilo] = useState<ProfiloCliente | null>(null);
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [errore, impostaErrore] = useState<string | null>(null);
  // Il fornitore rimanda qui dopo il pagamento: l'esito vero arriva dal
  // webhook, quindi questo parametro serve solo a spiegare cosa è successo.
  const [parametri, impostaParametri] = useSearchParams();
  const esitoPagamento = parametri.get('pagamento');

  useEffect(() => {
    if (esitoPagamento) {
      // Tolto dall'indirizzo: un ricaricamento non deve ripetere l'avviso.
      const ripuliti = new URLSearchParams(parametri);

      ripuliti.delete('pagamento');
      impostaParametri(ripuliti, { replace: true });
    }
  }, []);

  useEffect(() => {
    Promise.all([leggiAppuntamentiCliente(), leggiProfiloCliente()])
      .then(([elenco, scheda]) => {
        impostaAppuntamenti(elenco.appuntamenti);
        impostaProfilo(scheda);
      })
      .catch((problema: unknown) =>
        impostaErrore(problema instanceof ErroreApi ? problema.message : 'Dati non disponibili.'),
      )
      .finally(() => impostaCaricamento(false));
  }, []);

  function sostituisci(aggiornato: AppuntamentoCliente) {
    impostaAppuntamenti((precedenti) => {
      const senza = precedenti.filter((voce) => voce.id !== aggiornato.id);

      return [...senza, aggiornato].sort((primo, secondo) =>
        secondo.inizio.localeCompare(primo.inizio),
      );
    });
  }

  if (inCaricamento) {
    return <Caricamento messaggio="Caricamento della tua area" />;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-testo-tenue">{stato?.nomeSalone ?? 'Il tuo salone'}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ciao {utente?.nome ?? ''}</h1>
        </div>
        <Pulsante variante="secondario" onClick={() => void esci()}>
          Esci
        </Pulsante>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Sezioni della tua area">
        {SCHEDE.map(({ chiave, etichetta, icona: Icona }) => (
          <button
            key={chiave}
            type="button"
            onClick={() => impostaScheda(chiave)}
            aria-current={scheda === chiave ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-[var(--radius-pillola)] px-4 py-2 text-sm font-medium transition-colors duration-[var(--durata-breve)] ${
              scheda === chiave
                ? 'bg-accento text-su-accento'
                : 'border border-bordo text-testo-tenue hover:text-testo'
            }`}
          >
            <Icona size={16} aria-hidden />
            {etichetta}
          </button>
        ))}
      </nav>

      {esitoPagamento && (
        <div className="mt-4">
          <Avviso tono={esitoPagamento === 'riuscito' ? 'conferma' : 'avviso'}>
            {esitoPagamento === 'riuscito'
              ? 'Pagamento ricevuto. L’appuntamento risulta confermato appena il fornitore ci conferma l’incasso: se qui è ancora in attesa, ricarica fra qualche secondo.'
              : 'Pagamento non completato. Finché lo slot è tenuto puoi riprovare dal pulsante «Paga».'}
          </Avviso>
        </div>
      )}

      {errore && (
        <div className="mt-4">
          <Avviso tono="errore">{errore}</Avviso>
        </div>
      )}

      <motion.div
        key={scheda}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6"
      >
        {scheda === 'appuntamenti' && (
          <MieiAppuntamenti appuntamenti={appuntamenti} onAggiornato={sostituisci} />
        )}

        {scheda === 'prenota' && (
          <Prenota
            saldoCreditoCentesimi={profilo?.saldoCreditoCentesimi ?? 0}
            onPrenotato={(appuntamento) => {
              sostituisci(appuntamento);
              impostaScheda('appuntamenti');
            }}
          />
        )}

        {scheda === 'profilo' && profilo && (
          <ProfiloClienteScheda profilo={profilo} onAggiornato={impostaProfilo} />
        )}
      </motion.div>
    </main>
  );
}
