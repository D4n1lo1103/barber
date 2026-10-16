import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { Ambiente } from '../configurazione/ambiente.js';

/**
 * Client Prisma dell'installazione. La connessione passa dall'adattatore
 * PostgreSQL ufficiale e l'URL arriva solo dalle variabili d'ambiente.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configurazione: ConfigService<Ambiente, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: configurazione.get('DATABASE_URL', { infer: true }),
      }),
      log:
        configurazione.get('NODE_ENV', { infer: true }) === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
