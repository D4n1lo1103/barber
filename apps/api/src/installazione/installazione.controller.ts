import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  PROFILI,
  schemaProceduraGuidata,
  type DatiProceduraGuidata,
  type Profilo,
  type StatoInstallazione,
} from '@barber/shared';
import { LimiteDiFrequenza } from '../comuni/decoratori/limite-frequenza.decoratore.js';
import { Pubblico } from '../comuni/decoratori/pubblico.decoratore.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { InstallazioneServizio } from './installazione.servizio.js';

/** Intestazione che trasporta la chiave di installazione. */
export const HEADER_CHIAVE_INSTALLAZIONE = 'x-chiave-installazione';

@Controller('installazione')
export class InstallazioneController {
  constructor(private readonly installazione: InstallazioneServizio) {}

  @Pubblico()
  @Get()
  leggiStato(): Promise<StatoInstallazione> {
    return this.installazione.leggiStato();
  }

  /** Impostazioni e catalogo proposti per un profilo, usati dalla procedura guidata. */
  @Pubblico()
  @Get('profili/:profilo')
  leggiProfilo(@Param('profilo') profilo: string) {
    if (!(PROFILI as readonly string[]).includes(profilo)) {
      throw new BadRequestException('Profilo non riconosciuto.');
    }

    return this.installazione.leggiConfigurazioneProfilo(profilo as Profilo);
  }

  @Pubblico()
  @LimiteDiFrequenza(5, 300)
  @Post('procedura-guidata')
  @HttpCode(HttpStatus.NO_CONTENT)
  async completaProceduraGuidata(
    @Body(new ValidazioneZodPipe(schemaProceduraGuidata)) dati: DatiProceduraGuidata,
    @Headers(HEADER_CHIAVE_INSTALLAZIONE) chiave?: string,
  ): Promise<void> {
    await this.installazione.completaProceduraGuidata(dati, chiave ?? '');
  }
}
