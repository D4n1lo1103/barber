import { useEffect, useState } from 'react';
import {
  ETICHETTE_MOTIVO_ANNULLAMENTO,
  ETICHETTE_STATO,
  MOTIVI_ANNULLAMENTO_DA_PERSONALE,
  type Appuntamento,
  type MotivoAnnullamentoDaPersonale,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import {
  annullaAppuntamento,
  completaAppuntamento,
  segnaMancataPresentazione,
  spostaAppuntamento,
} from '../../servizi/gestione';
import {
  formattaDataBreve,
  formattaDurata,
  formattaIntervallo,
  formattaPrezzo,
} from '../../utilita/formati';
import { dataDiVista, giornoDaDataDiVista } from '../../utilita/fuso-vista';
import { SelettoreSlot } from './selettore-slot';

type Azione = 'nessuna' | 'spostamento' | 'annullamento';

/** Dettaglio di un appuntamento e azioni del personale. */
export function ModaleDettaglioAppuntamento({
  appuntamento,
  onChiudi,
  onAggiornato,
}: {
  appuntamento: Appuntamento | null;
  onChiudi: () => void;
  onAggiornato: (appuntamento: Appuntamento) => void;
}) {
  const [azione, impostaAzione] = useState<Azione>('nessuna');
  const [giorno, impostaGiorno] = useState('');
  const [nuovoInizio, impostaNuovoInizio] = useState<string | null>(null);
  const [motivo, impostaMotivo] = useState<MotivoAnnullamentoDaPersonale>('tempestivo');
  const [note, impostaNote] = useState('');
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inCorso, impostaInCorso] = useState(false);

  useEffect(() => {
    if (appuntamento) {
      impostaAzione('nessuna');
      impostaGiorno(giornoDaDataDiVista(dataDiVista(appuntamento.inizio)));
      impostaNuovoInizio(null);
      impostaMotivo('tempestivo');
      impostaNote('');
      impostaErrore(null);
    }
  }, [appuntamento]);

  if (!appuntamento) {
    return null;
  }

  const modificabile =
    appuntamento.stato === 'confermato' || appuntamento.stato === 'in_attesa_pagamento';

  async function esegui(operazione: () => Promise<Appuntamento>) {
    impostaInCorso(true);
    impostaErrore(null);

    try {
      onAggiornato(await operazione());
      onChiudi();
    } catch (motivoErrore) {
      impostaErrore(
        motivoErrore instanceof Error ? motivoErrore.message : 'Operazione non riuscita.',
      );
    } finally {
      impostaInCorso(false);
    }
  }

  return (
    <Modale
      aperto={appuntamento !== null}
      titolo={`${appuntamento.cliente.nome} ${appuntamento.cliente.cognome}`}
      descrizione={`${formattaDataBreve(appuntamento.inizio)} · ${formattaIntervallo(appuntamento.inizio, appuntamento.fine)}`}
      onChiudi={onChiudi}
    >
      <div className="space-y-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-testo-tenue">Stato</dt>
            <dd className="font-medium">{ETICHETTE_STATO[appuntamento.stato]}</dd>
          </div>
          <div>
            <dt className="text-xs text-testo-tenue">Operatore</dt>
            <dd className="font-medium">
              {appuntamento.operatore.nome} {appuntamento.operatore.cognome}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-testo-tenue">Servizi</dt>
            <dd className="font-medium">
              {appuntamento.servizi.map((servizio) => servizio.nome).join(' + ')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-testo-tenue">Totale</dt>
            <dd className="font-medium">
              {formattaPrezzo(appuntamento.prezzoTotaleCentesimi)} ·{' '}
              {formattaDurata(appuntamento.durataMinuti)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-testo-tenue">Contatto</dt>
            <dd className="font-medium">{appuntamento.cliente.numeroWhatsapp ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-testo-tenue">Caparra</dt>
            <dd className="font-medium">
              {appuntamento.senzaCaparra
                ? 'Non richiesta'
                : formattaPrezzo(appuntamento.caparraCentesimi)}
            </dd>
          </div>
        </dl>

        {appuntamento.note && (
          <p className="rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2 text-sm">
            {appuntamento.note}
          </p>
        )}

        {appuntamento.motivoAnnullamento && (
          <Avviso tono="informazione">
            {ETICHETTE_MOTIVO_ANNULLAMENTO[appuntamento.motivoAnnullamento]}
          </Avviso>
        )}

        {errore && <Avviso tono="errore">{errore}</Avviso>}

        {azione === 'spostamento' && (
          <div className="space-y-3 rounded-[var(--radius-campo)] border border-bordo p-3">
            <SelettoreSlot
              operatoreId={appuntamento.operatore.id}
              servizioIds={appuntamento.servizi
                .map((servizio) => servizio.servizioId)
                .filter((id): id is string => id !== null)}
              giorno={giorno}
              onCambiaGiorno={(nuovo) => {
                impostaGiorno(nuovo);
                impostaNuovoInizio(null);
              }}
              valore={nuovoInizio}
              onScegli={impostaNuovoInizio}
              escludiAppuntamentoId={appuntamento.id}
            />
            <div className="flex justify-end gap-3">
              <Pulsante variante="secondario" onClick={() => impostaAzione('nessuna')}>
                Indietro
              </Pulsante>
              <Pulsante
                disabled={!nuovoInizio || inCorso}
                onClick={() =>
                  void esegui(() => spostaAppuntamento(appuntamento.id, { inizio: nuovoInizio! }))
                }
              >
                Conferma spostamento
              </Pulsante>
            </div>
          </div>
        )}

        {azione === 'annullamento' && (
          <div className="space-y-3 rounded-[var(--radius-campo)] border border-bordo p-3">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Motivo dell’annullamento</legend>
              {MOTIVI_ANNULLAMENTO_DA_PERSONALE.map((valore) => (
                <label key={valore} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="motivo-annullamento"
                    value={valore}
                    checked={motivo === valore}
                    onChange={() => impostaMotivo(valore)}
                    className="accent-[var(--color-accento)]"
                  />
                  {ETICHETTE_MOTIVO_ANNULLAMENTO[valore]}
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="note-annullamento" className="block text-sm font-medium">
                Nota (facoltativa)
              </label>
              <textarea
                id="note-annullamento"
                value={note}
                onChange={(evento) => impostaNote(evento.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Pulsante variante="secondario" onClick={() => impostaAzione('nessuna')}>
                Indietro
              </Pulsante>
              <Pulsante
                disabled={inCorso}
                onClick={() =>
                  void esegui(() => annullaAppuntamento(appuntamento.id, { motivo, note }))
                }
              >
                Registra annullamento
              </Pulsante>
            </div>
          </div>
        )}

        {azione === 'nessuna' && (
          <div className="flex flex-wrap justify-end gap-3">
            {modificabile && (
              <>
                <Pulsante variante="secondario" onClick={() => impostaAzione('spostamento')}>
                  Sposta
                </Pulsante>
                <Pulsante variante="secondario" onClick={() => impostaAzione('annullamento')}>
                  Annulla appuntamento
                </Pulsante>
              </>
            )}
            {appuntamento.stato === 'confermato' && (
              <>
                <Pulsante
                  variante="secondario"
                  disabled={inCorso}
                  onClick={() => void esegui(() => segnaMancataPresentazione(appuntamento.id))}
                >
                  Mancata presentazione
                </Pulsante>
                <Pulsante
                  disabled={inCorso}
                  onClick={() => void esegui(() => completaAppuntamento(appuntamento.id))}
                >
                  Segna completato
                </Pulsante>
              </>
            )}
            {!modificabile && appuntamento.stato !== 'confermato' && (
              <Pulsante variante="secondario" onClick={onChiudi}>
                Chiudi
              </Pulsante>
            )}
          </div>
        )}
      </div>
    </Modale>
  );
}
