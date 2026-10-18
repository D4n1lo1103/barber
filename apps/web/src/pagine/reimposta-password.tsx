import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { schemaPassword } from '@barber/shared';
import { Avviso } from '../componenti/avviso';
import { Campo } from '../componenti/campo';
import { Pulsante } from '../componenti/pulsante';
import { Superficie } from '../componenti/superficie';
import { ErroreApi } from '../servizi/client-api';
import { confermaResetPassword } from '../servizi/gestione';

/** Scelta della nuova password dal link ricevuto per e-mail. */
export function PaginaReimpostaPassword() {
  const [parametri] = useSearchParams();
  const token = parametri.get('token') ?? '';
  const [password, impostaPassword] = useState('');
  const [errore, impostaErrore] = useState<string | null>(null);
  const [fatto, impostaFatto] = useState(false);
  const [inInvio, impostaInvio] = useState(false);

  async function invia() {
    const validazione = schemaPassword.safeParse(password);

    if (!validazione.success) {
      impostaErrore(validazione.error.issues[0]?.message ?? 'Password non valida.');

      return;
    }

    impostaErrore(null);
    impostaInvio(true);

    try {
      await confermaResetPassword(token, validazione.data);
      impostaFatto(true);
    } catch (problema) {
      impostaErrore(
        problema instanceof ErroreApi ? problema.message : 'Reimpostazione non riuscita.',
      );
    } finally {
      impostaInvio(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <Superficie className="w-full p-8" sollevata>
        <h1 className="text-xl font-semibold tracking-tight">Scegli una nuova password</h1>

        {fatto ? (
          <>
            <div className="mt-4">
              <Avviso tono="conferma">
                Password aggiornata. Gli altri dispositivi sono stati disconnessi.
              </Avviso>
            </div>
            <Link to="/accesso" className="mt-6 inline-block">
              <Pulsante>Accedi</Pulsante>
            </Link>
          </>
        ) : !token ? (
          <div className="mt-4">
            <Avviso tono="errore">Link non valido: manca il codice di reimpostazione.</Avviso>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <Campo
              etichetta="Nuova password"
              type="password"
              value={password}
              onChange={(evento) => impostaPassword(evento.target.value)}
              suggerimento="Almeno 12 caratteri."
              autoComplete="new-password"
            />

            {errore && <Avviso tono="errore">{errore}</Avviso>}

            <Pulsante className="w-full" onClick={() => void invia()} disabled={inInvio}>
              {inInvio ? 'Salvataggio…' : 'Salva la password'}
            </Pulsante>
          </div>
        )}
      </Superficie>
    </main>
  );
}
