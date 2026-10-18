import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Avviso } from '../../componenti/avviso';
import { Caricamento } from '../../componenti/caricamento';
import { leggiDisponibilita } from '../../servizi/gestione';
import type { DisponibilitaGiorno } from '@barber/shared';
import { formattaOra } from '../../utilita/formati';

/**
 * Scelta del giorno e dell'orario fra quelli realmente disponibili per
 * l'operatore e i servizi selezionati.
 */
export function SelettoreSlot({
  operatoreId,
  servizioIds,
  giorno,
  onCambiaGiorno,
  valore,
  onScegli,
  escludiAppuntamentoId,
  carica = leggiDisponibilita,
}: {
  operatoreId: string;
  servizioIds: string[];
  giorno: string;
  onCambiaGiorno: (giorno: string) => void;
  valore: string | null;
  onScegli: (inizio: string) => void;
  escludiAppuntamentoId?: string;
  /**
   * Da dove arrivano gli slot: il personale e l'area clienti usano rotte
   * diverse, con regole di preavviso diverse.
   */
  carica?: (dati: {
    operatoreId: string;
    servizioIds: string[];
    dal: string;
    escludiAppuntamentoId?: string;
  }) => Promise<{ giorni: DisponibilitaGiorno[] }>;
}) {
  const [slot, impostaSlot] = useState<string[]>([]);
  const [inCaricamento, impostaCaricamento] = useState(false);
  const [errore, impostaErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!operatoreId || servizioIds.length === 0 || !giorno) {
      impostaSlot([]);

      return;
    }

    let annullato = false;

    impostaCaricamento(true);
    impostaErrore(null);

    carica({ operatoreId, servizioIds, dal: giorno, escludiAppuntamentoId })
      .then((risposta) => {
        if (!annullato) {
          impostaSlot(risposta.giorni[0]?.slot ?? []);
        }
      })
      .catch((motivo: unknown) => {
        if (!annullato) {
          impostaSlot([]);
          impostaErrore(
            motivo instanceof Error ? motivo.message : 'Disponibilità non recuperabile.',
          );
        }
      })
      .finally(() => {
        if (!annullato) {
          impostaCaricamento(false);
        }
      });

    return () => {
      annullato = true;
    };
  }, [operatoreId, servizioIds, giorno, escludiAppuntamentoId, carica]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="giorno-appuntamento" className="block text-sm font-medium">
          Giorno
        </label>
        <input
          id="giorno-appuntamento"
          type="date"
          value={giorno}
          onChange={(evento) => onCambiaGiorno(evento.target.value)}
          className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
        />
      </div>

      {errore && <Avviso tono="errore">{errore}</Avviso>}

      {inCaricamento ? (
        <Caricamento messaggio="Calcolo degli orari liberi" compatto />
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Orario</legend>
          {servizioIds.length === 0 ? (
            <p className="text-sm text-testo-tenue">Scegli prima i servizi.</p>
          ) : slot.length === 0 ? (
            <p className="text-sm text-testo-tenue">
              Nessun orario libero in questo giorno: prova con un altro giorno o un altro operatore.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slot.map((istante) => (
                <button
                  key={istante}
                  type="button"
                  aria-pressed={valore === istante}
                  onClick={() => onScegli(istante)}
                  className={clsx(
                    'rounded-[var(--radius-campo)] border px-2 py-2 text-sm transition-colors duration-[var(--durata-breve)]',
                    valore === istante
                      ? 'border-accento bg-accento text-su-accento'
                      : 'border-bordo bg-fondo-elevato hover:border-accento',
                  )}
                >
                  {formattaOra(istante)}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
