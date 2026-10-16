import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Ruolo } from '@barber/shared';
import { CHIAVE_RUOLI } from '../decoratori/ruoli.decoratore.js';
import type { RichiestaAutenticata } from '../tipi-richiesta.js';

/** Verifica che il ruolo dell'utente autenticato sia fra quelli consentiti. */
@Injectable()
export class RuoliGuardia implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contesto: ExecutionContext): boolean {
    const ruoliConsentiti = this.reflector.getAllAndOverride<Ruolo[]>(CHIAVE_RUOLI, [
      contesto.getHandler(),
      contesto.getClass(),
    ]);

    if (!ruoliConsentiti || ruoliConsentiti.length === 0) {
      return true;
    }

    const richiesta = contesto.switchToHttp().getRequest<RichiestaAutenticata>();
    const utente = richiesta.utente;

    if (!utente || !ruoliConsentiti.includes(utente.ruolo)) {
      throw new ForbiddenException('Permessi insufficienti per questa operazione.');
    }

    return true;
  }
}
