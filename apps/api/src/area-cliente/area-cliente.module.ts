import { Module } from '@nestjs/common';
import { AppuntamentiModule } from '../appuntamenti/appuntamenti.module.js';
import { AutenticazioneModule } from '../autenticazione/autenticazione.module.js';
import { ClientiModule } from '../clienti/clienti.module.js';
import { ImpostazioniModule } from '../impostazioni/impostazioni.module.js';
import { NotificheModule } from '../notifiche/notifiche.module.js';
import { PagamentiModule } from '../pagamenti/pagamenti.module.js';
import { PersonaleModule } from '../personale/personale.module.js';
import { ServiziModule } from '../servizi/servizi.module.js';
import { AreaClienteController } from './area-cliente.controller.js';
import { CancellazioniController } from './cancellazioni.controller.js';
import { AreaClienteServizio } from './area-cliente.servizio.js';
import { VerificaNumeroServizio } from './verifica-numero.servizio.js';

@Module({
  imports: [
    AppuntamentiModule,
    AutenticazioneModule,
    ClientiModule,
    ImpostazioniModule,
    NotificheModule,
    PagamentiModule,
    PersonaleModule,
    ServiziModule,
  ],
  controllers: [AreaClienteController, CancellazioniController],
  providers: [AreaClienteServizio, VerificaNumeroServizio],
  exports: [AreaClienteServizio],
})
export class AreaClienteModule {}
