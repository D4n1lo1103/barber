import { useState } from 'react';
import { Link } from 'react-router';
import { schemaEmail } from '@barber/shared';
import { Avviso } from '../componenti/avviso';
import { Campo } from '../componenti/campo';
import { Pulsante } from '../componenti/pulsante';
import { Superficie } from '../componenti/superficie';
import { ErroreApi } from '../servizi/client-api';
import { richiediResetPassword } from '../servizi/gestione';

/**
 * Richiesta di reimpostazione. La risposta è sempre la stessa, anche se
 * l'indirizzo non è registrato: non si rivela chi ha un account.
 */
export function PaginaPasswordDimenticata() {
  const [email, impostaEmail] = useState('');
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inviata, impostaInviata] = useState(false);
  const [inInvio, impostaInvio] = useState(false);

  async function invia() {
    const validazione = schemaEmail.safeParse(email);

    if (!validazione.success) {
      impostaErrore(validazione.error.issues[0]?.message ?? 'Indirizzo non valido.');

      return;
    }

    impostaErrore(null);
    impostaInvio(true);

    try {
      await richiediResetPassword(validazione.data);
      impostaInviata(true);
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Richiesta non riuscita.');
    } finally {
      impostaInvio(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <Superficie className="w-full p-8" sollevata>
        <h1 className="text-xl font-semibold tracking-tight">Password dimenticata</h1>

        {inviata ? (
          <>
            <p className="mt-3 text-sm text-testo-tenue">
              Se l’indirizzo è registrato, riceverai un messaggio con il link per scegliere una
              nuova password. Il link resta valido due ore.
            </p>
            <Link to="/accesso" className="mt-6 inline-block">
              <Pulsante>Torna all’accesso</Pulsante>
            </Link>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <Campo
              etichetta="E-mail"
              type="email"
              value={email}
              onChange={(evento) => impostaEmail(evento.target.value)}
              autoComplete="email"
            />

            {errore && <Avviso tono="errore">{errore}</Avviso>}

            <Pulsante className="w-full" onClick={() => void invia()} disabled={inInvio}>
              {inInvio ? 'Invio…' : 'Invia il link'}
            </Pulsante>

            <Link to="/accesso" className="block text-center text-sm text-testo-tenue underline">
              Torna all’accesso
            </Link>
          </div>
        )}
      </Superficie>
    </main>
  );
}
