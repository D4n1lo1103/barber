import type {
  Appuntamento,
  AppuntamentoCliente,
  Assenza,
  Chiusura,
  Cliente,
  DatiAnnullamentoDaPersonale,
  DatiCreazioneAppuntamento,
  DatiCreazioneAssenza,
  DatiCreazioneChiusura,
  DatiCreazioneCliente,
  DatiCreazioneDipendente,
  DatiCreazioneServizio,
  DatiEsitoFinto,
  DatiImpostazioniWhatsapp,
  DatiEvasioneRichiesta,
  DatiModificaCliente,
  DatiModificaProfilo,
  DatiPrenotazioneCliente,
  DatiRegistrazioneCliente,
  DatiRegoleSalone,
  DatiRestituzioneDiscrezionale,
  DatiModificaServizio,
  DatiRimozioneChiusura,
  DatiSpostamentoAppuntamento,
  ConfigurazionePagamenti,
  DisponibilitaGiorno,
  ElencoClienti,
  EsitoRegistrazione,
  EsitoInvioDiProva,
  EsitoRichiestaCodice,
  EsportazioneDati,
  FasciaSettimanale,
  Operatore,
  PagamentoDaCompletare,
  ProfiloCliente,
  RegoleSalone,
  RichiestaCancellazione,
  Servizio,
  StatoWhatsapp,
  SituazioneCaparre,
} from '@barber/shared';
import { chiamaApi } from './client-api';

// ─── Servizi ──────────────────────────────────────────────────────────────────

export function leggiServizi(): Promise<{ servizi: Servizio[] }> {
  return chiamaApi<{ servizi: Servizio[] }>('/servizi');
}

export function creaServizio(dati: DatiCreazioneServizio): Promise<Servizio> {
  return chiamaApi<Servizio>('/servizi', { metodo: 'POST', corpo: dati });
}

export function modificaServizio(id: string, dati: DatiModificaServizio): Promise<Servizio> {
  return chiamaApi<Servizio>(`/servizi/${id}`, { metodo: 'PATCH', corpo: dati });
}

export function disattivaServizio(id: string): Promise<Servizio> {
  return chiamaApi<Servizio>(`/servizi/${id}`, { metodo: 'DELETE' });
}

// ─── Personale ────────────────────────────────────────────────────────────────

export function leggiPersonale(): Promise<{ personale: Operatore[] }> {
  return chiamaApi<{ personale: Operatore[] }>('/personale');
}

export function creaDipendente(
  dati: DatiCreazioneDipendente,
): Promise<{ operatore: Operatore; token: string; scadeIl: string }> {
  return chiamaApi('/personale', { metodo: 'POST', corpo: dati });
}

export function disattivaOperatore(id: string): Promise<Operatore> {
  return chiamaApi<Operatore>(`/personale/${id}`, { metodo: 'DELETE' });
}

export function riattivaOperatore(id: string): Promise<Operatore> {
  return chiamaApi<Operatore>(`/personale/${id}/riattivazione`, { metodo: 'POST' });
}

export function rigeneraInvito(id: string): Promise<{ token: string; scadeIl: string }> {
  return chiamaApi(`/personale/${id}/invito`, { metodo: 'POST' });
}

export function attivaAccount(token: string, password: string, email?: string): Promise<void> {
  return chiamaApi<void>('/autenticazione/attivazione', {
    metodo: 'POST',
    corpo: { token, password, email },
  });
}

// ─── Orari ────────────────────────────────────────────────────────────────────

export function leggiOrariApertura(): Promise<{ fasce: FasciaSettimanale[] }> {
  return chiamaApi<{ fasce: FasciaSettimanale[] }>('/orari/apertura');
}

export function salvaOrariApertura(
  fasce: FasciaSettimanale[],
): Promise<{ fasce: FasciaSettimanale[] }> {
  return chiamaApi('/orari/apertura', { metodo: 'PUT', corpo: { fasce } });
}

export function leggiOrariOperatore(operatoreId: string): Promise<{ fasce: FasciaSettimanale[] }> {
  return chiamaApi(`/orari/operatori/${operatoreId}`);
}

export function salvaOrariOperatore(
  operatoreId: string,
  fasce: FasciaSettimanale[],
): Promise<{ fasce: FasciaSettimanale[] }> {
  return chiamaApi(`/orari/operatori/${operatoreId}`, { metodo: 'PUT', corpo: { fasce } });
}

