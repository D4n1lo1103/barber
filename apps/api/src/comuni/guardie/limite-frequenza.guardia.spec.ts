import { jest } from '@jest/globals';
import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { LimiteFrequenzaGuardia } from './limite-frequenza.guardia.js';
import { LimiteFrequenzaServizio } from '../limite-frequenza.servizio.js';

function creaContesto(): ExecutionContext {
  const richiesta = { ip: '203.0.113.7', method: 'POST', path: '/api/autenticazione/accesso' };

  return {
    switchToHttp: () => ({ getRequest: () => richiesta }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function creaConfigurazione(ambiente: string, disattivi: boolean): ConfigService {
  return {
    get: (chiave: string) => (chiave === 'NODE_ENV' ? ambiente : disattivi),
  } as unknown as ConfigService;
}

describe('LimiteFrequenzaGuardia', () => {
  let reflector: Reflector;
  let limiti: LimiteFrequenzaServizio;

  beforeEach(() => {
    reflector = new Reflector();
    limiti = new LimiteFrequenzaServizio();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ massimo: 2, finestraSecondi: 60 });
  });

  function creaGuardia(ambiente = 'development', disattivi = false) {
    return new LimiteFrequenzaGuardia(
      reflector,
      limiti,
      creaConfigurazione(ambiente, disattivi) as never,
    );
  }

  it('blocca le richieste oltre il limite dichiarato dalla rotta', () => {
    const guardia = creaGuardia();

    expect(guardia.canActivate(creaContesto())).toBe(true);
    expect(guardia.canActivate(creaContesto())).toBe(true);
    expect(() => guardia.canActivate(creaContesto())).toThrow(HttpException);
  });

  it('non applica limiti alle rotte che non li dichiarano', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const guardia = creaGuardia();

    for (let tentativo = 0; tentativo < 10; tentativo += 1) {
      expect(guardia.canActivate(creaContesto())).toBe(true);
    }
  });

  it('consente di disattivare i limiti solo fuori dalla produzione', () => {
    const inSviluppo = creaGuardia('development', true);

    for (let tentativo = 0; tentativo < 5; tentativo += 1) {
      expect(inSviluppo.canActivate(creaContesto())).toBe(true);
    }

    limiti.azzera();
    const inProduzione = creaGuardia('production', true);

    expect(inProduzione.canActivate(creaContesto())).toBe(true);
    expect(inProduzione.canActivate(creaContesto())).toBe(true);
    expect(() => inProduzione.canActivate(creaContesto())).toThrow(HttpException);
  });
});
