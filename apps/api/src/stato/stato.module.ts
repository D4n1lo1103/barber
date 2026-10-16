import { Module } from '@nestjs/common';
import { StatoController } from './stato.controller.js';

@Module({
  controllers: [StatoController],
})
export class StatoModule {}
