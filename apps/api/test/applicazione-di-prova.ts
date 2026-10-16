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

  return contesto.prisma.utente.create({
    data: {
      email: `${ruolo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${SUFFISSO_PROVA}`,
      passwordHash,
      nome: 'Utente',
      cognome: 'DiProva',
      ruolo,
      attivo: opzioni.attivo ?? true,
      emailVerificata: true,
    },
  });
}

export async function rimuoviDatiDiProva(contesto: ContestoDiProva): Promise<void> {
  await contesto.prisma.utente.deleteMany({
    where: { email: { endsWith: SUFFISSO_PROVA } },
  });
}

/** Riporta l'installazione allo stato "primo avvio". */
export async function azzeraInstallazione(contesto: ContestoDiProva): Promise<void> {
  await contesto.prisma.servizio.deleteMany();
  await contesto.prisma.installazione.deleteMany();
  await contesto.prisma.utente.deleteMany({ where: { ruolo: 'titolare' } });
}

/** Estrae il valore di un cookie dall'header Set-Cookie della risposta. */
export function leggiCookie(intestazioni: string[] | undefined, nome: string): string | undefined {
  const voce = intestazioni?.find((cookie) => cookie.startsWith(`${nome}=`));

  return voce?.split(';')[0]?.split('=')[1];
}
