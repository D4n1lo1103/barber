import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  istanteDaOraLocale,
  type Appuntamento,
  type Cliente,
  type Operatore,
  type Servizio,
} from '@barber/shared';
import { usaSessione } from '../../autenticazione/contesto-sessione';
import { Avviso } from '../../componenti/avviso';
import { CercaCliente } from '../../componenti/cerca-cliente';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import { creaAppuntamento } from '../../servizi/gestione';
import { formattaDurata, formattaPrezzo } from '../../utilita/formati';
import { SelettoreSlot } from './selettore-slot';

/** Istante UTC corrispondente a un giorno e a un'ora locali del salone. */
function istanteDa(giorno: string, ora: string): string | null {
  const [anno, mese, resto] = giorno.split('-');
  const [ore, minuti] = ora.split(':');

  if (!anno || !mese || !resto || !ore || !minuti) {
    return null;
  }

  return istanteDaOraLocale(
    Number(anno),
    Number(mese),
    Number(resto),
    Number(ore) * 60 + Number(minuti),
  ).toISOString();
}

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
  // Deroga del titolare: orario libero al posto della griglia degli slot.
  const [fuoriOrario, impostaFuoriOrario] = useState(false);
  const [ora, impostaOra] = useState('');
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
      impostaFuoriOrario(false);
      impostaOra('');
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

  const { utente } = usaSessione();
  const puoForzare = utente?.ruolo === 'titolare';
  // Fuori orario l'istante arriva dai campi giorno e ora, non dalla griglia.
  const istante = fuoriOrario ? istanteDa(giorno, ora) : inizio;

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
    // Un messaggio per ciascun dato mancante: il generico non diceva quale.
    if (!cliente) {
      impostaErrore('Scegli il cliente.');

      return;
    }

    if (servizioIds.length === 0) {
      impostaErrore('Scegli almeno un servizio.');

      return;
    }

    if (!istante) {
      impostaErrore(
        fuoriOrario
          ? 'Indica il giorno e l’ora dell’appuntamento.'
          : 'Scegli l’orario fra quelli liberi. Se il giorno non ne ha, provane un altro.',
      );

      return;
    }

    impostaInvio(true);
    impostaErrore(null);

    try {
      const creato = await creaAppuntamento({
        clienteId: cliente.id,
        operatoreId,
        servizioIds,
        inizio: istante,
        // Inserendo dal personale la caparra non si applica.
        senzaCaparra: true,
        forzato: fuoriOrario,
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

        {puoForzare && (
          <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={fuoriOrario}
              onChange={(evento) => {
                impostaFuoriOrario(evento.target.checked);
                impostaInizio(null);
                impostaErrore(null);
              }}
              className="mt-0.5 accent-[var(--color-accento)]"
            />
            <span>
              <span className="block font-medium">Fuori orario</span>
              <span className="block text-xs text-testo-tenue">
                Riservato al titolare: sceglie qualsiasi giorno e ora, anche a salone chiuso o con
                l’operatore già impegnato.
              </span>
            </span>
          </label>
        )}

        {fuoriOrario ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="giorno-fuori-orario" className="block text-sm font-medium">
                  Giorno
                </label>
                <input
                  id="giorno-fuori-orario"
                  type="date"
                  value={giorno}
                  onChange={(evento) => impostaGiorno(evento.target.value)}
                  className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="ora-fuori-orario" className="block text-sm font-medium">
                  Ora
                </label>
                <input
                  id="ora-fuori-orario"
                  type="time"
                  value={ora}
                  onChange={(evento) => impostaOra(evento.target.value)}
                  className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
                />
              </div>
            </div>
            <Avviso tono="avviso">
              Questo appuntamento non rispetta i vincoli dell’agenda: orari di lavoro, chiusure,
              assenze e sovrapposizioni. Controlla di persona che l’operatore sia davvero libero.
            </Avviso>
          </div>
        ) : (
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
        )}

        <p className="text-xs text-testo-tenue">
          Un appuntamento inserito dal personale non prevede caparra: la caparra si paga online e
          riguarda solo le prenotazioni che il cliente fa da sé.
        </p>

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
