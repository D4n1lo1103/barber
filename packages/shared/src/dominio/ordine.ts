import { creditoDaUsare } from './caparra.js';

export const STATI_ORDINE = [
  'in_attesa_pagamento',
  'pagato',
  'in_preparazione',
  'pronto_per_ritiro',
  'spedito',
  'consegnato',
  'annullato',
  'rimborsato',
] as const;

export type StatoOrdine = (typeof STATI_ORDINE)[number];

export const ETICHETTE_STATO_ORDINE: Readonly<Record<StatoOrdine, string>> = {
  in_attesa_pagamento: 'In attesa di pagamento',
  pagato: 'Pagato',
  in_preparazione: 'In preparazione',
  pronto_per_ritiro: 'Pronto per il ritiro',
  spedito: 'Spedito',
  consegnato: 'Consegnato',
  annullato: 'Annullato',
  rimborsato: 'Rimborsato',
};

export const TIPI_CONSEGNA = ['ritiro_in_negozio', 'spedizione'] as const;

export type TipoConsegna = (typeof TIPI_CONSEGNA)[number];

export const ETICHETTE_TIPO_CONSEGNA: Readonly<Record<TipoConsegna, string>> = {
  ritiro_in_negozio: 'Ritiro in negozio',
  spedizione: 'Spedizione a domicilio',
};

/**
 * Tipi di consegna che il cliente può scegliere oggi.
 *
 * La spedizione a domicilio è prevista dal modello dati ma non attivabile:
 * corriere, costi e zone non sono ancora definiti. Quando lo saranno, basterà
 * aggiungerla qui.
 */
export const CONSEGNE_DISPONIBILI: readonly TipoConsegna[] = ['ritiro_in_negozio'];

/** Prodotti diversi ammessi in un ordine: un carrello, non un grossista. */
export const RIGHE_MASSIME_PER_ORDINE = 30;

/** Pezzi massimi dello stesso prodotto in un ordine. */
export const PEZZI_MASSIMI_PER_RIGA = 20;

/**
 * Giorni di recesso per gli acquisti online dei consumatori. È un diritto di
 * legge, non un'impostazione del salone: il titolare non lo può ridurre.
 */
export const GIORNI_RECESSO = 14;

/** Minuti predefiniti entro cui pagare un ordine, se l'installazione non li definisce. */
export const MINUTI_BLOCCO_ORDINE_PREDEFINITO = 20;

/**
 * Totale delle righe di un ordine, in centesimi. Vive nel pacchetto condiviso
 * perché il cliente deve vedere nel carrello lo stesso importo che il server
 * registra sull'ordine.
 */
export function totaleOrdine(
  righe: readonly { prezzoCentesimi: number; quantita: number }[],
): number {
  return righe.reduce((totale, riga) => totale + riga.prezzoCentesimi * riga.quantita, 0);
}

export interface ImportiOrdine {
  totaleRigheCentesimi: number;
  speseConsegnaCentesimi: number;
  /** Parte coperta dal credito del cliente. */
  creditoUsatoCentesimi: number;
  /** Differenza da pagare al fornitore: zero se il credito copre tutto. */
  daPagareCentesimi: number;
}

/**
 * Importi di un ordine, già ripartiti fra credito del cliente e residuo da
 * pagare. Il credito copre quello che può, con la stessa regola della caparra:
 * se la differenza scendesse sotto il minimo accettato dal fornitore si usa un
 * po' meno credito, perché un pagamento da pochi centesimi verrebbe rifiutato.
 */
export function importiOrdine(parametri: {
  righe: readonly { prezzoCentesimi: number; quantita: number }[];
  speseConsegnaCentesimi?: number;
  saldoCredito?: number;
}): ImportiOrdine {
  const totaleRigheCentesimi = totaleOrdine(parametri.righe);
  const speseConsegnaCentesimi = parametri.speseConsegnaCentesimi ?? 0;
  const dovuto = totaleRigheCentesimi + speseConsegnaCentesimi;
  const creditoUsatoCentesimi = creditoDaUsare(dovuto, parametri.saldoCredito ?? 0);

  return {
    totaleRigheCentesimi,
    speseConsegnaCentesimi,
    creditoUsatoCentesimi,
    daPagareCentesimi: dovuto - creditoUsatoCentesimi,
  };
}

/**
 * Transizioni di stato ammesse.
 *
 * Il passaggio da `in_attesa_pagamento` a `pagato` lo compie solo l'evento
 * firmato del fornitore; gli altri li compie il personale. `spedito` è
 * raggiungibile dal modello ma nessuna azione lo produce finché la spedizione
 * a domicilio non sarà definita.
 */
const TRANSIZIONI: Readonly<Record<StatoOrdine, readonly StatoOrdine[]>> = {
  in_attesa_pagamento: ['pagato', 'annullato'],
  pagato: ['in_preparazione', 'annullato'],
  in_preparazione: ['pronto_per_ritiro', 'spedito', 'annullato'],
  pronto_per_ritiro: ['consegnato', 'annullato'],
  spedito: ['consegnato', 'annullato'],
  consegnato: ['rimborsato'],
  annullato: ['rimborsato'],
  rimborsato: [],
};

export function transizioneOrdineAmmessa(da: StatoOrdine, a: StatoOrdine): boolean {
  return TRANSIZIONI[da].includes(a);
}

/** Stati in cui i pezzi dell'ordine sono fuori dalla giacenza disponibile. */
export const STATI_ORDINE_CHE_IMPEGNANO_LA_GIACENZA: readonly StatoOrdine[] = [
  'in_attesa_pagamento',
  'pagato',
  'in_preparazione',
  'pronto_per_ritiro',
  'spedito',
  'consegnato',
];

/** Momento entro cui il cliente può esercitare il recesso. */
export function scadenzaRecesso(consegnatoIl: Date): Date {
  const scadenza = new Date(consegnatoIl);
  scadenza.setDate(scadenza.getDate() + GIORNI_RECESSO);

  return scadenza;
}

/**
 * Vero quando il cliente può ancora chiedere il reso: l'ordine è stato
 * consegnato e i quattordici giorni non sono passati. Un ordine mai consegnato
 * non si rende, si annulla.
 */
export function recessoAperto(parametri: {
  stato: StatoOrdine;
  consegnatoIl: Date | null;
  adesso: Date;
}): boolean {
  if (parametri.stato !== 'consegnato' || !parametri.consegnatoIl) {
    return false;
  }

  return parametri.adesso.getTime() <= scadenzaRecesso(parametri.consegnatoIl).getTime();
}

export const STATI_RICHIESTA_RESO = ['richiesto', 'approvato', 'rifiutato', 'rimborsato'] as const;

export type StatoRichiestaReso = (typeof STATI_RICHIESTA_RESO)[number];

export const ETICHETTE_STATO_RESO: Readonly<Record<StatoRichiestaReso, string>> = {
  richiesto: 'Da valutare',
  approvato: 'Approvato, in attesa della merce',
  rifiutato: 'Rifiutato',
  rimborsato: 'Rimborsato',
};

/**
 * Rimborso dovuto su un reso, in centesimi.
 *
 * Si rimborsa il prezzo dei pezzi resi. Le spese di consegna restano fuori:
 * il ritiro in negozio non ne ha, e per la spedizione la regola andrà decisa
 * quando corriere e costi saranno definiti.
 */
export function rimborsoDovuto(
  righeRese: readonly { prezzoCentesimi: number; quantita: number }[],
): number {
  return totaleOrdine(righeRese);
}
