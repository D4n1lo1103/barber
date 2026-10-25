import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  schemaCreazioneOrdine,
  schemaRichiestaReso,
  type DatiCreazioneOrdine,
  type DatiRichiestaReso,
  type Ordine,
  type OrdineCreato,
  type Prodotto,
} from '@barber/shared';
import { LimiteDiFrequenza } from '../comuni/decoratori/limite-frequenza.decoratore.js';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import type { UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { ProdottiServizio } from '../prodotti/prodotti.servizio.js';
import { OrdiniServizio } from './ordini.servizio.js';
import { ResiServizio } from './resi.servizio.js';

/**
 * Negozio online del cliente: catalogo, ordini e resi.
 *
 * Tutte le rotte agiscono solo sui propri dati, letti dalla sessione, e sono
 * disponibili solo se il titolare ha attivato la vendita online in fase di
 * installazione.
 */
@Controller('area-cliente')
@UseGuards(RuoliGuardia)
@Ruoli('cliente')
export class OrdiniClienteController {
  constructor(
    private readonly ordini: OrdiniServizio,
    private readonly resi: ResiServizio,
    private readonly prodotti: ProdottiServizio,
  ) {}

  /** Catalogo acquistabile: solo i prodotti in vendita, con la giacenza. */
  @Get('catalogo')
  async catalogo(): Promise<Prodotto[]> {
    if (!(await this.ordini.venditaOnlineAttiva())) {
      throw new ForbiddenException('La vendita online non è attiva in questo salone.');
    }

    // Prima di mostrare le quantità si rilasciano quelle degli ordini
    // scaduti, altrimenti il cliente vedrebbe un esaurito che non c'è.
    await this.ordini.scadiOrdiniNonPagati();

    return this.prodotti.elenca(true);
  }

  @Get('ordini')
  elenca(@UtenteCorrente() utente: UtenteRichiesta): Promise<Ordine[]> {
    return this.ordini.elencaDelCliente(utente.id);
  }

  @Get('ordini/:id')
  leggi(
    @Param('id', ParseUUIDPipe) id: string,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Ordine> {
    return this.ordini.leggiDelCliente(id, utente.id);
  }

  @Post('ordini')
  @LimiteDiFrequenza(10, 300)
  crea(
    @Body(new ValidazioneZodPipe(schemaCreazioneOrdine)) dati: DatiCreazioneOrdine,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<OrdineCreato> {
    return this.ordini.crea(dati, utente.id);
  }

  @Patch('ordini/:id/annulla')
  annulla(
    @Param('id', ParseUUIDPipe) id: string,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Ordine> {
    return this.ordini.annullaDalCliente(id, utente.id);
  }

  @Post('ordini/:id/reso')
  @LimiteDiFrequenza(10, 300)
  chiediReso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidazioneZodPipe(schemaRichiestaReso)) dati: DatiRichiestaReso,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Ordine> {
    return this.resi.richiedi(id, dati, utente.id);
  }
}
