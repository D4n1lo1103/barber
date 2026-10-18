import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import type { Appuntamento, Cliente, Operatore, Servizio } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import { creaAppuntamento, leggiClienti } from '../../servizi/gestione';
import { formattaDurata, formattaPrezzo } from '../../utilita/formati';
import { SelettoreSlot } from './selettore-slot';

/** Inserimento di un appuntamento da parte del personale. */
export function ModaleNuovoAppuntamento({
  aperto,
  onChiudi,
  onCreato,
  operatori,
  servizi,
  operatoreIniziale,
  giornoIniziale,
  orarioIniziale,
}: {
  aperto: boolean;
  onChiudi: () => void;
  onCreato: (appuntamento: Appuntamento) => void;
  operatori: Operatore[];
  servizi: Servizio[];
  operatoreIniziale: string;
  giornoIniziale: string;
  orarioIniziale: string | null;
}) {
  const [operatoreId, impostaOperatore] = useState(operatoreIniziale);
  const [servizioIds, impostaServizi] = useState<string[]>([]);
  const [giorno, impostaGiorno] = useState(giornoIniziale);
  const [inizio, impostaInizio] = useState<string | null>(orarioIniziale);
  const [cliente, impostaCliente] = useState<Cliente | null>(null);
  const [senzaCaparra, impostaSenzaCaparra] = useState(false);
  const [note, impostaNote] = useState('');
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inInvio, impostaInvio] = useState(false);

  useEffect(() => {
    if (aperto) {
      impostaOperatore(operatoreIniziale);
      impostaGiorno(giornoIniziale);
      impostaInizio(orarioIniziale);
      impostaServizi([]);
      impostaCliente(null);
      impostaSenzaCaparra(false);
      impostaNote('');
      impostaErrore(null);
    }
  }, [aperto, operatoreIniziale, giornoIniziale, orarioIniziale]);

  /** Solo i servizi che l'operatore scelto è abilitato a erogare. */
  const serviziDisponibili = useMemo(
    () =>
      servizi.filter(
        (servizio) => servizio.attivo && servizio.operatoriAbilitati.includes(operatoreId),
      ),
    [servizi, operatoreId],
  );

  const scelti = serviziDisponibili.filter((servizio) => servizioIds.includes(servizio.id));
  const durata = scelti.reduce((somma, servizio) => somma + servizio.durataMinuti, 0);
  const prezzo = scelti.reduce((somma, servizio) => somma + servizio.prezzoCentesimi, 0);

  function alternaServizio(id: string) {
    impostaInizio(null);
    impostaServizi((precedenti) =>
      precedenti.includes(id) ? precedenti.filter((altro) => altro !== id) : [...precedenti, id],
    );
  }

  async function invia() {
    if (!cliente || !inizio || servizioIds.length === 0) {
      impostaErrore('Scegli il cliente, i servizi e l’orario.');

      return;
    }

    impostaInvio(true);
    impostaErrore(null);

    try {
      const creato = await creaAppuntamento({
        clienteId: cliente.id,
        operatoreId,
        servizioIds,
        inizio,
        senzaCaparra,
        note,
      });

      onCreato(creato);
      onChiudi();
    } catch (motivo) {
      impostaErrore(motivo instanceof Error ? motivo.message : 'Appuntamento non salvato.');
    } finally {
      impostaInvio(false);
    }
  }

  return (
    <Modale
      aperto={aperto}
      titolo="Nuovo appuntamento"
      descrizione="Inserimento dal personale: nessun preavviso minimo."
      onChiudi={onChiudi}
    >
      <div className="space-y-5">
        <CercaCliente cliente={cliente} onScegli={impostaCliente} />

        <div className="space-y-2">
          <label htmlFor="operatore-appuntamento" className="block text-sm font-medium">
            Operatore
          </label>
          <select
            id="operatore-appuntamento"
            value={operatoreId}
            onChange={(evento) => {
              impostaOperatore(evento.target.value);
              impostaServizi([]);
              impostaInizio(null);
            }}
            className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
          >
            {operatori.map((operatore) => (
              <option key={operatore.id} value={operatore.id}>
                {operatore.nome} {operatore.cognome}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Servizi</legend>
          {serviziDisponibili.length === 0 ? (
            <p className="text-sm text-testo-tenue">
              Questo operatore non è abilitato a nessun servizio attivo.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {serviziDisponibili.map((servizio) => (
                <label
                  key={servizio.id}
                  className={clsx(
                    'flex cursor-pointer items-start gap-2 rounded-[var(--radius-campo)] border px-3 py-2 text-sm transition-colors duration-[var(--durata-breve)]',
                    servizioIds.includes(servizio.id)
                      ? 'border-accento bg-accento/10'
                      : 'border-bordo bg-fondo-elevato hover:border-accento',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={servizioIds.includes(servizio.id)}
                    onChange={() => alternaServizio(servizio.id)}
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
          )}
          {scelti.length > 0 && (
            <p className="text-sm text-testo-tenue">
              Durata totale {formattaDurata(durata)} · {formattaPrezzo(prezzo)}
            </p>
          )}
        </fieldset>

        <SelettoreSlot
          operatoreId={operatoreId}
          servizioIds={servizioIds}
          giorno={giorno}
          onCambiaGiorno={(nuovo) => {
            impostaGiorno(nuovo);
            impostaInizio(null);
          }}
          valore={inizio}
          onScegli={impostaInizio}
        />

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={senzaCaparra}
            onChange={(evento) => impostaSenzaCaparra(evento.target.checked)}
            className="mt-0.5 accent-[var(--color-accento)]"
          />
          <span>
            Senza caparra
            <span className="block text-xs text-testo-tenue">
              Disponibile solo al personale: il cliente non vede questa opzione.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <label htmlFor="note-appuntamento" className="block text-sm font-medium">
            Note
          </label>
          <textarea
            id="note-appuntamento"
            value={note}
            onChange={(evento) => impostaNote(evento.target.value)}
            rows={2}
            maxLength={500}
            className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
          />
        </div>

        {errore && <Avviso tono="errore">{errore}</Avviso>}

        <div className="flex flex-wrap justify-end gap-3">
          <Pulsante variante="secondario" onClick={onChiudi}>
            Annulla
          </Pulsante>
          <Pulsante onClick={() => void invia()} disabled={inInvio}>
            {inInvio ? 'Salvataggio…' : 'Salva appuntamento'}
          </Pulsante>
        </div>
      </div>
    </Modale>
  );
}

/** Ricerca della scheda cliente per nome, cognome o numero. */
function CercaCliente({
  cliente,
  onScegli,
}: {
  cliente: Cliente | null;
  onScegli: (cliente: Cliente | null) => void;
}) {
  const [cerca, impostaCerca] = useState('');
  const [risultati, impostaRisultati] = useState<Cliente[]>([]);
  const [inRicerca, impostaRicerca] = useState(false);

  useEffect(() => {
    if (cliente || cerca.trim().length < 2) {
      impostaRisultati([]);

      return;
    }

    let annullato = false;
    // Piccolo ritardo: evita una richiesta per ogni tasto premuto.
    const attesa = setTimeout(() => {
      impostaRicerca(true);
      leggiClienti({ cerca: cerca.trim(), perPagina: 8 })
        .then((elenco) => {
          if (!annullato) {
            impostaRisultati(elenco.clienti);
          }
        })
        .catch(() => {
          if (!annullato) {
            impostaRisultati([]);
          }
        })
        .finally(() => {
          if (!annullato) {
            impostaRicerca(false);
          }
        });
    }, 250);

    return () => {
      annullato = true;
      clearTimeout(attesa);
    };
  }, [cerca, cliente]);

  if (cliente) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-campo)] border border-accento bg-accento/10 px-3 py-2.5">
        <span className="text-sm">
          <span className="font-medium">
            {cliente.nome} {cliente.cognome}
          </span>
          <span className="block text-xs text-testo-tenue">
            {cliente.numeroWhatsapp ?? cliente.email ?? 'Nessun contatto'}
          </span>
        </span>
        <Pulsante variante="discreto" onClick={() => onScegli(null)}>
          Cambia
        </Pulsante>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Campo
        etichetta="Cliente"
        value={cerca}
        onChange={(evento) => impostaCerca(evento.target.value)}
        placeholder="Nome, cognome o numero"
        suggerimento="La scheda si crea dalla pagina Clienti."
        autoComplete="off"
      />
      {inRicerca && <p className="text-xs text-testo-tenue">Ricerca…</p>}
      {risultati.length > 0 && (
        <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-[var(--radius-campo)] border border-bordo">
          {risultati.map((risultato) => (
            <li key={risultato.id}>
              <button
                type="button"
                onClick={() => onScegli(risultato)}
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-fondo-elevato"
              >
                <span className="font-medium">
                  {risultato.nome} {risultato.cognome}
                </span>
                <span className="block text-xs text-testo-tenue">
                  {risultato.numeroWhatsapp ?? risultato.email ?? 'Nessun contatto'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
