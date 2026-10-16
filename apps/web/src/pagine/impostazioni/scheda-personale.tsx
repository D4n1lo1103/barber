import { useEffect, useState } from 'react';
import type { Operatore } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import {
  creaDipendente,
  disattivaOperatore,
  leggiPersonale,
  riattivaOperatore,
  rigeneraInvito,
} from '../../servizi/gestione';
import { formattaData } from '../../utilita/formati';

interface InvitoMostrato {
  nomeCompleto: string;
  collegamento: string;
  scadeIl: string;
}

export function SchedaPersonale() {
  const [personale, impostaPersonale] = useState<Operatore[]>([]);
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inCaricamento, impostaInCaricamento] = useState(true);
  const [invito, impostaInvito] = useState<InvitoMostrato | null>(null);

  const [nome, impostaNome] = useState('');
  const [cognome, impostaCognome] = useState('');
  const [email, impostaEmail] = useState('');
  const [inInvio, impostaInInvio] = useState(false);

  async function ricarica() {
    try {
      const elenco = await leggiPersonale();
      impostaPersonale(elenco.personale);
      impostaErrore(null);
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Caricamento non riuscito.');
    } finally {
      impostaInCaricamento(false);
    }
  }

  useEffect(() => {
    void ricarica();
  }, []);

  function componiCollegamento(token: string): string {
    return `${window.location.origin}/attivazione?token=${encodeURIComponent(token)}`;
  }

  async function aggiungi(evento: React.FormEvent) {
    evento.preventDefault();
    impostaErrore(null);
    impostaInInvio(true);

    try {
      const esito = await creaDipendente({ nome, cognome, email });
      impostaInvito({
        nomeCompleto: `${esito.operatore.nome} ${esito.operatore.cognome}`,
        collegamento: componiCollegamento(esito.token),
        scadeIl: esito.scadeIl,
      });
      impostaNome('');
      impostaCognome('');
      impostaEmail('');
      await ricarica();
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Operazione non riuscita.');
    } finally {
      impostaInInvio(false);
    }
  }

  async function cambiaStato(operatore: Operatore) {
    impostaErrore(null);

    try {
      if (operatore.attivo) {
        await disattivaOperatore(operatore.id);
      } else {
        await riattivaOperatore(operatore.id);
      }
      await ricarica();
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Operazione non riuscita.');
    }
  }

  async function nuovoInvito(operatore: Operatore) {
    impostaErrore(null);

    try {
      const esito = await rigeneraInvito(operatore.id);
      impostaInvito({
        nomeCompleto: `${operatore.nome} ${operatore.cognome}`,
        collegamento: componiCollegamento(esito.token),
        scadeIl: esito.scadeIl,
      });
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Operazione non riuscita.');
    }
  }

  if (inCaricamento) {
    return <p className="text-sm text-testo-tenue">Caricamento del personale…</p>;
  }

  return (
    <div className="space-y-6">
      {errore && <Avviso tono="errore">{errore}</Avviso>}

      {invito && (
        <Superficie className="p-6">
          <h2 className="text-lg font-semibold">Link di attivazione per {invito.nomeCompleto}</h2>
          <p className="mt-2 text-sm text-testo-tenue">
            Consegnalo alla persona interessata: sceglierà la password da sola. Il link è valido
            fino al {formattaData(invito.scadeIl)} e viene mostrato una sola volta.
          </p>
          <p className="mt-3 rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato p-3 text-xs break-all">
            {invito.collegamento}
          </p>
          <div className="mt-4 flex gap-3">
            <Pulsante
              variante="secondario"
              onClick={() => void navigator.clipboard?.writeText(invito.collegamento)}
            >
              Copia il link
            </Pulsante>
            <Pulsante variante="discreto" onClick={() => impostaInvito(null)}>
              Ho finito
            </Pulsante>
          </div>
        </Superficie>
      )}

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Personale ({personale.length})</h2>
        <ul className="mt-4 space-y-3">
          {personale.map((operatore) => (
            <li
              key={operatore.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-campo)] border border-bordo p-3"
            >
              <div>
                <p className="text-sm font-semibold">
                  {operatore.nome} {operatore.cognome}
                </p>
                <p className="text-xs text-testo-tenue">
                  {operatore.ruolo === 'titolare' ? 'Titolare' : 'Dipendente'} · {operatore.email}
                  {!operatore.attivo && ' · disattivato'}
                  {!operatore.accountAttivato && ' · account da attivare'}
                </p>
              </div>
              <div className="flex gap-2">
                {!operatore.accountAttivato && operatore.ruolo === 'dipendente' && (
                  <Pulsante variante="secondario" onClick={() => void nuovoInvito(operatore)}>
                    Nuovo link
                  </Pulsante>
                )}
                {operatore.ruolo === 'dipendente' && (
                  <Pulsante variante="secondario" onClick={() => void cambiaStato(operatore)}>
                    {operatore.attivo ? 'Disattiva' : 'Riattiva'}
                  </Pulsante>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Nuovo dipendente</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          Non imposti tu la password: il sistema genera un link con cui la persona attiva il proprio
          account.
        </p>
        <form onSubmit={aggiungi} className="mt-4 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etichetta="Nome"
              value={nome}
              onChange={(evento) => impostaNome(evento.target.value)}
              required
            />
            <Campo
              etichetta="Cognome"
              value={cognome}
              onChange={(evento) => impostaCognome(evento.target.value)}
              required
            />
          </div>
          <Campo
            etichetta="E-mail"
            type="email"
            value={email}
            onChange={(evento) => impostaEmail(evento.target.value)}
            required
          />
          <Pulsante type="submit" disabled={inInvio}>
            {inInvio ? 'Creazione…' : 'Crea account'}
          </Pulsante>
        </form>
      </Superficie>
    </div>
  );
}
