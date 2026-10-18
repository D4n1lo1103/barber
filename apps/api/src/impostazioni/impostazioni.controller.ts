import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import {
  schemaImpostazioniWhatsapp,
  schemaInvioDiProva,
  schemaRegoleSalone,
  type DatiImpostazioniWhatsapp,
  type DatiInvioDiProva,
  type DatiRegoleSalone,
  type EsitoInvioDiProva,
  type RegoleSalone,
  type StatoWhatsapp,
} from '@barber/shared';
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

  /**
   * Messaggi WhatsApp: attivazione, numero mittente e modelli approvati. Il
   * token non passa da qui, vive nell'ambiente.
   */
  @Get('whatsapp')
  @Ruoli('titolare')
  leggiWhatsapp(): Promise<StatoWhatsapp> {
    return this.impostazioni.leggiWhatsapp();
  }

  @Put('whatsapp')
  @Ruoli('titolare')
  salvaWhatsapp(
    @Body(new ValidazioneZodPipe(schemaImpostazioniWhatsapp)) dati: DatiImpostazioniWhatsapp,
  ): Promise<StatoWhatsapp> {
    return this.impostazioni.salvaWhatsapp(dati);
  }

  @Post('whatsapp/prova')
  @Ruoli('titolare')
  inviaProva(
    @Body(new ValidazioneZodPipe(schemaInvioDiProva)) dati: DatiInvioDiProva,
  ): Promise<EsitoInvioDiProva> {
    return this.impostazioni.inviaProva(dati.numeroWhatsapp);
  }
}
