import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ORE_LIMITE_PREAVVISO_PREDEFINITO,
  type DatiRegoleSalone,
  type RegoleSalone,
} from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Regole di annullamento e spostamento del salone. Sono impostazioni salvate
 * nel database, non valori fissi nel codice: il titolare le cambia
 * dall'interfaccia.
 */
@Injectable()
export class ImpostazioniServizio {
  constructor(private readonly prisma: PrismaService) {}

  async leggiRegole(): Promise<RegoleSalone> {
    const installazione = await this.prisma.installazione.findFirst({
      select: {
        oreLimitePreavviso: true,
        spostamentoComeAnnullamento: true,
        oreAnticipoPromemoria: true,
      },
    });

    return (
      installazione ?? {
        oreLimitePreavviso: ORE_LIMITE_PREAVVISO_PREDEFINITO,
        spostamentoComeAnnullamento: false,
        oreAnticipoPromemoria: 24,
      }
    );
  }

  async salvaRegole(dati: DatiRegoleSalone): Promise<RegoleSalone> {
    const installazione = await this.prisma.installazione.findFirst({ select: { id: true } });

    if (!installazione) {
      throw new NotFoundException('Installazione non configurata.');
    }

    const aggiornata = await this.prisma.installazione.update({
      where: { id: installazione.id },
      data: {
        oreLimitePreavviso: dati.oreLimitePreavviso,
        spostamentoComeAnnullamento: dati.spostamentoComeAnnullamento,
        oreAnticipoPromemoria: dati.oreAnticipoPromemoria,
      },
      select: {
        oreLimitePreavviso: true,
        spostamentoComeAnnullamento: true,
        oreAnticipoPromemoria: true,
      },
    });

    return aggiornata;
  }
}
