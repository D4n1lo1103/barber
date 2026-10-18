import { Module } from '@nestjs/common';
import { AppuntamentiModule } from '../appuntamenti/appuntamenti.module.js';
import { ClientiModule } from '../clienti/clienti.module.js';
import { ImpostazioniModule } from '../impostazioni/impostazioni.module.js';
import { PersonaleModule } from '../personale/personale.module.js';
import { ServiziModule } from '../servizi/servizi.module.js';
import { AreaClienteController } from './area-cliente.controller.js';
import { CancellazioniController } from './cancellazioni.controller.js';
import { AreaClienteServizio } from './area-cliente.servizio.js';

@Module({
  imports: [AppuntamentiModule, ClientiModule, ImpostazioniModule, PersonaleModule, ServiziModule],
  controllers: [AreaClienteController, CancellazioniController],
  providers: [AreaClienteServizio],
  exports: [AreaClienteServizio],
})
export class AreaClienteModule {}
