import { useEffect, useState } from 'react';
import {
  schemaImpostazioniWhatsapp,
  schemaInvioDiProva,
  type ModelliWhatsapp,
  type StatoWhatsapp,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import {
  inviaProvaWhatsapp,
  leggiImpostazioniWhatsapp,
  salvaImpostazioniWhatsapp,
} from '../../servizi/gestione';

/** Etichette dei quattro modelli, nell'ordine in cui si usano. */
const MODELLI: { chiave: keyof ModelliWhatsapp; etichetta: string; suggerimento: string }[] = [
  {
    chiave: 'confermaPrenotazione',
    etichetta: 'Conferma della prenotazione',
    suggerimento: 'Parametri: nome, salone, data e ora, servizi, operatore.',
  },
  {
    chiave: 'promemoria',
    etichetta: 'Promemoria',
    suggerimento: 'Stessi parametri della conferma. L’anticipo si imposta nella scheda Regole.',
  },
  {
    chiave: 'invitoAttivazione',
    etichetta: 'Invito ad attivare l’account',
    suggerimento: 'Parametri: nome, salone. Il link va nel pulsante del modello.',
  },
  {
    chiave: 'verificaNumero',
    etichetta: 'Codice di verifica del numero',
    suggerimento: 'Categoria «autenticazione» presso Meta. Parametro: il codice.',
  },
];

/**
 * Messaggi WhatsApp: attivazione, numero mittente e nomi dei modelli approvati
 * da Meta. Il token di accesso non si imposta da qui: è un segreto e vive nelle
 * variabili d'ambiente del server, come le credenziali dei pagamenti.
 */
export function SchedaMessaggi() {
  const [stato, impostaStato] = useState<StatoWhatsapp | null>(null);
  const [attivo, impostaAttivo] = useState(false);
  const [idNumero, impostaIdNumero] = useState('');
  const [modelli, impostaModelli] = useState<ModelliWhatsapp | null>(null);
  const [numeroProva, impostaNumeroProva] = useState('');
  const [messaggio, impostaMessaggio] = useState<{
    tono: 'errore' | 'conferma' | 'avviso';
    testo: string;
  } | null>(null);
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [inCorso, impostaInCorso] = useState(false);

  useEffect(() => {
    leggiImpostazioniWhatsapp()
      .then((letto) => {
        impostaStato(letto);
        impostaAttivo(letto.attivo);
        impostaIdNumero(letto.idNumero);
        impostaModelli(letto.modelli);
      })
      .catch((problema: unknown) =>
        impostaMessaggio({
          tono: 'errore',
          testo: problema instanceof ErroreApi ? problema.message : 'Impostazioni non caricate.',
        }),
      )
      .finally(() => impostaCaricamento(false));
  }, []);

  async function salva() {
    if (!modelli) {
      return;
    }

    const validazione = schemaImpostazioniWhatsapp.safeParse({ attivo, idNumero, modelli });

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
      impostaStato(await salvaImpostazioniWhatsapp(validazione.data));
      impostaMessaggio({ tono: 'conferma', testo: 'Impostazioni dei messaggi salvate.' });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Impostazioni non salvate.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  async function prova() {
    const validazione = schemaInvioDiProva.safeParse({ numeroWhatsapp: numeroProva });

    if (!validazione.success) {
      impostaMessaggio({
        tono: 'errore',
        testo: validazione.error.issues[0]?.message ?? 'Numero non valido.',
      });

      return;
    }

    impostaInCorso(true);
    impostaMessaggio(null);

    try {
      const esito = await inviaProvaWhatsapp(validazione.data.numeroWhatsapp);

      impostaMessaggio({
        tono: esito.inviato ? 'conferma' : 'errore',
        testo: esito.dettaglio,
      });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Invio di prova non riuscito.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  if (inCaricamento || !stato || !modelli) {
    return <p className="text-sm text-testo-tenue">Caricamento delle impostazioni…</p>;
  }

  return (
    <div className="space-y-6">
      {messaggio && <Avviso tono={messaggio.tono}>{messaggio.testo}</Avviso>}

      {!stato.tokenConfigurato && (
        <Avviso tono="avviso">
          Il token di WhatsApp non è configurato sul server: i messaggi non partono e i clienti
          ricevono tutto via e-mail. Il token è un segreto e si imposta nel file di configurazione
          dell’installazione (variabile <code>WHATSAPP_TOKEN</code>), non da questa pagina.
        </Avviso>
      )}

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Messaggi WhatsApp</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Conferme, promemoria e inviti vanno su WhatsApp ai clienti che hanno dato il consenso.
          Senza consenso, senza numero o se l’invio non riesce, il messaggio parte via e-mail.
        </p>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={attivo}
            onChange={(evento) => impostaAttivo(evento.target.checked)}
            className="mt-0.5 accent-[var(--color-accento)]"
          />
          <span>
            Invia i messaggi di servizio su WhatsApp
            <span className="block text-xs text-testo-tenue">
              Serve l’identificativo del numero mittente registrato presso Meta.
            </span>
          </span>
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            etichetta="Identificativo del numero mittente"
            value={idNumero}
            onChange={(evento) => impostaIdNumero(evento.target.value)}
            inputMode="numeric"
            suggerimento="Lo trovi nella console di Meta come «Phone number ID». Non è un segreto."
          />
        </div>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Modelli approvati</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          WhatsApp consente solo messaggi costruiti su modelli approvati da Meta. Qui vanno i nomi
          con cui li hai registrati: minuscole, numeri e trattini bassi.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {MODELLI.map(({ chiave, etichetta, suggerimento }) => (
            <Campo
              key={chiave}
              etichetta={etichetta}
              value={modelli[chiave]}
              onChange={(evento) => impostaModelli({ ...modelli, [chiave]: evento.target.value })}
              suggerimento={suggerimento}
            />
          ))}
        </div>

        <Pulsante className="mt-6" onClick={() => void salva()} disabled={inCorso}>
          {inCorso ? 'Salvataggio…' : 'Salva i messaggi'}
        </Pulsante>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Invio di prova</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Invia il modello del codice di verifica a un numero che controlli, per accertarti che la
          configurazione funzioni prima di contare sui messaggi.
          {stato.finto && ' In questa installazione i messaggi vengono solo registrati nei log.'}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Campo
              etichetta="Numero di prova"
              value={numeroProva}
              onChange={(evento) => impostaNumeroProva(evento.target.value)}
              placeholder="+39333…"
              inputMode="tel"
            />
          </div>
          <Pulsante variante="secondario" onClick={() => void prova()} disabled={inCorso}>
            Invia la prova
          </Pulsante>
        </div>
      </Superficie>
    </div>
  );
}
