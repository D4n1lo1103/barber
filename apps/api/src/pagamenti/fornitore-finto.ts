import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  type DatiAvvioPagamento,
  type EventoPagamento,
  type FornitorePagamenti,
  type OggettoPagato,
  type PagamentoAvviato,
} from './fornitore-pagamenti.js';

/** Firma attesa dagli eventi finti: nessun segreto, perché nulla è reale. */
export const FIRMA_FINTA = 'finta';

/**
 * Fornitore finto, per lo sviluppo e i test automatici senza chiavi Stripe.
 * Non muove denaro: apre una pagina locale dove si sceglie l'esito, e
 * l'evento che ne deriva passa dallo stesso percorso di quello reale.
 *
 * Non viene mai costruito in produzione: il modulo dei pagamenti interrompe
 * l'avvio se mancano le chiavi con `NODE_ENV=production`.
 */
export class FornitoreFinto implements FornitorePagamenti {
  readonly descrizione = 'Fornitore finto (nessun pagamento reale)';
  readonly finto = true;
  readonly chiavePubblicabile = null;

  private readonly logger = new Logger(FornitoreFinto.name);
  /** Pagamenti aperti: riferimento → oggetto pagato e importo. */
  private readonly aperti = new Map<string, { oggetto: OggettoPagato; importoCentesimi: number }>();

  constructor(private readonly origineWeb: string) {}

  avvia(dati: DatiAvvioPagamento): Promise<PagamentoAvviato> {
    const riferimento = `finto_${randomUUID()}`;

    this.aperti.set(riferimento, {
      oggetto: dati.oggetto,
      importoCentesimi: dati.importoCentesimi,
    });

    const indirizzo = new URL('/pagamento-finto', this.origineWeb);

    indirizzo.searchParams.set('riferimento', riferimento);
    indirizzo.searchParams.set('importo', String(dati.importoCentesimi));
    indirizzo.searchParams.set('ritorno', dati.urlRitorno);

    this.logger.warn(`Pagamento finto avviato per ${dati.oggetto.tipo} ${dati.oggetto.id}.`);

    return Promise.resolve({ riferimento, urlPagamento: indirizzo.toString() });
  }

  annulla(riferimento: string): Promise<void> {
    this.aperti.delete(riferimento);

    return Promise.resolve();
  }

  rimborsa(riferimento: string, importoCentesimi: number): Promise<string> {
    this.logger.warn(`Rimborso finto di ${importoCentesimi} centesimi su ${riferimento}.`);

    return Promise.resolve(`rimborso_finto_${randomUUID()}`);
  }

  /**
   * L'evento finto arriva dal nostro stesso frontend, quindi il corpo è già
   * nel nostro formato: resta da controllare la firma convenzionale e che il
   * pagamento sia stato davvero avviato da noi.
   */
  interpretaEvento(corpo: Buffer, firma: string | undefined): EventoPagamento {
    if (firma !== FIRMA_FINTA) {
      throw new Error('Evento finto senza la firma attesa.');
    }

    const dati = JSON.parse(corpo.toString('utf8')) as {
      riferimento?: unknown;
      esito?: unknown;
    };

    if (typeof dati.riferimento !== 'string') {
      throw new Error('Evento finto senza riferimento.');
    }

    if (dati.esito !== 'riuscito' && dati.esito !== 'fallito' && dati.esito !== 'scaduto') {
      throw new Error('Esito finto non riconosciuto.');
    }

    const aperto = this.aperti.get(dati.riferimento);

    if (!aperto) {
      throw new Error('Nessun pagamento finto aperto con questo riferimento.');
    }

    if (dati.esito !== 'riuscito') {
      this.aperti.delete(dati.riferimento);
    }

    return {
      // Un identificativo per evento: così l'idempotenza si può provare
      // rimandando due volte lo stesso corpo.
      id: `evento_finto_${dati.riferimento}_${dati.esito}`,
      tipo: `finto.${dati.esito}`,
      esito: dati.esito,
      riferimento: dati.riferimento,
      oggetto: aperto.oggetto,
      importoCentesimi: aperto.importoCentesimi,
      errore: dati.esito === 'fallito' ? 'Pagamento finto rifiutato.' : '',
    };
  }
}
