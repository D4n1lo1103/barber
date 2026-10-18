import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CODA_BLOCCO_SLOT, CodaServizio } from '../attivita/coda.servizio.js';
import { PagamentiServizio } from './pagamenti.servizio.js';

interface LavoroBloccoSlot {
  appuntamentoId: string;
}

/**
 * Attività che libera lo slot quando il tempo per pagare la caparra è finito.
 *
 * È solo la via tempestiva: la correttezza non dipende da lei. Prima di
 * occupare uno slot l'agenda ripulisce comunque i blocchi scaduti, così un
 * mancato passaggio della coda non lascia uno slot occupato per sempre.
 */
@Injectable()
export class ScadenzaBloccoAttivita implements OnModuleInit {
  private readonly logger = new Logger(ScadenzaBloccoAttivita.name);

  constructor(
    private readonly coda: CodaServizio,
    private readonly pagamenti: PagamentiServizio,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.coda.registra(CODA_BLOCCO_SLOT, async (dati) => {
      const { appuntamentoId } = dati as LavoroBloccoSlot;

      await this.pagamenti.scadiBlocco(appuntamentoId);
    });
  }

  /** Programma la liberazione dello slot all'istante indicato. */
  async programma(appuntamentoId: string, scadeIl: Date): Promise<void> {
    const ritardoSecondi = Math.max(1, Math.ceil((scadeIl.getTime() - Date.now()) / 1000));

    try {
      await this.coda.accoda(CODA_BLOCCO_SLOT, { appuntamentoId }, { ritardoSecondi });
    } catch (errore) {
      // Non impedisce la prenotazione: lo slot verrà comunque liberato alla
      // prima occasione utile.
      this.logger.warn(
        `Scadenza del blocco non programmata per ${appuntamentoId}: ${
          errore instanceof Error ? errore.message : 'errore non identificato'
        }`,
      );
    }
  }
}
