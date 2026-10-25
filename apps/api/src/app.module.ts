import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validaAmbiente } from './configurazione/ambiente.js';
import { AppuntamentiModule } from './appuntamenti/appuntamenti.module.js';
import { AreaClienteModule } from './area-cliente/area-cliente.module.js';
import { AttivitaModule } from './attivita/attivita.module.js';
import { AutenticazioneModule } from './autenticazione/autenticazione.module.js';
import { ClientiModule } from './clienti/clienti.module.js';
import { CsrfGuardia } from './comuni/guardie/csrf.guardia.js';
import { LimiteFrequenzaGuardia } from './comuni/guardie/limite-frequenza.guardia.js';
import { LimiteFrequenzaServizio } from './comuni/limite-frequenza.servizio.js';
import { SessioneGuardia } from './comuni/guardie/sessione.guardia.js';
import { InstallazioneModule } from './installazione/installazione.module.js';
import { ImpostazioniModule } from './impostazioni/impostazioni.module.js';
import { NotificheModule } from './notifiche/notifiche.module.js';
import { OrariModule } from './orari/orari.module.js';
import { OrdiniModule } from './ordini/ordini.module.js';
import { PagamentiModule } from './pagamenti/pagamenti.module.js';
import { PersonaleModule } from './personale/personale.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProdottiModule } from './prodotti/prodotti.module.js';
import { ServiziModule } from './servizi/servizi.module.js';
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
    AttivitaModule,
    NotificheModule,
    AppuntamentiModule,
    AreaClienteModule,
    AutenticazioneModule,
    ClientiModule,
    ImpostazioniModule,
    InstallazioneModule,
    OrariModule,
    OrdiniModule,
    PagamentiModule,
    PersonaleModule,
    ProdottiModule,
    ServiziModule,
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
