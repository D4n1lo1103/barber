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
 * Se il numero WhatsApp indicato appartiene già a una scheda creata dal
 * personale, la registrazione **non** crea un duplicato: prende quella scheda,
 * con il suo storico. L'account diventa utilizzabile solo dopo la verifica
 * dell'e-mail, quindi il collegamento richiede sempre una casella verificata.
 *
 * La verifica del numero di telefono arriva con i messaggi WhatsApp (fase 7):
 * fino ad allora `numeroVerificato` resta falso.
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

    const perNumero = await this.prisma.utente.findFirst({
      where: { numeroWhatsapp: dati.numeroWhatsapp },
    });

    if (perNumero && (perNumero.ruolo !== 'cliente' || perNumero.passwordHash)) {
      // Numero del personale, o scheda che ha già un account attivo.
      throw new ConflictException(
        'Questo numero è già collegato a un account. Accedi, oppure reimposta la password.',
      );
    }

    const adesso = new Date();
    const datiComuni = {
      nome: dati.nome,
      cognome: dati.cognome,
      email: dati.email,
      numeroWhatsapp: dati.numeroWhatsapp,
      passwordHash: await this.autenticazione.calcolaHashPassword(dati.password),
      emailVerificata: false,
      consensoTrattamentoIl: adesso,
      consensoWhatsappIl: dati.consensoWhatsapp ? adesso : null,
    };

    const cliente = perNumero
      ? await this.prisma.utente.update({ where: { id: perNumero.id }, data: datiComuni })
      : await this.prisma.utente.create({ data: { ...datiComuni, ruolo: 'cliente' } });

    const invito = await this.token.crea(cliente.id, 'verifica_email');

    await this.notifiche.inviaVerificaEmail(
      { nome: cliente.nome, email: dati.email },
      invito.token,
    );

    this.logger.log(
      perNumero
        ? 'Registrazione collegata a una scheda cliente già presente.'
        : 'Nuova registrazione cliente.',
    );

    return { email: dati.email, collegataASchedaEsistente: perNumero !== null };
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
