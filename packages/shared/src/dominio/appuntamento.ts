/** Stati del ciclo di vita di un appuntamento. */
export const STATI_APPUNTAMENTO = [
  'in_attesa_pagamento',
  'confermato',
  'completato',
  'annullato',
  'mancata_presentazione',
] as const;

export type StatoAppuntamento = (typeof STATI_APPUNTAMENTO)[number];

/** Motivo dell'annullamento, determina il trattamento della caparra. */
export const MOTIVI_ANNULLAMENTO = [
  'tempestivo',
  'tardivo',
  'dal_salone',
  'pagamento_non_completato',
] as const;

export type MotivoAnnullamento = (typeof MOTIVI_ANNULLAMENTO)[number];

/**
 * Motivi che il personale può indicare registrando un annullamento:
 * `pagamento_non_completato` lo imposta solo il sistema alla scadenza del blocco.
 */
export const MOTIVI_ANNULLAMENTO_DA_PERSONALE = ['tempestivo', 'tardivo', 'dal_salone'] as const;

export type MotivoAnnullamentoDaPersonale = (typeof MOTIVI_ANNULLAMENTO_DA_PERSONALE)[number];

export const ETICHETTE_STATO: Readonly<Record<StatoAppuntamento, string>> = {
  in_attesa_pagamento: 'In attesa di pagamento',
  confermato: 'Confermato',
  completato: 'Completato',
  annullato: 'Annullato',
  mancata_presentazione: 'Mancata presentazione',
};

export const ETICHETTE_MOTIVO_ANNULLAMENTO: Readonly<Record<MotivoAnnullamento, string>> = {
  tempestivo: 'Annullamento tempestivo',
  tardivo: 'Annullamento tardivo',
  dal_salone: 'Annullato dal salone',
  pagamento_non_completato: 'Pagamento non completato',
};

/**
 * Stati che occupano lo slot in agenda: su questi il database applica il
 * vincolo di esclusione contro le doppie prenotazioni.
 */
export const STATI_CHE_OCCUPANO_LO_SLOT = [
  'in_attesa_pagamento',
  'confermato',
  'completato',
  'mancata_presentazione',
] as const satisfies readonly StatoAppuntamento[];

export function occupaLoSlot(stato: StatoAppuntamento): boolean {
  return (STATI_CHE_OCCUPANO_LO_SLOT as readonly StatoAppuntamento[]).includes(stato);
}

/** Massimo numero di giorni nel futuro per cui si può prenotare. */
export const GIORNI_MASSIMI_PRENOTAZIONE = 60;

/** Preavviso minimo per la prenotazione online del cliente, in ore. */
export const ORE_MINIME_PRENOTAZIONE_CLIENTE = 2;

/**
 * Giorni nel passato entro cui il personale può registrare un appuntamento già
 * avvenuto, per regolarizzare l'agenda.
 */
export const GIORNI_PASSATO_PERSONALE = 7;

/** Numero massimo di servizi in un solo appuntamento. */
export const SERVIZI_MASSIMI_PER_APPUNTAMENTO = 6;

/** Limite di preavviso predefinito, in ore, se l'installazione non lo definisce. */
export const ORE_LIMITE_PREAVVISO_PREDEFINITO = 24;

/**
 * Un annullamento è tempestivo se arriva almeno `oreLimitePreavviso` prima
 * dell'inizio dell'appuntamento; dopo è tardivo.
 */
export function annullamentoTempestivo(
  inizio: Date,
  adesso: Date,
  oreLimitePreavviso: number,
): boolean {
  return inizio.getTime() - adesso.getTime() >= oreLimitePreavviso * 60 * 60 * 1000;
}

/**
 * Cosa può fare il cliente dall'app su un appuntamento.
 *
 * Dopo il limite di preavviso il pulsante di annullamento non è più
 * disponibile: il cliente deve contattare il salone, che registra
 * l'annullamento tardivo. Lo spostamento segue la regola scelta dal titolare:
 * se è trattato come un annullamento vale lo stesso limite, altrimenti è
 * libero solo entro il limite.
 */
export function azioniDelCliente(parametri: {
  stato: StatoAppuntamento;
  inizio: Date;
  adesso: Date;
  oreLimitePreavviso: number;
}): { puoAnnullare: boolean; puoSpostare: boolean } {
  const { stato, inizio, adesso, oreLimitePreavviso } = parametri;
  const modificabile = stato === 'confermato' || stato === 'in_attesa_pagamento';
  const entroIlPreavviso = annullamentoTempestivo(inizio, adesso, oreLimitePreavviso);
  const consentito = modificabile && entroIlPreavviso;

  return { puoAnnullare: consentito, puoSpostare: consentito };
}

/**
 * Transizioni di stato ammesse. Il pagamento della caparra (fase 6) porta da
 * `in_attesa_pagamento` a `confermato`; gli altri passaggi li compie il
 * personale dall'agenda.
 */
const TRANSIZIONI: Readonly<Record<StatoAppuntamento, readonly StatoAppuntamento[]>> = {
  in_attesa_pagamento: ['confermato', 'annullato'],
  confermato: ['completato', 'annullato', 'mancata_presentazione'],
  completato: [],
  annullato: [],
  mancata_presentazione: [],
};

export function transizioneAmmessa(da: StatoAppuntamento, a: StatoAppuntamento): boolean {
  return TRANSIZIONI[da].includes(a);
}
