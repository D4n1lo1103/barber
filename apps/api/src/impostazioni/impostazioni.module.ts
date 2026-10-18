import { Module } from '@nestjs/common';
import { ImpostazioniController } from './impostazioni.controller.js';
import { ImpostazioniServizio } from './impostazioni.servizio.js';

@Module({
  controllers: [ImpostazioniController],
  providers: [ImpostazioniServizio],
  exports: [ImpostazioniServizio],
})
export class ImpostazioniModule {}
