import { Controller, Get, UseGuards } from '@nestjs/common';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Gestione del personale: riservata al titolare. */
@Controller('utenti')
@UseGuards(RuoliGuardia)
@Ruoli('titolare')
export class UtentiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('personale')
  async elencaPersonale() {
    const personale = await this.prisma.utente.findMany({
      where: { ruolo: { in: ['titolare', 'dipendente'] } },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        ruolo: true,
        attivo: true,
      },
      orderBy: [{ ruolo: 'asc' }, { cognome: 'asc' }],
    });

    return { personale };
  }
}
