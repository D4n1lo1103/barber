import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Avviso } from '../componenti/avviso';
import { Pulsante } from '../componenti/pulsante';
import { Superficie } from '../componenti/superficie';
import { ErroreApi } from '../servizi/client-api';
import { comunicaEsitoFinto } from '../servizi/gestione';
import { formattaPrezzo } from '../utilita/formati';

/**
 * Pagina di pagamento finta: esiste solo quando l'installazione non ha le
 * chiavi di Stripe, in sviluppo e nei test. Non muove denaro, serve a scegliere
 * l'esito e verificare il flusso. Con Stripe configurato l'API rifiuta questi
 * esiti, quindi la pagina non ha alcun effetto.
 */
export function PaginaPagamentoFinto() {
  const [parametri] = useSearchParams();
  const naviga = useNavigate();
  const riferimento = parametri.get('riferimento') ?? '';
  const importo = Number(parametri.get('importo') ?? 0);
  const ritorno = parametri.get('ritorno') ?? '/area-cliente';
  const [errore, impostaErrore] = useState<string | null>(null);
  const [inCorso, impostaInCorso] = useState(false);

  async function scegli(esito: 'riuscito' | 'fallito') {
    impostaInCorso(true);
    impostaErrore(null);

    try {
      await comunicaEsitoFinto({ riferimento, esito });
      const indirizzo = new URL(ritorno, window.location.origin);

      await naviga(`${indirizzo.pathname}${indirizzo.search}`);
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Esito non registrato.');
    } finally {
      impostaInCorso(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full"
      >
        <Superficie className="p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Pagamento di prova</h1>
          <p className="mt-1 text-sm text-testo-tenue">
            Questa installazione non ha le chiavi del fornitore di pagamenti: nessun denaro viene
            movimentato. Scegli come deve andare il pagamento.
          </p>

          <p className="mt-6 text-sm">
            Importo: <strong>{formattaPrezzo(importo)}</strong>
          </p>

          {errore && (
            <div className="mt-4">
              <Avviso tono="errore">{errore}</Avviso>
            </div>
          )}

          {riferimento === '' ? (
            <div className="mt-6">
              <Avviso tono="errore">
                Indirizzo incompleto: manca il riferimento del pagamento.
              </Avviso>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              <Pulsante disabled={inCorso} onClick={() => void scegli('riuscito')}>
                Pagamento riuscito
              </Pulsante>
              <Pulsante
                variante="secondario"
                disabled={inCorso}
                onClick={() => void scegli('fallito')}
              >
                Pagamento rifiutato
              </Pulsante>
            </div>
          )}
        </Superficie>
      </motion.div>
    </main>
  );
}
