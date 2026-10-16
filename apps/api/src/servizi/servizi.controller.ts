import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
  schemaCreazioneServizio,
  schemaModificaServizio,
  schemaRiordinoServizi,
  type DatiCreazioneServizio,
  type DatiModificaServizio,
  type DatiRiordinoServizi,
  type Servizio,
} from '@barber/shared';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { ServiziServizio } from './servizi.servizio.js';

/**
 * Catalogo dei servizi: tutto il personale lo consulta,
 * solo il titolare lo modifica.
 */
@Controller('servizi')
@UseGuards(RuoliGuardia)
export class ServiziController {
  constructor(private readonly servizi: ServiziServizio) {}

  @Get()
  @Ruoli('titolare', 'dipendente')
  elenca(): Promise<{ servizi: Servizio[] }> {
    return this.servizi.elenca().then((servizi) => ({ servizi }));
  }

  @Post()
  @Ruoli('titolare')
  crea(
    @Body(new ValidazioneZodPipe(schemaCreazioneServizio)) dati: DatiCreazioneServizio,
  ): Promise<Servizio> {
    return this.servizi.crea(dati);
  }

  @Put('ordine')
  @Ruoli('titolare')
  async riordina(
    @Body(new ValidazioneZodPipe(schemaRiordinoServizi)) dati: DatiRiordinoServizi,
  ): Promise<{ servizi: Servizio[] }> {
    await this.servizi.riordina(dati.idOrdinati);

    return { servizi: await this.servizi.elenca() };
  }

  @Patch(':id')
  @Ruoli('titolare')
  modifica(
    @Param('id') id: string,
    @Body(new ValidazioneZodPipe(schemaModificaServizio)) dati: DatiModificaServizio,
  ): Promise<Servizio> {
    return this.servizi.modifica(id, dati);
  }

  @Delete(':id')
  @Ruoli('titolare')
  disattiva(@Param('id') id: string): Promise<Servizio> {
    return this.servizi.disattiva(id);
  }
}
