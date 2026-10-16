import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COOKIE_CSRF,
  COOKIE_SESSIONE,
  HEADER_CSRF,
  SessioniServizio,
} from '../../autenticazione/sessioni.servizio.js';
import type { Ambiente } from '../../configurazione/ambiente.js';
import type { RichiestaAutenticata } from '../tipi-richiesta.js';

const METODI_SICURI = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protezione CSRF con doppio invio del token (cookie + header),
 * rafforzata dal controllo dell'origine della richiesta.
 * Si applica solo alle richieste che modificano dati e che portano un cookie di sessione.
 */
@Injectable()
export class CsrfGuardia implements CanActivate {
  constructor(
    private readonly sessioni: SessioniServizio,
    private readonly configurazione: ConfigService<Ambiente, true>,
  ) {}

  canActivate(contesto: ExecutionContext): boolean {
    const richiesta = contesto.switchToHttp().getRequest<RichiestaAutenticata>();

    if (METODI_SICURI.has(richiesta.method)) {
      return true;
    }

    if (!richiesta.cookies?.[COOKIE_SESSIONE]) {
      return true;
    }

    this.verificaOrigine(richiesta);
    this.verificaToken(richiesta);

    return true;
  }

  private verificaOrigine(richiesta: RichiestaAutenticata): void {
    const origineAttesa = this.configurazione.get('ORIGINE_WEB', { infer: true });
    const origine = richiesta.headers.origin;

    if (origine && origine !== origineAttesa) {
      throw new ForbiddenException('Richiesta rifiutata.');
    }
  }

  private verificaToken(richiesta: RichiestaAutenticata): void {
    const dalCookie = richiesta.cookies?.[COOKIE_CSRF];
    const dallHeader = richiesta.headers[HEADER_CSRF];

    const csrfHashSessione = richiesta.csrfHashSessione;

    if (
      typeof dalCookie !== 'string' ||
      typeof dallHeader !== 'string' ||
      typeof csrfHashSessione !== 'string' ||
      !this.sessioni.verificaTokenCsrf(dalCookie, dallHeader, csrfHashSessione)
    ) {
      throw new ForbiddenException('Token di sicurezza non valido. Ricarica la pagina.');
    }
  }
}
