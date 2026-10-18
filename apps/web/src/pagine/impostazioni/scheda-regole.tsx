import { useEffect, useState } from 'react';
import {
  ETICHETTE_FORMA_RESTITUZIONE,
  ETICHETTE_RICHIESTA_CANCELLAZIONE,
  FORME_RESTITUZIONE,
  schemaRegoleSalone,
  type FormaRestituzione,
  type RegoleSalone,
  type RichiestaCancellazione,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import {
  evadiRichiestaCancellazione,
  leggiRegole,
  leggiRichiesteCancellazione,
  salvaRegole,
} from '../../servizi/gestione';
import { formattaData } from '../../utilita/formati';

/**
 * Regole di annullamento, spostamento e caparra, più le richieste di
 * cancellazione dei dati inviate dai clienti.
 */
export function SchedaRegole() {
  const [regole, impostaRegole] = useState<RegoleSalone | null>(null);
  const [preavviso, impostaPreavviso] = useState('24');
  const [promemoria, impostaPromemoria] = useState('24');
  const [comeAnnullamento, impostaComeAnnullamento] = useState(false);
  const [caparraAttiva, impostaCaparraAttiva] = useState(false);
  const [percentuale, impostaPercentuale] = useState('50');
  const [restituzione, impostaRestituzione] = useState<FormaRestituzione>('rimborso');
  const [richieste, impostaRichieste] = useState<RichiestaCancellazione[]>([]);
  const [messaggio, impostaMessaggio] = useState<{
    tono: 'errore' | 'conferma';
    testo: string;
  } | null>(null);
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [inCorso, impostaInCorso] = useState(false);

  useEffect(() => {
    Promise.all([leggiRegole(), leggiRichiesteCancellazione()])
      .then(([lette, elenco]) => {
        impostaRegole(lette);
        impostaPreavviso(String(lette.oreLimitePreavviso));
        impostaPromemoria(String(lette.oreAnticipoPromemoria));
        impostaComeAnnullamento(lette.spostamentoComeAnnullamento);
        impostaCaparraAttiva(lette.caparraAttiva);
        impostaPercentuale(String(lette.caparraPercentuale));
        impostaRestituzione(lette.restituzioneCaparra);
        impostaRichieste(elenco.richieste);
      })
      .catch((problema: unknown) =>
        impostaMessaggio({
          tono: 'errore',
          testo: problema instanceof ErroreApi ? problema.message : 'Regole non caricate.',
        }),
      )
      .finally(() => impostaCaricamento(false));
  }, []);

  async function salva() {
    const validazione = schemaRegoleSalone.safeParse({
      oreLimitePreavviso: Number(preavviso),
      spostamentoComeAnnullamento: comeAnnullamento,
      oreAnticipoPromemoria: Number(promemoria),
      caparraAttiva,
      caparraPercentuale: Number(percentuale),
      restituzioneCaparra: restituzione,
    });

    if (!validazione.success) {
      impostaMessaggio({
        tono: 'errore',
        testo: validazione.error.issues[0]?.message ?? 'Valori non validi.',
      });

      return;
    }

    impostaInCorso(true);
    impostaMessaggio(null);

    try {
      impostaRegole(await salvaRegole(validazione.data));
      impostaMessaggio({ tono: 'conferma', testo: 'Regole salvate.' });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Regole non salvate.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  async function evadi(richiesta: RichiestaCancellazione, azione: 'anonimizza' | 'rifiuta') {
    impostaInCorso(true);
    impostaMessaggio(null);

    try {
      const aggiornata = await evadiRichiestaCancellazione(richiesta.id, { azione, nota: '' });

      impostaRichieste((precedenti) =>
        precedenti.map((voce) => (voce.id === aggiornata.id ? aggiornata : voce)),
      );
      impostaMessaggio({
        tono: 'conferma',
        testo:
          azione === 'anonimizza'
            ? 'Dati del cliente rimossi: lo storico resta in forma anonima.'
            : 'Richiesta rifiutata.',
      });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Operazione non riuscita.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  if (inCaricamento || !regole) {
    return <p className="text-sm text-testo-tenue">Caricamento delle regole…</p>;
  }

  return (
    <div className="space-y-6">
      {messaggio && <Avviso tono={messaggio.tono}>{messaggio.testo}</Avviso>}

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Annullamenti e spostamenti</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Entro il limite di preavviso il cliente può annullare dall’app; dopo deve chiamare e il
          personale registra l’annullamento tardivo.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            etichetta="Limite di preavviso (ore)"
            type="number"
            min={0}
            max={336}
            value={preavviso}
            onChange={(evento) => impostaPreavviso(evento.target.value)}
          />
          <Campo
            etichetta="Anticipo del promemoria (ore)"
            type="number"
            min={1}
            max={168}
            value={promemoria}
            onChange={(evento) => impostaPromemoria(evento.target.value)}
            suggerimento="Usato dai promemoria WhatsApp ed e-mail."
          />
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-medium">Spostamento di un appuntamento</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="regola-spostamento"
              checked={!comeAnnullamento}
              onChange={() => impostaComeAnnullamento(false)}
              className="mt-0.5 accent-[var(--color-accento)]"
            />
            <span>
              Libero entro il limite di preavviso
              <span className="block text-xs text-testo-tenue">
                Il cliente sposta senza conseguenze sulla caparra.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="regola-spostamento"
              checked={comeAnnullamento}
              onChange={() => impostaComeAnnullamento(true)}
              className="mt-0.5 accent-[var(--color-accento)]"
            />
            <span>
              Trattato come un annullamento
              <span className="block text-xs text-testo-tenue">
                Seguirà le regole della caparra, quando sarà attiva.
              </span>
            </span>
          </label>
        </fieldset>

        <Pulsante className="mt-6" onClick={() => void salva()} disabled={inCorso}>
          {inCorso ? 'Salvataggio…' : 'Salva le regole'}
        </Pulsante>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Caparra</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Con la caparra attiva il cliente paga online una percentuale del prezzo al momento della
          prenotazione; l’appuntamento è confermato solo a pagamento avvenuto. Il personale può
          sempre inserire un appuntamento «senza caparra» dall’agenda.
        </p>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={caparraAttiva}
            onChange={(evento) => impostaCaparraAttiva(evento.target.checked)}
            className="mt-0.5 accent-[var(--color-accento)]"
          />
          <span>
            Richiedi la caparra per le prenotazioni online
            <span className="block text-xs text-testo-tenue">
              Gli appuntamenti già fissati non cambiano.
            </span>
          </span>
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            etichetta="Percentuale della caparra (%)"
            type="number"
            min={1}
            max={100}
            value={percentuale}
            onChange={(evento) => impostaPercentuale(evento.target.value)}
            disabled={!caparraAttiva}
            suggerimento="Calcolata sul prezzo dei servizi scelti e scalata dal totale a servizio concluso."
          />
        </div>

        <fieldset className="mt-4 space-y-2" disabled={!caparraAttiva}>
          <legend className="text-sm font-medium">
            Restituzione per un annullamento tempestivo
          </legend>
          {FORME_RESTITUZIONE.map((forma) => (
            <label key={forma} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="forma-restituzione"
                checked={restituzione === forma}
                onChange={() => impostaRestituzione(forma)}
                className="mt-0.5 accent-[var(--color-accento)]"
              />
              <span>{ETICHETTE_FORMA_RESTITUZIONE[forma]}</span>
            </label>
          ))}
          <p className="text-xs text-testo-tenue">
            Un annullamento tardivo e una mancata presentazione trattengono sempre la caparra; un
            annullamento deciso dal salone la rimborsa sempre per intero. Solo tu puoi restituire
            una caparra trattenuta, indicando il motivo.
          </p>
        </fieldset>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Richieste di cancellazione dei dati</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Cancellando i dati la scheda resta senza riferimenti personali e l’account viene
          disattivato; lo storico degli appuntamenti rimane per la contabilità. L’operazione non è
          reversibile.
        </p>

        {richieste.length === 0 ? (
          <p className="mt-4 text-sm text-testo-tenue">Nessuna richiesta.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {richieste.map((richiesta) => (
              <li
                key={richiesta.id}
                className="rounded-[var(--radius-campo)] border border-bordo px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {richiesta.cliente.nome} {richiesta.cliente.cognome}
                    </p>
                    <p className="text-xs text-testo-tenue">
                      {formattaData(richiesta.richiestaIl)} ·{' '}
                      {ETICHETTE_RICHIESTA_CANCELLAZIONE[richiesta.stato]}
                      {richiesta.appuntamentiFuturi > 0 &&
                        ` · ${richiesta.appuntamentiFuturi} appuntamenti ancora in agenda`}
                    </p>
                    {richiesta.motivo && (
                      <p className="mt-1 text-xs text-testo-tenue">«{richiesta.motivo}»</p>
                    )}
                  </div>

                  {richiesta.stato === 'in_attesa' && (
                    <div className="flex flex-wrap gap-2">
                      <Pulsante
                        variante="secondario"
                        disabled={inCorso}
                        onClick={() => void evadi(richiesta, 'rifiuta')}
                      >
                        Rifiuta
                      </Pulsante>
                      <Pulsante
                        disabled={inCorso}
                        onClick={() => void evadi(richiesta, 'anonimizza')}
                      >
                        Cancella i dati
                      </Pulsante>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Superficie>
    </div>
  );
}
