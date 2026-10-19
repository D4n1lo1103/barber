import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ETICHETTE_MOVIMENTO_CAPARRA,
  ETICHETTE_STATO,
  type Appuntamento,
  type Cliente,
  type SituazioneCaparre,
  type Vendita,
  type TipoMovimentoCaparra,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Caricamento } from '../../componenti/caricamento';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { usaSessione } from '../../autenticazione/contesto-sessione';
import {
  leggiSituazioneCaparre,
  leggiVendite,
  leggiStoricoCliente,
  leggiCliente,
  modificaCliente,
  rigeneraInvitoCliente,
} from '../../servizi/gestione';
import {
  formattaData,
  formattaDataBreve,
  formattaIntervallo,
  formattaPrezzo,
} from '../../utilita/formati';

/** Scheda cliente: contatti, note interne e storico degli appuntamenti. */
export function PaginaDettaglioCliente() {
  const { id } = useParams<{ id: string }>();
  const { utente } = usaSessione();
  // Movimenti e credito sono dati economici: li vede solo il titolare.
  const [situazione, impostaSituazione] = useState<SituazioneCaparre | null>(null);
  const [acquisti, impostaAcquisti] = useState<Vendita[]>([]);
  const [cliente, impostaCliente] = useState<Cliente | null>(null);
  const [appuntamenti, impostaAppuntamenti] = useState<Appuntamento[]>([]);
  const [note, impostaNote] = useState('');
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [errore, impostaErrore] = useState<string | null>(null);
  const [esito, impostaEsito] = useState<string | null>(null);
  const [collegamento, impostaCollegamento] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    let annullato = false;

    Promise.all([
      leggiCliente(id),
      leggiStoricoCliente(id),
      utente?.ruolo === 'titolare' ? leggiSituazioneCaparre(id) : Promise.resolve(null),
      leggiVendite({ clienteId: id }),
    ])
      .then(([scheda, storico, caparre, vendite]) => {
        if (!annullato) {
          impostaCliente(scheda);
          impostaNote(scheda.note);
          impostaAppuntamenti(storico.appuntamenti);
          impostaSituazione(caparre);
          impostaAcquisti(vendite.vendite);
        }
      })
      .catch((motivo: unknown) => {
        if (!annullato) {
          impostaErrore(motivo instanceof Error ? motivo.message : 'Scheda non disponibile.');
        }
      })
      .finally(() => {
        if (!annullato) {
          impostaCaricamento(false);
        }
      });

    return () => {
      annullato = true;
    };
  }, [id]);

  async function salvaNote() {
    if (!cliente) {
      return;
    }

    impostaEsito(null);
    impostaErrore(null);

    try {
      impostaCliente(await modificaCliente(cliente.id, { note }));
      impostaEsito('Note salvate.');
    } catch (motivo) {
      impostaErrore(motivo instanceof Error ? motivo.message : 'Note non salvate.');
    }
  }

  async function nuovoInvito() {
    if (!cliente) {
      return;
    }

    impostaErrore(null);

    try {
      const invito = await rigeneraInvitoCliente(cliente.id);

      impostaCollegamento(
        `${window.location.origin}/attivazione?token=${encodeURIComponent(invito.token)}`,
      );
    } catch (motivo) {
      impostaErrore(motivo instanceof Error ? motivo.message : 'Invito non generato.');
    }
  }

  if (inCaricamento) {
    return <Caricamento messaggio="Caricamento della scheda" />;
  }

  if (!cliente) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Avviso tono="errore">{errore ?? 'Scheda non trovata.'}</Avviso>
        <div className="mt-4">
          <Link to="/clienti">
            <Pulsante variante="secondario">Torna ai clienti</Pulsante>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-testo-tenue">Scheda cliente</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {cliente.nome} {cliente.cognome}
          </h1>
        </div>
        <Link to="/clienti">
          <Pulsante variante="secondario">Torna ai clienti</Pulsante>
        </Link>
      </div>

      <Superficie className="mt-6 p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-testo-tenue">Numero WhatsApp</dt>
            <dd className="font-medium">{cliente.numeroWhatsapp ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-testo-tenue">E-mail</dt>
            <dd className="font-medium">{cliente.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-testo-tenue">Account</dt>
            <dd className="font-medium">
              {cliente.accountAttivato ? 'Attivato dal cliente' : 'Da attivare'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-testo-tenue">Scheda creata il</dt>
            <dd className="font-medium">{formattaDataBreve(cliente.creatoIl)}</dd>
          </div>
        </dl>

        {!cliente.accountAttivato && (
          <div className="mt-4 space-y-3">
            <Pulsante variante="secondario" onClick={() => void nuovoInvito()}>
              Genera un nuovo link di attivazione
            </Pulsante>
            {collegamento && (
              <>
                <p className="break-all rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2 text-xs">
                  {collegamento}
                </p>
                <Pulsante
                  variante="discreto"
                  onClick={() => void navigator.clipboard?.writeText(collegamento)}
                >
                  Copia il link
                </Pulsante>
              </>
            )}
          </div>
        )}
      </Superficie>

      <Superficie className="mt-4 p-5">
        <label htmlFor="note-scheda" className="block text-sm font-medium">
          Note interne
        </label>
        <textarea
          id="note-scheda"
          value={note}
          onChange={(evento) => impostaNote(evento.target.value)}
          rows={3}
          maxLength={500}
          className="mt-2 w-full rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-3 py-2.5 text-sm focus:border-accento focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Pulsante onClick={() => void salvaNote()} disabled={note === cliente.note}>
            Salva note
          </Pulsante>
          {esito && <Avviso tono="conferma">{esito}</Avviso>}
        </div>
      </Superficie>

      {errore && (
        <div className="mt-4">
          <Avviso tono="errore">{errore}</Avviso>
        </div>
      )}

      {situazione && (
        <>
          <h2 className="mt-8 text-lg font-semibold tracking-tight">Caparre e credito</h2>
          <Superficie className="mt-3 p-5">
            <p className="text-sm">
              Credito disponibile:{' '}
              <strong>{formattaPrezzo(situazione.saldoCreditoCentesimi)}</strong>
              <span className="block text-xs text-testo-tenue">Il credito non ha scadenza.</span>
            </p>

            {situazione.movimentiCaparra.length === 0 ? (
              <p className="mt-4 text-sm text-testo-tenue">Nessun movimento di caparra.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {situazione.movimentiCaparra.map((movimento) => (
                  <li
                    key={movimento.id}
                    className="border-t border-bordo pt-2 text-sm first:border-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {ETICHETTE_MOVIMENTO_CAPARRA[movimento.tipo as TipoMovimentoCaparra]} ·{' '}
                        {formattaPrezzo(movimento.importoCentesimi)}
                      </span>
                      <span className="text-xs text-testo-tenue">
                        {formattaData(movimento.creatoIl)}
                      </span>
                    </div>
                    <p className="text-xs text-testo-tenue">
                      {movimento.motivo}
                      {movimento.autore
                        ? ` — ${movimento.autore.nome} ${movimento.autore.cognome}`
                        : ' — registrato dal sistema'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Superficie>
        </>
      )}

      {acquisti.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold tracking-tight">Acquisti in negozio</h2>
          <ul className="mt-3 space-y-2">
            {acquisti.map((vendita) => (
              <li
                key={vendita.id}
                className="rounded-[var(--radius-campo)] border border-bordo bg-superficie px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {formattaPrezzo(vendita.totaleCentesimi)}
                    {vendita.annullataIl && (
                      <span className="ml-2 text-xs text-testo-tenue">(annullata)</span>
                    )}
                  </span>
                  <span className="text-xs text-testo-tenue">
                    {formattaDataBreve(vendita.creataIl)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-testo-tenue">
                  {vendita.righe.map((riga) => `${riga.quantita} × ${riga.nome}`).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Storico appuntamenti</h2>
      {appuntamenti.length === 0 ? (
        <p className="mt-2 text-sm text-testo-tenue">Nessun appuntamento registrato.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {appuntamenti.map((appuntamento) => (
            <li
              key={appuntamento.id}
              className="rounded-[var(--radius-campo)] border border-bordo bg-superficie px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {formattaDataBreve(appuntamento.inizio)} ·{' '}
                  {formattaIntervallo(appuntamento.inizio, appuntamento.fine)}
                </span>
                <span className="text-xs text-testo-tenue">
                  {ETICHETTE_STATO[appuntamento.stato]}
                </span>
              </div>
              <p className="mt-1 text-xs text-testo-tenue">
                {appuntamento.servizi.map((servizio) => servizio.nome).join(' + ')} ·{' '}
                {appuntamento.operatore.nome} {appuntamento.operatore.cognome} ·{' '}
                {formattaPrezzo(appuntamento.prezzoTotaleCentesimi)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
