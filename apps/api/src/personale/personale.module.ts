import { Module } from '@nestjs/common';
import { AutenticazioneModule } from '../autenticazione/autenticazione.module.js';
import { InvitiServizio } from './inviti.servizio.js';
import { PersonaleController } from './personale.controller.js';
import { PersonaleServizio } from './personale.servizio.js';

@Module({
  imports: [AutenticazioneModule],
  controllers: [PersonaleController],
  providers: [PersonaleServizio, InvitiServizio],
  exports: [PersonaleServizio, InvitiServizio],
})
export class PersonaleModule {}
