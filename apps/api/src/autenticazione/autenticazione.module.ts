import { Module } from '@nestjs/common';
import { AutenticazioneController } from './autenticazione.controller.js';
import { AutenticazioneServizio } from './autenticazione.servizio.js';
import { SessioniServizio } from './sessioni.servizio.js';

@Module({
  controllers: [AutenticazioneController],
  providers: [AutenticazioneServizio, SessioniServizio],
  exports: [AutenticazioneServizio, SessioniServizio],
})
export class AutenticazioneModule {}
