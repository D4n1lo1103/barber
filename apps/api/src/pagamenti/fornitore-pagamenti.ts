/**
 * Pagamenti dietro un'interfaccia: la logica di business non conosce il
 * fornitore, così si può cambiare senza toccarla. Nessun dato di carta passa
 * mai dal nostro codice: il cliente paga su una pagina del fornitore e noi
 * conserviamo solo il riferimento opaco all'operazione.
 */

/**
 * Che cosa il cliente sta pagando. Il fornitore non conosce il nostro dominio:
 * gli passiamo il tipo e l'identificativo, e li ritroviamo tali e quali
 * nell'evento, così un solo webhook serve caparre e ordini.
 */
export type TipoOggettoPagato = 'caparra' | 'ordine';

export interface OggettoPagato {
  tipo: TipoOggettoPagato;
  /** Identificativo dell'appuntamento o dell'ordine. */
  id: string;
}

/** Pagamento aperto presso il fornitore, da far completare al cliente. */
export interface PagamentoAvviato {
  /** Identificativo dell'operazione presso il fornitore. */
  riferimento: string;
  /** Indirizzo a cui mandare il cliente per pagare. */
  urlPagamento: string;
}

export interface DatiAvvioPagamento {
  importoCentesimi: number;
  /** Descrizione mostrata al cliente sulla pagina di pagamento. */
  descrizione: string;
  /** Riferimento interno, per ritrovare l'oggetto pagato negli eventi. */
  oggetto: OggettoPagato;
  emailCliente?: string;
  /** Indirizzi a cui tornare dopo il pagamento, riuscito o abbandonato. */
  urlRitorno: string;
  urlAnnullamento: string;
  /** Oltre questo istante il pagamento non va più accettato. */
  scadeIl: Date;
}

/** Esito di un evento ricevuto dal fornitore, già tradotto nel nostro dominio. */
export type EsitoEvento = 'riuscito' | 'fallito' | 'scaduto' | 'ignorato';

export interface EventoPagamento {
  /** Identificativo dell'evento presso il fornitore: serve all'idempotenza. */
  id: string;
  /** Tipo grezzo, registrato per il troubleshooting. */
  tipo: string;
  esito: EsitoEvento;
  /** Riferimento del pagamento a cui si riferisce, se l'evento lo porta. */
  riferimento: string | null;
  /** Oggetto indicato dal fornitore nei metadati, quando presente. */
  oggetto: OggettoPagato | null;
  /** Importo effettivamente pagato, per confrontarlo con quello atteso. */
  importoCentesimi: number | null;
  /** Messaggio d'errore del fornitore, da non mostrare al cliente. */
  errore: string;
}

export interface FornitorePagamenti {
  /** Descrizione leggibile, usata nei log all'avvio. */
  readonly descrizione: string;
  /** Vero quando i pagamenti non sono reali: l'interfaccia lo segnala. */
  readonly finto: boolean;
  /** Chiave pubblicabile, se il fornitore ne usa una lato browser. */
  readonly chiavePubblicabile: string | null;

  avvia(dati: DatiAvvioPagamento): Promise<PagamentoAvviato>;

  /** Chiude un pagamento mai completato, alla scadenza del blocco. */
  annulla(riferimento: string): Promise<void>;

  /**
   * Rimborsa un pagamento riuscito e restituisce il riferimento del rimborso.
   * L'importo è in centesimi: la caparra si rimborsa sempre per intero, un
   * ordine anche solo per i pezzi resi.
   */
  rimborsa(riferimento: string, importoCentesimi: number): Promise<string>;

  /**
   * Verifica la firma dell'evento e lo traduce. Un corpo non firmato
   * correttamente deve far lanciare un errore: è l'unica difesa contro un
   * falso evento di pagamento.
   */
  interpretaEvento(corpo: Buffer, firma: string | undefined): EventoPagamento;
}

/** Token di iniezione: le classi dipendono dall'interfaccia, non dal fornitore. */
export const FORNITORE_PAGAMENTI = 'FORNITORE_PAGAMENTI';
