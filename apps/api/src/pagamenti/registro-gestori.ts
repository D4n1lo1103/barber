import { Injectable, Logger } from '@nestjs/common';
import type { TipoOggettoPagato } from './fornitore-pagamenti.js';

/**
 * Effetti che un evento del fornitore produce sull'oggetto pagato.
 *
 * Ogni metodo restituisce una frase breve, che finisce nel registro degli
 * eventi come esito dell'elaborazione: serve al troubleshooting di un
 * pagamento che non ha avuto l'effetto atteso.
 */
export interface GestorePagamento {
  /** Pagamento confermato dall'evento firmato. */
  pagamentoRiuscito(parametri: { oggettoId: string; importoCentesimi: number }): Promise<string>;
  /** Pagamento rifiutato: l'oggetto resta in attesa fino alla scadenza. */
  pagamentoFallito(parametri: { oggettoId: string; errore: string }): Promise<string>;
  /** Pagamento scaduto o abbandonato prima di essere completato. */
  pagamentoScaduto(parametri: { oggettoId: string }): Promise<string>;
}

/**
 * Registro dei gestori, uno per tipo di oggetto pagabile.
 *
 * Serve a tenere la dipendenza in una sola direzione: il modulo degli ordini
 * conosce i pagamenti, i pagamenti non conoscono gli ordini. Senza il registro
 * i due moduli si importerebbero a vicenda e servirebbe un `forwardRef`.
 *
 * La caparra non passa da qui: la gestisce il servizio dei pagamenti stesso,
 * dove quella logica è nata.
 */
@Injectable()
export class RegistroGestoriPagamento {
  private readonly logger = new Logger(RegistroGestoriPagamento.name);
  private readonly gestori = new Map<TipoOggettoPagato, GestorePagamento>();

  registra(tipo: TipoOggettoPagato, gestore: GestorePagamento): void {
    this.gestori.set(tipo, gestore);
    this.logger.log(`Gestore dei pagamenti registrato per «${tipo}».`);
  }

  gestore(tipo: TipoOggettoPagato): GestorePagamento | null {
    return this.gestori.get(tipo) ?? null;
  }
}
