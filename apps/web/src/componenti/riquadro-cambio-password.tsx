import { useState } from 'react';
import { useNavigate } from 'react-router';
import { schemaCambioPassword } from '@barber/shared';
import { usaSessione } from '../autenticazione/contesto-sessione';
import { Avviso } from './avviso';
import { Campo } from './campo';
import { Pulsante } from './pulsante';
import { Superficie } from './superficie';
import { ErroreApi } from '../servizi/client-api';
import { cambiaPassword } from '../servizi/gestione';

/**
 * Cambio della propria password, uguale per il personale e per i clienti. Il
 * backend revoca tutte le sessioni al cambio e cancella i cookie: qui basta
 * dimenticare l'utente, senza chiamare l'uscita, che a quel punto
 * risponderebbe 401 e farebbe sembrare fallito un cambio riuscito.
 */
export function RiquadroCambioPassword() {
  const { scollega } = usaSessione();
  const vaiA = useNavigate();
  const [attuale, impostaAttuale] = useState('');
  const [nuova, impostaNuova] = useState('');
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inCorso, impostaInCorso] = useState(false);

  async function salva() {
    const validazione = schemaCambioPassword.safeParse({
      passwordAttuale: attuale,
      passwordNuova: nuova,
    });

    if (!validazione.success) {
      impostaErrore(validazione.error.issues[0]?.message ?? 'Password non valida.');

      return;
    }

    impostaInCorso(true);
    impostaErrore(null);

    try {
      await cambiaPassword(validazione.data);
      impostaAttuale('');
      impostaNuova('');
      // Prima si dimentica l'utente, poi si va all'accesso: invertendo,
      // la pagina di accesso rimbalzerebbe indietro, vedendo una sessione
      // che per il backend non esiste più.
      scollega();
      vaiA('/accesso', {
        replace: true,
        state: {
          avviso:
            'Password cambiata. Per sicurezza tutti gli accessi sono stati chiusi: entra di nuovo con la password nuova.',
        },
      });
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Password non cambiata.');
    } finally {
      impostaInCorso(false);
    }
  }

  return (
    <Superficie className="p-6">
      <h2 className="text-lg font-semibold">Cambia la password</h2>
      <p className="mt-1 text-sm text-testo-tenue">
        Serve la password attuale. Al cambio vieni disconnesso da tutti i dispositivi.
      </p>

      {errore && (
        <div className="mt-4">
          <Avviso tono="errore">{errore}</Avviso>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo
          etichetta="Password attuale"
          type="password"
          autoComplete="current-password"
          value={attuale}
          onChange={(evento) => impostaAttuale(evento.target.value)}
        />
        <Campo
          etichetta="Nuova password"
          type="password"
          autoComplete="new-password"
          value={nuova}
          onChange={(evento) => impostaNuova(evento.target.value)}
        />
      </div>

      <Pulsante className="mt-4" onClick={() => void salva()} disabled={inCorso}>
        {inCorso ? 'Salvataggio…' : 'Cambia password'}
      </Pulsante>
    </Superficie>
  );
}
