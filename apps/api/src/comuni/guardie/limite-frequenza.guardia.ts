import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  CHIAVE_LIMITE_FREQUENZA,
  type LimiteFrequenza,
} from '../decoratori/limite-frequenza.decoratore.js';
import { LimiteFrequenzaServizio } from '../limite-frequenza.servizio.js';
import type { Ambiente } from '../../configurazione/ambiente.js';
import type { RichiestaAutenticata } from '../tipi-richiesta.js';

/**
 * Applica il limite di frequenza alle rotte che lo dichiarano,
 * contando le richieste per indirizzo IP e per rotta.
 */
@Injectable()
export class LimiteFrequenzaGuardia implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiti: LimiteFrequenzaServizio,
    private readonly configurazione: ConfigService<Ambiente, true>,
  ) {}

  canActivate(contesto: ExecutionContext): boolean {
    if (this.limitiDisattivati()) {
      return true;
    }

    const limite = this.reflector.getAllAndOverride<LimiteFrequenza>(CHIAVE_LIMITE_FREQUENZA, [
      contesto.getHandler(),
      contesto.getClass(),
    ]);

    if (!limite) {
      return true;
    }

    const richiesta = contesto.switchToHttp().getRequest<RichiestaAutenticata>();
    const chiave = `${richiesta.ip ?? 'ip-ignoto'}:${richiesta.method}:${richiesta.path}`;

    if (!this.limiti.registra(chiave, limite.massimo, limite.finestraSecondi)) {
      throw new HttpException(
        {
          messaggio: 'Troppi tentativi. Attendi qualche istante e riprova.',
          secondiDiAttesa: this.limiti.secondiDiAttesa(chiave),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /** I limiti si possono disattivare solo fuori dalla produzione, per i test. */
  private limitiDisattivati(): boolean {
    return (
      this.configurazione.get('NODE_ENV', { infer: true }) !== 'production' &&
      this.configurazione.get('LIMITI_FREQUENZA_DISATTIVI', { infer: true })
    );
  }
}
