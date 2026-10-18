import { Module } from '@nestjs/common';
import { AutenticazioneModule } from '../autenticazione/autenticazione.module.js';
import { NotificheModule } from '../notifiche/notifiche.module.js';
import { ClientiController } from './clienti.controller.js';
import { ClientiServizio } from './clienti.servizio.js';

@Module({
  imports: [AutenticazioneModule, NotificheModule],
  controllers: [ClientiController],
  providers: [ClientiServizio],
  exports: [ClientiServizio],
})
export class ClientiModule {}
