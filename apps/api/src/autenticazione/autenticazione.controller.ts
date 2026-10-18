import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  schemaAccesso,
  schemaAttivazioneAccount,
  schemaCambioPassword,
  schemaConfermaReset,
  schemaRegistrazioneCliente,
  schemaRichiestaReset,
  schemaVerificaEmail,
  type DatiAccesso,
  type DatiAttivazioneAccount,
  type DatiCambioPassword,
  type DatiConfermaReset,
  type DatiRegistrazioneCliente,
  type DatiRichiestaReset,
  type DatiVerificaEmail,
  type EsitoRegistrazione,
  type UtenteAutenticato,
} from '@barber/shared';
import { LimiteDiFrequenza } from '../comuni/decoratori/limite-frequenza.decoratore.js';
import { Pubblico } from '../comuni/decoratori/pubblico.decoratore.js';
import { UtenteCorrente } from '../comuni/decoratori/utente-corrente.decoratore.js';
import { ValidazioneZodPipe } from '../comuni/validazione.pipe.js';
import type { Ambiente } from '../configurazione/ambiente.js';
import type { RichiestaAutenticata, UtenteRichiesta } from '../comuni/tipi-richiesta.js';
import { AutenticazioneServizio } from './autenticazione.servizio.js';
import { RegistrazioneServizio } from './registrazione.servizio.js';
import {
  COOKIE_CSRF,
  COOKIE_SESSIONE,
  SessioniServizio,
  type SessioneCreata,
} from './sessioni.servizio.js';

@Controller('autenticazione')
export class AutenticazioneController {
  constructor(
    private readonly autenticazione: AutenticazioneServizio,
    private readonly registrazione: RegistrazioneServizio,
    private readonly sessioni: SessioniServizio,
    private readonly configurazione: ConfigService<Ambiente, true>,
  ) {}

  /**
   * Registrazione autonoma del cliente. L'account diventa utilizzabile solo
   * dopo la conferma dell'indirizzo e-mail.
   */
  @Pubblico()
  @LimiteDiFrequenza(5, 300)
  @Post('registrazione')
  registra(
    @Body(new ValidazioneZodPipe(schemaRegistrazioneCliente)) dati: DatiRegistrazioneCliente,
  ): Promise<EsitoRegistrazione> {
    return this.registrazione.registraCliente(dati);
  }

  @Pubblico()
  @LimiteDiFrequenza(10, 300)
  @Post('verifica-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verificaEmail(
    @Body(new ValidazioneZodPipe(schemaVerificaEmail)) dati: DatiVerificaEmail,
  ): Promise<void> {
    await this.registrazione.verificaEmail(dati.token);
  }

  /** Nuovo invio del link di verifica. Risposta identica anche se l'indirizzo non esiste. */
  @Pubblico()
  @LimiteDiFrequenza(3, 300)
  @Post('verifica-email/rinvio')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rinviaVerifica(
    @Body(new ValidazioneZodPipe(schemaRichiestaReset)) dati: DatiRichiestaReset,
  ): Promise<void> {
    await this.registrazione.rinviaVerifica(dati.email);
  }

  @Pubblico()
  @LimiteDiFrequenza(3, 300)
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async richiediReset(
    @Body(new ValidazioneZodPipe(schemaRichiestaReset)) dati: DatiRichiestaReset,
  ): Promise<void> {
    await this.registrazione.richiediReset(dati.email);
  }

  @Pubblico()
  @LimiteDiFrequenza(5, 300)
  @Post('reset-password/conferma')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confermaReset(
    @Body(new ValidazioneZodPipe(schemaConfermaReset)) dati: DatiConfermaReset,
  ): Promise<void> {
    await this.registrazione.confermaReset(dati.token, dati.password);
  }

  /**
   * Attivazione dell'account da un invito: vale per i dipendenti creati dal
   * titolare e per i clienti con scheda creata dal personale.
   */
  @Pubblico()
  @LimiteDiFrequenza(5, 300)
  @Post('attivazione')
  @HttpCode(HttpStatus.NO_CONTENT)
  async attiva(
    @Body(new ValidazioneZodPipe(schemaAttivazioneAccount)) dati: DatiAttivazioneAccount,
  ): Promise<void> {
    await this.registrazione.attivaAccount(dati.token, dati.password, dati.email);
  }

  /** Limite di frequenza stretto: protegge dagli attacchi a forza bruta. */
  @Pubblico()
  @LimiteDiFrequenza(5, 60)
  @Post('accesso')
  @HttpCode(HttpStatus.OK)
  async accedi(
    @Body(new ValidazioneZodPipe(schemaAccesso)) dati: DatiAccesso,
    @Req() richiesta: RichiestaAutenticata,
    @Res({ passthrough: true }) risposta: Response,
  ): Promise<{ utente: UtenteAutenticato }> {
    const { utente, sessione } = await this.autenticazione.accedi(
      dati.email,
      dati.password,
      richiesta.ip,
      richiesta.headers['user-agent'],
    );

    this.impostaCookie(risposta, sessione);

    return { utente };
  }

  @Post('uscita')
  @HttpCode(HttpStatus.NO_CONTENT)
  async esci(
    @Req() richiesta: RichiestaAutenticata,
    @Res({ passthrough: true }) risposta: Response,
  ): Promise<void> {
    if (richiesta.tokenSessione) {
      await this.sessioni.revoca(richiesta.tokenSessione);
    }

    this.rimuoviCookie(risposta);
  }

  @Get('io')
  leggiUtenteCorrente(@UtenteCorrente() utente?: UtenteRichiesta): { utente: UtenteAutenticato } {
    if (!utente) {
      throw new UnauthorizedException('Accesso non autorizzato.');
    }

    return { utente };
  }

  @Post('cambio-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @LimiteDiFrequenza(5, 60)
  async cambiaPassword(
    @Body(new ValidazioneZodPipe(schemaCambioPassword)) dati: DatiCambioPassword,
    @UtenteCorrente() utente: UtenteRichiesta,
    @Res({ passthrough: true }) risposta: Response,
  ): Promise<void> {
    await this.autenticazione.cambiaPassword(utente.id, dati.passwordAttuale, dati.passwordNuova);

    this.rimuoviCookie(risposta);
  }

  private eInProduzione(): boolean {
    return this.configurazione.get('NODE_ENV', { infer: true }) === 'production';
  }

  private impostaCookie(risposta: Response, sessione: SessioneCreata): void {
    const sicuro = this.eInProduzione();

    risposta.cookie(COOKIE_SESSIONE, sessione.token, {
      httpOnly: true,
      secure: sicuro,
      sameSite: 'strict',
      path: '/',
      expires: sessione.scadeIl,
    });

    // Leggibile dal frontend: va rispedito nell'header per la verifica CSRF.
    risposta.cookie(COOKIE_CSRF, sessione.tokenCsrf, {
      httpOnly: false,
      secure: sicuro,
      sameSite: 'strict',
      path: '/',
      expires: sessione.scadeIl,
    });
  }

  private rimuoviCookie(risposta: Response): void {
    const opzioni = {
      httpOnly: true,
      secure: this.eInProduzione(),
      sameSite: 'strict' as const,
      path: '/',
    };

    risposta.clearCookie(COOKIE_SESSIONE, opzioni);
    risposta.clearCookie(COOKIE_CSRF, { ...opzioni, httpOnly: false });
  }
}
