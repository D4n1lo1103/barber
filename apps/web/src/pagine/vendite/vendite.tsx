import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { totaleVendita, type Cliente, type Prodotto, type Vendita } from '@barber/shared';
import { Avviso } from '../../componenti/avviso';
import { Campo } from '../../componenti/campo';
import { CercaCliente } from '../../componenti/cerca-cliente';
import { Caricamento } from '../../componenti/caricamento';
import { Modale } from '../../componenti/modale';
import { Pulsante } from '../../componenti/pulsante';
import { Superficie } from '../../componenti/superficie';
import { ErroreApi } from '../../servizi/client-api';
import {
  annullaVendita,
  leggiProdotti,
  leggiVendite,
  registraVendita,
} from '../../servizi/gestione';
import { formattaData, formattaPrezzo } from '../../utilita/formati';

/**
 * Vendita di prodotti in negozio.
 *
 * La vendita non produce alcun documento per il cliente: è una registrazione
 * interna, che scarica il magazzino. Collegare un cliente è facoltativo e
 * serve al suo storico.
 */
export function PaginaVendite() {
  const [prodotti, impostaProdotti] = useState<Prodotto[]>([]);
  const [vendite, impostaVendite] = useState<Vendita[]>([]);
  const [quantita, impostaQuantita] = useState<Record<string, number>>({});
  const [cliente, impostaCliente] = useState<Cliente | null>(null);
  const [note, impostaNote] = useState('');
  const [errore, impostaErrore] = useState<string | null>(null);
  const [esito, impostaEsito] = useState<string | null>(null);
  const [inCaricamento, impostaCaricamento] = useState(true);
  const [inInvio, impostaInvio] = useState(false);
  const [daAnnullare, impostaDaAnnullare] = useState<Vendita | null>(null);
  const [motivo, impostaMotivo] = useState('');

  async function ricarica() {
    try {
      const [catalogo, elenco] = await Promise.all([leggiProdotti(), leggiVendite()]);

      impostaProdotti(catalogo.filter((prodotto) => prodotto.attivo));
      impostaVendite(elenco.vendite);
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

  const righe = useMemo(
    () =>
      prodotti
        .filter((prodotto) => (quantita[prodotto.id] ?? 0) > 0)
        .map((prodotto) => ({
          prodottoId: prodotto.id,
          nome: prodotto.nome,
          prezzoCentesimi: prodotto.prezzoCentesimi,
          quantita: quantita[prodotto.id]!,
        })),
    [prodotti, quantita],
  );
  const totale = totaleVendita(righe);
  const sottoScorta = prodotti.filter((prodotto) => prodotto.sottoScorta);

  function cambiaQuantita(prodotto: Prodotto, valore: number) {
    // Non si può vendere più di quanto c'è: la giacenza è il limite.
    const pezzi = Math.max(0, Math.min(prodotto.giacenza, Math.trunc(valore)));

    impostaQuantita((precedenti) => ({ ...precedenti, [prodotto.id]: pezzi }));
  }

  async function registra() {
    if (righe.length === 0) {
      impostaErrore('Scegli almeno un prodotto.');

      return;
    }

    impostaInvio(true);
    impostaErrore(null);
    impostaEsito(null);

    try {
      const vendita = await registraVendita({
        righe: righe.map((riga) => ({ prodottoId: riga.prodottoId, quantita: riga.quantita })),
        clienteId: cliente?.id,
        note,
      });

      impostaQuantita({});
      impostaCliente(null);
      impostaNote('');
      impostaEsito(`Vendita registrata: ${formattaPrezzo(vendita.totaleCentesimi)}.`);
      await ricarica();
    } catch (problema) {
      impostaErrore(problema instanceof ErroreApi ? problema.message : 'Vendita non registrata.');
    } finally {
      impostaInvio(false);
    }
  }

  async function annulla() {
    if (!daAnnullare) {
      return;
    }

    impostaInvio(true);
    impostaErrore(null);

    try {
      await annullaVendita(daAnnullare.id, motivo.trim());
      impostaDaAnnullare(null);
      impostaMotivo('');
      impostaEsito('Vendita annullata: i pezzi sono tornati in magazzino.');
      await ricarica();
    } catch (problema) {
      impostaErrore(
        problema instanceof ErroreApi ? problema.message : 'Annullamento non riuscito.',
      );
    } finally {
      impostaInvio(false);
    }
  }

  if (inCaricamento) {
    return <Caricamento messaggio="Caricamento del magazzino" />;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendite in negozio</h1>
          <p className="mt-1 text-sm text-testo-tenue">
            La vendita scarica il magazzino. Non produce documenti per il cliente.
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 space-y-6"
      >
        {errore && <Avviso tono="errore">{errore}</Avviso>}
        {esito && <Avviso tono="conferma">{esito}</Avviso>}

        {sottoScorta.length > 0 && (
          <Avviso tono="avviso">
            Scorte in esaurimento:{' '}
            {sottoScorta.map((prodotto) => `${prodotto.nome} (${prodotto.giacenza})`).join(', ')}.
          </Avviso>
        )}

        <Superficie className="p-6">
          <h2 className="text-lg font-semibold">Prodotti</h2>

          {prodotti.length === 0 ? (
            <p className="mt-2 text-sm text-testo-tenue">
              Nessun prodotto in vendita. Il titolare li aggiunge dalle impostazioni.
            </p>
          ) : (
            <ul className="mt-4 space-y-2" aria-label="Prodotti in vendita">
              {prodotti.map((prodotto) => (
                <li
                  key={prodotto.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-campo)] border border-bordo px-3 py-2.5"
                >
                  <div className="text-sm">
                    <p className="font-medium">{prodotto.nome}</p>
                    <p className="text-xs text-testo-tenue">
                      {formattaPrezzo(prodotto.prezzoCentesimi)} ·{' '}
                      {prodotto.giacenza === 0
                        ? 'esaurito'
                        : `${prodotto.giacenza} pezzi disponibili`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-testo-tenue" htmlFor={`pezzi-${prodotto.id}`}>
                      Pezzi
                    </label>
                    <input
                      id={`pezzi-${prodotto.id}`}
                      type="number"
                      min={0}
                      max={prodotto.giacenza}
                      disabled={prodotto.giacenza === 0}
                      value={quantita[prodotto.id] ?? 0}
                      onChange={(evento) => cambiaQuantita(prodotto, Number(evento.target.value))}
                      className="w-20 rounded-[var(--radius-campo)] border border-bordo bg-fondo-elevato px-2 py-1.5 text-sm focus:border-accento focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Superficie>

        <Superficie className="p-6">
          <h2 className="text-lg font-semibold">Cliente (facoltativo)</h2>
          <p className="mt-1 text-sm text-testo-tenue">
            Collegare la vendita a un cliente la fa comparire nel suo storico.
          </p>

          <div className="mt-4">
            <CercaCliente cliente={cliente} onScegli={impostaCliente} />
          </div>

          <div className="mt-4">
            <Campo
              etichetta="Note (facoltative)"
              value={note}
              onChange={(evento) => impostaNote(evento.target.value)}
              placeholder="Es. pagato in contanti"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Totale: <strong>{formattaPrezzo(totale)}</strong>
              {righe.length > 0 && (
                <span className="block text-xs text-testo-tenue">
                  {righe.map((riga) => `${riga.quantita} × ${riga.nome}`).join(', ')}
                </span>
              )}
            </p>
            <Pulsante disabled={inInvio || righe.length === 0} onClick={() => void registra()}>
              {inInvio ? 'Registrazione…' : 'Registra la vendita'}
            </Pulsante>
          </div>
        </Superficie>

        <section>
          <h2 className="text-lg font-semibold">Ultime vendite</h2>
          {vendite.length === 0 ? (
            <p className="mt-2 text-sm text-testo-tenue">Nessuna vendita registrata.</p>
          ) : (
            <ul className="mt-3 space-y-2" aria-label="Vendite registrate">
              {vendite.map((vendita) => (
                <li
                  key={vendita.id}
                  className="rounded-[var(--radius-campo)] border border-bordo bg-superficie px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {formattaPrezzo(vendita.totaleCentesimi)}
                        {vendita.annullataIl && (
                          <span className="ml-2 text-xs text-testo-tenue">(annullata)</span>
                        )}
                      </p>
                      <p className="text-xs text-testo-tenue">
                        {formattaData(vendita.creataIl)} ·{' '}
                        {vendita.righe.map((riga) => `${riga.quantita} × ${riga.nome}`).join(', ')}
                        {vendita.cliente && ` · ${vendita.cliente.nome} ${vendita.cliente.cognome}`}
                      </p>
                      {vendita.annullataIl && (
                        <p className="mt-1 text-xs text-testo-tenue">
                          Motivo: {vendita.motivoAnnullamento}
                        </p>
                      )}
                    </div>

                    {!vendita.annullataIl && (
                      <Pulsante
                        variante="secondario"
                        onClick={() => {
                          impostaDaAnnullare(vendita);
                          impostaMotivo('');
                        }}
                      >
                        Annulla
                      </Pulsante>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </motion.div>

      <Modale
        aperto={daAnnullare !== null}
        titolo="Annulla la vendita"
        descrizione="I pezzi tornano in magazzino e l’operazione resta registrata."
        onChiudi={() => impostaDaAnnullare(null)}
      >
        <div className="space-y-4">
          <Campo
            etichetta="Motivo"
            value={motivo}
            onChange={(evento) => impostaMotivo(evento.target.value)}
            suggerimento="Obbligatorio: resta nei movimenti di magazzino."
          />

          <div className="flex flex-wrap justify-end gap-3">
            <Pulsante variante="secondario" onClick={() => impostaDaAnnullare(null)}>
              Indietro
            </Pulsante>
            <Pulsante disabled={inInvio || motivo.trim().length < 3} onClick={() => void annulla()}>
              Annulla la vendita
            </Pulsante>
          </div>
        </div>
      </Modale>
    </main>
  );
}
