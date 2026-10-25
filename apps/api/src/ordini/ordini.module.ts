import { Module } from '@nestjs/common';
import { AttivitaModule } from '../attivita/attivita.module.js';
import { PagamentiModule } from '../pagamenti/pagamenti.module.js';
import { ProdottiModule } from '../prodotti/prodotti.module.js';
import { OrdiniClienteController } from './ordini-cliente.controller.js';
import { OrdiniController } from './ordini.controller.js';
import { OrdiniServizio } from './ordini.servizio.js';
import { ResiServizio } from './resi.servizio.js';
import { ScadenzaOrdiniAttivita } from './scadenza-ordini.attivita.js';

/**
 * Vendita online: catalogo per il cliente, ordini, ritiro in negozio e resi.
 *
 * Dipende dai pagamenti ma non viceversa: il servizio si registra come
 * gestore dei pagamenti di tipo «ordine» all'avvio, così il webhook resta
 * unico senza che i pagamenti conoscano gli ordini.
 */
@Module({
  imports: [AttivitaModule, PagamentiModule, ProdottiModule],
  controllers: [OrdiniController, OrdiniClienteController],
  providers: [OrdiniServizio, ResiServizio, ScadenzaOrdiniAttivita],
  exports: [OrdiniServizio],
})
export class OrdiniModule {}
