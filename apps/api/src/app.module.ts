import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validaAmbiente } from './configurazione/ambiente.js';
import { AutenticazioneModule } from './autenticazione/autenticazione.module.js';
import { CsrfGuardia } from './comuni/guardie/csrf.guardia.js';
import { LimiteFrequenzaGuardia } from './comuni/guardie/limite-frequenza.guardia.js';
import { LimiteFrequenzaServizio } from './comuni/limite-frequenza.servizio.js';
import { SessioneGuardia } from './comuni/guardie/sessione.guardia.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StatoModule } from './stato/stato.module.js';
import { UtentiModule } from './utenti/utenti.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validaAmbiente,
    }),
    PrismaModule,
    AutenticazioneModule,
    StatoModule,
    UtentiModule,
  ],
  providers: [
    LimiteFrequenzaServizio,
    // L'ordine conta: prima il limite di frequenza, poi la sessione
    // (che popola la richiesta) e infine la verifica CSRF.
    { provide: APP_GUARD, useClass: LimiteFrequenzaGuardia },
    { provide: APP_GUARD, useClass: SessioneGuardia },
    { provide: APP_GUARD, useClass: CsrfGuardia },
  ],
})
export class AppModule {}