export function leggiAssenze(operatoreId?: string): Promise<{ assenze: Assenza[] }> {
  const parametri = operatoreId ? `?operatoreId=${encodeURIComponent(operatoreId)}` : '';

  return chiamaApi(`/orari/assenze${parametri}`);
}

export function creaAssenza(dati: DatiCreazioneAssenza): Promise<Assenza> {
  return chiamaApi<Assenza>('/orari/assenze', { metodo: 'POST', corpo: dati });
}

export function rimuoviAssenza(id: string): Promise<void> {
  return chiamaApi<void>(`/orari/assenze/${id}`, { metodo: 'DELETE' });
}

// ─── Chiusure del salone ──────────────────────────────────────────────────────

export function leggiChiusure(): Promise<{ chiusure: Chiusura[] }> {
  return chiamaApi('/orari/chiusure');
}

export function creaChiusura(dati: DatiCreazioneChiusura): Promise<Chiusura> {
  return chiamaApi<Chiusura>('/orari/chiusure', { metodo: 'POST', corpo: dati });
}

export function rimuoviChiusura(dati: DatiRimozioneChiusura): Promise<void> {
  return chiamaApi<void>('/orari/chiusure', { metodo: 'DELETE', corpo: dati });
}

// ─── Clienti ──────────────────────────────────────────────────────────────────

export function leggiClienti(dati: {
  cerca?: string;
  pagina?: number;
  perPagina?: number;
}): Promise<ElencoClienti> {
  const parametri = new URLSearchParams();

  if (dati.cerca) {
    parametri.set('cerca', dati.cerca);
  }

  if (dati.pagina) {
    parametri.set('pagina', String(dati.pagina));
  }

  if (dati.perPagina) {
    parametri.set('perPagina', String(dati.perPagina));
  }

  const query = parametri.toString();

  return chiamaApi<ElencoClienti>(`/clienti${query ? `?${query}` : ''}`);
}

export function leggiCliente(id: string): Promise<Cliente> {
  return chiamaApi<Cliente>(`/clienti/${id}`);
}

export function creaCliente(
  dati: DatiCreazioneCliente,
): Promise<{ cliente: Cliente; token: string; scadeIl: string }> {
  return chiamaApi('/clienti', { metodo: 'POST', corpo: dati });
}

export function modificaCliente(id: string, dati: DatiModificaCliente): Promise<Cliente> {
  return chiamaApi<Cliente>(`/clienti/${id}`, { metodo: 'PATCH', corpo: dati });
}

export function rigeneraInvitoCliente(id: string): Promise<{ token: string; scadeIl: string }> {
  return chiamaApi(`/clienti/${id}/invito`, { metodo: 'POST' });
}

// ─── Appuntamenti ─────────────────────────────────────────────────────────────

export function leggiAppuntamenti(dati: {
  dal: string;
  giorni: number;
  operatoreId?: string;
}): Promise<{ appuntamenti: Appuntamento[] }> {
  const parametri = new URLSearchParams({ dal: dati.dal, giorni: String(dati.giorni) });

  if (dati.operatoreId) {
    parametri.set('operatoreId', dati.operatoreId);
  }

  return chiamaApi(`/appuntamenti?${parametri.toString()}`);
}

export function leggiStoricoCliente(clienteId: string): Promise<{ appuntamenti: Appuntamento[] }> {
  return chiamaApi(`/appuntamenti/cliente/${clienteId}`);
}

export function leggiDisponibilita(dati: {
  operatoreId: string;
  servizioIds: string[];
  dal: string;
  giorni?: number;
  escludiAppuntamentoId?: string;
}): Promise<{ giorni: DisponibilitaGiorno[] }> {
  const parametri = new URLSearchParams({
    operatoreId: dati.operatoreId,
    servizioIds: dati.servizioIds.join(','),
    dal: dati.dal,
    giorni: String(dati.giorni ?? 1),
  });

  if (dati.escludiAppuntamentoId) {
    parametri.set('escludiAppuntamentoId', dati.escludiAppuntamentoId);
  }

  return chiamaApi(`/appuntamenti/disponibilita?${parametri.toString()}`);
}

export function creaAppuntamento(dati: DatiCreazioneAppuntamento): Promise<Appuntamento> {
  return chiamaApi<Appuntamento>('/appuntamenti', { metodo: 'POST', corpo: dati });
}

