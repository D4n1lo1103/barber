import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  schemaAttivazioneAccount,
  schemaCreazioneDipendente,
  schemaModificaOperatore,
  type DatiAttivazioneAccount,
  type DatiCreazioneDipendente,
  type DatiModificaOperatore,
  type Operatore,
} from '@barber/shared';
import { LimiteDiFrequenza } from '../comuni/decoratori/limite-frequenza.decoratore.js';
import { Pubblico } from '../comuni/decoratori/pubblico.decoratore.js';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import type { UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { PersonaleServizio } from './personale.servizio.js';

@Controller('personale')
@UseGuards(RuoliGuardia)
export class PersonaleController {
  constructor(private readonly personale: PersonaleServizio) {}

  /** Tutto il personale vede i colleghi: serve per agende e abilitazioni. */
  @Get()
  @Ruoli('titolare', 'dipendente')
  elenca(): Promise<{ personale: Operatore[] }> {
    return this.personale.elenca().then((elenco) => ({ personale: elenco }));
  }

  @Post()
  @Ruoli('titolare')
  creaDipendente(
    @Body(new ValidazioneZodPipe(schemaCreazioneDipendente)) dati: DatiCreazioneDipendente,
  ): Promise<{ operatore: Operatore; token: string; scadeIl: Date }> {
    return this.personale.creaDipendente(dati);
  }

  @Patch(':id')
  @Ruoli('titolare')
  modifica(
    @Param('id') id: string,
    @Body(new ValidazioneZodPipe(schemaModificaOperatore)) dati: DatiModificaOperatore,
  ): Promise<Operatore> {
    return this.personale.modifica(id, dati);
  }

  @Delete(':id')
  @Ruoli('titolare')
  disattiva(
    @Param('id') id: string,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Operatore> {
    return this.personale.disattiva(id, utente.id);
  }

  @Post(':id/riattivazione')
  @Ruoli('titolare')
  riattiva(@Param('id') id: string): Promise<Operatore> {
    return this.personale.riattiva(id);
  }

  @Post(':id/invito')
  @Ruoli('titolare')
  rigeneraInvito(@Param('id') id: string): Promise<{ token: string; scadeIl: Date }> {
    return this.personale.rigeneraInvito(id);
  }

  /** Attivazione dell'account da parte del dipendente invitato. */
  @Pubblico()
  @LimiteDiFrequenza(5, 300)
  @Post('attivazione')
  @HttpCode(HttpStatus.NO_CONTENT)
  async attiva(
    @Body(new ValidazioneZodPipe(schemaAttivazioneAccount)) dati: DatiAttivazioneAccount,
  ): Promise<void> {
    await this.personale.attivaAccount(dati.token, dati.password);
  }
}
