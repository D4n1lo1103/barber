import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  calcolaCaparra,
  type AppuntamentoCliente,
  type Operatore,
  type Servizio,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { usaInstallazione } from '../../installazione/contesto-installazione';
import { ErroreApi } from '../../servizi/client-api';
import {
  avviaPagamentoCaparra,
  leggiCatalogoCliente,
  leggiDisponibilitaCliente,
  prenotaComeCliente,
} from '../../servizi/gestione';
import { formattaDurata, formattaPrezzo } from '../../utilita/formati';
import { giornoDaDataDiVista, dataDiVista } from '../../utilita/fuso-vista';
import { SelettoreSlot } from '../agenda/selettore-slot';

/**
 * Prenotazione dall'area clienti: si scelgono i servizi, poi l'operatore fra
 * quelli abilitati a tutti i servizi scelti, poi l'orario fra quelli liberi.
 * Non esiste "operatore indifferente".
 */
export function Prenota({
  onPrenotato,
  saldoCreditoCentesimi,
}: {
  onPrenotato: (a: AppuntamentoCliente) => void;
  /** Credito del cliente: copre la caparra in tutto o in parte. */
  saldoCreditoCentesimi: number;
}) {
  const { stato } = usaInstallazione();
  const [servizi, impostaServizi] = useState<Servizio[]>([]);
  const [operatori, impostaOperatori] = useState<Operatore[]>([]);
  const [scelti, impostaScelti] = useState<string[]>([]);
  const [operatoreId, impostaOperatore] = useState('');
  const [giorno, impostaGiorno] = useState(() => giornoDaDataDiVista(dataDiVista(new Date())));
  const [inizio, impostaInizio] = useState<string | null>(null);
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [inInvio, impostaInvio] = useState(false);

  useEffect(() => {
    leggiCatalogoCliente()
      .then((catalogo) => {
        impostaServizi(catalogo.servizi);
        impostaOperatori(catalogo.operatori);
      })
      .catch((problema: unknown) =>
        impostaErrore(problema instanceof ErroreApi ? problema.message : 'Catalogo non caricato.'),
      )
      .finally(() => impostaCaricamento(false));
  }, []);

  /** Solo chi è abilitato a tutti i servizi scelti può ricevere l'appuntamento. */
  const operatoriPossibili = useMemo(
    () =>
      operatori.filter((operatore) =>
        scelti.every((servizioId) =>
          servizi
            .find((servizio) => servizio.id === servizioId)
            ?.operatoriAbilitati.includes(operatore.id),
        ),
      ),
    [operatori, servizi, scelti],
  );

  useEffect(() => {
    if (operatoreId && !operatoriPossibili.some((operatore) => operatore.id === operatoreId)) {
      impostaOperatore('');
      impostaInizio(null);
    }
  }, [operatoriPossibili, operatoreId]);

  const selezionati = servizi.filter((servizio) => scelti.includes(servizio.id));
  const durata = selezionati.reduce((somma, servizio) => somma + servizio.durataMinuti, 0);
  const prezzo = selezionati.reduce((somma, servizio) => somma + servizio.prezzoCentesimi, 0);

  function alterna(id: string) {
    impostaInizio(null);
    impostaScelti((precedenti) =>
      precedenti.includes(id) ? precedenti.filter((altro) => altro !== id) : [...precedenti, id],
    );
  }

  async function prenota() {
    if (!operatoreId || !inizio || scelti.length === 0) {
      impostaErrore('Scegli servizi, operatore e orario.');

      return;
    }

    impostaErrore(null);
    impostaInvio(true);

    try {
      const esito = await prenotaComeCliente({ operatoreId, servizioIds: scelti, inizio });

      if (esito.appuntamento.caparraDaPagareCentesimi > 0) {
        // Lo slot è tenuto per pochi minuti: si va subito a pagare.
        const pagamento = await avviaPagamentoCaparra(esito.appuntamento.id);

        window.location.assign(pagamento.urlPagamento);

        return;
      }

      onPrenotato(esito.appuntamento);
      impostaScelti([]);
      impostaInizio(null);
    } catch (problema) {
      impostaErrore(
        problema instanceof ErroreApi ? problema.message : 'Prenotazione non riuscita.',
      );
    } finally {
      impostaInvio(false);
    }
  }

  if (inCaricamento) {
    return <p className="text-sm text-testo-tenue">Caricamento del catalogo…</p>;
  }

  const prezzoTotale = scelti.reduce(
    (totale, servizioId) =>
      totale + (servizi.find((servizio) => servizio.id === servizioId)?.prezzoCentesimi ?? 0),
    0,
  );
  // Stima mostrata prima di prenotare: l'importo vero lo calcola il backend.
  const caparra = stato?.caparraAttiva ? calcolaCaparra(prezzoTotale, stato.caparraPercentuale) : 0;
  const creditoUsato = Math.min(saldoCreditoCentesimi, caparra);
  const daPagare = caparra - creditoUsato;

  return (
    <div className="space-y-5">
      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Scegli i servizi</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Puoi sceglierne più di uno: vengono svolti uno dopo l’altro, dallo stesso operatore.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {servizi.map((servizio) => (
            <label
              key={servizio.id}
              className={clsx(
                'flex cursor-pointer items-start gap-2 rounded-[var(--radius-campo)] border px-3 py-2 text-sm transition-colors duration-[var(--durata-breve)]',
                scelti.includes(servizio.id)
                  ? 'border-accento bg-accento/10'
                  : 'border-bordo bg-fondo-elevato hover:border-accento',
              )}
            >
              <input
                type="checkbox"
                checked={scelti.includes(servizio.id)}
                onChange={() => alterna(servizio.id)}
                className="mt-0.5 accent-[var(--color-accento)]"
              />
              <span>
                <span className="block font-medium">{servizio.nome}</span>
                <span className="block text-xs text-testo-tenue">
                  {formattaDurata(servizio.durataMinuti)} ·{' '}
                  {formattaPrezzo(servizio.prezzoCentesimi)}
                </span>
              </span>
            </label>
          ))}
        </div>

        {selezionati.length > 0 && (
          <p className="mt-3 text-sm text-testo-tenue">
            Totale: {formattaDurata(durata)} · {formattaPrezzo(prezzo)}
          </p>
        )}
      </Superficie>

      {scelti.length > 0 && (
        <Superficie className="p-6">
          <h2 className="text-lg font-semibold">Scegli con chi</h2>
          {operatoriPossibili.length === 0 ? (
            <p className="mt-2 text-sm text-testo-tenue">
              Nessun operatore esegue tutti i servizi scelti: prova a prenotarli separatamente.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {operatoriPossibili.map((operatore) => (
                <button
                  key={operatore.id}
                  type="button"
                  aria-pressed={operatoreId === operatore.id}
                  onClick={() => {
                    impostaOperatore(operatore.id);
                    impostaInizio(null);
                  }}
                  className={clsx(
                    'rounded-[var(--radius-pillola)] border px-4 py-2 text-sm transition-colors duration-[var(--durata-breve)]',
                    operatoreId === operatore.id
                      ? 'border-accento bg-accento text-su-accento'
                      : 'border-bordo text-testo-tenue hover:text-testo',
                  )}
                >
                  {operatore.nome} {operatore.cognome}
                </button>
              ))}
            </div>
          )}
        </Superficie>
      )}

      {operatoreId && (
        <Superficie className="p-6">
          <h2 className="text-lg font-semibold">Scegli quando</h2>
          <p className="mt-1 text-sm text-testo-tenue">
            Le prenotazioni online richiedono almeno due ore di preavviso.
          </p>
          <div className="mt-4">
            <SelettoreSlot
              operatoreId={operatoreId}
              servizioIds={scelti}
              giorno={giorno}
              onCambiaGiorno={(nuovo) => {
                impostaGiorno(nuovo);
                impostaInizio(null);
              }}
              valore={inizio}
              onScegli={impostaInizio}
              carica={leggiDisponibilitaCliente}
            />
          </div>
        </Superficie>
      )}

      {caparra > 0 && (
        <Superficie className="p-6">
          <h2 className="text-lg font-semibold">Caparra</h2>
          <p className="mt-1 text-sm text-testo-tenue">
            Il salone chiede una caparra del {stato?.caparraPercentuale}% alla prenotazione:{' '}
            <strong>{formattaPrezzo(caparra)}</strong> sui {formattaPrezzo(prezzoTotale)} totali. Si
            paga subito online e viene scalata dal conto a servizio concluso.
          </p>
          {creditoUsato > 0 && (
            <p className="mt-2 text-sm">
              Il tuo credito copre {formattaPrezzo(creditoUsato)}
              {daPagare > 0 ? (
                <>
                  : da pagare adesso <strong>{formattaPrezzo(daPagare)}</strong>.
                </>
              ) : (
                ': non devi pagare nulla adesso.'
              )}
            </p>
          )}
          {daPagare > 0 && (
            <p className="mt-2 text-xs text-testo-tenue">
              Dopo la conferma vieni portato alla pagina di pagamento. Lo slot resta tenuto per{' '}
              {stato?.minutiBloccoSlot ?? 10} minuti: se il pagamento non arriva, torna libero.
            </p>
          )}
        </Superficie>
      )}

      {errore && <Avviso tono="errore">{errore}</Avviso>}

      <Pulsante disabled={!inizio || inInvio} onClick={() => void prenota()}>
        {inInvio
          ? 'Prenotazione…'
          : daPagare > 0
            ? 'Prenota e paga la caparra'
            : 'Conferma la prenotazione'}
      </Pulsante>
    </div>
  );
}
