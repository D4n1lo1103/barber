import { Controller, Get } from '@nestjs/common';
import { Pubblico } from '../comuni/decoratori/pubblico.decoratore.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Endpoint di salute usato da Docker, dal reverse proxy e dal deploy. */
@Controller('stato')
export class StatoController {
  constructor(private readonly prisma: PrismaService) {}

  @Pubblico()
  @Get()
  async leggiStato(): Promise<{ stato: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return { stato: 'attivo', database: 'raggiungibile' };
    } catch {
      return { stato: 'degradato', database: 'non raggiungibile' };
    }
  }
}
