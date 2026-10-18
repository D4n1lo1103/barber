/**
 * Riporta il database allo stato "primo avvio": svuota installazione, servizi
 * e utenti. Serve ai test end-to-end della procedura guidata.
 * Non eseguibile in produzione.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function esegui(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Il database di produzione non può essere azzerato da questo script.');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL non è configurata.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    // Gli appuntamenti trattengono clienti e operatori (vincolo RESTRICT):
    // vanno rimossi prima degli utenti.
    await prisma.appuntamento.deleteMany();
    await prisma.servizio.deleteMany();
    await prisma.sessione.deleteMany();
    await prisma.utente.deleteMany();
    await prisma.installazione.deleteMany();

    console.warn("Database azzerato: l'installazione risulta da configurare.");
  } finally {
    await prisma.$disconnect();
  }
}

esegui().catch((errore: unknown) => {
  console.error(errore);
  process.exit(1);
});
