import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Ambiente } from './configurazione/ambiente.js';

async function avvia(): Promise<void> {
  // `rawBody` serve a verificare la firma degli eventi di pagamento: la firma
  // vale sul corpo esatto ricevuto, non su quello ricostruito dal JSON.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const configurazione = app.get(ConfigService<Ambiente, true>);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: configurazione.get('ORIGINE_WEB', { infer: true }),
    credentials: true,
  });
  app.enableShutdownHooks();

  const porta = configurazione.get('PORTA', { infer: true });
  await app.listen(porta);

  new Logger('Avvio').log(`API in ascolto sulla porta ${porta}.`);
}

void avvia();
