import { useEffect, useState } from 'react';
import type { Cliente } from '@barber/shared';
import { leggiClienti } from '../servizi/gestione';
import { Campo } from './campo';
import { Pulsante } from './pulsante';

/**
 * Ricerca di una scheda cliente, con scelta. La usano il pannello di
 * prenotazione e la registrazione di una vendita: è lo stesso gesto, cercare
 * un cliente per nome o numero.
 */
export function CercaCliente({
  cliente,
  onScegli,
}: {
  cliente: Cliente | null;
  onScegli: (cliente: Cliente | null) => void;
}) {
  const [cerca, impostaCerca] = useState('');
  const [risultati, impostaRisultati] = useState<Cliente[]>([]);
  const [inRicerca, impostaRicerca] = useState(false);

  useEffect(() => {
    if (cliente || cerca.trim().length < 2) {
      impostaRisultati([]);

      return;
    }

    let annullato = false;
    // Piccolo ritardo: evita una richiesta per ogni tasto premuto.
    const attesa = setTimeout(() => {
      impostaRicerca(true);
      leggiClienti({ cerca: cerca.trim(), perPagina: 8 })
        .then((elenco) => {
          if (!annullato) {
            impostaRisultati(elenco.clienti);
          }
        })
        .catch(() => {
          if (!annullato) {
            impostaRisultati([]);
          }
        })
        .finally(() => {
          if (!annullato) {
            impostaRicerca(false);
          }
        });
    }, 250);

    return () => {
      annullato = true;
      clearTimeout(attesa);
    };
  }, [cerca, cliente]);

  if (cliente) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-campo)] border border-accento bg-accento/10 px-3 py-2.5">
        <span className="text-sm">
          <span className="font-medium">
            {cliente.nome} {cliente.cognome}
          </span>
          <span className="block text-xs text-testo-tenue">
            {cliente.numeroWhatsapp ?? cliente.email ?? 'Nessun contatto'}
          </span>
        </span>
        <Pulsante variante="discreto" onClick={() => onScegli(null)}>
          Cambia
        </Pulsante>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Campo
        etichetta="Cliente"
        value={cerca}
        onChange={(evento) => impostaCerca(evento.target.value)}
        placeholder="Nome, cognome o numero"
        suggerimento="La scheda si crea dalla pagina Clienti."
        autoComplete="off"
      />
      {inRicerca && <p className="text-xs text-testo-tenue">Ricerca…</p>}
      {risultati.length > 0 && (
        <ul className="divide-y divide-[var(--color-bordo)] overflow-hidden rounded-[var(--radius-campo)] border border-bordo">
          {risultati.map((risultato) => (
            <li key={risultato.id}>
              <button
                type="button"
                onClick={() => onScegli(risultato)}
                className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-fondo-elevato"
              >
                <span className="font-medium">
                  {risultato.nome} {risultato.cognome}
                </span>
                <span className="block text-xs text-testo-tenue">
                  {risultato.numeroWhatsapp ?? risultato.email ?? 'Nessun contatto'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
