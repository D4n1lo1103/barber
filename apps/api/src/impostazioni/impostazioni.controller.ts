import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { schemaRegoleSalone, type DatiRegoleSalone, type RegoleSalone } from '@barber/shared';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { ImpostazioniServizio } from './impostazioni.servizio.js';

/** Regole del salone: le consulta il personale, le cambia solo il titolare. */
@Controller('impostazioni')
@UseGuards(RuoliGuardia)
export class ImpostazioniController {
  constructor(private readonly impostazioni: ImpostazioniServizio) {}

  @Get('regole')
  @Ruoli('titolare', 'dipendente')
  leggi(): Promise<RegoleSalone> {
    return this.impostazioni.leggiRegole();
  }

  @Put('regole')
  @Ruoli('titolare')
  salva(
    @Body(new ValidazioneZodPipe(schemaRegoleSalone)) dati: DatiRegoleSalone,
  ): Promise<RegoleSalone> {
    return this.impostazioni.salvaRegole(dati);
  }
}
