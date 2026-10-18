import { Module, forwardRef } from '@nestjs/common';
import { NotificheModule } from '../notifiche/notifiche.module.js';
import { ImpostazioniController } from './impostazioni.controller.js';
import { ImpostazioniServizio } from './impostazioni.servizio.js';

@Module({
  // Le notifiche usano le impostazioni e le impostazioni fanno l'invio di
  // prova: il riferimento circolare fra i due moduli va dichiarato.
  imports: [forwardRef(() => NotificheModule)],
  controllers: [ImpostazioniController],
  providers: [ImpostazioniServizio],
  exports: [ImpostazioniServizio],
})
export class ImpostazioniModule {}
