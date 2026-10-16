import { Module } from '@nestjs/common';
import { OrariController } from './orari.controller.js';
import { OrariServizio } from './orari.servizio.js';

@Module({
  controllers: [OrariController],
  providers: [OrariServizio],
  exports: [OrariServizio],
})
export class OrariModule {}
