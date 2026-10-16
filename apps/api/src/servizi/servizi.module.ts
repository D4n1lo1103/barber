import { Module } from '@nestjs/common';
import { ServiziController } from './servizi.controller.js';
import { ServiziServizio } from './servizi.servizio.js';

@Module({
  controllers: [ServiziController],
  providers: [ServiziServizio],
  exports: [ServiziServizio],
})
export class ServiziModule {}
