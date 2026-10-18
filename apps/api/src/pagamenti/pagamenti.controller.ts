import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  schemaEsitoFinto,
  schemaRestituzioneDiscrezionale,
  type ConfigurazionePagamenti,
  type DatiEsitoFinto,
  type DatiRestituzioneDiscrezionale,
  type PagamentoDaCompletare,
  type SituazioneCaparre,
} from '@barber/shared';
import { LimiteDiFrequenza } from '../comuni/decoratori/limite-frequenza.decoratore.js';
import { Pubblico } from '../comuni/decoratori/pubblico.decoratore.js';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import type { UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import { CaparraServizio } from './caparra.servizio.js';
import { FIRMA_FINTA } from './fornitore-finto.js';
import { FORNITORE_PAGAMENTI, type FornitorePagamenti } from './fornitore-pagamenti.js';
import { PagamentiServizio } from './pagamenti.servizio.js';

/** Intestazione con cui Stripe firma ogni evento. */
const HEADER_FIRMA = 'stripe-signature';

/**
 * Pagamenti della caparra.
 *
 * Il webhook è pubblico perché lo chiama il fornitore, non un utente: la sua
 * autenticazione è la **firma** dell'evento, verificata dal fornitore prima di
 * elaborare qualsiasi cosa. La protezione CSRF non lo riguarda, perché non
 * arriva con un cookie di sessione.
 */
@Controller('pagamenti')
@UseGuards(RuoliGuardia)
export class PagamentiController {
  constructor(
    private readonly pagamenti: PagamentiServizio,
    private readonly caparra: CaparraServizio,
    @Inject(FORNITORE_PAGAMENTI) private readonly fornitore: FornitorePagamenti,
  ) {}

  /** Come sono configurati i pagamenti: l'interfaccia dichiara i pagamenti finti. */
  @Get('configurazione')
  @Pubblico()
  leggiConfigurazione(): ConfigurazionePagamenti {
    return { finto: this.fornitore.finto };
  }

  /** Movimenti e credito di un cliente: dati economici, solo per il titolare. */
  @Get('clienti/:id/situazione')
  @Ruoli('titolare')
  leggiSituazione(@Param('id', ParseUUIDPipe) id: string): Promise<SituazioneCaparre> {
    return this.caparra.situazioneDelCliente(id);
  }

  @Post('webhook')
  @Pubblico()
  @HttpCode(204)
  async riceviEvento(@Req() richiesta: Request & { rawBody?: Buffer }): Promise<void> {
    const corpo = richiesta.rawBody;

    if (!corpo) {
      throw new BadRequestException('Evento senza corpo.');
    }

    const firma = richiesta.headers[HEADER_FIRMA];

    await this.pagamenti.riceviEvento(corpo, typeof firma === 'string' ? firma : undefined);
  }

  /** Apre (o riapre) il pagamento della caparra di un proprio appuntamento. */
  @Post('appuntamenti/:id')
  @Ruoli('cliente')
  @LimiteDiFrequenza(10, 300)
  avvia(
    @Param('id', ParseUUIDPipe) id: string,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<PagamentoDaCompletare> {
    return this.pagamenti.avviaCaparra(id, utente.id);
  }

  /**
   * Restituzione discrezionale di una caparra trattenuta: solo il titolare, con
   * motivazione obbligatoria. L'operazione resta nei movimenti.
   */
  @Post('appuntamenti/:id/restituzione')
  @Ruoli('titolare')
  @HttpCode(204)
  async restituisci(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidazioneZodPipe(schemaRestituzioneDiscrezionale))
    dati: DatiRestituzioneDiscrezionale,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<void> {
    await this.pagamenti.restituisciInViaDiscrezionale({
      appuntamentoId: id,
      forma: dati.forma,
      motivo: dati.motivo,
      titolareId: utente.id,
    });
  }

  /**
   * Esito scelto sulla pagina di pagamento finta. Esiste solo quando il
   * fornitore è finto: con Stripe configurato la rotta non risponde, così non
   * può diventare una scorciatoia per confermare un pagamento mai avvenuto.
   */
  @Post('finto/esito')
  @Pubblico()
  @LimiteDiFrequenza(20, 300)
  @HttpCode(204)
  async esitoFinto(
    @Body(new ValidazioneZodPipe(schemaEsitoFinto)) dati: DatiEsitoFinto,
  ): Promise<void> {
    if (!this.fornitore.finto) {
      throw new NotFoundException();
    }

    const evento = this.fornitore.interpretaEvento(Buffer.from(JSON.stringify(dati)), FIRMA_FINTA);

    await this.pagamenti.elaboraEvento(evento);
  }
}
