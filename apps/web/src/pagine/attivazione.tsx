import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { schemaEmail, schemaPassword } from '@barber/shared';
import { Avviso } from '../componenti/avviso';
import { Campo } from '../componenti/campo';
import { Pulsante } from '../componenti/pulsante';
import { Superficie } from '../componenti/superficie';
import { ErroreApi } from '../servizi/client-api';
import { attivaAccount } from '../servizi/gestione';

/** Attivazione dell'account del personale tramite il link ricevuto dal titolare. */
export function PaginaAttivazione() {
  const [parametri] = useSearchParams();
  const naviga = useNavigate();
  const token = parametri.get('token') ?? '';
  const [password, impostaPassword] = useState('');
  const [conferma, impostaConferma] = useState('');
  const [email, impostaEmail] = useState('');
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inInvio, impostaInInvio] = useState(false);
  const [completata, impostaCompletata] = useState(false);

  async function invia(evento: React.FormEvent) {
    evento.preventDefault();
    impostaErrore(null);

    const validazione = schemaPassword.safeParse(password);

    if (!validazione.success) {
      impostaErrore(validazione.error.issues[0]?.message ?? 'Password non valida.');

      return;
    }

    if (password !== conferma) {
      impostaErrore('Le due password non coincidono.');

      return;
    }

    const indirizzo = email.trim();

    if (indirizzo !== '') {
      const validazioneEmail = schemaEmail.safeParse(indirizzo);

      if (!validazioneEmail.success) {
        impostaErrore(validazioneEmail.error.issues[0]?.message ?? 'Indirizzo non valido.');

        return;
      }
    }

    impostaInInvio(true);

    try {
      await attivaAccount(token, password, indirizzo === '' ? undefined : indirizzo);
      impostaCompletata(true);
      setTimeout(() => void naviga('/accesso'), 1500);
    } catch (problema) {
      impostaErrore(
        problema instanceof ErroreApi ? problema.message : 'Attivazione non riuscita. Riprova.',
      );
    } finally {
      impostaInInvio(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <Superficie className="p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Attiva il tuo account</h1>
          <p className="mt-1 text-sm text-testo-tenue">
            Scegli la password che userai per accedere: il salone non la conosce.
          </p>

          {token.length === 0 ? (
            <div className="mt-6">
              <Avviso tono="errore">
                Link di attivazione incompleto. Chiedi al titolare di generarne uno nuovo.
              </Avviso>
            </div>
          ) : completata ? (
            <div className="mt-6">
              <Avviso tono="conferma">Account attivato. Ti porto alla pagina di accesso…</Avviso>
            </div>
          ) : (
            <form onSubmit={invia} className="mt-8 space-y-5" noValidate>
              <Campo
                etichetta="E-mail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(evento) => impostaEmail(evento.target.value)}
                suggerimento="Indicala se il salone non l’ha già registrata: ti servirà per accedere e per recuperare la password."
              />

              <Campo
                etichetta="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(evento) => impostaPassword(evento.target.value)}
                suggerimento="Almeno 12 caratteri."
                required
              />
              <Campo
                etichetta="Conferma la password"
                type="password"
                autoComplete="new-password"
                value={conferma}
                onChange={(evento) => impostaConferma(evento.target.value)}
                required
              />

              {errore && <Avviso tono="errore">{errore}</Avviso>}

              <Pulsante type="submit" className="w-full" disabled={inInvio}>
                {inInvio ? 'Attivazione…' : 'Attiva account'}
              </Pulsante>
            </form>
          )}
        </Superficie>
      </motion.div>
    </main>
  );
}
