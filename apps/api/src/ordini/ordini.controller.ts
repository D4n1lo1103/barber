import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  schemaAnnullamentoOrdine,
  schemaAvanzamentoOrdine,
  schemaDecisioneReso,
  schemaRicercaOrdini,
  type DatiAnnullamentoOrdine,
  type DatiAvanzamentoOrdine,
  type DatiDecisioneReso,
  type DatiRicercaOrdini,
  type ElencoOrdini,
  type Ordine,
} from '@barber/shared';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import type { UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { OrdiniServizio } from './ordini.servizio.js';
import { ResiServizio } from './resi.servizio.js';

/**
 * Ordini online dal lato del personale.
 *
 * Il personale prepara e consegna gli ordini; **i resi li decide solo il
 * titolare**, perché comportano un rimborso, come la restituzione
 * discrezionale di una caparra.
 */
@Controller('ordini')
@UseGuards(RuoliGuardia)
export class OrdiniController {
  constructor(
    private readonly ordini: OrdiniServizio,
    private readonly resi: ResiServizio,
  ) {}

  @Get()
  @Ruoli('titolare', 'dipendente')
  elenca(
    @Query(new ValidazioneZodPipe(schemaRicercaOrdini)) ricerca: DatiRicercaOrdini,
  ): Promise<ElencoOrdini> {
    return this.ordini.elenca(ricerca);
  }

  @Get(':id')
  @Ruoli('titolare', 'dipendente')
  leggi(@Param('id', ParseUUIDPipe) id: string): Promise<Ordine> {
    return this.ordini.leggi(id);
  }

  @Patch(':id/stato')
  @Ruoli('titolare', 'dipendente')
  avanza(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidazioneZodPipe(schemaAvanzamentoOrdine)) dati: DatiAvanzamentoOrdine,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Ordine> {
    return this.ordini.avanza(id, dati, utente.id);
  }

  @Patch(':id/annulla')
  @Ruoli('titolare', 'dipendente')
  annulla(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidazioneZodPipe(schemaAnnullamentoOrdine)) dati: DatiAnnullamentoOrdine,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Ordine> {
    return this.ordini.annullaDalPersonale(id, dati, utente.id);
  }

  @Patch('resi/:id/decisione')
  @Ruoli('titolare')
  decidiReso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidazioneZodPipe(schemaDecisioneReso)) dati: DatiDecisioneReso,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Ordine> {
    return this.resi.decidi(id, dati, utente.id);
  }

  @Post('resi/:id/rientro')
  @Ruoli('titolare')
  registraRientro(
    @Param('id', ParseUUIDPipe) id: string,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Ordine> {
    return this.resi.registraRientro(id, utente.id);
  }
}
