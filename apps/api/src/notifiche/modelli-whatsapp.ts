/**
 * Modelli dei messaggi WhatsApp, in italiano.
 *
 * Ogni modello deve essere **approvato da Meta** prima dell'uso reale: qui
 * vivono il nome con cui è registrato, la lingua e l'ordine dei parametri, che
 * devono corrispondere a quelli approvati. I testi di `anteprima` servono ai
 * log in sviluppo e al ripiego via e-mail, non vengono inviati a Meta.
 *
 * I nomi dei modelli sono configurabili dall'installazione, perché ogni salone
 * registra i propri presso il suo account Meta: questi sono i valori iniziali.
 */
import { MODELLI_WHATSAPP_PREDEFINITI, type ModelliWhatsapp } from '@barber/shared';
import type { MessaggioWhatsapp } from './mittente-whatsapp.js';

export const LINGUA_MODELLI = 'it';

/** Nomi dei modelli registrati presso Meta: li definisce il pacchetto condiviso. */
export type NomiModelliWhatsapp = ModelliWhatsapp;

export const NOMI_MODELLI_PREDEFINITI = MODELLI_WHATSAPP_PREDEFINITI;

export interface DestinatarioWhatsapp {
  nome: string;
  numeroWhatsapp: string;
}

export interface RiepilogoPerWhatsapp {
  /** Data e ora già formattate nel fuso del salone. */
  quando: string;
  servizi: string;
  operatore: string;
}

/**
 * Conferma della prenotazione.
 * Modello atteso: «Ciao {{1}}, il tuo appuntamento da {{2}} è confermato per
 * {{3}}: {{4}} con {{5}}.»
 */
export function modelloWhatsappConferma(
  nomi: NomiModelliWhatsapp,
  nomeSalone: string,
  destinatario: DestinatarioWhatsapp,
  riepilogo: RiepilogoPerWhatsapp,
): MessaggioWhatsapp {
  return {
    a: destinatario.numeroWhatsapp,
    modello: nomi.confermaPrenotazione,
    lingua: LINGUA_MODELLI,
    parametri: [
      destinatario.nome,
      nomeSalone,
      riepilogo.quando,
      riepilogo.servizi,
      riepilogo.operatore,
    ],
    anteprima:
      `Ciao ${destinatario.nome}, il tuo appuntamento da ${nomeSalone} è confermato per ` +
      `${riepilogo.quando}: ${riepilogo.servizi} con ${riepilogo.operatore}.`,
  };
}

/**
 * Promemoria prima dell'appuntamento.
 * Modello atteso: «Ciao {{1}}, ti ricordiamo l'appuntamento da {{2}} {{3}}:
 * {{4}} con {{5}}.»
 */
export function modelloWhatsappPromemoria(
  nomi: NomiModelliWhatsapp,
  nomeSalone: string,
  destinatario: DestinatarioWhatsapp,
  riepilogo: RiepilogoPerWhatsapp,
): MessaggioWhatsapp {
  return {
    a: destinatario.numeroWhatsapp,
    modello: nomi.promemoria,
    lingua: LINGUA_MODELLI,
    parametri: [
      destinatario.nome,
      nomeSalone,
      riepilogo.quando,
      riepilogo.servizi,
      riepilogo.operatore,
    ],
    anteprima:
      `Ciao ${destinatario.nome}, ti ricordiamo l'appuntamento da ${nomeSalone} ` +
      `${riepilogo.quando}: ${riepilogo.servizi} con ${riepilogo.operatore}.`,
  };
}

/**
 * Invito ad attivare l'account, per le schede create dal personale.
 * Modello atteso: «Ciao {{1}}, {{2}} ti ha creato una scheda. Attiva il tuo
 * account per prenotare online.» con pulsante che porta al link.
 */
export function modelloWhatsappInvito(
  nomi: NomiModelliWhatsapp,
  nomeSalone: string,
  destinatario: DestinatarioWhatsapp,
  collegamento: string,
): MessaggioWhatsapp {
  return {
    a: destinatario.numeroWhatsapp,
    modello: nomi.invitoAttivazione,
    lingua: LINGUA_MODELLI,
    parametri: [destinatario.nome, nomeSalone],
    // Nei modelli con pulsante Meta riceve solo la parte finale del link.
    parametroPulsante: collegamento,
    anteprima:
      `Ciao ${destinatario.nome}, ${nomeSalone} ti ha creato una scheda. ` +
      `Attiva il tuo account: ${collegamento}`,
  };
}

/**
 * Codice di verifica del numero di telefono.
 * Modello atteso (categoria «autenticazione»): «{{1}} è il tuo codice di
 * verifica.»
 */
export function modelloWhatsappVerificaNumero(
  nomi: NomiModelliWhatsapp,
  destinatario: DestinatarioWhatsapp,
  codice: string,
): MessaggioWhatsapp {
  return {
    a: destinatario.numeroWhatsapp,
    modello: nomi.verificaNumero,
    lingua: LINGUA_MODELLI,
    parametri: [codice],
    anteprima: `${codice} è il tuo codice di verifica.`,
  };
}
