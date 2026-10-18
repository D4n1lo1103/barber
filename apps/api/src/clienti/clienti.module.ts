import { Module } from '@nestjs/common';
import { PersonaleModule } from '../personale/personale.module.js';
import { ClientiController } from './clienti.controller.js';
import { ClientiServizio } from './clienti.servizio.js';

@Module({
  imports: [PersonaleModule],
  controllers: [ClientiController],
  providers: [ClientiServizio],
  exports: [ClientiServizio],
})
export class ClientiModule {}
