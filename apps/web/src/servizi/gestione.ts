import type {
  Appuntamento,
  Assenza,
  Cliente,
  DatiAnnullamentoDaPersonale,
  DatiCreazioneAppuntamento,
  DatiCreazioneAssenza,
  DatiCreazioneCliente,
  DatiCreazioneDipendente,
  DatiCreazioneServizio,
  DatiModificaCliente,
  DatiModificaServizio,
  DatiSpostamentoAppuntamento,
  DisponibilitaGiorno,
  ElencoClienti,
  FasciaSettimanale,
  Operatore,
  Servizio,
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

export function attivaAccount(token: string, password: string): Promise<void> {
  return chiamaApi<void>('/personale/attivazione', {
    metodo: 'POST',
    corpo: { token, password },
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

export function leggiAppuntamentiCliente(
  clienteId: string,
): Promise<{ appuntamenti: Appuntamento[] }> {
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
