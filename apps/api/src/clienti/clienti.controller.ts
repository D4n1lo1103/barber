import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  schemaCreazioneCliente,
  schemaModificaCliente,
  schemaRicercaClienti,
  type CanaleInvito,
  type Cliente,
  type DatiCreazioneCliente,
  type DatiModificaCliente,
  type DatiRicercaClienti,
  type ElencoClienti,
} from '@barber/shared';
import { LimiteDiFrequenza } from '../comuni/decoratori/limite-frequenza.decoratore.js';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { ClientiServizio } from './clienti.servizio.js';

/**
 * Schede clienti: tutto il personale consulta e inserisce, perché al banco e
 * al telefono serve a chiunque sia presente in negozio.
 */
@Controller('clienti')
@UseGuards(RuoliGuardia)
@Ruoli('titolare', 'dipendente')
export class ClientiController {
  constructor(private readonly clienti: ClientiServizio) {}

  @Get()
  elenca(
    @Query(new ValidazioneZodPipe(schemaRicercaClienti)) dati: DatiRicercaClienti,
  ): Promise<ElencoClienti> {
    return this.clienti.elenca(dati);
  }

  @Get(':id')
  leggi(@Param('id') id: string): Promise<Cliente> {
    return this.clienti.leggi(id);
  }

  /** La scheda nasce senza password: è il cliente a scegliere la propria con l'invito. */
  @Post()
  @LimiteDiFrequenza(30, 300)
  crea(
    @Body(new ValidazioneZodPipe(schemaCreazioneCliente)) dati: DatiCreazioneCliente,
  ): Promise<{ cliente: Cliente; token: string; scadeIl: Date; canale: CanaleInvito }> {
    return this.clienti.crea(dati);
  }

  @Patch(':id')
  modifica(
    @Param('id') id: string,
    @Body(new ValidazioneZodPipe(schemaModificaCliente)) dati: DatiModificaCliente,
  ): Promise<Cliente> {
    return this.clienti.modifica(id, dati);
  }

  @Post(':id/invito')
  rigeneraInvito(
    @Param('id') id: string,
  ): Promise<{ token: string; scadeIl: Date; canale: CanaleInvito }> {
    return this.clienti.rigeneraInvito(id);
  }
}
