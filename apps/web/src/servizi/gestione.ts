import type {
  Assenza,
  DatiCreazioneAssenza,
  DatiCreazioneDipendente,
  DatiCreazioneServizio,
  DatiModificaServizio,
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
