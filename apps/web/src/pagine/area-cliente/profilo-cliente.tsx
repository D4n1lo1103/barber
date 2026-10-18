import { useEffect, useState } from 'react';
import {
  ETICHETTE_RICHIESTA_CANCELLAZIONE,
  schemaModificaProfilo,
  type ProfiloCliente,
  type RichiestaCancellazione,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import {
  chiediCodiceNumero,
  confermaCodiceNumero,
  esportaDatiCliente,
  leggiProfiloCliente,
  leggiRichiestaCancellazione,
  modificaProfiloCliente,
  richiediCancellazioneDati,
} from '../../servizi/gestione';
import { formattaData } from '../../utilita/formati';

/** Dati personali, consensi e diritti GDPR del cliente. */
export function ProfiloClienteScheda({
  profilo,
  onAggiornato,
}: {
  profilo: ProfiloCliente;
  onAggiornato: (profilo: ProfiloCliente) => void;
}) {
  const [nome, impostaNome] = useState(profilo.nome);
  const [cognome, impostaCognome] = useState(profilo.cognome);
  const [numero, impostaNumero] = useState(profilo.numeroWhatsapp ?? '');
  const [errori, impostaErrori] = useState<Record<string, string>>({});
  const [messaggio, impostaMessaggio] = useState<{
    tono: 'errore' | 'conferma';
    testo: string;
  } | null>(null);
  const [richiesta, impostaRichiesta] = useState<RichiestaCancellazione | null>(null);
  const [cancellazioneAperta, impostaCancellazioneAperta] = useState(false);
  const [codiceRichiesto, impostaCodiceRichiesto] = useState(false);
  const [codice, impostaCodice] = useState('');
  const [motivo, impostaMotivo] = useState('');
  const [inCorso, impostaInCorso] = useState(false);

  useEffect(() => {
    leggiRichiestaCancellazione()
      .then((esito) => impostaRichiesta(esito.richiesta))
      .catch(() => impostaRichiesta(null));
  }, []);

  const consensoWhatsapp = profilo.consensoWhatsappIl !== null;

  async function salvaContatti() {
    const validazione = schemaModificaProfilo.safeParse({ nome, cognome, numeroWhatsapp: numero });

    if (!validazione.success) {
      impostaErrori(
        Object.fromEntries(
          validazione.error.issues.map((problema) => [String(problema.path[0]), problema.message]),
        ),
      );

      return;
    }

    impostaErrori({});
    impostaMessaggio(null);
    impostaInCorso(true);

    try {
      onAggiornato(await modificaProfiloCliente(validazione.data));
      impostaMessaggio({ tono: 'conferma', testo: 'Dati aggiornati.' });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Dati non salvati.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  async function cambiaConsenso(valore: boolean) {
    impostaMessaggio(null);

    try {
      onAggiornato(await modificaProfiloCliente({ consensoWhatsapp: valore }));
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Consenso non aggiornato.',
      });
    }
  }

  /** Scarica una copia dei propri dati, come prevede il diritto di accesso. */
  async function scaricaDati() {
    impostaMessaggio(null);

    try {
      const dati = await esportaDatiCliente();
      const collegamento = document.createElement('a');
      const contenuto = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });

      collegamento.href = URL.createObjectURL(contenuto);
      collegamento.download = 'i-miei-dati.json';
      collegamento.click();
      URL.revokeObjectURL(collegamento.href);
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Copia non disponibile.',
      });
    }
  }

  async function chiediCancellazione() {
    impostaInCorso(true);
    impostaMessaggio(null);

    try {
      impostaRichiesta(await richiediCancellazioneDati(motivo));
      impostaCancellazioneAperta(false);
      impostaMotivo('');
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Richiesta non inviata.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  /** Chiede il codice di verifica del numero. */
  async function chiediCodice() {
    impostaInCorso(true);
    impostaMessaggio(null);

    try {
      const esito = await chiediCodiceNumero();

      impostaCodiceRichiesto(true);
      impostaMessaggio({
        tono: 'conferma',
        testo:
          esito.canale === 'whatsapp'
            ? 'Codice inviato su WhatsApp.'
            : 'Il salone non ha attivo WhatsApp: il codice è stato inviato per e-mail.',
      });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Codice non inviato.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  async function confermaNumero() {
    impostaInCorso(true);
    impostaMessaggio(null);

    try {
      await confermaCodiceNumero(codice.trim());
      onAggiornato(await leggiProfiloCliente());
      impostaCodiceRichiesto(false);
      impostaCodice('');
      impostaMessaggio({ tono: 'conferma', testo: 'Numero verificato.' });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Codice non valido.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  return (
    <div className="space-y-5">
      {messaggio && <Avviso tono={messaggio.tono}>{messaggio.testo}</Avviso>}

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">I tuoi dati</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo
            etichetta="Nome"
            value={nome}
            onChange={(evento) => impostaNome(evento.target.value)}
            errore={errori.nome}
          />
          <Campo
            etichetta="Cognome"
            value={cognome}
            onChange={(evento) => impostaCognome(evento.target.value)}
            errore={errori.cognome}
          />
        </div>

        <div className="mt-4">
          <Campo
            etichetta="Numero WhatsApp"
            value={numero}
            onChange={(evento) => impostaNumero(evento.target.value)}
            errore={errori.numeroWhatsapp}
            suggerimento={
              profilo.numeroVerificato
                ? 'Numero verificato.'
                : 'Verificalo per ricevere conferme e promemoria su WhatsApp.'
            }
            inputMode="tel"
          />
        </div>

        {!profilo.numeroVerificato && profilo.numeroWhatsapp && (
          <div className="mt-4 rounded-[var(--radius-campo)] border border-bordo p-4">
            {codiceRichiesto ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1">
                  <Campo
                    etichetta="Codice ricevuto"
                    value={codice}
                    onChange={(evento) => impostaCodice(evento.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    suggerimento="Sei cifre, valide pochi minuti."
                  />
                </div>
                <Pulsante
                  disabled={inCorso || codice.trim().length !== 6}
                  onClick={() => void confermaNumero()}
                >
                  Conferma il numero
                </Pulsante>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-testo-tenue">
                  Verifica il tuo numero: ti inviamo un codice di sei cifre.
                </p>
                <Pulsante
                  variante="secondario"
                  disabled={inCorso}
                  onClick={() => void chiediCodice()}
                >
                  Invia il codice
                </Pulsante>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-sm text-testo-tenue">
          E-mail: <strong>{profilo.email ?? '—'}</strong>
          {profilo.emailVerificata ? ' (confermata)' : ' (da confermare)'}. Per cambiarla scrivi al
          salone: serve una nuova conferma.
        </p>

        <Pulsante className="mt-4" onClick={() => void salvaContatti()} disabled={inCorso}>
          Salva i dati
        </Pulsante>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Consensi</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Il consenso al trattamento dei dati è stato dato il{' '}
          {profilo.consensoTrattamentoIl ? formattaData(profilo.consensoTrattamentoIl) : '—'} ed è
          necessario per gestire gli appuntamenti.
        </p>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consensoWhatsapp}
            onChange={(evento) => void cambiaConsenso(evento.target.checked)}
            className="mt-0.5 accent-[var(--color-accento)]"
          />
          <span>
            Ricevere conferme e promemoria su WhatsApp
            <span className="block text-xs text-testo-tenue">
              {consensoWhatsapp
                ? `Consenso dato il ${formattaData(profilo.consensoWhatsappIl!)}. Puoi revocarlo qui.`
                : 'Senza consenso i messaggi arrivano per e-mail.'}
            </span>
          </span>
        </label>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">I tuoi diritti</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Puoi scaricare una copia dei tuoi dati o chiederne la cancellazione.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Pulsante variante="secondario" onClick={() => void scaricaDati()}>
            Scarica i miei dati
          </Pulsante>
          {!richiesta || richiesta.stato !== 'in_attesa' ? (
            <Pulsante variante="secondario" onClick={() => impostaCancellazioneAperta(true)}>
              Chiedi la cancellazione
            </Pulsante>
          ) : null}
        </div>

        {richiesta && (
          <p className="mt-4 text-sm text-testo-tenue">
            Richiesta del {formattaData(richiesta.richiestaIl)}:{' '}
            <strong>{ETICHETTE_RICHIESTA_CANCELLAZIONE[richiesta.stato]}</strong>
            {richiesta.notaTitolare && ` — ${richiesta.notaTitolare}`}
          </p>
        )}
      </Superficie>

      <Modale
        aperto={cancellazioneAperta}
        titolo="Chiedi la cancellazione dei dati"
        descrizione="La richiesta viene valutata dal salone."
        onChiudi={() => impostaCancellazioneAperta(false)}
      >
        <div className="space-y-4">
          <Avviso tono="avviso">
            I tuoi dati personali verranno rimossi e l’account disattivato. Gli appuntamenti già
            svolti restano nei registri del salone in forma anonima, come richiedono gli obblighi
            contabili. Appuntamenti futuri ancora in agenda vanno prima annullati.
          </Avviso>

          <div className="space-y-2">
            <label htmlFor="motivo-cancellazione" className="block text-sm font-medium">
              Motivo (facoltativo)
            </label>
            <textarea
              id="motivo-cancellazione"
              value={motivo}
              onChange={(evento) => impostaMotivo(evento.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Pulsante variante="secondario" onClick={() => impostaCancellazioneAperta(false)}>
              Annulla
            </Pulsante>
            <Pulsante disabled={inCorso} onClick={() => void chiediCancellazione()}>
              Invia la richiesta
            </Pulsante>
          </div>
        </div>
      </Modale>
    </div>
  );
}
