import { useEffect, useState } from 'react';
import { schemaCreazioneChiusura, type Chiusura } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import { creaChiusura, leggiChiusure, rimuoviChiusura } from '../../servizi/gestione';
import { formattaData } from '../../utilita/formati';

const BOZZA_VUOTA = { dal: '', al: '', motivo: '' };

/**
 * L'ultimo giorno di chiusura: l'intervallo salvato esclude la fine, che è la
 * mezzanotte del giorno successivo.
 */
function ultimoGiorno(fine: string): Date {
  return new Date(new Date(fine).getTime() - 60_000);
}

/**
 * Chiusure straordinarie del salone (festività, chiusura per ferie
 * dell'intera attività): un solo flusso rende occupati tutti gli operatori.
 * I giorni di chiusura abituali, invece, sono i giorni senza fasce di apertura.
 */
export function ChiusureSalone() {
  const [chiusure, impostaChiusure] = useState<Chiusura[]>([]);
  const [bozza, impostaBozza] = useState(BOZZA_VUOTA);
  const [errori, impostaErrori] = useState<Record<string, string>>({});
  const [messaggio, impostaMessaggio] = useState<{
    tono: 'errore' | 'conferma';
    testo: string;
  } | null>(null);
  const [inCorso, impostaInCorso] = useState(false);

  useEffect(() => {
    leggiChiusure()
      .then((elenco) => impostaChiusure(elenco.chiusure))
      .catch(() => impostaChiusure([]));
  }, []);

  async function aggiungi() {
    const validazione = schemaCreazioneChiusura.safeParse(bozza);

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
      const creata = await creaChiusura(validazione.data);

      impostaChiusure((precedenti) =>
        [...precedenti, creata].sort((primo, secondo) =>
          primo.inizio.localeCompare(secondo.inizio),
        ),
      );
      impostaBozza(BOZZA_VUOTA);
      impostaMessaggio({
        tono: 'conferma',
        testo: `Chiusura registrata per ${creata.operatoriCoinvolti} operatori.`,
      });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Chiusura non registrata.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  async function rimuovi(chiusura: Chiusura) {
    impostaMessaggio(null);
    impostaInCorso(true);

    try {
      await rimuoviChiusura({ inizio: chiusura.inizio, fine: chiusura.fine });
      impostaChiusure((precedenti) =>
        precedenti.filter((voce) => voce.inizio !== chiusura.inizio || voce.fine !== chiusura.fine),
      );
      impostaMessaggio({
        tono: 'conferma',
        testo: 'Chiusura rimossa: il salone è di nuovo aperto.',
      });
    } catch (problema) {
      impostaMessaggio({
        tono: 'errore',
        testo: problema instanceof ErroreApi ? problema.message : 'Chiusura non rimossa.',
      });
    } finally {
      impostaInCorso(false);
    }
  }

  return (
    <Superficie className="p-6">
      <h2 className="text-lg font-semibold">Chiusure del salone</h2>
      <p className="mt-1 text-sm text-testo-tenue">
        Per le festività e le chiusure dell’intera attività: tutti gli operatori risultano occupati
        e nessuno può essere prenotato. I giorni di chiusura abituali si impostano lasciando il
        giorno senza fasce di apertura, qui sopra.
      </p>

      {messaggio && (
        <div className="mt-4">
          <Avviso tono={messaggio.tono}>{messaggio.testo}</Avviso>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Campo
          etichetta="Dal"
          type="date"
          value={bozza.dal}
          onChange={(evento) => impostaBozza({ ...bozza, dal: evento.target.value })}
          errore={errori.dal}
        />
        <Campo
          etichetta="Al (compreso)"
          type="date"
          value={bozza.al}
          onChange={(evento) => impostaBozza({ ...bozza, al: evento.target.value })}
          errore={errori.al}
        />
        <Campo
          etichetta="Motivo"
          value={bozza.motivo}
          onChange={(evento) => impostaBozza({ ...bozza, motivo: evento.target.value })}
          errore={errori.motivo}
          placeholder="es. Natale"
        />
      </div>

      <Pulsante className="mt-4" onClick={() => void aggiungi()} disabled={inCorso}>
        {inCorso ? 'Salvataggio…' : 'Registra chiusura'}
      </Pulsante>

      {chiusure.length === 0 ? (
        <p className="mt-6 text-sm text-testo-tenue">Nessuna chiusura registrata.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {chiusure.map((chiusura) => (
            <li
              key={`${chiusura.inizio}-${chiusura.fine}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-campo)] border border-bordo px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{chiusura.motivo}</span>
                <span className="block text-xs text-testo-tenue">
                  {formattaData(chiusura.inizio)} – {formattaData(ultimoGiorno(chiusura.fine))} ·{' '}
                  {chiusura.operatoriCoinvolti} operatori
                </span>
              </span>
              <Pulsante
                variante="discreto"
                disabled={inCorso}
                onClick={() => void rimuovi(chiusura)}
                aria-label={`Rimuovi la chiusura «${chiusura.motivo}»`}
              >
                Rimuovi
              </Pulsante>
            </li>
          ))}
        </ul>
      )}
    </Superficie>
  );
}
