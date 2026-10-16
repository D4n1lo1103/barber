import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chiamaApi, ErroreApi, leggiTokenCsrf } from './client-api';

describe('client API', () => {
  const chiamataFinta = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', chiamataFinta);
    document.cookie = 'csrf=token-di-prova';
  });

  afterEach(() => {
    chiamataFinta.mockReset();
    document.cookie = 'csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  function rispostaFinta(stato: number, corpo?: unknown) {
    return {
      ok: stato >= 200 && stato < 300,
      status: stato,
      json: () => Promise.resolve(corpo),
    } as Response;
  }

  it('legge il token CSRF dal cookie', () => {
    expect(leggiTokenCsrf()).toBe('token-di-prova');
  });

  it('invia i cookie e non aggiunge il token CSRF alle richieste di lettura', async () => {
    chiamataFinta.mockResolvedValue(rispostaFinta(200, { utente: { nome: 'Luca' } }));

    await chiamaApi('/autenticazione/io');

    const opzioni = chiamataFinta.mock.calls[0]![1];
    expect(opzioni.credentials).toBe('include');
    expect(opzioni.headers['x-csrf-token']).toBeUndefined();
  });

  it('aggiunge il token CSRF alle richieste che modificano dati', async () => {
    chiamataFinta.mockResolvedValue(rispostaFinta(204));

    await chiamaApi('/autenticazione/uscita', { metodo: 'POST' });

    const opzioni = chiamataFinta.mock.calls[0]![1];
    expect(opzioni.headers['x-csrf-token']).toBe('token-di-prova');
  });

  it('riporta il messaggio di errore dell API', async () => {
    chiamataFinta.mockResolvedValue(rispostaFinta(401, { message: 'Credenziali non valide.' }));

    await expect(
      chiamaApi('/autenticazione/accesso', { metodo: 'POST', corpo: {} }),
    ).rejects.toThrow('Credenziali non valide.');
  });

  it('riporta gli errori per campo della validazione', async () => {
    chiamataFinta.mockResolvedValue(
      rispostaFinta(400, {
        messaggio: 'Dati non validi.',
        errori: [{ campo: 'email', messaggio: 'E-mail non valida.' }],
      }),
    );

    await expect(
      chiamaApi('/autenticazione/accesso', { metodo: 'POST', corpo: {} }),
    ).rejects.toMatchObject({
      stato: 400,
      errori: [{ campo: 'email', messaggio: 'E-mail non valida.' }],
    });
  });

  it('segnala in modo leggibile l assenza di connessione', async () => {
    chiamataFinta.mockRejectedValue(new TypeError('Failed to fetch'));

    const errore = await chiamaApi('/stato').catch((problema: unknown) => problema);

    expect(errore).toBeInstanceOf(ErroreApi);
    expect((errore as ErroreApi).message).toContain('Connessione non disponibile');
  });
});
