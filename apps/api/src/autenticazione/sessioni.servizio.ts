import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Ambiente } from '../configurazione/ambiente.js';

/** Nome del cookie che trasporta il token di sessione. */
export const COOKIE_SESSIONE = 'sessione';
/** Nome del cookie leggibile dal frontend per la protezione CSRF. */
export const COOKIE_CSRF = 'csrf';
/** Header che il frontend deve inviare con il valore del cookie CSRF. */
export const HEADER_CSRF = 'x-csrf-token';

const BYTE_TOKEN = 32;

export interface SessioneCreata {
  token: string;
  tokenCsrf: string;
  scadeIl: Date;
}

@Injectable()
export class SessioniServizio {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configurazione: ConfigService<Ambiente, true>,
  ) {}

  /**
   * Nel database è salvato solo l'hash del token: una lettura del database
   * non permette di impersonare una sessione attiva.
   */
  private calcolaHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async crea(
    utenteId: string,
    indirizzoIp?: string,
    agenteUtente?: string,
  ): Promise<SessioneCreata> {
    const token = randomBytes(BYTE_TOKEN).toString('base64url');
    const tokenCsrf = randomBytes(BYTE_TOKEN).toString('base64url');
    const durataOre = this.configurazione.get('DURATA_SESSIONE_ORE', { infer: true });
    const scadeIl = new Date(Date.now() + durataOre * 60 * 60 * 1000);

    await this.prisma.sessione.create({
      data: {
        utenteId,
        tokenHash: this.calcolaHash(token),
        csrfHash: this.calcolaHash(tokenCsrf),
        scadeIl,
        indirizzoIp: indirizzoIp ?? null,
        agenteUtente: agenteUtente?.slice(0, 255) ?? null,
      },
    });

    return { token, tokenCsrf, scadeIl };
  }

  /**
   * Restituisce l'utente e la sessione validi, oppure null.
   * Il controllo include la revoca e la scadenza della sessione
   * e la disattivazione dell'account.
   */
  async risolviSessione(token: string) {
    const sessione = await this.prisma.sessione.findUnique({
      where: { tokenHash: this.calcolaHash(token) },
      include: { utente: true },
    });

    if (!sessione || sessione.revocataIl || sessione.scadeIl <= new Date()) {
      return null;
    }

    if (!sessione.utente.attivo) {
      return null;
    }

    return sessione;
  }

  async revoca(token: string): Promise<void> {
    await this.prisma.sessione.updateMany({
      where: { tokenHash: this.calcolaHash(token), revocataIl: null },
      data: { revocataIl: new Date() },
    });
  }

  /** Revoca tutte le sessioni di un utente, es. dopo un cambio password. */
  async revocaTutte(utenteId: string): Promise<void> {
    await this.prisma.sessione.updateMany({
      where: { utenteId, revocataIl: null },
      data: { revocataIl: new Date() },
    });
  }

  async rimuoviScadute(): Promise<number> {
    const esito = await this.prisma.sessione.deleteMany({
      where: { scadeIl: { lt: new Date() } },
    });

    return esito.count;
  }

  /**
   * Verifica il token CSRF: deve coincidere fra cookie e header (doppio invio)
   * e corrispondere all'hash memorizzato nella sessione, così che un cookie
   * iniettato da terzi non sia sufficiente.
   */
  verificaTokenCsrf(dalCookie: string, dallHeader: string, csrfHashSessione: string): boolean {
    if (!this.confrontaStringhe(dalCookie, dallHeader)) {
      return false;
    }

    return this.confrontaStringhe(this.calcolaHash(dalCookie), csrfHashSessione);
  }

  private confrontaStringhe(atteso: string, ricevuto: string): boolean {
    const a = Buffer.from(atteso);
    const b = Buffer.from(ricevuto);

    return a.length === b.length && timingSafeEqual(a, b);
  }
}
