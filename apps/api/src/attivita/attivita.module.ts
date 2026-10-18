import { Module } from '@nestjs/common';
import { CodaServizio } from './coda.servizio.js';

@Module({
  providers: [CodaServizio],
  exports: [CodaServizio],
})
export class AttivitaModule {}
