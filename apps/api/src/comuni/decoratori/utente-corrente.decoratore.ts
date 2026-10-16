import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RichiestaAutenticata, UtenteRichiesta } from '../tipi-richiesta.js';

/** Inietta l'utente autenticato dalla richiesta. */
export const UtenteCorrente = createParamDecorator(
  (_dati: unknown, contesto: ExecutionContext): UtenteRichiesta | undefined => {
    const richiesta = contesto.switchToHttp().getRequest<RichiestaAutenticata>();

    return richiesta.utente;
  },
);
