import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  schemaAnnullamentoVendita,
  schemaCreazioneProdotto,
  schemaCreazioneVendita,
  schemaModificaProdotto,
  schemaMovimentoGiacenza,
  schemaRicercaVendite,
  type DatiAnnullamentoVendita,
  type DatiCreazioneProdotto,
  type DatiCreazioneVendita,
  type DatiModificaProdotto,
  type DatiMovimentoGiacenza,
  type DatiRicercaVendite,
  type ElencoVendite,
  type MovimentoMagazzino,
  type Prodotto,
  type Vendita,
} from '@barber/shared';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import type { UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { ProdottiServizio } from './prodotti.servizio.js';
import { VenditeServizio } from './vendite.servizio.js';

/**
 * Prodotti, magazzino e vendite in negozio.
 *
 * Il personale consulta il catalogo, vende e vede le scorte basse; il
 * **catalogo e le giacenze li governa solo il titolare**, come deciso: il
 * personale scarica il magazzino vendendo, non correggendo le quantità.
 */
@Controller()
@UseGuards(RuoliGuardia)
export class ProdottiController {
  constructor(
    private readonly prodotti: ProdottiServizio,
    private readonly vendite: VenditeServizio,
  ) {}

  @Get('prodotti')
  @Ruoli('titolare', 'dipendente')
  elenca(@UtenteCorrente() utente: UtenteRichiesta): Promise<Prodotto[]> {
    // Al dipendente servono i prodotti vendibili; il titolare vede anche i
    // disattivati, per riattivarli o correggerli.
    return this.prodotti.elenca(utente.ruolo !== 'titolare');
  }

  /** Prodotti arrivati alla scorta minima: l'avviso lo vede tutto il personale. */
  @Get('prodotti/sotto-scorta')
  @Ruoli('titolare', 'dipendente')
  sottoScorta(): Promise<Prodotto[]> {
    return this.prodotti.sottoScorta();
  }

  @Post('prodotti')
  @Ruoli('titolare')
  crea(
    @Body(new ValidazioneZodPipe(schemaCreazioneProdotto)) dati: DatiCreazioneProdotto,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Prodotto> {
    return this.prodotti.crea(dati, utente.id);
  }

  @Patch('prodotti/:id')
  @Ruoli('titolare')
  modifica(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidazioneZodPipe(schemaModificaProdotto)) dati: DatiModificaProdotto,
  ): Promise<Prodotto> {
    return this.prodotti.modifica(id, dati);
  }

  @Delete('prodotti/:id')
  @Ruoli('titolare')
  disattiva(@Param('id', ParseUUIDPipe) id: string): Promise<Prodotto> {
    return this.prodotti.disattiva(id);
  }

  @Put('prodotti/ordine')
  @Ruoli('titolare')
  riordina(@Body() corpo: { ordine: string[] }): Promise<Prodotto[]> {
    return this.prodotti.riordina(corpo.ordine ?? []);
  }

  /** Carico o correzione della giacenza: solo il titolare, sempre motivata. */
  @Post('prodotti/:id/movimenti')
  @Ruoli('titolare')
  registraMovimento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidazioneZodPipe(schemaMovimentoGiacenza)) dati: DatiMovimentoGiacenza,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Prodotto> {
    return this.prodotti.registraMovimento(id, dati, utente.id);
  }

  @Get('prodotti/:id/movimenti')
  @Ruoli('titolare')
  movimenti(@Param('id', ParseUUIDPipe) id: string): Promise<MovimentoMagazzino[]> {
    return this.prodotti.movimenti(id);
  }

  @Get('vendite')
  @Ruoli('titolare', 'dipendente')
  elencaVendite(
    @Query(new ValidazioneZodPipe(schemaRicercaVendite)) dati: DatiRicercaVendite,
  ): Promise<ElencoVendite> {
    return this.vendite.elenca(dati);
  }

  @Post('vendite')
  @Ruoli('titolare', 'dipendente')
  registraVendita(
    @Body(new ValidazioneZodPipe(schemaCreazioneVendita)) dati: DatiCreazioneVendita,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Vendita> {
    return this.vendite.registra(dati, utente.id);
  }

  @Post('vendite/:id/annullamento')
  @Ruoli('titolare', 'dipendente')
  annullaVendita(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidazioneZodPipe(schemaAnnullamentoVendita)) dati: DatiAnnullamentoVendita,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<Vendita> {
    return this.vendite.annulla(id, dati, utente.id);
  }
}
