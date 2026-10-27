import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import type { DatiRegistrazioneCliente, EsitoRegistrazione } from '@barber/shared';
import { NotificheServizio } from '../notifiche/notifiche.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AutenticazioneServizio } from './autenticazione.servizio.js';
import { SessioniServizio } from './sessioni.servizio.js';
import { TokenServizio } from './token.servizio.js';

/**
 * Registrazione autonoma del cliente, verifica dell'indirizzo e-mail e
 * reimpostazione della password.
 *
 * La registrazione **non tocca mai una scheda già esistente**, nemmeno quando
 * il numero indicato coincide: il numero è un dato che chiunque può scrivere
 * nel modulo, e usarlo come prova d'identità permetterebbe a un estraneo di
 * impossessarsi della scheda di un cliente, con il suo storico e il suo
 * credito. Nasce sempre un account nuovo, con il numero da verificare.
 *
 * Il collegamento alla scheda creata dal personale avviene dopo, quando il
 * cliente verifica il numero con il codice che riceve su WhatsApp: è lì che si
 * dimostra di possedere davvero quel numero. Vedi
 * `VerificaNumeroServizio.confermaCodice`.
 */
@Injectable()
export class RegistrazioneServizio {
  private readonly logger = new Logger(RegistrazioneServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autenticazione: AutenticazioneServizio,
    private readonly token: TokenServizio,
    private readonly notifiche: NotificheServizio,
    private readonly sessioni: SessioniServizio,
  ) {}

  async registraCliente(dati: DatiRegistrazioneCliente): Promise<EsitoRegistrazione> {
    const perEmail = await this.prisma.utente.findUnique({ where: { email: dati.email } });

    if (perEmail) {
      throw new ConflictException(
        'Esiste già un account con questo indirizzo e-mail. Accedi, oppure reimposta la password.',
      );
    }

    // Un numero già verificato, o in uso a un account con password, appartiene
    // a qualcuno che l'ha dimostrato: non lo si può richiedere di nuovo. Una
    // scheda creata dal personale, invece, non blocca nessuno: resta dov'è e
    // verrà unita a chi dimostrerà di possedere il numero.
    const giaRivendicato = await this.prisma.utente.findFirst({
      where: {
        numeroWhatsapp: dati.numeroWhatsapp,
        OR: [
          { ruolo: { not: 'cliente' } },
          { passwordHash: { not: null } },
          { numeroVerificato: true },
        ],
      },
      select: { id: true },
    });

    if (giaRivendicato) {
      throw new ConflictException(
        'Questo numero è già collegato a un account. Accedi, oppure reimposta la password.',
      );
    }

    const adesso = new Date();
    const cliente = await this.prisma.utente.create({
      data: {
        nome: dati.nome,
        cognome: dati.cognome,
        email: dati.email,
        numeroWhatsapp: dati.numeroWhatsapp,
        ruolo: 'cliente',
        passwordHash: await this.autenticazione.calcolaHashPassword(dati.password),
        emailVerificata: false,
        // Il numero vale solo come recapito finché non arriva il codice.
        numeroVerificato: false,
        consensoTrattamentoIl: adesso,
        consensoWhatsappIl: dati.consensoWhatsapp ? adesso : null,
      },
    });

    const invito = await this.token.crea(cliente.id, 'verifica_email');

    await this.notifiche.inviaVerificaEmail(
      { nome: cliente.nome, email: dati.email },
      invito.token,
    );

    this.logger.log('Nuova registrazione cliente.');

    return { email: dati.email };
  }

  /** Conferma dell'indirizzo: da qui l'account del cliente è utilizzabile. */
  async verificaEmail(token: string): Promise<void> {
    const riga = await this.token.risolvi(token, 'verifica_email');

    await this.prisma.utente.update({
      where: { id: riga.utenteId },
      data: { emailVerificata: true },
    });
    await this.token.segnaUsato(riga.id);
  }

  /** Nuovo invio della verifica, se la prima e-mail non è arrivata. */
  async rinviaVerifica(email: string): Promise<void> {
    const utente = await this.prisma.utente.findUnique({ where: { email } });

    // Risposta identica anche quando l'indirizzo non esiste: non si rivela
    // quali indirizzi sono registrati.
    if (!utente || utente.emailVerificata || !utente.attivo) {
      return;
    }

    const invito = await this.token.crea(utente.id, 'verifica_email');

    await this.notifiche.inviaVerificaEmail({ nome: utente.nome, email }, invito.token);
  }

  /**
   * Richiesta di reimpostazione: la risposta non cambia se l'indirizzo non
   * esiste, per non rivelare chi è registrato.
   */
  async richiediReset(email: string): Promise<void> {
    const utente = await this.prisma.utente.findUnique({ where: { email } });

    if (!utente || !utente.attivo || !utente.passwordHash) {
      this.logger.warn('Richiesta di reimpostazione per un indirizzo non utilizzabile.');

      return;
    }

    const invito = await this.token.crea(utente.id, 'reset_password');

    await this.notifiche.inviaResetPassword({ nome: utente.nome, email }, invito.token);
  }

  /** Conferma della reimpostazione: revoca tutte le sessioni aperte. */
  async confermaReset(token: string, password: string): Promise<void> {
    const riga = await this.token.risolvi(token, 'reset_password');

    await this.prisma.utente.update({
      where: { id: riga.utenteId },
      data: {
        passwordHash: await this.autenticazione.calcolaHashPassword(password),
        // Chi reimposta la password dal link ha dimostrato di avere accesso
        // alla casella: l'indirizzo è verificato.
        emailVerificata: true,
      },
    });
    await this.token.segnaUsato(riga.id);
    await this.sessioni.revocaTutte(riga.utenteId);
  }

  /**
   * Attivazione dell'account da un invito: la password la scegli chi attiva l'account.
   * Per i clienti con scheda creata dal personale senza e-mail, l'indirizzo
   * viene chiesto adesso: senza non potrebbero accedere.
   */
  async attivaAccount(token: string, password: string, email?: string): Promise<void> {
    const riga = await this.token.risolvi(token, 'attivazione');
    const utente = riga.utente;

    if (!utente.email && !email) {
      throw new BadRequestException(
        'Indica un indirizzo e-mail: ti servirà per accedere e per recuperare la password.',
      );
    }

    if (email && email !== utente.email) {
      const altro = await this.prisma.utente.findFirst({
        where: { email, id: { not: utente.id } },
      });

      if (altro) {
        throw new ConflictException('Esiste già un account con questo indirizzo e-mail.');
      }
    }

    await this.prisma.utente.update({
      where: { id: utente.id },
      data: {
        passwordHash: await this.autenticazione.calcolaHashPassword(password),
        email: email ?? utente.email,
        emailVerificata: true,
        // Chi attiva l'account accetta il trattamento dei dati: il consenso
        // viene registrato con il momento dell'attivazione.
        consensoTrattamentoIl: utente.consensoTrattamentoIl ?? new Date(),
      },
    });
    await this.token.segnaUsato(riga.id);
  }
}