/** Un singolo appuntamento, per ricaricarlo dopo un'operazione. */
export function leggiAppuntamento(id: string): Promise<Appuntamento> {
  return chiamaApi<Appuntamento>(`/appuntamenti/${id}`);
}

export function spostaAppuntamento(
  id: string,
  dati: DatiSpostamentoAppuntamento,
): Promise<Appuntamento> {
  return chiamaApi<Appuntamento>(`/appuntamenti/${id}/spostamento`, {
    metodo: 'POST',
    corpo: dati,
  });
}

export function annullaAppuntamento(
  id: string,
  dati: DatiAnnullamentoDaPersonale,
): Promise<Appuntamento> {
  return chiamaApi<Appuntamento>(`/appuntamenti/${id}/annullamento`, {
    metodo: 'POST',
    corpo: dati,
  });
}

export function segnaMancataPresentazione(id: string): Promise<Appuntamento> {
  return chiamaApi<Appuntamento>(`/appuntamenti/${id}/mancata-presentazione`, { metodo: 'POST' });
}

export function completaAppuntamento(id: string): Promise<Appuntamento> {
  return chiamaApi<Appuntamento>(`/appuntamenti/${id}/completamento`, { metodo: 'POST' });
}

// ─── Registrazione, verifica e password ───────────────────────────────────────

export function registraCliente(dati: DatiRegistrazioneCliente): Promise<EsitoRegistrazione> {
  return chiamaApi('/autenticazione/registrazione', { metodo: 'POST', corpo: dati });
}

export function verificaEmail(token: string): Promise<void> {
  return chiamaApi<void>('/autenticazione/verifica-email', { metodo: 'POST', corpo: { token } });
}

export function rinviaVerificaEmail(email: string): Promise<void> {
  return chiamaApi<void>('/autenticazione/verifica-email/rinvio', {
    metodo: 'POST',
    corpo: { email },
  });
}

export function richiediResetPassword(email: string): Promise<void> {
  return chiamaApi<void>('/autenticazione/reset-password', { metodo: 'POST', corpo: { email } });
}

export function confermaResetPassword(token: string, password: string): Promise<void> {
  return chiamaApi<void>('/autenticazione/reset-password/conferma', {
    metodo: 'POST',
    corpo: { token, password },
  });
}

// ─── Regole del salone ────────────────────────────────────────────────────────

export function leggiRegole(): Promise<RegoleSalone> {
  return chiamaApi<RegoleSalone>('/impostazioni/regole');
}

export function salvaRegole(dati: DatiRegoleSalone): Promise<RegoleSalone> {
  return chiamaApi<RegoleSalone>('/impostazioni/regole', { metodo: 'PUT', corpo: dati });
}

// ─── Richieste di cancellazione (titolare) ────────────────────────────────────

export function leggiRichiesteCancellazione(): Promise<{ richieste: RichiestaCancellazione[] }> {
  return chiamaApi('/cancellazioni');
}

export function evadiRichiestaCancellazione(
  id: string,
  dati: DatiEvasioneRichiesta,
): Promise<RichiestaCancellazione> {
  return chiamaApi(`/cancellazioni/${id}/evasione`, { metodo: 'POST', corpo: dati });
}

// ─── Area cliente ─────────────────────────────────────────────────────────────

export function leggiCatalogoCliente(): Promise<{ servizi: Servizio[]; operatori: Operatore[] }> {
  return chiamaApi('/area-cliente/catalogo');
}

export function leggiAppuntamentiCliente(): Promise<{ appuntamenti: AppuntamentoCliente[] }> {
  return chiamaApi('/area-cliente/appuntamenti');
}

export function leggiDisponibilitaCliente(dati: {
  operatoreId: string;
  servizioIds: string[];
  dal: string;
  giorni?: number;
  escludiAppuntamentoId?: string;
}): Promise<{ giorni: DisponibilitaGiorno[] }> {
  const parametri = new URLSearchParams({
    operatoreId: dati.operatoreId,
    servizioIds: dati.servizioIds.join(','),
    dal: dati.dal,
    giorni: String(dati.giorni ?? 1),
  });

  if (dati.escludiAppuntamentoId) {
    parametri.set('escludiAppuntamentoId', dati.escludiAppuntamentoId);
  }

  return chiamaApi(`/area-cliente/disponibilita?${parametri.toString()}`);
}

