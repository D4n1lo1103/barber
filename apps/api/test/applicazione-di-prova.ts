import 'dotenv/config';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { AutenticazioneServizio } from '../src/autenticazione/autenticazione.servizio.js';
import { LimiteFrequenzaServizio } from '../src/comuni/limite-frequenza.servizio.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { Ruolo } from '@barber/shared';

export interface ContestoDiProva {
  app: INestApplication;
  prisma: PrismaService;
  autenticazione: AutenticazioneServizio;
  limiti: LimiteFrequenzaServizio;
}

/** Suffisso delle e-mail create dai test, usato per la pulizia finale. */
export const SUFFISSO_PROVA = '@prova.integrazione';

/** Prefisso dei numeri usati nelle prove, per poterli ripulire. */
export const PREFISSO_NUMERO_PROVA = '+39999';

export async function avviaApplicazioneDiProva(): Promise<ContestoDiProva> {
  const moduloDiProva = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduloDiProva.createNestApplication();

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    autenticazione: app.get(AutenticazioneServizio),
    limiti: app.get(LimiteFrequenzaServizio),
  };
}

export async function creaUtenteDiProva(
  contesto: ContestoDiProva,
  ruolo: Ruolo,
  password: string,
  opzioni: { attivo?: boolean } = {},
) {
  const passwordHash = await contesto.autenticazione.calcolaHashPassword(password);
  const email = `${ruolo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${SUFFISSO_PROVA}`;

  const utente = await contesto.prisma.utente.create({
    data: {
      email,
      passwordHash,
      nome: 'Utente',
      cognome: 'DiProva',
      ruolo,
      attivo: opzioni.attivo ?? true,
      emailVerificata: true,
    },
  });

  // L'e-mail è facoltativa sul modello, ma gli utenti di prova ne hanno sempre una.
  return { ...utente, email };
}

export async function rimuoviDatiDiProva(contesto: ContestoDiProva): Promise<void> {
  // Gli appuntamenti trattengono gli utenti collegati (vincolo RESTRICT),
  // quindi vanno rimossi per primi.
  await contesto.prisma.appuntamento.deleteMany();
  await contesto.prisma.utente.deleteMany({
    where: {
      OR: [
        { email: { endsWith: SUFFISSO_PROVA } },
        { numeroWhatsapp: { startsWith: PREFISSO_NUMERO_PROVA } },
      ],
    },
  });
}

/** Riporta l'installazione allo stato "primo avvio". */
export async function azzeraInstallazione(contesto: ContestoDiProva): Promise<void> {
  await contesto.prisma.servizio.deleteMany();
  await contesto.prisma.installazione.deleteMany();
  await contesto.prisma.utente.deleteMany({ where: { ruolo: 'titolare' } });
}

/** Configura un salone minimo, come farebbe la procedura guidata. */
export async function configuraSalone(
  contesto: ContestoDiProva,
  granularitaSlotMin = 15,
): Promise<void> {
  await contesto.prisma.installazione.deleteMany();
  await contesto.prisma.installazione.create({
    data: {
      riga: 1,
      profilo: 'barbiere',
      nomeSalone: 'Salone di prova',
      indirizzo: 'Via delle Prove 1',
      citta: 'Bologna',
      telefono: '+393401234567',
      emailSalone: 'salone@prova.integrazione',
      granularitaSlotMin,
      minutiBloccoSlot: 10,
      configurata: true,
    },
  });
}

/** Esegue l'accesso e restituisce i cookie e il token CSRF da riusare. */
export async function accediPerProva(
  contesto: ContestoDiProva,
  email: string,
  password: string,
): Promise<{ cookie: string; tokenCsrf: string }> {
  const { default: request } = await import('supertest');
  const risposta = await request(contesto.app.getHttpServer())
    .post('/api/autenticazione/accesso')
    .send({ email, password });

  const intestazioni = risposta.headers['set-cookie'] as unknown as string[] | undefined;

  return {
    cookie: intestazioni?.map((valore) => valore.split(';')[0]).join('; ') ?? '',
    tokenCsrf: leggiCookie(intestazioni, 'csrf') ?? '',
  };
}

/** Estrae il valore di un cookie dall'header Set-Cookie della risposta. */
export function leggiCookie(intestazioni: string[] | undefined, nome: string): string | undefined {
  const voce = intestazioni?.find((cookie) => cookie.startsWith(`${nome}=`));

  return voce?.split(';')[0]?.split('=')[1];
}
