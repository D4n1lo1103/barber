/**
 * Dati demo per sviluppo, test e staging, parametrizzati per profilo.
 *
 * Uso:  pnpm seed                 (profilo barbiere, predefinito)
 *       pnpm seed -- parrucchiere
 *       PROFILO_DEMO=parrucchiere pnpm seed
 *
 * Non eseguire in produzione: lo script si interrompe se NODE_ENV è "production".
 * La password degli account demo arriva da PASSWORD_DEMO.
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { configurazioneProfilo, PROFILI, type Profilo } from '@barber/shared';

const PASSWORD_DEMO = process.env.PASSWORD_DEMO ?? 'password-demo-salone';

const SALONI_DEMO: Record<
  Profilo,
  { nome: string; indirizzo: string; citta: string; telefono: string; email: string }
> = {
  barbiere: {
    nome: 'Barberia Centrale',
    indirizzo: 'Via Giuseppe Garibaldi 14',
    citta: 'Bologna',
    telefono: '+393401112233',
    email: 'info@barberiacentrale.test',
  },
  parrucchiere: {
    nome: 'Atelier Capelli',
    indirizzo: 'Corso Vittorio Emanuele 8',
    citta: 'Bologna',
    telefono: '+393404445566',
    email: 'info@ateliercapelli.test',
  },
};

const PERSONALE_DEMO = [
  { nome: 'Luca', cognome: 'Bianchi', email: 'titolare@salone.test', ruolo: 'titolare' as const },
  { nome: 'Sara', cognome: 'Verdi', email: 'dipendente@salone.test', ruolo: 'dipendente' as const },
  {
    nome: 'Marco',
    cognome: 'Neri',
    email: 'dipendente2@salone.test',
    ruolo: 'dipendente' as const,
  },
];

/** Apertura demo: 9:00–13:00 e 15:00–19:00 da martedì a sabato. */
const APERTURA_DEMO = [2, 3, 4, 5, 6].flatMap((giornoSettimana) => [
  { giornoSettimana, minutoInizio: 540, minutoFine: 780 },
  { giornoSettimana, minutoInizio: 900, minutoFine: 1140 },
]);

const CLIENTI_DEMO = [
  {
    nome: 'Giulia',
    cognome: 'Rossi',
    email: 'giulia.rossi@cliente.test',
    numeroWhatsapp: '+393405550001',
  },
  {
    nome: 'Andrea',
    cognome: 'Conti',
    email: 'andrea.conti@cliente.test',
    numeroWhatsapp: '+393405550002',
  },
  {
    nome: 'Elena',
    cognome: 'Moretti',
    email: 'elena.moretti@cliente.test',
    numeroWhatsapp: '+393405550003',
  },
];

function leggiProfilo(): Profilo {
  // Il separatore "--" di pnpm può comparire fra gli argomenti: va ignorato.
  const argomento = process.argv.slice(2).find((valore) => valore !== '--');
  const richiesto = argomento ?? process.env.PROFILO_DEMO ?? 'barbiere';

  if (!(PROFILI as readonly string[]).includes(richiesto)) {
    throw new Error(`Profilo non valido: "${richiesto}". Valori ammessi: ${PROFILI.join(', ')}.`);
  }

  return richiesto as Profilo;
}

async function esegui(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('I dati demo non possono essere inseriti in produzione.');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL non è configurata.');
  }

  const profilo = leggiProfilo();
  const configurazione = configurazioneProfilo(profilo);
  const salone = SALONI_DEMO[profilo];
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const passwordHash = await argon2.hash(PASSWORD_DEMO, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  try {
    // I dati demo sostituiscono quelli esistenti, così il seed è ripetibile.
    await prisma.servizio.deleteMany();
    await prisma.installazione.deleteMany();

    await prisma.installazione.create({
      data: {
        riga: 1,
        profilo,
        nomeSalone: salone.nome,
        indirizzo: salone.indirizzo,
        citta: salone.citta,
        telefono: salone.telefono,
        emailSalone: salone.email,
        granularitaSlotMin: configurazione.granularitaSlotMinuti,
        minutiBloccoSlot: configurazione.minutiBloccoSlot,
        venditaOnlineAttiva: false,
        configurata: true,
      },
    });

    await prisma.servizio.createMany({
      data: configurazione.catalogoIniziale.map((servizio, posizione) => ({
        nome: servizio.nome,
        descrizione: servizio.descrizione,
        prezzoCentesimi: servizio.prezzoCentesimi,
        durataMinuti: servizio.durataMinuti,
        ordine: posizione,
      })),
    });

    for (const persona of PERSONALE_DEMO) {
      await prisma.utente.upsert({
        where: { email: persona.email },
        update: {
          nome: persona.nome,
          cognome: persona.cognome,
          ruolo: persona.ruolo,
          attivo: true,
        },
        create: { ...persona, passwordHash, emailVerificata: true },
      });
    }

    // Orari: il salone apre da martedì a sabato; il titolare lavora sempre,
    // i dipendenti coprono mattina e pomeriggio alternandosi.
    await prisma.orarioOperatore.deleteMany();
    await prisma.orarioApertura.deleteMany();
    await prisma.orarioApertura.createMany({ data: APERTURA_DEMO });

    const personale = await prisma.utente.findMany({
      where: { ruolo: { in: ['titolare', 'dipendente'] } },
      orderBy: { creatoIl: 'asc' },
    });

    for (const [posizione, operatore] of personale.entries()) {
      const fasce = APERTURA_DEMO.filter((fascia) =>
        // Il titolare copre tutte le fasce, i dipendenti una metà giornata ciascuno.
        posizione === 0
          ? true
          : posizione % 2 === 1
            ? fascia.minutoInizio < 800
            : fascia.minutoInizio >= 800,
      );

      await prisma.orarioOperatore.createMany({
        data: fasce.map((fascia) => ({ ...fascia, operatoreId: operatore.id })),
      });
    }

    // Tutti gli operatori sono abilitati a tutti i servizi del catalogo demo.
    const serviziCreati = await prisma.servizio.findMany({ select: { id: true } });
    await prisma.servizioOperatore.createMany({
      data: serviziCreati.flatMap((servizio) =>
        personale.map((operatore) => ({ servizioId: servizio.id, operatoreId: operatore.id })),
      ),
    });

    for (const cliente of CLIENTI_DEMO) {
      await prisma.utente.upsert({
        where: { email: cliente.email },
        update: {},
        create: { ...cliente, passwordHash, ruolo: 'cliente', emailVerificata: true },
      });
    }

    console.warn(
      `Dati demo inseriti per il profilo "${profilo}": ${salone.nome}, ` +
        `${configurazione.catalogoIniziale.length} servizi, ${PERSONALE_DEMO.length} membri del personale, ` +
        `${CLIENTI_DEMO.length} clienti, orari di apertura e di lavoro.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

esegui().catch((errore: unknown) => {
  console.error(errore);
  process.exit(1);
});
