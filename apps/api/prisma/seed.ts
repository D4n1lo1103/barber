/**
 * Dati demo per sviluppo, test e staging.
 * Non eseguire in produzione: lo script si interrompe se NODE_ENV è "production".
 * La password degli account demo arriva da PASSWORD_DEMO (predefinita: password-demo-salone).
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const PASSWORD_DEMO = process.env.PASSWORD_DEMO ?? 'password-demo-salone';

async function esegui(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('I dati demo non possono essere inseriti in produzione.');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL non è configurata.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const passwordHash = await argon2.hash(PASSWORD_DEMO, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  try {
    const titolare = await prisma.utente.upsert({
      where: { email: 'titolare@salone.test' },
      update: {},
      create: {
        email: 'titolare@salone.test',
        passwordHash,
        nome: 'Luca',
        cognome: 'Bianchi',
        ruolo: 'titolare',
        emailVerificata: true,
      },
    });

    const dipendente = await prisma.utente.upsert({
      where: { email: 'dipendente@salone.test' },
      update: {},
      create: {
        email: 'dipendente@salone.test',
        passwordHash,
        nome: 'Sara',
        cognome: 'Verdi',
        ruolo: 'dipendente',
        emailVerificata: true,
      },
    });

    console.warn(`Dati demo inseriti: ${titolare.email}, ${dipendente.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

esegui().catch((errore: unknown) => {
  console.error(errore);
  process.exit(1);
});