export function prenotaComeCliente(
  dati: DatiPrenotazioneCliente,
): Promise<{ appuntamento: AppuntamentoCliente }> {
  return chiamaApi('/area-cliente/appuntamenti', { metodo: 'POST', corpo: dati });
}

export function spostaAppuntamentoCliente(
  id: string,
  inizio: string,
): Promise<{ appuntamento: AppuntamentoCliente }> {
  return chiamaApi(`/area-cliente/appuntamenti/${id}/spostamento`, {
    metodo: 'POST',
    corpo: { inizio },
  });
}

export function annullaAppuntamentoCliente(
  id: string,
): Promise<{ appuntamento: AppuntamentoCliente }> {
  return chiamaApi(`/area-cliente/appuntamenti/${id}/annullamento`, { metodo: 'POST' });
}

export function leggiProfiloCliente(): Promise<ProfiloCliente> {
  return chiamaApi<ProfiloCliente>('/area-cliente/profilo');
}

export function modificaProfiloCliente(dati: DatiModificaProfilo): Promise<ProfiloCliente> {
  return chiamaApi<ProfiloCliente>('/area-cliente/profilo', { metodo: 'PATCH', corpo: dati });
}

export function esportaDatiCliente(): Promise<EsportazioneDati> {
  return chiamaApi<EsportazioneDati>('/area-cliente/dati');
}

export function leggiRichiestaCancellazione(): Promise<{
  richiesta: RichiestaCancellazione | null;
}> {
  return chiamaApi('/area-cliente/cancellazione');
}

export function richiediCancellazioneDati(motivo: string): Promise<RichiestaCancellazione> {
  return chiamaApi('/area-cliente/cancellazione', { metodo: 'POST', corpo: { motivo } });
}

// ─── Messaggi WhatsApp ────────────────────────────────────────────────────────

export function leggiImpostazioniWhatsapp(): Promise<StatoWhatsapp> {
  return chiamaApi('/impostazioni/whatsapp');
}

export function salvaImpostazioniWhatsapp(dati: DatiImpostazioniWhatsapp): Promise<StatoWhatsapp> {
  return chiamaApi('/impostazioni/whatsapp', { metodo: 'PUT', corpo: dati });
}

/** Invio di prova, per verificare la configurazione dei messaggi. */
export function inviaProvaWhatsapp(numeroWhatsapp: string): Promise<EsitoInvioDiProva> {
  return chiamaApi('/impostazioni/whatsapp/prova', {
    metodo: 'POST',
    corpo: { numeroWhatsapp },
  });
}

/** Chiede il codice per verificare il proprio numero. */
export function chiediCodiceNumero(): Promise<EsitoRichiestaCodice> {
  return chiamaApi('/area-cliente/numero/codice', { metodo: 'POST' });
}

export function confermaCodiceNumero(codice: string): Promise<void> {
  return chiamaApi('/area-cliente/numero/verifica', { metodo: 'POST', corpo: { codice } });
}

// ─── Pagamenti ────────────────────────────────────────────────────────────────

export function leggiConfigurazionePagamenti(): Promise<ConfigurazionePagamenti> {
  return chiamaApi('/pagamenti/configurazione');
}

/** Apre il pagamento della caparra e restituisce l'indirizzo del fornitore. */
export function avviaPagamentoCaparra(appuntamentoId: string): Promise<PagamentoDaCompletare> {
  return chiamaApi(`/pagamenti/appuntamenti/${appuntamentoId}`, { metodo: 'POST' });
}

/** Restituzione discrezionale di una caparra trattenuta: solo il titolare. */
export function restituisciCaparra(
  appuntamentoId: string,
  dati: DatiRestituzioneDiscrezionale,
): Promise<void> {
  return chiamaApi(`/pagamenti/appuntamenti/${appuntamentoId}/restituzione`, {
    metodo: 'POST',
    corpo: dati,
  });
}

/** Movimenti della caparra e credito di un cliente: solo per il titolare. */
export function leggiSituazioneCaparre(clienteId: string): Promise<SituazioneCaparre> {
  return chiamaApi(`/pagamenti/clienti/${clienteId}/situazione`);
}

/** Esito scelto sulla pagina di pagamento finta: esiste solo in sviluppo. */
export function comunicaEsitoFinto(dati: DatiEsitoFinto): Promise<void> {
  return chiamaApi('/pagamenti/finto/esito', { metodo: 'POST', corpo: dati });
}
