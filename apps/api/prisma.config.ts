import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Configurazione della CLI Prisma: l'URL del database arriva dall'ambiente
 * e non è mai scritto nello schema né nel codice.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // Database temporaneo usato da Prisma per calcolare e verificare le
    // migrazioni in sviluppo. Non serve in produzione.
    shadowDatabaseUrl: process.env.DATABASE_URL_OMBRA,
  },
});
