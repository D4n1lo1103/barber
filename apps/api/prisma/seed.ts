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
import {
  configurazioneProfilo,
  dataLocale,
  giornoSettimanaLocale,
  istanteDaDataLocale,
  PROFILI,
  type Profilo,
  type StatoAppuntamento,
} from '@barber/shared';

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

/**
 * Apertura demo: la stessa proposta dalla procedura guidata, cioè da martedì a
 * sabato (domenica e lunedì chiusi).
 */
const APERTURA_DEMO = configurazioneProfilo('barbiere').aperturaPredefinita.map((fascia) => ({
  giornoSettimana: fascia.giornoSettimana as number,
  minutoInizio: fascia.minutoInizio,
  minutoFine: fascia.minutoFine,
}));

/**
 * Clienti di prova, scelti per coprire i casi dei messaggi di servizio:
 * ogni combinazione di consenso WhatsApp, numero verificato ed e-mail porta a
 * un canale diverso, così si possono provare WhatsApp, ripiego e assenza di
 * recapiti senza inventare dati a mano.
 */
const CLIENTI_DEMO = [
  {
    // Consenso dato e numero verificato: riceve tutto su WhatsApp.
    nome: 'Giulia',
    cognome: 'Rossi',
    email: 'giulia.rossi@cliente.test',
    numeroWhatsapp: '+393405550001',
    consensoWhatsapp: true,
    numeroVerificato: true,
  },
  {
    // Nessun consenso: riceve tutto via e-mail, anche se ha il numero.
    nome: 'Andrea',
    cognome: 'Conti',
    email: 'andrea.conti@cliente.test',
    numeroWhatsapp: '+393405550002',
    consensoWhatsapp: false,
    numeroVerificato: false,
  },
  {
    // Consenso dato ma numero non ancora verificato: serve a provare la
    // verifica con il codice dalla propria area.
    nome: 'Elena',
    cognome: 'Moretti',
    email: 'elena.moretti@cliente.test',
    numeroWhatsapp: '+393405550003',
    consensoWhatsapp: true,
    numeroVerificato: false,
  },
  {
    // Scheda creata dal personale: solo numero, nessuna e-mail e consenso
    // dichiarato al telefono. Senza WhatsApp attivo non ha alcun recapito
    // digitale, e il personale deve dettare il link di attivazione.
    nome: 'Paolo',
    cognome: 'Ferri',
    email: null,
    numeroWhatsapp: '+393405550004',
    consensoWhatsapp: true,
    numeroVerificato: false,
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

/**
 * Appuntamenti demo distribuiti fra ieri e la settimana prossima, in stati
 * diversi: quelli passati sono chiusi (completati o mancata presentazione),
 * quelli futuri confermati, più un annullamento per mostrare la gestione.
 * Gli orari seguono gli orari di lavoro di ciascun operatore, così restano
 * validi anche per i controlli dell'agenda.
 */
async function creaAppuntamentiDemo(
  prisma: PrismaClient,
  dati: {
    personale: { id: string }[];
    clienti: { id: string }[];
    servizi: { id: string; nome: string; prezzoCentesimi: number; durataMinuti: number }[];
    granularitaMinuti: number;
  },
): Promise<number> {
  const { personale, clienti, servizi, granularitaMinuti } = dati;

  await prisma.appuntamento.deleteMany();

  if (personale.length === 0 || clienti.length === 0 || servizi.length === 0) {
    return 0;
  }

  const orari = await prisma.orarioOperatore.findMany();
  let creati = 0;

  for (let scostamento = -3; scostamento <= 7; scostamento += 1) {
    const giorno = dataLocale(new Date(Date.now() + scostamento * 24 * 60 * 60 * 1000));
    const giornoSettimana = giornoSettimanaLocale(istanteDaDataLocale(giorno, 0)!);

    for (const [posizione, operatore] of personale.entries()) {
      const fascia = orari
        .filter(
          (voce) => voce.operatoreId === operatore.id && voce.giornoSettimana === giornoSettimana,
        )
        .sort((primo, secondo) => primo.minutoInizio - secondo.minutoInizio)[0];

      if (!fascia) {
        continue;
      }

      // Due appuntamenti per operatore: a inizio fascia e un'ora più tardi.
      for (const ritardo of [0, 60]) {
        const scelti = [servizi[(posizione + ritardo) % servizi.length]!];

        if (ritardo === 60 && servizi.length > 1) {
          scelti.push(servizi[(posizione + 1) % servizi.length]!);
        }

        const durataMinuti = scelti.reduce((somma, servizio) => somma + servizio.durataMinuti, 0);
        const minutoInizio =
          fascia.minutoInizio + Math.ceil(ritardo / granularitaMinuti) * granularitaMinuti;

        if (minutoInizio + durataMinuti > fascia.minutoFine) {
          continue;
        }

        const inizio = istanteDaDataLocale(giorno, minutoInizio)!;
        const cliente = clienti[(creati + posizione) % clienti.length]!;
        const passato = scostamento < 0;
        const stato: StatoAppuntamento = passato
          ? creati % 5 === 0
            ? 'mancata_presentazione'
            : 'completato'
          : creati % 7 === 0
            ? 'annullato'
            : 'confermato';

        await prisma.appuntamento.create({
          data: {
            clienteId: cliente.id,
            operatoreId: operatore.id,
            inizio,
            fine: new Date(inizio.getTime() + durataMinuti * 60_000),
            durataMinuti,
            prezzoTotaleCentesimi: scelti.reduce(
              (somma, servizio) => somma + servizio.prezzoCentesimi,
              0,
            ),
            stato,
            motivoAnnullamento: stato === 'annullato' ? 'tempestivo' : null,
            annullatoIl: stato === 'annullato' ? new Date() : null,
            completatoIl: stato === 'completato' ? inizio : null,
            senzaCaparra: creati % 4 === 0,
            note: '',
            creatoDaId: personale[0]!.id,
            servizi: {
              create: scelti.map((servizio, indice) => ({
                servizioId: servizio.id,
                nome: servizio.nome,
                prezzoCentesimi: servizio.prezzoCentesimi,
                durataMinuti: servizio.durataMinuti,
                ordine: indice,
              })),
            },
          },
        });

        creati += 1;
      }
    }
  }

  return creati;
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
    await prisma.appuntamento.deleteMany();
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
      const { consensoWhatsapp, ...dati } = cliente;
      const comuni = {
        ...dati,
        consensoTrattamentoIl: new Date(),
        consensoWhatsappIl: consensoWhatsapp ? new Date() : null,
        ruolo: 'cliente' as const,
        emailVerificata: dati.email !== null,
      };
      // Chi non ha e-mail non può accedere da solo: resta una scheda del
      // personale, in attesa dell'invito.
      const esistente = await prisma.utente.findFirst({
        where: { numeroWhatsapp: dati.numeroWhatsapp },
        select: { id: true },
      });

      if (esistente) {
        continue;
      }

      await prisma.utente.create({
        data: dati.email ? { ...comuni, passwordHash } : comuni,
      });
    }

    const clienti = await prisma.utente.findMany({
      where: { ruolo: 'cliente' },
      orderBy: { creatoIl: 'asc' },
    });
    const servizi = await prisma.servizio.findMany({ orderBy: { ordine: 'asc' } });
    const appuntamentiCreati = await creaAppuntamentiDemo(prisma, {
      personale,
      clienti,
      servizi,
      granularitaMinuti: configurazione.granularitaSlotMinuti,
    });

    console.warn(
      `Dati demo inseriti per il profilo "${profilo}": ${salone.nome}, ` +
        `${configurazione.catalogoIniziale.length} servizi, ${PERSONALE_DEMO.length} membri del personale, ` +
        `${CLIENTI_DEMO.length} clienti, orari di apertura e di lavoro, ` +
        `${appuntamentiCreati} appuntamenti.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

esegui().catch((errore: unknown) => {
  console.error(errore);
  process.exit(1);
});
