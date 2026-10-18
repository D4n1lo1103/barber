import type { MotivoAnnullamento } from './appuntamento.js';

/** Forma con cui il salone restituisce una caparra. */
export const FORME_RESTITUZIONE = ['rimborso', 'credito'] as const;

export type FormaRestituzione = (typeof FORME_RESTITUZIONE)[number];

export const ETICHETTE_FORMA_RESTITUZIONE: Readonly<Record<FormaRestituzione, string>> = {
  rimborso: 'Rimborso sul metodo di pagamento',
  credito: 'Credito a favore del cliente',
};

/** Tipi di movimento della caparra: insieme formano il registro di audit. */
export const TIPI_MOVIMENTO_CAPARRA = [
  'pagata',
  'rimborsata',
  'convertita_in_credito',
  'trattenuta',
  'scalata',
  'restituita_discrezionale',
] as const;

export type TipoMovimentoCaparra = (typeof TIPI_MOVIMENTO_CAPARRA)[number];

export const ETICHETTE_MOVIMENTO_CAPARRA: Readonly<Record<TipoMovimentoCaparra, string>> = {
  pagata: 'Caparra pagata',
  rimborsata: 'Caparra rimborsata',
  convertita_in_credito: 'Caparra convertita in credito',
  trattenuta: 'Caparra trattenuta',
  scalata: 'Caparra scalata dal totale',
  restituita_discrezionale: 'Caparra restituita dal titolare',
};

/** Stati di un pagamento presso il fornitore. */
export const STATI_PAGAMENTO = [
  'avviato',
  'riuscito',
  'fallito',
  'annullato',
  'rimborsato',
] as const;

export type StatoPagamento = (typeof STATI_PAGAMENTO)[number];

export const ETICHETTE_STATO_PAGAMENTO: Readonly<Record<StatoPagamento, string>> = {
  avviato: 'In attesa di pagamento',
  riuscito: 'Pagata',
  fallito: 'Pagamento non riuscito',
  annullato: 'Pagamento annullato',
  rimborsato: 'Rimborsata',
};

/** Percentuale predefinita della caparra, se l'installazione non la definisce. */
export const CAPARRA_PERCENTUALE_PREDEFINITA = 50;

/**
 * Caparra dovuta su un prezzo, in centesimi. L'arrotondamento è al centesimo
 * più vicino e l'importo non supera mai il prezzo dei servizi.
 */
export function calcolaCaparra(prezzoTotaleCentesimi: number, percentuale: number): number {
  if (prezzoTotaleCentesimi <= 0 || percentuale <= 0) {
    return 0;
  }

  return Math.min(prezzoTotaleCentesimi, Math.round((prezzoTotaleCentesimi * percentuale) / 100));
}

/**
 * Importo minimo che un pagamento con carta può avere, in centesimi.
 * Sotto questa soglia il fornitore rifiuta l'operazione, quindi non si può
 * chiedere al cliente di pagare la differenza.
 */
export const MINIMO_PAGABILE_CENTESIMI = 50;

/**
 * Quanto credito usare su una caparra dovuta.
 *
 * Il credito copre una parte della caparra e il resto si paga con carta, così
 * non resta credito fermo. Se però la differenza da pagare scendesse sotto il
 * minimo accettato dal fornitore, si usa un po' meno credito e si lascia da
 * pagare esattamente il minimo: un pagamento da pochi centesimi verrebbe
 * rifiutato. Quando il credito basta a coprire tutto, la carta non serve.
 */
export function creditoDaUsare(caparraCentesimi: number, saldoCredito: number): number {
  if (caparraCentesimi <= 0 || saldoCredito <= 0) {
    return 0;
  }

  if (saldoCredito >= caparraCentesimi) {
    return caparraCentesimi;
  }

  const massimoUtilizzabile = caparraCentesimi - MINIMO_PAGABILE_CENTESIMI;

  return Math.max(0, Math.min(saldoCredito, massimoUtilizzabile));
}

/** Residuo da saldare in negozio: il prezzo meno la caparra già pagata. */
export function residuoDaSaldare(prezzoTotaleCentesimi: number, caparraPagata: number): number {
  return Math.max(0, prezzoTotaleCentesimi - caparraPagata);
}

/**
 * Che fine fa la caparra già pagata quando l'appuntamento viene annullato.
 *
 * Le regole sono quelle dei requisiti e non sono configurabili, tranne la
 * forma della restituzione per l'annullamento tempestivo, che il titolare
 * sceglie fra rimborso e credito:
 *
 * - **tempestivo**: restituita nella forma scelta dal salone;
 * - **tardivo** e **mancata presentazione**: trattenuta;
 * - **dal salone**: rimborsata per intero, sempre;
 * - **pagamento non completato**: non c'è nulla da restituire.
 */
export function trattamentoDellaCaparra(parametri: {
  motivo: MotivoAnnullamento;
  forma: FormaRestituzione;
}): 'rimborsata' | 'convertita_in_credito' | 'trattenuta' | 'nessuno' {
  switch (parametri.motivo) {
    case 'tempestivo':
      return parametri.forma === 'credito' ? 'convertita_in_credito' : 'rimborsata';
    case 'dal_salone':
      return 'rimborsata';
    case 'tardivo':
      return 'trattenuta';
    case 'pagamento_non_completato':
      return 'nessuno';
  }
}

/** Un movimento, ridotto a ciò che serve per i totali. */
export interface MovimentoPerTotali {
  tipo: TipoMovimentoCaparra;
  importoCentesimi: number;
}

/**
 * Caparra entrata e non ancora restituita, calcolata dai movimenti.
 *
 * «trattenuta» e «scalata» non restituiscono denaro al cliente: la caparra
 * resta al salone, quindi non riducono l'importo pagato.
 */
export function caparraPagataDaMovimenti(movimenti: readonly MovimentoPerTotali[]): number {
  return movimenti.reduce((totale, movimento) => {
    switch (movimento.tipo) {
      case 'pagata':
        return totale + movimento.importoCentesimi;
      case 'rimborsata':
      case 'convertita_in_credito':
      case 'restituita_discrezionale':
        return totale - movimento.importoCentesimi;
      default:
        return totale;
    }
  }, 0);
}

/** Caparra trattenuta dal salone e non più restituita. */
export function caparraTrattenutaDaMovimenti(movimenti: readonly MovimentoPerTotali[]): number {
  const somma = (tipo: TipoMovimentoCaparra) =>
    movimenti
      .filter((movimento) => movimento.tipo === tipo)
      .reduce((totale, movimento) => totale + movimento.importoCentesimi, 0);

  return Math.max(0, somma('trattenuta') - somma('restituita_discrezionale'));
}

/** Il movimento aumenta il credito del cliente. */
export function accreditaCredito(tipo: TipoMovimentoCaparra): boolean {
  return tipo === 'convertita_in_credito';
}
