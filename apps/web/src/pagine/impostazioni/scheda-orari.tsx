import { useEffect, useState } from 'react';
import {
  GIORNI_SETTIMANA,
  minutiDaOrario,
  NOMI_GIORNI,
  orarioDaMinuti,
  type FasciaSettimanale,
  type GiornoSettimana,
  type Operatore,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { ChiusureSalone } from './chiusure-salone';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import {
  leggiOrariApertura,
  leggiOrariOperatore,
  leggiPersonale,
  salvaOrariApertura,
  salvaOrariOperatore,
} from '../../servizi/gestione';

/** Una riga modificabile dell'orario: valori testuali "09:00". */
interface RigaOrario {
  giornoSettimana: GiornoSettimana;
  inizio: string;
  fine: string;
}

function righeDaFasce(fasce: FasciaSettimanale[]): RigaOrario[] {
  return fasce.map((fascia) => ({
    giornoSettimana: fascia.giornoSettimana as GiornoSettimana,
    inizio: orarioDaMinuti(fascia.minutoInizio),
    fine: orarioDaMinuti(fascia.minutoFine),
  }));
}

/**
 * Propone una nuova fascia che segue l'ultima già presente nel giorno,
 * così da non creare sovrapposizioni con un clic.
 */
function fasciaProposta(delGiorno: RigaOrario[], giornoSettimana: GiornoSettimana): RigaOrario {
  const fini = delGiorno
    .map((riga) => minutiDaOrario(riga.fine))
    .filter((minuti): minuti is number => minuti !== null);

  if (fini.length === 0) {
    return { giornoSettimana, inizio: '09:00', fine: '13:00' };
  }

  const inizio = Math.min(Math.max(...fini) + 60, 1380);

  return {
    giornoSettimana,
    inizio: orarioDaMinuti(inizio),
    fine: orarioDaMinuti(Math.min(inizio + 180, 1440)),
  };
}

function fasceDaRighe(righe: RigaOrario[]): FasciaSettimanale[] | string {
  const fasce: FasciaSettimanale[] = [];

  for (const riga of righe) {
    const minutoInizio = minutiDaOrario(riga.inizio);
    const minutoFine = minutiDaOrario(riga.fine);

    if (minutoInizio === null || minutoFine === null) {
      return `Orario non valido per ${NOMI_GIORNI[riga.giornoSettimana].toLowerCase()}: usa il formato 09:00.`;
    }

    if (minutoInizio >= minutoFine) {
      return `Per ${NOMI_GIORNI[riga.giornoSettimana].toLowerCase()} la chiusura deve seguire l'apertura.`;
    }

    fasce.push({ giornoSettimana: riga.giornoSettimana, minutoInizio, minutoFine });
  }

  return fasce;
}

function EditorOrario({
  titolo,
  descrizione,
  righe,
  impostaRighe,
  onSalva,
  inSalvataggio,
}: {
  titolo: string;
  descrizione: string;
  righe: RigaOrario[];
  impostaRighe: (righe: RigaOrario[]) => void;
  onSalva: () => void;
  inSalvataggio: boolean;
}) {
  return (
    <Superficie className="p-6">
      <h2 className="text-lg font-semibold">{titolo}</h2>
      <p className="mt-1 text-sm text-testo-tenue">{descrizione}</p>

      <div className="mt-4 space-y-4">
        {GIORNI_SETTIMANA.map((giorno) => {
          const delGiorno = righe.filter((riga) => riga.giornoSettimana === giorno);

          return (
            <div
              key={giorno}
              data-giorno={giorno}
              className="rounded-[var(--radius-campo)] border border-bordo p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{NOMI_GIORNI[giorno]}</p>
                <Pulsante
                  variante="discreto"
                  aria-label={`Aggiungi una fascia a ${NOMI_GIORNI[giorno].toLowerCase()}`}
                  onClick={() => impostaRighe([...righe, fasciaProposta(delGiorno, giorno)])}
                >
                  Aggiungi fascia
                </Pulsante>
              </div>

              {delGiorno.length === 0 && <p className="mt-2 text-xs text-testo-tenue">Chiuso</p>}

              {delGiorno.map((riga) => {
                const indice = righe.indexOf(riga);

                return (
                  <div key={indice} className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`inizio-${indice}`}>
                      Apertura di {NOMI_GIORNI[giorno]}
                    </label>
                    <input
                      id={`inizio-${indice}`}
                      type="time"
                      value={riga.inizio}
                      onChange={(evento) => {
                        const copia = [...righe];
                        copia[indice] = { ...riga, inizio: evento.target.value };
                        impostaRighe(copia);
                      }}
                      className="rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2 text-sm outline-none focus:border-accento"
                    />
                    <span aria-hidden="true" className="text-testo-tenue">
                      –
                    </span>
                    <label className="sr-only" htmlFor={`fine-${indice}`}>
                      Chiusura di {NOMI_GIORNI[giorno]}
                    </label>
                    <input
                      id={`fine-${indice}`}
                      type="time"
                      value={riga.fine}
                      onChange={(evento) => {
                        const copia = [...righe];
                        copia[indice] = { ...riga, fine: evento.target.value };
                        impostaRighe(copia);
                      }}
                      className="rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2 text-sm outline-none focus:border-accento"
                    />
                    <Pulsante
                      variante="discreto"
                      onClick={() =>
                        impostaRighe(righe.filter((_, posizione) => posizione !== indice))
                      }
                      aria-label={`Rimuovi la fascia di ${NOMI_GIORNI[giorno]}`}
                    >
                      Rimuovi
                    </Pulsante>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <Pulsante className="mt-6" onClick={onSalva} disabled={inSalvataggio}>
        {inSalvataggio ? 'Salvataggio…' : 'Salva orari'}
      </Pulsante>
    </Superficie>
  );
}

export function SchedaOrari() {
  const [apertura, impostaApertura] = useState<RigaOrario[]>([]);
  const [personale, impostaPersonale] = useState<Operatore[]>([]);
  const [operatoreScelto, impostaOperatoreScelto] = useState<string>('');
  const [orariOperatore, impostaOrariOperatore] = useState<RigaOrario[]>([]);
  const [messaggio, impostaMessaggio] = useState<{
    tono: 'errore' | 'conferma';
    testo: string;
  } | null>(null);
  const [inCaricamento, impostaInCaricamento] = useState(true);
  const [inSalvataggio, impostaInSalvataggio] = useState(false);

  useEffect(() => {
    async function carica() {
      try {
        const [orari, elenco] = await Promise.all([leggiOrariApertura(), leggiPersonale()]);
        impostaApertura(righeDaFasce(orari.fasce));
        const attivi = elenco.personale.filter((operatore) => operatore.attivo);
        impostaPersonale(attivi);
        impostaOperatoreScelto(attivi[0]?.id ?? '');
      } catch (problema) {
        impostaMessaggio({
          tono: 'errore',
          testo: problema instanceof ErroreApi ? problema.message : 'Caricamento non riuscito.',
        });
      } finally {
        impostaInCaricamento(false);
      }
    }

    void carica();
  }, []);

  useEffect(() => {
    if (!operatoreScelto) {
      return;
    }

    leggiOrariOperatore(operatoreScelto)
      .then((orari) => impostaOrariOperatore(righeDaFasce(orari.fasce)))
      .catch(() => impostaOrariOperatore([]));
  }, [operatoreScelto]);

  async function salva(
    righe: RigaOrario[],
    azione: (fasce: FasciaSettimanale[]) => Promise<{ fasce: FasciaSettimanale[] }>,
    applica: (righe: RigaOrario[]) => void,
  ) {
    impostaMessaggio(null);
    const esito = fasceDaRighe(righe);

    if (typeof esito === 'string') {
      impostaMessaggio({ tono: 'errore', testo: esito });

      return;
    }

    impostaInSalvataggio(true);

    try {
      const salvate = await azione(esito);
      applica(righeDaFasce(salvate.fasce));
      impostaMessaggio({ tono: 'conferma', testo: 'Orari salvati.' });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Salvataggio non riuscito.',
      });
    } finally {
      impostaInSalvataggio(false);
    }
  }

  if (inCaricamento) {
    return <p className="text-sm text-testo-tenue">Caricamento degli orari…</p>;
  }

  return (
    <div className="space-y-6">
      {messaggio && <Avviso tono={messaggio.tono}>{messaggio.testo}</Avviso>}

      <EditorOrario
        titolo="Orari di apertura del salone"
        descrizione="Aggiungi più fasce nello stesso giorno per la pausa pranzo. I giorni senza fasce sono di chiusura."
        righe={apertura}
        impostaRighe={impostaApertura}
        inSalvataggio={inSalvataggio}
        onSalva={() => void salva(apertura, salvaOrariApertura, impostaApertura)}
      />

      <ChiusureSalone />

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Orari di lavoro degli operatori</h2>
        <label htmlFor="operatore" className="mt-4 block text-sm font-medium">
          Operatore
        </label>
        <select
          id="operatore"
          value={operatoreScelto}
          onChange={(evento) => impostaOperatoreScelto(evento.target.value)}
          className="mt-2 w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm outline-none focus:border-accento"
        >
          {personale.map((operatore) => (
            <option key={operatore.id} value={operatore.id}>
              {operatore.nome} {operatore.cognome}
            </option>
          ))}
        </select>
      </Superficie>

      {operatoreScelto && (
        <EditorOrario
          titolo="Orario dell'operatore"
          descrizione="Deve rientrare negli orari di apertura del salone."
          righe={orariOperatore}
          impostaRighe={impostaOrariOperatore}
          inSalvataggio={inSalvataggio}
          onSalva={() =>
            void salva(
              orariOperatore,
              (fasce) => salvaOrariOperatore(operatoreScelto, fasce),
              impostaOrariOperatore,
            )
          }
        />
      )}
    </div>
  );
}
