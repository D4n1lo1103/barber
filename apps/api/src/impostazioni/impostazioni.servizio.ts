import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CAPARRA_PERCENTUALE_PREDEFINITA,
  ORE_LIMITE_PREAVVISO_PREDEFINITO,
  type DatiRegoleSalone,
  type RegoleSalone,
} from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Colonne che compongono le regole: lette e restituite sempre insieme. */
const CAMPI_REGOLE = {
  oreLimitePreavviso: true,
  spostamentoComeAnnullamento: true,
  oreAnticipoPromemoria: true,
  caparraAttiva: true,
  caparraPercentuale: true,
  restituzioneCaparra: true,
} as const;

/**
 * Regole di annullamento, spostamento e caparra del salone. Sono impostazioni
 * salvate nel database, non valori fissi nel codice: il titolare le cambia
 * dall'interfaccia.
 */
@Injectable()
export class ImpostazioniServizio {
  constructor(private readonly prisma: PrismaService) {}

  async leggiRegole(): Promise<RegoleSalone> {
    const installazione = await this.prisma.installazione.findFirst({
      select: CAMPI_REGOLE,
    });

    return (
      installazione ?? {
        oreLimitePreavviso: ORE_LIMITE_PREAVVISO_PREDEFINITO,
        spostamentoComeAnnullamento: false,
        oreAnticipoPromemoria: 24,
        caparraAttiva: false,
        caparraPercentuale: CAPARRA_PERCENTUALE_PREDEFINITA,
        restituzioneCaparra: 'rimborso',
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
        caparraAttiva: dati.caparraAttiva,
        caparraPercentuale: dati.caparraPercentuale,
        restituzioneCaparra: dati.restituzioneCaparra,
      },
      select: CAMPI_REGOLE,
    });

    return aggiornata;
  }
}
