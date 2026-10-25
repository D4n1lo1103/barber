import { useEffect, useState } from 'react';
import {
  CONFIGURAZIONI_PROFILO,
  GRANULARITA_SLOT_AMMESSE,
  schemaDatiSaloneModificabili,
  type Salone,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { usaInstallazione } from '../../installazione/contesto-installazione';
import { ErroreApi } from '../../servizi/client-api';
import { leggiSalone, salvaSalone } from '../../servizi/gestione';

const BOZZA_VUOTA = {
  nomeSalone: '',
  indirizzo: '',
  citta: '',
  telefono: '',
  emailSalone: '',
};

/**
 * Dati del salone decisi al primo avvio e poi modificabili. Il profilo è in
 * sola lettura: cambiarlo a salone avviato ribalterebbe catalogo, durate
 * tipiche e palette su dati già in uso.
 */
export function SchedaSalone() {
  const { stato, aggiorna } = usaInstallazione();
  const [bozza, impostaBozza] = useState(BOZZA_VUOTA);
  const [profilo, impostaProfilo] = useState<Salone['profilo'] | null>(null);
  const [granularita, impostaGranularita] = useState('15');
  const [bloccoSlot, impostaBloccoSlot] = useState('10');
  const [venditaOnline, impostaVenditaOnline] = useState(false);
  const [messaggio, impostaMessaggio] = useState<{
    tono: 'errore' | 'conferma';
    testo: string;
  } | null>(null);
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [inCorso, impostaInCorso] = useState(false);

  useEffect(() => {
    leggiSalone()
      .then((salone) => {
        impostaBozza({
          nomeSalone: salone.nomeSalone,
          indirizzo: salone.indirizzo,
          citta: salone.citta,
          telefono: salone.telefono,
          emailSalone: salone.emailSalone,
        });
        impostaProfilo(salone.profilo);
        impostaGranularita(String(salone.granularitaSlotMinuti));
        impostaBloccoSlot(String(salone.minutiBloccoSlot));
        impostaVenditaOnline(salone.venditaOnlineAttiva);
      })
      .catch((problema: unknown) =>
        impostaMessaggio({
          tono: 'errore',
          testo: problema instanceof ErroreApi ? problema.message : 'Dati del salone non caricati.',
        }),
      )
      .finally(() => impostaCaricamento(false));
  }, []);

  function aggiornaCampo(campo: keyof typeof BOZZA_VUOTA, valore: string) {
    impostaBozza((precedente) => ({ ...precedente, [campo]: valore }));
  }

  async function salva() {
    const validazione = schemaDatiSaloneModificabili.safeParse({
      ...bozza,
      granularitaSlotMinuti: Number(granularita),
      minutiBloccoSlot: Number(bloccoSlot),
      venditaOnlineAttiva: venditaOnline,
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
      await salvaSalone(validazione.data);
      // Nome, granularità e vendita online sono nello stato dell'installazione,
      // che tutta l'app legge: va riletto, altrimenti resta quello vecchio.
      await aggiorna();
      impostaMessaggio({ tono: 'conferma', testo: 'Dati del salone salvati.' });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Dati non salvati.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  if (inCaricamento) {
    return <p className="text-sm text-testo-tenue">Caricamento dei dati del salone…</p>;
  }

  const granularitaCambiata = String(stato?.granularitaSlotMinuti ?? '') !== granularita;

  return (
    <div className="space-y-6">
      {messaggio && <Avviso tono={messaggio.tono}>{messaggio.testo}</Avviso>}

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Dati del salone</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Compaiono nelle e-mail ai clienti e nell’intestazione dell’app.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            etichetta="Nome del salone"
            value={bozza.nomeSalone}
            onChange={(evento) => aggiornaCampo('nomeSalone', evento.target.value)}
          />
          <Campo
            etichetta="Città"
            value={bozza.citta}
            onChange={(evento) => aggiornaCampo('citta', evento.target.value)}
          />
          <Campo
            etichetta="Indirizzo"
            value={bozza.indirizzo}
            onChange={(evento) => aggiornaCampo('indirizzo', evento.target.value)}
          />
          <Campo
            etichetta="Telefono"
            value={bozza.telefono}
            onChange={(evento) => aggiornaCampo('telefono', evento.target.value)}
            suggerimento="In formato internazionale, come +39340…"
          />
          <Campo
            etichetta="E-mail del salone"
            type="email"
            value={bozza.emailSalone}
            onChange={(evento) => aggiornaCampo('emailSalone', evento.target.value)}
          />
          <div className="space-y-2">
            <p className="block text-sm font-medium">Profilo</p>
            <p className="rounded-[var(--radius-campo)] border border-bordo bg-fondo px-3 py-2.5 text-sm text-testo-tenue">
              {profilo ? CONFIGURAZIONI_PROFILO[profilo].etichetta : '—'}
            </p>
            <p className="text-xs text-testo-tenue">
              Scelto al primo avvio e non modificabile: decide catalogo predefinito, durate tipiche
              e colori dell’app.
            </p>
          </div>
        </div>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Agenda e prenotazioni</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="granularita-slot" className="block text-sm font-medium">
              Granularità degli slot
            </label>
            <select
              id="granularita-slot"
              value={granularita}
              onChange={(evento) => impostaGranularita(evento.target.value)}
              className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
            >
              {GRANULARITA_SLOT_AMMESSE.map((minuti) => (
                <option key={minuti} value={minuti}>
                  {minuti} minuti
                </option>
              ))}
            </select>
            <p className="text-xs text-testo-tenue">
              Passo con cui l’agenda propone gli orari liberi.
            </p>
          </div>
          <Campo
            etichetta="Blocco dello slot durante il pagamento (minuti)"
            type="number"
            min={5}
            max={60}
            value={bloccoSlot}
            onChange={(evento) => impostaBloccoSlot(evento.target.value)}
            suggerimento="Tempo concesso al cliente per pagare la caparra prima che lo slot torni libero."
          />
        </div>

        {granularitaCambiata && (
          <div className="mt-4">
            <Avviso tono="avviso">
              Gli appuntamenti già presi restano al loro orario: la nuova granularità vale solo per
              quelli futuri. Le durate dei servizi devono essere multiple del valore scelto,
              altrimenti il salvataggio dice quali correggere.
            </Avviso>
          </div>
        )}

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={venditaOnline}
            onChange={(evento) => impostaVenditaOnline(evento.target.checked)}
            className="mt-0.5 accent-[var(--color-accento)]"
          />
          <span>
            Vendita online dei prodotti attiva
            <span className="block text-xs text-testo-tenue">
              I clienti possono acquistare i prodotti dall’app.
            </span>
          </span>
        </label>

        <Pulsante className="mt-6" onClick={() => void salva()} disabled={inCorso}>
          {inCorso ? 'Salvataggio…' : 'Salva i dati del salone'}
        </Pulsante>
      </Superficie>
    </div>
  );
}
