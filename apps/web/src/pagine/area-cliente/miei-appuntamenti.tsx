import { useState } from 'react';
import { ETICHETTE_STATO, type AppuntamentoCliente } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { usaInstallazione } from '../../installazione/contesto-installazione';
import { ErroreApi } from '../../servizi/client-api';
import {
  annullaAppuntamentoCliente,
  leggiDisponibilitaCliente,
  spostaAppuntamentoCliente,
} from '../../servizi/gestione';
import {
  formattaDataBreve,
  formattaDurata,
  formattaIntervallo,
  formattaPrezzo,
} from '../../utilita/formati';
import { dataDiVista, giornoDaDataDiVista } from '../../utilita/fuso-vista';
import { SelettoreSlot } from '../agenda/selettore-slot';

/** I propri appuntamenti, con le azioni ancora consentite dalle regole. */
export function MieiAppuntamenti({
  appuntamenti,
  onAggiornato,
}: {
  appuntamenti: AppuntamentoCliente[];
  onAggiornato: (appuntamento: AppuntamentoCliente) => void;
}) {
  const { stato } = usaInstallazione();
  const [daSpostare, impostaDaSpostare] = useState<AppuntamentoCliente | null>(null);
  const [giorno, impostaGiorno] = useState('');
  const [nuovoInizio, impostaNuovoInizio] = useState<string | null>(null);
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inCorso, impostaInCorso] = useState(false);

  const adesso = Date.now();
  const futuri = appuntamenti.filter(
    (appuntamento) =>
      new Date(appuntamento.inizio).getTime() >= adesso && appuntamento.stato !== 'annullato',
  );
  const passati = appuntamenti.filter((appuntamento) => !futuri.includes(appuntamento));

  async function esegui(operazione: () => Promise<{ appuntamento: AppuntamentoCliente }>) {
    impostaInCorso(true);
    impostaErrore(null);

    try {
      const esito = await operazione();

      onAggiornato(esito.appuntamento);
      impostaDaSpostare(null);
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Operazione non riuscita.');
    } finally {
      impostaInCorso(false);
    }
  }

  function apriSpostamento(appuntamento: AppuntamentoCliente) {
    impostaDaSpostare(appuntamento);
    impostaGiorno(giornoDaDataDiVista(dataDiVista(appuntamento.inizio)));
    impostaNuovoInizio(null);
    impostaErrore(null);
  }

  return (
    <div className="space-y-6">
      {errore && <Avviso tono="errore">{errore}</Avviso>}

      <section>
        <h2 className="text-lg font-semibold">Prossimi appuntamenti</h2>
        {futuri.length === 0 ? (
          <p className="mt-2 text-sm text-testo-tenue">
            Nessun appuntamento in programma. Prenota dalla scheda «Prenota».
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {futuri.map((appuntamento) => (
              <li key={appuntamento.id}>
                <Superficie className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {formattaDataBreve(appuntamento.inizio)} ·{' '}
                        {formattaIntervallo(appuntamento.inizio, appuntamento.fine)}
                      </p>
                      <p className="mt-1 text-sm text-testo-tenue">
                        {appuntamento.servizi.map((servizio) => servizio.nome).join(' + ')} · con{' '}
                        {appuntamento.operatore.nome} {appuntamento.operatore.cognome}
                      </p>
                      <p className="mt-1 text-sm text-testo-tenue">
                        {formattaDurata(appuntamento.durataMinuti)} ·{' '}
                        {formattaPrezzo(appuntamento.prezzoTotaleCentesimi)} ·{' '}
                        {ETICHETTE_STATO[appuntamento.stato]}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {appuntamento.puoSpostare && (
                        <Pulsante
                          variante="secondario"
                          onClick={() => apriSpostamento(appuntamento)}
                        >
                          Sposta
                        </Pulsante>
                      )}
                      {appuntamento.puoAnnullare && (
                        <Pulsante
                          variante="secondario"
                          disabled={inCorso}
                          onClick={() =>
                            void esegui(() => annullaAppuntamentoCliente(appuntamento.id))
                          }
                        >
                          Annulla
                        </Pulsante>
                      )}
                    </div>
                  </div>

                  {!appuntamento.puoAnnullare && (
                    <p className="mt-3 text-xs text-testo-tenue">
                      Il termine per annullare o spostare online è passato
                      {stato ? ` (${stato.oreLimitePreavviso} ore prima)` : ''}: per modifiche
                      chiama il salone.
                    </p>
                  )}
                </Superficie>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Storico</h2>
        {passati.length === 0 ? (
          <p className="mt-2 text-sm text-testo-tenue">Nessun appuntamento passato.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {passati.map((appuntamento) => (
              <li
                key={appuntamento.id}
                className="rounded-[var(--radius-campo)] border border-bordo px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {formattaDataBreve(appuntamento.inizio)} ·{' '}
                    {formattaIntervallo(appuntamento.inizio, appuntamento.fine)}
                  </span>
                  <span className="text-xs text-testo-tenue">
                    {ETICHETTE_STATO[appuntamento.stato]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-testo-tenue">
                  {appuntamento.servizi.map((servizio) => servizio.nome).join(' + ')} ·{' '}
                  {formattaPrezzo(appuntamento.prezzoTotaleCentesimi)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modale
        aperto={daSpostare !== null}
        titolo="Sposta l’appuntamento"
        descrizione="Scegli un nuovo orario fra quelli liberi."
        onChiudi={() => impostaDaSpostare(null)}
      >
        {daSpostare && (
          <div className="space-y-4">
            <SelettoreSlot
              operatoreId={daSpostare.operatore.id}
              servizioIds={daSpostare.servizioIds}
              giorno={giorno}
              onCambiaGiorno={(nuovo) => {
                impostaGiorno(nuovo);
                impostaNuovoInizio(null);
              }}
              valore={nuovoInizio}
              onScegli={impostaNuovoInizio}
              escludiAppuntamentoId={daSpostare.id}
              carica={leggiDisponibilitaCliente}
            />

            <div className="flex justify-end gap-3">
              <Pulsante variante="secondario" onClick={() => impostaDaSpostare(null)}>
                Annulla
              </Pulsante>
              <Pulsante
                disabled={!nuovoInizio || inCorso}
                onClick={() =>
                  void esegui(() => spostaAppuntamentoCliente(daSpostare.id, nuovoInizio!))
                }
              >
                Conferma
              </Pulsante>
            </div>
          </div>
        )}
      </Modale>
    </div>
  );
}
