import { Module } from '@nestjs/common';
import { NotificheModule } from '../notifiche/notifiche.module.js';
import { AutenticazioneController } from './autenticazione.controller.js';
import { AutenticazioneServizio } from './autenticazione.servizio.js';
import { SessioniServizio } from './sessioni.servizio.js';
import { RegistrazioneServizio } from './registrazione.servizio.js';
import { TokenServizio } from './token.servizio.js';

@Module({
  imports: [NotificheModule],
  controllers: [AutenticazioneController],
  providers: [AutenticazioneServizio, RegistrazioneServizio, SessioniServizio, TokenServizio],
  exports: [AutenticazioneServizio, RegistrazioneServizio, SessioniServizio, TokenServizio],
})
export class AutenticazioneModule {}
