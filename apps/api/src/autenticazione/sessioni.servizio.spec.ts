import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { SessioniServizio } from './sessioni.servizio.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function hash(valore: string): string {
  return createHash('sha256').update(valore).digest('hex');
}

describe('SessioniServizio', () => {
  const sessioneCreata =
    jest.fn<(argomenti: { data: Record<string, unknown> }) => Promise<unknown>>();
  const sessioneTrovata = jest.fn<(argomenti: unknown) => Promise<unknown>>();
  const prisma = {
    sessione: {
      create: sessioneCreata,
      findUnique: sessioneTrovata,
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const configurazione = {
    get: () => 12,
  } as unknown as ConfigService;

  const servizio = new SessioniServizio(prisma, configurazione as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('salva solo gli hash dei token, mai i token in chiaro', async () => {
    const { token, tokenCsrf } = await servizio.crea('utente-1', '127.0.0.1', 'test');
    const datiSalvati = sessioneCreata.mock.calls[0]![0].data as Record<string, string>;

    expect(datiSalvati.tokenHash).toBe(hash(token));
    expect(datiSalvati.csrfHash).toBe(hash(tokenCsrf));
    expect(JSON.stringify(datiSalvati)).not.toContain(token);
    expect(JSON.stringify(datiSalvati)).not.toContain(tokenCsrf);
  });

  it('genera token distinti e di lunghezza adeguata', async () => {
    const prima = await servizio.crea('utente-1');
    const seconda = await servizio.crea('utente-1');

    expect(prima.token).not.toBe(seconda.token);
    expect(prima.token).not.toBe(prima.tokenCsrf);
    expect(prima.token.length).toBeGreaterThanOrEqual(32);
  });

  it('calcola la scadenza dalla durata configurata', async () => {
    const { scadeIl } = await servizio.crea('utente-1');
    const oreDiDifferenza = (scadeIl.getTime() - Date.now()) / (60 * 60 * 1000);

    expect(oreDiDifferenza).toBeGreaterThan(11.9);
    expect(oreDiDifferenza).toBeLessThanOrEqual(12);
  });

  describe('verificaTokenCsrf', () => {
    const tokenCsrf = 'token-csrf-di-prova';

    it('accetta il token presente nel cookie, nell header e nella sessione', () => {
      expect(servizio.verificaTokenCsrf(tokenCsrf, tokenCsrf, hash(tokenCsrf))).toBe(true);
    });

    it('rifiuta un header che non coincide con il cookie', () => {
      expect(servizio.verificaTokenCsrf(tokenCsrf, 'altro-valore-lungo', hash(tokenCsrf))).toBe(
        false,
      );
    });

    it('rifiuta un cookie iniettato non legato alla sessione', () => {
      const iniettato = 'token-csrf-iniettato';

      expect(servizio.verificaTokenCsrf(iniettato, iniettato, hash(tokenCsrf))).toBe(false);
    });
  });

  describe('risolviSessione', () => {
    const utenteAttivo = { id: 'utente-1', attivo: true };

    it('rifiuta una sessione scaduta', async () => {
      sessioneTrovata.mockResolvedValue({
        scadeIl: new Date(Date.now() - 1000),
        revocataIl: null,
        utente: utenteAttivo,
      });

      await expect(servizio.risolviSessione('token')).resolves.toBeNull();
    });

    it('rifiuta una sessione revocata', async () => {
      sessioneTrovata.mockResolvedValue({
        scadeIl: new Date(Date.now() + 10_000),
        revocataIl: new Date(),
        utente: utenteAttivo,
      });

      await expect(servizio.risolviSessione('token')).resolves.toBeNull();
    });

    it('rifiuta la sessione di un account disattivato', async () => {
      sessioneTrovata.mockResolvedValue({
        scadeIl: new Date(Date.now() + 10_000),
        revocataIl: null,
        utente: { id: 'utente-1', attivo: false },
      });

      await expect(servizio.risolviSessione('token')).resolves.toBeNull();
    });

    it('accetta una sessione valida', async () => {
      const sessione = {
        scadeIl: new Date(Date.now() + 10_000),
        revocataIl: null,
        csrfHash: 'hash',
        utente: utenteAttivo,
      };
      sessioneTrovata.mockResolvedValue(sessione);

      await expect(servizio.risolviSessione('token')).resolves.toBe(sessione);
    });
  });
});
