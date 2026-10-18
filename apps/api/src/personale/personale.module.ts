import { Module } from '@nestjs/common';
import { AutenticazioneModule } from '../autenticazione/autenticazione.module.js';
import { NotificheModule } from '../notifiche/notifiche.module.js';
import { PersonaleController } from './personale.controller.js';
import { PersonaleServizio } from './personale.servizio.js';

@Module({
  imports: [AutenticazioneModule, NotificheModule],
  controllers: [PersonaleController],
  providers: [PersonaleServizio],
  exports: [PersonaleServizio],
})
export class PersonaleModule {}
