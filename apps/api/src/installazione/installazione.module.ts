import { Module } from '@nestjs/common';
import { AutenticazioneModule } from '../autenticazione/autenticazione.module.js';
import { InstallazioneController } from './installazione.controller.js';
import { InstallazioneServizio } from './installazione.servizio.js';

@Module({
  imports: [AutenticazioneModule],
  controllers: [InstallazioneController],
  providers: [InstallazioneServizio],
  exports: [InstallazioneServizio],
})
export class InstallazioneModule {}
