import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  schemaCreazioneAssenza,
  schemaOrariApertura,
  schemaOrariOperatore,
  type Assenza,
  type DatiCreazioneAssenza,
  type DatiOrariApertura,
  type DatiOrariOperatore,
  type FasciaSettimanale,
} from '@barber/shared';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { OrariServizio } from './orari.servizio.js';

/**
 * Orari del salone e degli operatori, assenze.
 * Tutto il personale consulta, solo il titolare modifica.
 */
@Controller('orari')
@UseGuards(RuoliGuardia)
export class OrariController {
  constructor(private readonly orari: OrariServizio) {}

  @Get('apertura')
  @Ruoli('titolare', 'dipendente')
  leggiApertura(): Promise<{ fasce: FasciaSettimanale[] }> {
    return this.orari.leggiOrariApertura().then((fasce) => ({ fasce }));
  }

  @Put('apertura')
  @Ruoli('titolare')
  sostituisciApertura(
    @Body(new ValidazioneZodPipe(schemaOrariApertura)) dati: DatiOrariApertura,
  ): Promise<{ fasce: FasciaSettimanale[] }> {
    return this.orari.sostituisciOrariApertura(dati.fasce).then((fasce) => ({ fasce }));
  }

  @Get('operatori/:operatoreId')
  @Ruoli('titolare', 'dipendente')
  leggiOrariOperatore(
    @Param('operatoreId') operatoreId: string,
  ): Promise<{ fasce: FasciaSettimanale[] }> {
    return this.orari.leggiOrariOperatore(operatoreId).then((fasce) => ({ fasce }));
  }

  @Put('operatori/:operatoreId')
  @Ruoli('titolare')
  sostituisciOrariOperatore(
    @Param('operatoreId') operatoreId: string,
    @Body(new ValidazioneZodPipe(schemaOrariOperatore)) dati: DatiOrariOperatore,
  ): Promise<{ fasce: FasciaSettimanale[] }> {
    return this.orari
      .sostituisciOrariOperatore(operatoreId, dati.fasce)
      .then((fasce) => ({ fasce }));
  }

  @Get('assenze')
  @Ruoli('titolare', 'dipendente')
  elencaAssenze(
    @Query('operatoreId') operatoreId?: string,
    @Query('dal') dal?: string,
    @Query('al') al?: string,
  ): Promise<{ assenze: Assenza[] }> {
    return this.orari
      .elencaAssenze(operatoreId, dal ? new Date(dal) : undefined, al ? new Date(al) : undefined)
      .then((assenze) => ({ assenze }));
  }

  @Post('assenze')
  @Ruoli('titolare')
  creaAssenza(
    @Body(new ValidazioneZodPipe(schemaCreazioneAssenza)) dati: DatiCreazioneAssenza,
  ): Promise<Assenza> {
    return this.orari.creaAssenza(dati);
  }

  @Delete('assenze/:id')
  @Ruoli('titolare')
  @HttpCode(HttpStatus.NO_CONTENT)
  rimuoviAssenza(@Param('id') id: string): Promise<void> {
    return this.orari.rimuoviAssenza(id);
  }
}
