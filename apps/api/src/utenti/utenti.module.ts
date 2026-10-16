import { Module } from '@nestjs/common';
import { UtentiController } from './utenti.controller.js';

@Module({
  controllers: [UtentiController],
})
export class UtentiModule {}
