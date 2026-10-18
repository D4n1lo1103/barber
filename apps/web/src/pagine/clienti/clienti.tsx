import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Plus, Search } from 'lucide-react';
import type { Cliente } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Caricamento } from '../../componenti/caricamento';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { leggiClienti } from '../../servizi/gestione';
import { ModaleNuovoCliente } from './modale-nuovo-cliente';

const PER_PAGINA = 25;

export function PaginaClienti() {
  const [cerca, impostaCerca] = useState('');
  const [clienti, impostaClienti] = useState<Cliente[]>([]);
  const [totale, impostaTotale] = useState(0);
  const [pagina, impostaPagina] = useState(1);
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [errore, impostaErrore] = useState<string | null>(null);
  const [nuovoAperto, impostaNuovoAperto] = useState(false);

  useEffect(() => {
    let annullato = false;
    const attesa = setTimeout(() => {
      impostaCaricamento(true);
      leggiClienti({ cerca, pagina, perPagina: PER_PAGINA })
        .then((elenco) => {
          if (!annullato) {
            impostaClienti(elenco.clienti);
            impostaTotale(elenco.totale);
            impostaErrore(null);
          }
        })
        .catch((motivo: unknown) => {
          if (!annullato) {
            impostaErrore(motivo instanceof Error ? motivo.message : 'Clienti non disponibili.');
          }
        })
        .finally(() => {
          if (!annullato) {
            impostaCaricamento(false);
          }
        });
    }, 250);

    return () => {
      annullato = true;
      clearTimeout(attesa);
    };
  }, [cerca, pagina]);

  const ultimaPagina = Math.max(1, Math.ceil(totale / PER_PAGINA));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-testo-tenue">Clienti</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {totale === 1 ? '1 scheda' : `${totale} schede`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/agenda">
            <Pulsante variante="secondario">Agenda</Pulsante>
          </Link>
          <Pulsante onClick={() => impostaNuovoAperto(true)}>
            <Plus size={16} aria-hidden /> Nuova scheda
          </Pulsante>
        </div>
      </div>

      <Superficie className="mt-6 p-4">
        <label htmlFor="cerca-cliente" className="block text-sm font-medium">
          Cerca
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 focus-within:border-accento">
          <Search size={16} aria-hidden className="text-testo-tenue" />
          <input
            id="cerca-cliente"
            value={cerca}
            onChange={(evento) => {
              impostaCerca(evento.target.value);
              impostaPagina(1);
            }}
            placeholder="Nome, cognome, numero o e-mail"
            autoComplete="off"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
          />
        </div>
      </Superficie>

      {errore && (
        <div className="mt-4">
          <Avviso tono="errore">{errore}</Avviso>
        </div>
      )}

      {inCaricamento ? (
        <Caricamento messaggio="Caricamento delle schede" compatto />
      ) : clienti.length === 0 ? (
        <p className="mt-6 text-sm text-testo-tenue">
          {cerca ? 'Nessuna scheda corrisponde alla ricerca.' : 'Nessuna scheda cliente.'}
        </p>
      ) : (
        <motion.ul
          className="mt-6 space-y-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {clienti.map((cliente) => (
            <li key={cliente.id}>
              <Link
                to={`/clienti/${cliente.id}`}
                className="block rounded-[var(--radius-campo)] border border-bordo bg-superficie px-4 py-3 transition-colors duration-[var(--durata-breve)] hover:border-accento"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">
                      {cliente.nome} {cliente.cognome}
                    </span>
                    <span className="block text-xs text-testo-tenue">
                      {cliente.numeroWhatsapp ?? cliente.email ?? 'Nessun contatto'}
                    </span>
                  </span>
                  {!cliente.accountAttivato && (
                    <span className="rounded-[var(--radius-pillola)] border border-avviso/60 px-2 py-0.5 text-xs text-avviso">
                      Account da attivare
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </motion.ul>
      )}

      {ultimaPagina > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <Pulsante
            variante="secondario"
            disabled={pagina === 1}
            onClick={() => impostaPagina((precedente) => Math.max(1, precedente - 1))}
          >
            Precedenti
          </Pulsante>
          <p className="text-sm text-testo-tenue">
            Pagina {pagina} di {ultimaPagina}
          </p>
          <Pulsante
            variante="secondario"
            disabled={pagina >= ultimaPagina}
            onClick={() => impostaPagina((precedente) => precedente + 1)}
          >
            Successive
          </Pulsante>
        </div>
      )}

      <ModaleNuovoCliente
        aperto={nuovoAperto}
        onChiudi={() => impostaNuovoAperto(false)}
        onCreato={(cliente) => impostaClienti((precedenti) => [cliente, ...precedenti])}
      />
    </main>
  );
}
