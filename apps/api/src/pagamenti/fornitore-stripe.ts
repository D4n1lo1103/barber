import { Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
  type DatiAvvioPagamento,
  type EsitoEvento,
  type EventoPagamento,
  type FornitorePagamenti,
  type OggettoPagato,
  type PagamentoAvviato,
} from './fornitore-pagamenti.js';

/** Chiavi dei metadati con cui ritroviamo l'oggetto pagato negli eventi. */
const META_TIPO = 'oggettoTipo';
const META_ID = 'oggettoId';

/**
 * Chiave usata prima che i pagamenti servissero anche gli ordini. Resta letta
 * in ripiego perché un pagamento avviato prima di un aggiornamento porta
 * ancora questa: l'esito arriverebbe altrimenti senza oggetto.
 */
const META_APPUNTAMENTO_STORICA = 'appuntamentoId';

/**
 * Stripe Checkout ospitato: il cliente paga su una pagina di Stripe e noi
 * riceviamo l'esito dal webhook. Nessun dato di carta attraversa il nostro
 * server, e il frontend non ha bisogno di librerie di Stripe.
 *
 * Lo stato del pagamento si considera definitivo solo dopo l'evento firmato:
 * il ritorno del browser non è una prova di pagamento.
 */
export class FornitoreStripe implements FornitorePagamenti {
  readonly descrizione = 'Stripe Checkout';
  readonly finto = false;

  private readonly logger = new Logger(FornitoreStripe.name);
  private readonly stripe: Stripe;

  constructor(
    chiaveSegreta: string,
    private readonly segretoWebhook: string,
    readonly chiavePubblicabile: string | null,
  ) {
    this.stripe = new Stripe(chiaveSegreta);
  }

  async avvia(dati: DatiAvvioPagamento): Promise<PagamentoAvviato> {
    const sessione = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: dati.importoCentesimi,
            product_data: { name: dati.descrizione },
          },
        },
      ],
      // Il cliente non deve poter pagare uno slot che nel frattempo è stato
      // liberato: Stripe chiude la sessione da sé.
      expires_at: Math.floor(dati.scadeIl.getTime() / 1000),
      customer_email: dati.emailCliente,
      success_url: dati.urlRitorno,
      cancel_url: dati.urlAnnullamento,
      metadata: metadati(dati),
      payment_intent_data: { metadata: metadati(dati) },
    });

    if (!sessione.url) {
      throw new Error('Stripe non ha restituito l’indirizzo di pagamento.');
    }

    return { riferimento: sessione.id, urlPagamento: sessione.url };
  }

  async annulla(riferimento: string): Promise<void> {
    try {
      await this.stripe.checkout.sessions.expire(riferimento);
    } catch (errore) {
      // Una sessione già scaduta o già pagata non si può far scadere: non è un
      // problema, l'esito reale arriva comunque dal webhook.
      this.logger.warn(
        `Sessione ${riferimento} non annullabile presso Stripe: ${this.messaggio(errore)}`,
      );
    }
  }

  async rimborsa(riferimento: string, importoCentesimi: number): Promise<string> {
    const sessione = await this.stripe.checkout.sessions.retrieve(riferimento);
    const pagamento = sessione.payment_intent;
    const idPagamento = typeof pagamento === 'string' ? pagamento : pagamento?.id;

    if (!idPagamento) {
      throw new Error('La sessione di pagamento non ha un pagamento da rimborsare.');
    }

    const rimborso = await this.stripe.refunds.create({
      payment_intent: idPagamento,
      amount: importoCentesimi,
    });

    return rimborso.id;
  }

  interpretaEvento(corpo: Buffer, firma: string | undefined): EventoPagamento {
    if (!firma) {
      throw new Error('Evento senza firma.');
    }

    // Lancia se la firma non corrisponde: è la difesa contro un evento falso.
    const evento = this.stripe.webhooks.constructEvent(corpo, firma, this.segretoWebhook);
    const esito = ESITI[evento.type] ?? 'ignorato';
    const oggetto = evento.data.object as {
      id?: string;
      amount_total?: number | null;
      amount?: number | null;
      metadata?: Record<string, string> | null;
      last_payment_error?: { message?: string } | null;
    };

    return {
      id: evento.id,
      tipo: evento.type,
      esito,
      riferimento: oggetto.id ?? null,
      oggetto: oggettoPagato(oggetto.metadata),
      importoCentesimi: oggetto.amount_total ?? oggetto.amount ?? null,
      errore: oggetto.last_payment_error?.message ?? '',
    };
  }

  private messaggio(errore: unknown): string {
    return errore instanceof Error ? errore.message : 'errore non identificato';
  }
}

function metadati(dati: DatiAvvioPagamento): Record<string, string> {
  return { [META_TIPO]: dati.oggetto.tipo, [META_ID]: dati.oggetto.id };
}

/** Oggetto pagato ricostruito dai metadati, con il ripiego sulla chiave storica. */
function oggettoPagato(metadata: Record<string, string> | null | undefined): OggettoPagato | null {
  const tipo = metadata?.[META_TIPO];
  const id = metadata?.[META_ID];

  if ((tipo === 'caparra' || tipo === 'ordine') && id) {
    return { tipo, id };
  }

  const appuntamentoId = metadata?.[META_APPUNTAMENTO_STORICA];

  return appuntamentoId ? { tipo: 'caparra', id: appuntamentoId } : null;
}

/** Traduzione dei tipi di evento di Stripe nel nostro esito. */
const ESITI: Readonly<Record<string, EsitoEvento>> = {
  'checkout.session.completed': 'riuscito',
  'checkout.session.expired': 'scaduto',
  'checkout.session.async_payment_succeeded': 'riuscito',
  'checkout.session.async_payment_failed': 'fallito',
};
