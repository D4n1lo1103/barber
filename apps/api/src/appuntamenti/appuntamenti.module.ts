import { Module } from '@nestjs/common';
import { ClientiModule } from '../clienti/clienti.module.js';
import { NotificheModule } from '../notifiche/notifiche.module.js';
import { AppuntamentiController } from './appuntamenti.controller.js';
import { AppuntamentiServizio } from './appuntamenti.servizio.js';
import { DisponibilitaServizio } from './disponibilita.servizio.js';

@Module({
  imports: [ClientiModule, NotificheModule],
  controllers: [AppuntamentiController],
  providers: [AppuntamentiServizio, DisponibilitaServizio],
  exports: [AppuntamentiServizio, DisponibilitaServizio],
})
export class AppuntamentiModule {}
