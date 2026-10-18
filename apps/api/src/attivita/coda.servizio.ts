import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { ambienteBooleano, type Ambiente } from '../configurazione/ambiente.js';

/** Nomi delle code: un'attività per nome. */
export const CODA_EMAIL = 'invio-email';
/** Promemoria degli appuntamenti: attività ricorrente. */
export const CODA_PROMEMORIA = 'invio-promemoria';
/** Invio dei messaggi WhatsApp, con ripiego sull'e-mail. */
export const CODA_WHATSAPP = 'invio-whatsapp';
/** Scadenza del blocco dello slot durante il pagamento della caparra. */
export const CODA_BLOCCO_SLOT = 'scadenza-blocco-slot';

type Gestore = (dati: unknown) => Promise<void>;

/**
 * Attività in background su pg-boss, nello stesso PostgreSQL
 * dell'applicazione: nessun servizio aggiuntivo da gestire.
 *
 * Con `CODA_ATTIVA=false` le attività vengono eseguite subito, in linea:
 * i test automatici restano deterministici e lo sviluppo non richiede la coda.
 */
@Injectable()
export class CodaServizio implements OnModuleDestroy {
  private readonly logger = new Logger(CodaServizio.name);
  private readonly gestori = new Map<string, Gestore>();
  private boss: PgBoss | null = null;
  private avvio: Promise<PgBoss | null> | null = null;

  constructor(private readonly configurazione: ConfigService<Ambiente, true>) {}

  private get attiva(): boolean {
    return ambienteBooleano(this.configurazione.get('CODA_ATTIVA', { infer: true }));
  }

  /**
   * Avvia pg-boss alla prima necessità, una sola volta: evita di dipendere
   * dall'ordine di inizializzazione dei moduli.
   */
  private avviaSeNecessario(): Promise<PgBoss | null> {
    if (!this.attiva) {
      return Promise.resolve(null);
    }

    this.avvio ??= (async () => {
      const boss = new PgBoss({
        connectionString: this.configurazione.get('DATABASE_URL', { infer: true }),
        schema: 'coda',
      });

      boss.on('error', (errore) => this.logger.error('Errore della coda.', errore));
      await boss.start();
      this.boss = boss;
      this.logger.log('Coda delle attività avviata.');

      return boss;
    })();

    return this.avvio;
  }

  /**
   * Registra chi esegue un'attività. Va chiamato all'avvio del modulo che la
   * gestisce, prima che arrivino lavori da svolgere.
   */
  async registra(nome: string, gestore: Gestore): Promise<void> {
    this.gestori.set(nome, gestore);

    const boss = await this.avviaSeNecessario();

    if (!boss) {
      return;
    }

    await boss.createQueue(nome);
    await boss.work(nome, { batchSize: 1 }, async (lavori) => {
      for (const lavoro of lavori) {
        await gestore(lavoro.data);
      }
    });
  }

  /**
   * Accoda un'attività, eventualmente differita di qualche secondo.
   *
   * Senza coda attiva viene eseguita subito e l'errore risale al chiamante,
   * che decide se farlo fallire o solo registrarlo. Un'attività differita,
   * invece, viene saltata: eseguirla subito avrebbe l'effetto opposto a
   * quello voluto (annullerebbe un blocco ancora valido). Chi ne dipende deve
   * restare corretto anche se non viene mai eseguita.
   */
  async accoda(
    nome: string,
    dati: object,
    opzioni: { ritardoSecondi?: number } = {},
  ): Promise<void> {
    const boss = await this.avviaSeNecessario();

    if (!boss) {
      if (opzioni.ritardoSecondi) {
        this.logger.warn(`Coda non attiva: l'attività differita "${nome}" non verrà eseguita.`);

        return;
      }

      const gestore = this.gestori.get(nome);

      if (!gestore) {
        throw new Error(`Nessun gestore registrato per l'attività "${nome}".`);
      }

      await gestore(dati);

      return;
    }

    await boss.send(nome, dati, {
      startAfter: opzioni.ritardoSecondi,
      // Un'e-mail che non parte viene ritentata con attese crescenti.
      retryLimit: 5,
      retryDelay: 60,
      retryBackoff: true,
      expireInSeconds: 600,
    });
  }

  /**
   * Programma un'attività ricorrente con un'espressione cron.
   *
   * pg-boss tiene una sola pianificazione per nome, quindi chiamarla a ogni
   * avvio non accumula duplicati. Senza coda attiva non viene programmata
   * nulla: chi ne dipende deve restare corretto anche così.
   */
  async programmaRicorrente(nome: string, cron: string): Promise<void> {
    const boss = await this.avviaSeNecessario();

    if (!boss) {
      this.logger.warn(`Coda non attiva: l'attività ricorrente "${nome}" non verrà eseguita.`);

      return;
    }

    await boss.schedule(nome, cron);
    this.logger.log(`Attività ricorrente "${nome}" programmata (${cron}).`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) {
      // Chiusura ordinata: i lavori in corso finiscono, i nuovi non partono.
      await this.boss.stop({ graceful: true, close: true, timeout: 5000 });
      this.boss = null;
      this.avvio = null;
    }
  }
}
