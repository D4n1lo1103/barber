import { Module } from '@nestjs/common';
import { ProdottiController } from './prodotti.controller.js';
import { ProdottiServizio } from './prodotti.servizio.js';
import { VenditeServizio } from './vendite.servizio.js';

@Module({
  controllers: [ProdottiController],
  providers: [ProdottiServizio, VenditeServizio],
  exports: [ProdottiServizio, VenditeServizio],
})
export class ProdottiModule {}
