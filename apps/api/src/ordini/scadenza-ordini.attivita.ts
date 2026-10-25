import { Injectable, Logger } from '@nestjs/common';
import { CODA_BLOCCO_ORDINE, CodaServizio } from '../attivita/coda.servizio.js';

/** Dati del lavoro accodato: l'ordine di cui è scaduto il tempo di pagamento. */
export interface LavoroBloccoOrdine {
  ordineId: string;
}

/**
 * Programma il rilascio della giacenza quando il tempo per pagare un ordine
 * finisce.
 *
 * Qui sta solo l'accodamento: **chi esegue il lavoro lo registra il servizio
 * degli ordini**, all'avvio del modulo. Se fosse questa classe a registrarlo,
 * servizio e attività si importerebbero a vicenda e il caricamento dei moduli
 * fallirebbe.
 *
 * È solo la via tempestiva: la correttezza non dipende da lei. Prima di creare
 * un ordine e prima di elencarli, il servizio annulla comunque quelli scaduti,
 * così un mancato passaggio della coda non tiene i pezzi fuori dal magazzino
 * per sempre.
 */
@Injectable()
export class ScadenzaOrdiniAttivita {
  private readonly logger = new Logger(ScadenzaOrdiniAttivita.name);

  constructor(private readonly coda: CodaServizio) {}

  /** Registra chi esegue il lavoro. La chiama il servizio degli ordini. */
  async registraGestore(gestore: (ordineId: string) => Promise<void>): Promise<void> {
    await this.coda.registra(CODA_BLOCCO_ORDINE, async (dati) => {
      const { ordineId } = dati as LavoroBloccoOrdine;

      await gestore(ordineId);
    });
  }

  /** Programma il rilascio della giacenza all'istante indicato. */
  async programma(ordineId: string, scadeIl: Date): Promise<void> {
    const ritardoSecondi = Math.max(1, Math.ceil((scadeIl.getTime() - Date.now()) / 1000));

    try {
      await this.coda.accoda(CODA_BLOCCO_ORDINE, { ordineId }, { ritardoSecondi });
    } catch (errore) {
      // Non impedisce l'ordine: la giacenza verrà rilasciata alla prima
      // occasione utile.
      this.logger.warn(
        `Scadenza dell'ordine ${ordineId} non programmata: ${
          errore instanceof Error ? errore.message : 'errore non identificato'
        }`,
      );
    }
  }
}
