import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ORE_MINIME_PRENOTAZIONE_CLIENTE,
  schemaCodiceVerificaNumero,
  schemaModificaProfilo,
  schemaPrenotazioneCliente,
  schemaRichiestaCancellazioneDati,
  schemaRichiestaDisponibilita,
  schemaSpostamentoCliente,
  type AppuntamentoCliente,
  type DatiCodiceVerificaNumero,
  type DatiModificaProfilo,
  type DatiPrenotazioneCliente,
  type DatiRichiestaCancellazioneDati,
  type DatiRichiestaDisponibilita,
  type DatiSpostamentoCliente,
  type DisponibilitaGiorno,
  type EsitoRichiestaCodice,
  type EsportazioneDati,
  type OperatorePubblico,
  type ProfiloCliente,
  type RichiestaCancellazione,
  type Servizio,
} from '@barber/shared';
import { AppuntamentiServizio } from '../appuntamenti/appuntamenti.servizio.js';
import { DisponibilitaServizio } from '../appuntamenti/disponibilita.servizio.js';
import { LimiteDiFrequenza } from '../comuni/decoratori/limite-frequenza.decoratore.js';
import { Ruoli } from '../comuni/decoratori/ruoli.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { RuoliGuardia } from '../comuni/guardie/ruoli.guardia.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import type { UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { PersonaleServizio } from '../personale/personale.servizio.js';
import { ServiziServizio } from '../servizi/servizi.servizio.js';
import { AreaClienteServizio } from './area-cliente.servizio.js';
import { VerificaNumeroServizio } from './verifica-numero.servizio.js';

/**
 * Area del cliente: ogni rotta agisce solo sui propri dati, letti dalla
 * sessione. Le regole sono quelle del salone: almeno due ore di preavviso per
 * prenotare, annullamento e spostamento solo entro il limite di preavviso.
 */
@Controller('area-cliente')
@UseGuards(RuoliGuardia)
@Ruoli('cliente')
export class AreaClienteController {
  constructor(
    private readonly areaCliente: AreaClienteServizio,
    private readonly appuntamenti: AppuntamentiServizio,
    private readonly disponibilita: DisponibilitaServizio,
    private readonly servizi: ServiziServizio,
    private readonly personale: PersonaleServizio,
    private readonly verificaNumero: VerificaNumeroServizio,
  ) {}

  /**
   * Catalogo e operatori che il cliente può scegliere.
   *
   * Degli operatori escono solo identificativo e nome: e-mail, numero
   * personale, ruolo e stato dell'account sono dati del personale e per
   * scegliere con chi prenotare non servono.
   */
  @Get('catalogo')
  async leggiCatalogo(): Promise<{ servizi: Servizio[]; operatori: OperatorePubblico[] }> {
    const [catalogo, personale] = await Promise.all([
      this.servizi.elenca(),
      this.personale.elenca(),
    ]);

    return {
      servizi: catalogo.filter((servizio) => servizio.attivo),
      operatori: personale
        .filter((operatore) => operatore.attivo)
        .map(({ id, nome, cognome }) => ({ id, nome, cognome })),
    };
  }

  @Get('appuntamenti')
  async elencaAppuntamenti(
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<{ appuntamenti: AppuntamentoCliente[] }> {
    const propri = await this.appuntamenti.elencaPerAreaCliente(utente.id);

    return { appuntamenti: await this.areaCliente.componiPerCliente(propri) };
  }

  @Get('disponibilita')
  calcolaDisponibilita(
    @Query(new ValidazioneZodPipe(schemaRichiestaDisponibilita)) dati: DatiRichiestaDisponibilita,
  ): Promise<{ giorni: DisponibilitaGiorno[] }> {
    return this.disponibilita
      .calcola(dati, { oreMinimePreavviso: ORE_MINIME_PRENOTAZIONE_CLIENTE })
      .then((giorni) => ({ giorni }));
  }

  @Post('appuntamenti')
  @LimiteDiFrequenza(10, 300)
  async prenota(
    @Body(new ValidazioneZodPipe(schemaPrenotazioneCliente)) dati: DatiPrenotazioneCliente,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<{ appuntamento: AppuntamentoCliente }> {
    await this.areaCliente.verificaSchedaUtilizzabile(utente.id);
    const creato = await this.appuntamenti.prenotaComeCliente(utente.id, dati);
    const [composto] = await this.areaCliente.componiPerCliente([creato]);

    return { appuntamento: composto! };
  }

  @Post('appuntamenti/:id/spostamento')
  @LimiteDiFrequenza(10, 300)
  async sposta(
    @Param('id') id: string,
    @Body(new ValidazioneZodPipe(schemaSpostamentoCliente)) dati: DatiSpostamentoCliente,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<{ appuntamento: AppuntamentoCliente }> {
    const spostato = await this.appuntamenti.spostaComeCliente(id, utente.id, dati.inizio);
    const [composto] = await this.areaCliente.componiPerCliente([spostato]);

    return { appuntamento: composto! };
  }

  @Post('appuntamenti/:id/annullamento')
  @LimiteDiFrequenza(10, 300)
  async annulla(
    @Param('id') id: string,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<{ appuntamento: AppuntamentoCliente }> {
    const annullato = await this.appuntamenti.annullaComeCliente(id, utente.id);
    const [composto] = await this.areaCliente.componiPerCliente([annullato]);

    return { appuntamento: composto! };
  }

  /**
   * Chiede un codice per verificare il proprio numero: arriva su WhatsApp,
   * oppure via e-mail se il salone non ha attivato i messaggi.
   */
  @Post('numero/codice')
  @LimiteDiFrequenza(3, 900)
  chiediCodiceNumero(@UtenteCorrente() utente: UtenteRichiesta): Promise<EsitoRichiestaCodice> {
    return this.verificaNumero.inviaCodice(utente.id);
  }

  @Post('numero/verifica')
  @LimiteDiFrequenza(10, 900)
  @HttpCode(204)
  async confermaCodiceNumero(
    @Body(new ValidazioneZodPipe(schemaCodiceVerificaNumero)) dati: DatiCodiceVerificaNumero,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<void> {
    await this.verificaNumero.confermaCodice(utente.id, dati.codice);
  }

  @Get('profilo')
  leggiProfilo(@UtenteCorrente() utente: UtenteRichiesta): Promise<ProfiloCliente> {
    return this.areaCliente.leggiProfilo(utente.id);
  }

  @Patch('profilo')
  modificaProfilo(
    @Body(new ValidazioneZodPipe(schemaModificaProfilo)) dati: DatiModificaProfilo,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<ProfiloCliente> {
    return this.areaCliente.modificaProfilo(utente.id, dati);
  }

  /** Copia dei propri dati (diritto di accesso). */
  @Get('dati')
  esportaDati(@UtenteCorrente() utente: UtenteRichiesta): Promise<EsportazioneDati> {
    return this.areaCliente.esportaDati(utente.id);
  }

  @Get('cancellazione')
  leggiRichiesta(
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<{ richiesta: RichiestaCancellazione | null }> {
    return this.areaCliente.leggiRichiestaCorrente(utente.id).then((richiesta) => ({ richiesta }));
  }

  @Post('cancellazione')
  @LimiteDiFrequenza(3, 3600)
  richiediCancellazione(
    @Body(new ValidazioneZodPipe(schemaRichiestaCancellazioneDati))
    dati: DatiRichiestaCancellazioneDati,
    @UtenteCorrente() utente: UtenteRichiesta,
  ): Promise<RichiestaCancellazione> {
    return this.areaCliente.richiediCancellazione(utente.id, dati.motivo);
  }
}
