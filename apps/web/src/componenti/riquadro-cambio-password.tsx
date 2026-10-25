import { useState } from 'react';
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
 * backend revoca tutte le sessioni al cambio, quindi dopo il salvataggio si
 * torna alla pagina di accesso: l'avviso lo dice prima di partire.
 */
export function RiquadroCambioPassword() {
  const { esci } = usaSessione();
  const [attuale, impostaAttuale] = useState('');
  const [nuova, impostaNuova] = useState('');
  const [messaggio, impostaMessaggio] = useState<{
    tono: 'errore' | 'conferma';
    testo: string;
  } | null>(null);
  const [inCorso, impostaInCorso] = useState(false);

  async function salva() {
    const validazione = schemaCambioPassword.safeParse({
      passwordAttuale: attuale,
      passwordNuova: nuova,
    });

    if (!validazione.success) {
      impostaMessaggio({
        tono: 'errore',
        testo: validazione.error.issues[0]?.message ?? 'Password non valida.',
      });

      return;
    }

    impostaInCorso(true);
    impostaMessaggio(null);

    try {
      await cambiaPassword(validazione.data);
      impostaAttuale('');
      impostaNuova('');
      impostaMessaggio({
        tono: 'conferma',
        testo:
          'Password cambiata. Per sicurezza tutti gli accessi sono stati chiusi: entra di nuovo con la password nuova.',
      });
      await esci();
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Password non cambiata.',
      });
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

      {messaggio && (
        <div className="mt-4">
          <Avviso tono={messaggio.tono}>{messaggio.testo}</Avviso>
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
