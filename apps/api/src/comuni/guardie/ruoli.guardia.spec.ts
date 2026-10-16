import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { Ruolo } from '@barber/shared';
import { RuoliGuardia } from './ruoli.guardia.js';
import type { RichiestaAutenticata, UtenteRichiesta } from '../tipi-richiesta.js';

function creaContesto(utente?: UtenteRichiesta): ExecutionContext {
  const richiesta = { utente } as RichiestaAutenticata;

  return {
    switchToHttp: () => ({ getRequest: () => richiesta }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function creaUtente(ruolo: Ruolo): UtenteRichiesta {
  return {
    id: '3f2c1b4e-0000-4000-8000-000000000001',
    email: 'persona@example.com',
    nome: 'Mario',
    cognome: 'Rossi',
    ruolo,
    attivo: true,
  };
}

describe('RuoliGuardia', () => {
  let reflector: Reflector;
  let guardia: RuoliGuardia;

  beforeEach(() => {
    reflector = new Reflector();
    guardia = new RuoliGuardia(reflector);
  });

  function impostaRuoliConsentiti(ruoli: Ruolo[] | undefined): void {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ruoli);
  }

  it('consente l accesso quando la rotta non richiede ruoli specifici', () => {
    impostaRuoliConsentiti(undefined);

    expect(guardia.canActivate(creaContesto(creaUtente('cliente')))).toBe(true);
  });

  it('consente l accesso al ruolo elencato', () => {
    impostaRuoliConsentiti(['titolare']);

    expect(guardia.canActivate(creaContesto(creaUtente('titolare')))).toBe(true);
  });

  it('nega al dipendente le rotte riservate al titolare', () => {
    impostaRuoliConsentiti(['titolare']);

    expect(() => guardia.canActivate(creaContesto(creaUtente('dipendente')))).toThrow(
      ForbiddenException,
    );
  });

  it('nega l accesso quando la richiesta non ha un utente autenticato', () => {
    impostaRuoliConsentiti(['titolare', 'dipendente']);

    expect(() => guardia.canActivate(creaContesto(undefined))).toThrow(ForbiddenException);
  });
});
