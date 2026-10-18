import { Logger } from '@nestjs/common';
import {
  ErroreWhatsapp,
  type MessaggioWhatsapp,
  type MittenteWhatsapp,
} from './mittente-whatsapp.js';

/** Timeout della chiamata a Meta: oltre, si ripiega sull'e-mail. */
const TIMEOUT_MILLISECONDI = 10_000;

/**
 * WhatsApp Cloud API ufficiale di Meta.
 *
 * Invia solo messaggi costruiti su modelli approvati. Gli errori vengono
 * distinti fra **permanenti** (numero non su WhatsApp, modello non approvato:
 * ritentare è inutile) e temporanei, perché il chiamante ripieghi subito
 * sull'e-mail nel primo caso e possa ritentare nel secondo.
 */
export class MittenteWhatsappCloud implements MittenteWhatsapp {
  readonly finto = false;
  readonly descrizione: string;

  private readonly logger = new Logger(MittenteWhatsappCloud.name);

  constructor(
    private readonly token: string,
    private readonly idNumeroMittente: string,
    private readonly versioneApi = 'v23.0',
  ) {
    this.descrizione = `WhatsApp Cloud API (numero ${idNumeroMittente})`;
  }

  async invia(messaggio: MessaggioWhatsapp): Promise<void> {
    const indirizzo = `https://graph.facebook.com/${this.versioneApi}/${this.idNumeroMittente}/messages`;
    const componenti: unknown[] = [
      {
        type: 'body',
        parameters: messaggio.parametri.map((valore) => ({ type: 'text', text: valore })),
      },
    ];

    if (messaggio.parametroPulsante) {
      componenti.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: messaggio.parametroPulsante }],
      });
    }

    let risposta: Response;

    try {
      risposta = await fetch(indirizzo, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: messaggio.a,
          type: 'template',
          template: {
            name: messaggio.modello,
            language: { code: messaggio.lingua },
            components: componenti,
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MILLISECONDI),
      });
    } catch (errore) {
      // Rete o timeout: temporaneo, ha senso ritentare.
      throw new ErroreWhatsapp(
        `WhatsApp non raggiungibile: ${errore instanceof Error ? errore.message : 'errore'}`,
      );
    }

    if (risposta.ok) {
      return;
    }

    // Il corpo d'errore di Meta può contenere il numero del destinatario:
    // si registra solo il codice, non il testo completo.
    const dettaglio = (await this.leggiCodice(risposta)) ?? String(risposta.status);
    const permanente = risposta.status >= 400 && risposta.status < 500 && risposta.status !== 429;

    this.logger.warn(`Invio WhatsApp rifiutato (${dettaglio}).`);

    throw new ErroreWhatsapp(`WhatsApp ha rifiutato il messaggio (${dettaglio}).`, permanente);
  }

  /** Codice d'errore di Meta, senza il resto del corpo. */
  private async leggiCodice(risposta: Response): Promise<string | null> {
    try {
      const corpo = (await risposta.json()) as { error?: { code?: number; type?: string } };

      if (corpo.error?.code === undefined) {
        return null;
      }

      return `codice ${corpo.error.code}`;
    } catch {
      return null;
    }
  }
}
