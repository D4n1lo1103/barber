import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { schemaRegistrazioneCliente } from '@barber/shared';
import { Avviso } from '../componenti/avviso';
import { Campo } from '../componenti/campo';
import { Pulsante } from '../componenti/pulsante';
import { Superficie } from '../componenti/superficie';
import { usaInstallazione } from '../installazione/contesto-installazione';
import { ErroreApi } from '../servizi/client-api';
import { registraCliente, rinviaVerificaEmail } from '../servizi/gestione';

const BOZZA_VUOTA = {
  nome: '',
  cognome: '',
  email: '',
  numeroWhatsapp: '',
  password: '',
};

/**
 * Registrazione autonoma del cliente. I consensi sono separati: il trattamento
 * dei dati è obbligatorio, i messaggi WhatsApp sono facoltativi e revocabili.
 */
export function PaginaRegistrazione() {
  const { stato } = usaInstallazione();
  const naviga = useNavigate();
  const [bozza, impostaBozza] = useState(BOZZA_VUOTA);
  const [consensoTrattamento, impostaConsensoTrattamento] = useState(false);
  const [consensoWhatsapp, impostaConsensoWhatsapp] = useState(false);
  const [errori, impostaErrori] = useState<Record<string, string>>({});
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inviata, impostaInviata] = useState<string | null>(null);
  const [inInvio, impostaInvio] = useState(false);

  function aggiorna(campo: keyof typeof BOZZA_VUOTA, valore: string) {
    impostaBozza((precedente) => ({ ...precedente, [campo]: valore }));
  }

  async function invia() {
    const validazione = schemaRegistrazioneCliente.safeParse({
      ...bozza,
      consensoTrattamento,
      consensoWhatsapp,
    });

    if (!validazione.success) {
      impostaErrori(
        Object.fromEntries(
          validazione.error.issues.map((problema) => [String(problema.path[0]), problema.message]),
        ),
      );

      return;
    }

    impostaErrori({});
    impostaErrore(null);
    impostaInvio(true);

    try {
      const esito = await registraCliente(validazione.data);

      impostaInviata(esito.email);
    } catch (problema) {
      impostaErrore(
        problema instanceof ErroreApi ? problema.message : 'Registrazione non riuscita.',
      );
    } finally {
      impostaInvio(false);
    }
  }

  if (inviata) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
        <Superficie className="w-full p-8" sollevata>
          <h1 className="text-xl font-semibold tracking-tight">Controlla la tua e-mail</h1>
          <p className="mt-3 text-sm text-testo-tenue">
            Abbiamo inviato un messaggio a <strong>{inviata}</strong> con il link per confermare
            l’indirizzo. Il link resta valido 48 ore: dopo la conferma potrai accedere e prenotare.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/accesso">
              <Pulsante>Vai all’accesso</Pulsante>
            </Link>
            <Pulsante
              variante="secondario"
              onClick={() => void rinviaVerificaEmail(inviata).catch(() => undefined)}
            >
              Invia di nuovo
            </Pulsante>
          </div>
        </Superficie>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Superficie className="p-8" sollevata>
          <p className="text-sm text-testo-tenue">{stato?.nomeSalone ?? 'Il tuo salone'}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Crea il tuo account</h1>
          <p className="mt-2 text-sm text-testo-tenue">
            Ti serve per prenotare online, spostare o annullare i tuoi appuntamenti.
          </p>

          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etichetta="Nome"
                value={bozza.nome}
                onChange={(evento) => aggiorna('nome', evento.target.value)}
                errore={errori.nome}
                autoComplete="given-name"
              />
              <Campo
                etichetta="Cognome"
                value={bozza.cognome}
                onChange={(evento) => aggiorna('cognome', evento.target.value)}
                errore={errori.cognome}
                autoComplete="family-name"
              />
            </div>

            <Campo
              etichetta="E-mail"
              type="email"
              value={bozza.email}
              onChange={(evento) => aggiorna('email', evento.target.value)}
              errore={errori.email}
              autoComplete="email"
            />

            <Campo
              etichetta="Numero WhatsApp"
              value={bozza.numeroWhatsapp}
              onChange={(evento) => aggiorna('numeroWhatsapp', evento.target.value)}
              errore={errori.numeroWhatsapp}
              suggerimento="Formato internazionale, es. +393401234567."
              inputMode="tel"
              autoComplete="tel"
            />

            <Campo
              etichetta="Password"
              type="password"
              value={bozza.password}
              onChange={(evento) => aggiorna('password', evento.target.value)}
              errore={errori.password}
              suggerimento="Almeno 12 caratteri."
              autoComplete="new-password"
            />

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Consensi</legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consensoTrattamento}
                  onChange={(evento) => impostaConsensoTrattamento(evento.target.checked)}
                  className="mt-0.5 accent-[var(--color-accento)]"
                />
                <span>
                  Acconsento al trattamento dei miei dati per la gestione degli appuntamenti.
                  <span className="block text-xs text-testo-tenue">Obbligatorio.</span>
                </span>
              </label>
              {errori.consensoTrattamento && (
                <p className="text-xs text-errore">{errori.consensoTrattamento}</p>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consensoWhatsapp}
                  onChange={(evento) => impostaConsensoWhatsapp(evento.target.checked)}
                  className="mt-0.5 accent-[var(--color-accento)]"
                />
                <span>
                  Acconsento a ricevere su WhatsApp conferme e promemoria degli appuntamenti.
                  <span className="block text-xs text-testo-tenue">
                    Facoltativo, revocabile in qualsiasi momento. Senza consenso i messaggi arrivano
                    per e-mail.
                  </span>
                </span>
              </label>
            </fieldset>

            {errore && <Avviso tono="errore">{errore}</Avviso>}

            <Pulsante className="w-full" onClick={() => void invia()} disabled={inInvio}>
              {inInvio ? 'Creazione…' : 'Crea l’account'}
            </Pulsante>

            <p className="text-center text-sm text-testo-tenue">
              Hai già un account?{' '}
              <button
                type="button"
                onClick={() => void naviga('/accesso')}
                className="font-medium text-testo underline"
              >
                Accedi
              </button>
            </p>
          </div>
        </Superficie>
      </motion.div>
    </main>
  );
}
