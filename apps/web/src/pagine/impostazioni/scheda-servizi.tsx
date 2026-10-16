import { useEffect, useState } from 'react';
import type { Operatore, Servizio } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import {
  creaServizio,
  disattivaServizio,
  leggiPersonale,
  leggiServizi,
  modificaServizio,
} from '../../servizi/gestione';
import { centesimiDaPrezzo, formattaDurata, formattaPrezzo } from '../../utilita/formati';

const DURATA_PREDEFINITA = 30;

export function SchedaServizi({ granularitaSlotMinuti }: { granularitaSlotMinuti: number }) {
  const [servizi, impostaServizi] = useState<Servizio[]>([]);
  const [personale, impostaPersonale] = useState<Operatore[]>([]);
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inCaricamento, impostaInCaricamento] = useState(true);

  const [nome, impostaNome] = useState('');
  const [descrizione, impostaDescrizione] = useState('');
  const [prezzo, impostaPrezzo] = useState('');
  const [durata, impostaDurata] = useState(String(DURATA_PREDEFINITA));
  const [abilitati, impostaAbilitati] = useState<string[]>([]);
  const [inInvio, impostaInInvio] = useState(false);

  async function ricarica() {
    try {
      const [elencoServizi, elencoPersonale] = await Promise.all([
        leggiServizi(),
        leggiPersonale(),
      ]);
      impostaServizi(elencoServizi.servizi);
      impostaPersonale(elencoPersonale.personale.filter((operatore) => operatore.attivo));
      impostaErrore(null);
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Caricamento non riuscito.');
    } finally {
      impostaInCaricamento(false);
    }
  }

  useEffect(() => {
    void ricarica();
  }, []);

  async function aggiungi(evento: React.FormEvent) {
    evento.preventDefault();
    impostaErrore(null);

    const prezzoCentesimi = centesimiDaPrezzo(prezzo);
    const durataMinuti = Number(durata);

    if (prezzoCentesimi === null) {
      impostaErrore('Indica un prezzo valido, ad esempio 20,00.');

      return;
    }

    if (durataMinuti % granularitaSlotMinuti !== 0) {
      impostaErrore(`La durata deve essere un multiplo di ${granularitaSlotMinuti} minuti.`);

      return;
    }

    impostaInInvio(true);

    try {
      await creaServizio({
        nome,
        descrizione,
        prezzoCentesimi,
        durataMinuti,
        operatoriAbilitati: abilitati,
      });
      impostaNome('');
      impostaDescrizione('');
      impostaPrezzo('');
      impostaDurata(String(DURATA_PREDEFINITA));
      impostaAbilitati([]);
      await ricarica();
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Operazione non riuscita.');
    } finally {
      impostaInInvio(false);
    }
  }

  async function cambiaStato(servizio: Servizio) {
    try {
      if (servizio.attivo) {
        await disattivaServizio(servizio.id);
      } else {
        await modificaServizio(servizio.id, { attivo: true });
      }
      await ricarica();
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Operazione non riuscita.');
    }
  }

  if (inCaricamento) {
    return <p className="text-sm text-testo-tenue">Caricamento del catalogo…</p>;
  }

  return (
    <div className="space-y-6">
      {errore && <Avviso tono="errore">{errore}</Avviso>}

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Catalogo ({servizi.length})</h2>
        <ul className="mt-4 space-y-3">
          {servizi.map((servizio) => (
            <li
              key={servizio.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-campo)] border border-bordo p-3"
            >
              <div>
                <p className="text-sm font-semibold">
                  {servizio.nome}
                  {!servizio.attivo && (
                    <span className="ml-2 text-xs font-normal text-testo-tenue">(disattivato)</span>
                  )}
                </p>
                <p className="text-xs text-testo-tenue">
                  {formattaPrezzo(servizio.prezzoCentesimi)} ·{' '}
                  {formattaDurata(servizio.durataMinuti)}
                  {servizio.operatoriAbilitati.length > 0 &&
                    ` · ${servizio.operatoriAbilitati.length} operatori abilitati`}
                </p>
              </div>
              <Pulsante variante="secondario" onClick={() => void cambiaStato(servizio)}>
                {servizio.attivo ? 'Disattiva' : 'Riattiva'}
              </Pulsante>
            </li>
          ))}
          {servizi.length === 0 && (
            <li className="text-sm text-testo-tenue">Nessun servizio nel catalogo.</li>
          )}
        </ul>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Nuovo servizio</h2>
        <form onSubmit={aggiungi} className="mt-4 space-y-4" noValidate>
          <Campo
            etichetta="Nome"
            value={nome}
            onChange={(evento) => impostaNome(evento.target.value)}
            required
          />
          <Campo
            etichetta="Descrizione"
            value={descrizione}
            onChange={(evento) => impostaDescrizione(evento.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etichetta="Prezzo"
              value={prezzo}
              onChange={(evento) => impostaPrezzo(evento.target.value)}
              suggerimento="In euro, IVA inclusa. Es. 20,00"
              inputMode="decimal"
              required
            />
            <Campo
              etichetta="Durata (minuti)"
              type="number"
              min={granularitaSlotMinuti}
              step={granularitaSlotMinuti}
              value={durata}
              onChange={(evento) => impostaDurata(evento.target.value)}
              suggerimento={`Multiplo di ${granularitaSlotMinuti} minuti`}
              required
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Operatori abilitati</legend>
            {personale.map((operatore) => (
              <label key={operatore.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={abilitati.includes(operatore.id)}
                  onChange={(evento) =>
                    impostaAbilitati((precedenti) =>
                      evento.target.checked
                        ? [...precedenti, operatore.id]
                        : precedenti.filter((id) => id !== operatore.id),
                    )
                  }
                  className="accent-[var(--color-accento)]"
                />
                {operatore.nome} {operatore.cognome}
              </label>
            ))}
          </fieldset>

          <Pulsante type="submit" disabled={inInvio}>
            {inInvio ? 'Salvataggio…' : 'Aggiungi servizio'}
          </Pulsante>
        </form>
      </Superficie>
    </div>
  );
}
