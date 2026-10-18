import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Avviso } from '../componenti/avviso';
import { Pulsante } from '../componenti/pulsante';
import { Superficie } from '../componenti/superficie';
import { ErroreApi } from '../servizi/client-api';
import { verificaEmail } from '../servizi/gestione';

/** Conferma dell'indirizzo e-mail dal link ricevuto per posta. */
export function PaginaVerificaEmail() {
  const [parametri] = useSearchParams();
  const token = parametri.get('token') ?? '';
  const [stato, impostaStato] = useState<'attesa' | 'confermata' | 'errore'>('attesa');
  const [errore, impostaErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      impostaStato('errore');
      impostaErrore('Link non valido: manca il codice di verifica.');

      return;
    }

    verificaEmail(token)
      .then(() => impostaStato('confermata'))
      .catch((problema: unknown) => {
        impostaStato('errore');
        impostaErrore(problema instanceof ErroreApi ? problema.message : 'Verifica non riuscita.');
      });
  }, [token]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <Superficie className="w-full p-8" sollevata>
        <h1 className="text-xl font-semibold tracking-tight">Verifica dell’indirizzo</h1>

        {stato === 'attesa' && (
          <p className="mt-3 text-sm text-testo-tenue" role="status">
            Verifica in corso…
          </p>
        )}

        {stato === 'confermata' && (
          <>
            <div className="mt-4">
              <Avviso tono="conferma">
                Indirizzo confermato: ora puoi accedere e prenotare online.
              </Avviso>
            </div>
            <Link to="/accesso" className="mt-6 inline-block">
              <Pulsante>Accedi</Pulsante>
            </Link>
          </>
        )}

        {stato === 'errore' && (
          <>
            <div className="mt-4">
              <Avviso tono="errore">{errore}</Avviso>
            </div>
            <p className="mt-4 text-sm text-testo-tenue">
              Il link potrebbe essere scaduto o già usato. Puoi chiederne un altro dalla pagina di
              accesso.
            </p>
            <Link to="/accesso" className="mt-6 inline-block">
              <Pulsante variante="secondario">Vai all’accesso</Pulsante>
            </Link>
          </>
        )}
      </Superficie>
    </main>
  );
}
