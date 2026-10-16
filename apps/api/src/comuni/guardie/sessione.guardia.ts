import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHIAVE_PUBBLICO } from '../decoratori/pubblico.decoratore.js';
import { COOKIE_SESSIONE, SessioniServizio } from '../../autenticazione/sessioni.servizio.js';
import type { RichiestaAutenticata } from '../tipi-richiesta.js';

/**
 * Guardia globale: ogni rotta richiede una sessione valida,
 * salvo quelle marcate con il decoratore @Pubblico().
 */
@Injectable()
export class SessioneGuardia implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessioni: SessioniServizio,
  ) {}

  async canActivate(contesto: ExecutionContext): Promise<boolean> {
    const richiesta = contesto.switchToHttp().getRequest<RichiestaAutenticata>();
    const token = this.leggiToken(richiesta);

    if (token) {
      const sessione = await this.sessioni.risolviSessione(token);

      if (sessione) {
        const utente = sessione.utente;
        richiesta.utente = {
          id: utente.id,
          email: utente.email,
          nome: utente.nome,
          cognome: utente.cognome,
          ruolo: utente.ruolo,
          attivo: utente.attivo,
        };
        richiesta.tokenSessione = token;
        richiesta.csrfHashSessione = sessione.csrfHash;
      }
    }

    const ePubblica = this.reflector.getAllAndOverride<boolean>(CHIAVE_PUBBLICO, [
      contesto.getHandler(),
      contesto.getClass(),
    ]);

    if (ePubblica) {
      return true;
    }

    if (!richiesta.utente) {
      throw new UnauthorizedException('Accesso non autorizzato.');
    }

    return true;
  }

  private leggiToken(richiesta: RichiestaAutenticata): string | undefined {
    const valore = richiesta.cookies?.[COOKIE_SESSIONE];

    return typeof valore === 'string' && valore.length > 0 ? valore : undefined;
  }
}
