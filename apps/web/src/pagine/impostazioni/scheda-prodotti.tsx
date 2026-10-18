import { useEffect, useState } from 'react';
import {
  ETICHETTE_CAUSA_MOVIMENTO,
  schemaMovimentoGiacenza,
  type MovimentoMagazzino,
  type Prodotto,
} from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import {
  creaProdotto,
  disattivaProdotto,
  leggiMovimentiProdotto,
  leggiProdotti,
  modificaProdotto,
  registraMovimentoGiacenza,
} from '../../servizi/gestione';
import { centesimiDaPrezzo, formattaData, formattaPrezzo } from '../../utilita/formati';

/**
 * Catalogo prodotti e giacenze di magazzino, riservati al titolare.
 *
 * La giacenza non si scrive a mano in un campo: si corregge con un movimento
 * motivato, così resta sempre la traccia di chi l'ha cambiata e perché.
 */
export function SchedaProdotti() {
  const [prodotti, impostaProdotti] = useState<Prodotto[]>([]);
  const [errore, impostaErrore] = useState<string | null>(null);
  const [esito, impostaEsito] = useState<string | null>(null);
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [inInvio, impostaInvio] = useState(false);

  const [nome, impostaNome] = useState('');
  const [descrizione, impostaDescrizione] = useState('');
  const [prezzo, impostaPrezzo] = useState('');
  const [giacenza, impostaGiacenza] = useState('0');
  const [scorta, impostaScorta] = useState('0');

  const [inMovimento, impostaInMovimento] = useState<Prodotto | null>(null);
  const [quantita, impostaQuantita] = useState('');
  const [causa, impostaCausa] = useState<'carico' | 'correzione'>('carico');
  const [motivo, impostaMotivo] = useState('');
  const [movimenti, impostaMovimenti] = useState<MovimentoMagazzino[]>([]);

  async function ricarica() {
    try {
      impostaProdotti(await leggiProdotti());
      impostaErrore(null);
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Caricamento non riuscito.');
    } finally {
      impostaCaricamento(false);
    }
  }

  useEffect(() => {
    void ricarica();
  }, []);

  async function aggiungi(evento: React.FormEvent) {
    evento.preventDefault();
    impostaErrore(null);
    impostaEsito(null);

    const prezzoCentesimi = centesimiDaPrezzo(prezzo);

    if (prezzoCentesimi === null) {
      impostaErrore('Indica un prezzo valido, ad esempio 18,00.');

      return;
    }

    impostaInvio(true);

    try {
      await creaProdotto({
        nome,
        descrizione,
        prezzoCentesimi,
        giacenza: Number(giacenza) || 0,
        scortaMinima: Number(scorta) || 0,
      });
      impostaNome('');
      impostaDescrizione('');
      impostaPrezzo('');
      impostaGiacenza('0');
      impostaScorta('0');
      impostaEsito('Prodotto aggiunto al catalogo.');
      await ricarica();
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Prodotto non creato.');
    } finally {
      impostaInvio(false);
    }
  }

  async function apriMovimento(prodotto: Prodotto) {
    impostaInMovimento(prodotto);
    impostaQuantita('');
    impostaCausa('carico');
    impostaMotivo('');
    impostaErrore(null);

    try {
      impostaMovimenti(await leggiMovimentiProdotto(prodotto.id));
    } catch {
      impostaMovimenti([]);
    }
  }

  async function salvaMovimento() {
    if (!inMovimento) {
      return;
    }

    const validazione = schemaMovimentoGiacenza.safeParse({
      quantita: Number(quantita),
      causa,
      motivo,
    });

    if (!validazione.success) {
      impostaErrore(validazione.error.issues[0]?.message ?? 'Movimento non valido.');

      return;
    }

    impostaInvio(true);
    impostaErrore(null);

    try {
      const aggiornato = await registraMovimentoGiacenza(inMovimento.id, validazione.data);

      impostaInMovimento(null);
      impostaEsito(`Giacenza di «${aggiornato.nome}»: ${aggiornato.giacenza} pezzi.`);
      await ricarica();
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Movimento non registrato.');
    } finally {
      impostaInvio(false);
    }
  }

  async function cambiaStato(prodotto: Prodotto) {
    impostaErrore(null);

    try {
      if (prodotto.attivo) {
        await disattivaProdotto(prodotto.id);
      } else {
        await modificaProdotto(prodotto.id, { attivo: true });
      }

      await ricarica();
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Operazione non riuscita.');
    }
  }

  if (inCaricamento) {
    return <p className="text-sm text-testo-tenue">Caricamento del catalogo…</p>;
  }

  const sottoScorta = prodotti.filter((prodotto) => prodotto.attivo && prodotto.sottoScorta);

  return (
    <div className="space-y-6">
      {errore && <Avviso tono="errore">{errore}</Avviso>}
      {esito && <Avviso tono="conferma">{esito}</Avviso>}

      {sottoScorta.length > 0 && (
        <Avviso tono="avviso">
          {sottoScorta.length === 1
            ? `«${sottoScorta[0]!.nome}» è arrivato alla scorta minima.`
            : `${sottoScorta.length} prodotti sono arrivati alla scorta minima.`}{' '}
          Registra un carico quando arriva la merce.
        </Avviso>
      )}

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Catalogo prodotti</h2>
        <p className="mt-1 text-sm text-testo-tenue">
          I prodotti si vendono in negozio dalla pagina Vendite. La giacenza scende da sé a ogni
          vendita; per correggerla serve un movimento motivato.
        </p>

        {prodotti.length === 0 ? (
          <p className="mt-4 text-sm text-testo-tenue">Nessun prodotto in catalogo.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {prodotti.map((prodotto) => (
              <li
                key={prodotto.id}
                className="rounded-[var(--radius-campo)] border border-bordo px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {prodotto.nome}
                      {!prodotto.attivo && (
                        <span className="ml-2 text-xs text-testo-tenue">(non in vendita)</span>
                      )}
                    </p>
                    <p className="text-xs text-testo-tenue">
                      {formattaPrezzo(prodotto.prezzoCentesimi)} · {prodotto.giacenza} pezzi
                      {prodotto.scortaMinima > 0 && ` · scorta minima ${prodotto.scortaMinima}`}
                      {prodotto.sottoScorta && ' · da riordinare'}
                    </p>
                    {prodotto.descrizione && (
                      <p className="mt-1 text-xs text-testo-tenue">{prodotto.descrizione}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Pulsante variante="secondario" onClick={() => void apriMovimento(prodotto)}>
                      Giacenza
                    </Pulsante>
                    <Pulsante variante="secondario" onClick={() => void cambiaStato(prodotto)}>
                      {prodotto.attivo ? 'Ritira' : 'Rimetti in vendita'}
                    </Pulsante>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Superficie>

      <Superficie className="p-6">
        <h2 className="text-lg font-semibold">Nuovo prodotto</h2>
        <form onSubmit={(evento) => void aggiungi(evento)} className="mt-4 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etichetta="Nome"
              value={nome}
              onChange={(evento) => impostaNome(evento.target.value)}
              required
            />
            <Campo
              etichetta="Prezzo"
              value={prezzo}
              onChange={(evento) => impostaPrezzo(evento.target.value)}
              placeholder="18,00"
              inputMode="decimal"
              required
            />
            <Campo
              etichetta="Giacenza iniziale"
              type="number"
              min={0}
              value={giacenza}
              onChange={(evento) => impostaGiacenza(evento.target.value)}
            />
            <Campo
              etichetta="Scorta minima"
              type="number"
              min={0}
              value={scorta}
              onChange={(evento) => impostaScorta(evento.target.value)}
              suggerimento="Zero disattiva l’avviso."
            />
          </div>

          <Campo
            etichetta="Descrizione (facoltativa)"
            value={descrizione}
            onChange={(evento) => impostaDescrizione(evento.target.value)}
          />

          <Pulsante type="submit" disabled={inInvio}>
            {inInvio ? 'Salvataggio…' : 'Aggiungi al catalogo'}
          </Pulsante>
        </form>
      </Superficie>

      <Modale
        aperto={inMovimento !== null}
        titolo={inMovimento ? `Giacenza di ${inMovimento.nome}` : ''}
        descrizione={
          inMovimento ? `In magazzino ci sono ${inMovimento.giacenza} pezzi.` : undefined
        }
        onChiudi={() => impostaInMovimento(null)}
      >
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tipo di movimento</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="causa-movimento"
                checked={causa === 'carico'}
                onChange={() => impostaCausa('carico')}
                className="accent-[var(--color-accento)]"
              />
              Carico di merce ricevuta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="causa-movimento"
                checked={causa === 'correzione'}
                onChange={() => impostaCausa('correzione')}
                className="accent-[var(--color-accento)]"
              />
              Correzione dell’inventario
            </label>
          </fieldset>

          <Campo
            etichetta="Variazione (pezzi)"
            type="number"
            value={quantita}
            onChange={(evento) => impostaQuantita(evento.target.value)}
            suggerimento="Positiva in carico, negativa in scarico. La giacenza non può andare sotto zero."
          />

          <Campo
            etichetta="Motivo"
            value={motivo}
            onChange={(evento) => impostaMotivo(evento.target.value)}
            suggerimento="Obbligatorio: resta nei movimenti con data e autore."
          />

          {movimenti.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Ultimi movimenti</h3>
              <ul className="mt-2 space-y-1 text-xs text-testo-tenue">
                {movimenti.slice(0, 5).map((movimento) => (
                  <li key={movimento.id}>
                    {formattaData(movimento.creatoIl)} ·{' '}
                    {ETICHETTE_CAUSA_MOVIMENTO[movimento.causa]} ·{' '}
                    {movimento.quantita > 0 ? '+' : ''}
                    {movimento.quantita} → {movimento.giacenzaFinale} pezzi
                    {movimento.motivo && ` · ${movimento.motivo}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Pulsante variante="secondario" onClick={() => impostaInMovimento(null)}>
              Annulla
            </Pulsante>
            <Pulsante disabled={inInvio} onClick={() => void salvaMovimento()}>
              Registra il movimento
            </Pulsante>
          </div>
        </div>
      </Modale>
    </div>
  );
}
