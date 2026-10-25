import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  schemaAnnullamentoDaPersonale,
  schemaCreazioneAppuntamento,
  schemaRicercaAgenda,
  schemaRichiestaDisponibilita,
  schemaSpostamentoAppuntamento,
  type Appuntamento,
  type DatiAnnullamentoDaPersonale,
  type DatiCreazioneAppuntamento,
  type DatiRicercaAgenda,
  type DatiRichiestaDisponibilita,
  type DatiSpostamentoAppuntamento,
  type DisponibilitaGiorno,
} from '@barber/shared';
import { LimiteDiFrequenza } from '../comuni/decoratori/limite-frequenza.decoratore.js';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import type { UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { AppuntamentiServizio } from './appuntamenti.servizio.js';
import { DisponibilitaServizio } from './disponibilita.servizio.js';

/**
 * Agenda del personale. Ogni membro del personale vede e gestisce tutte le
 * agende: al banco e al telefono serve a chiunque sia presente in negozio.
 * L'area clienti avrà rotte proprie, con regole di preavviso diverse (fase 4).
 */
@Controller('appuntamenti')
@UseGuards(RuoliGuardia)
@Ruoli('titolare', 'dipendente')
export class AppuntamentiController {
  constructor(
    private readonly appuntamenti: AppuntamentiServizio,
    private readonly disponibilita: DisponibilitaServizio,
  ) {}

  @Get()
  elenca(
    @Query(new ValidazioneZodPipe(schemaRicercaAgenda)) dati: DatiRicercaAgenda,
  ): Promise<{ appuntamenti: Appuntamento[] }> {
    return this.appuntamenti.elenca(dati).then((elenco) => ({ appuntamenti: elenco }));
  }

  /** Slot liberi per operatore, servizi scelti e giorni richiesti. */
  @Get('disponibilita')
  calcolaDisponibilita(
    @Query(new ValidazioneZodPipe(schemaRichiestaDisponibilita)) dati: DatiRichiestaDisponibilita,
  ): Promise<{ giorni: DisponibilitaGiorno[] }> {
    return this.disponibilita.calcola(dati).then((giorni) => ({ giorni }));
  }

  @Get('cliente/:clienteId')
  elencaPerCliente(
    @Param('clienteId') clienteId: string,
  ): Promise<{ appuntamenti: Appuntamento[] }> {
    return this.appuntamenti
      .elencaPerCliente(clienteId)
      .then((elenco) => ({ appuntamenti: elenco }));
  }

  @Get(':id')
  leggi(@Param('id') id: string): Promise<Appuntamento> {
    return this.appuntamenti.leggi(id);
  }

  @Post()
  @LimiteDiFrequenza(60, 300)
  crea(
    @Body(new ValidazioneZodPipe(schemaCreazioneAppuntamento)) dati: DatiCreazioneAppuntamento,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Appuntamento> {
    return this.appuntamenti.crea(dati, utente.id, utente.ruolo);
  }

  @Post(':id/spostamento')
  sposta(
    @Param('id') id: string,
    @Body(new ValidazioneZodPipe(schemaSpostamentoAppuntamento)) dati: DatiSpostamentoAppuntamento,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Appuntamento> {
    return this.appuntamenti.sposta(id, dati, utente.id);
  }

  @Post(':id/annullamento')
  annulla(
    @Param('id') id: string,
    @Body(new ValidazioneZodPipe(schemaAnnullamentoDaPersonale)) dati: DatiAnnullamentoDaPersonale,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Appuntamento> {
    return this.appuntamenti.annulla(id, dati, utente.id);
  }

  @Post(':id/mancata-presentazione')
  segnaMancataPresentazione(
    @Param('id') id: string,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Appuntamento> {
    return this.appuntamenti.segnaMancataPresentazione(id, utente.id);
  }

  @Post(':id/completamento')
  completa(
    @Param('id') id: string,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Appuntamento> {
    return this.appuntamenti.completa(id, utente.id);
  }
}
