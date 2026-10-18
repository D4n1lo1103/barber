import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { UtenteAutenticato } from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessioniServizio, type SessioneCreata } from './sessioni.servizio.js';

/** Parametri di hashing allineati alle raccomandazioni OWASP per Argon2id. */
const OPZIONI_ARGON2: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class AutenticazioneServizio {
  private readonly logger = new Logger(AutenticazioneServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessioni: SessioniServizio,
  ) {}

  async calcolaHashPassword(password: string): Promise<string> {
    return argon2.hash(password, OPZIONI_ARGON2);
  }

  /**
   * Verifica le credenziali. In caso di esito negativo il messaggio è sempre
   * lo stesso, per non rivelare se l'indirizzo e-mail esiste.
   */
  async accedi(
    email: string,
    password: string,
    indirizzoIp?: string,
    agenteUtente?: string,
  ): Promise<{ utente: UtenteAutenticato; sessione: SessioneCreata }> {
    const utente = await this.prisma.utente.findUnique({ where: { email } });
    const hashDaVerificare = utente?.passwordHash ?? null;

    const passwordCorretta = hashDaVerificare
      ? await argon2.verify(hashDaVerificare, password)
      : await this.sprecaTempo(password);

    if (!utente || !passwordCorretta || !utente.attivo) {
      this.logger.warn(`Tentativo di accesso non riuscito da ${indirizzoIp ?? 'origine ignota'}.`);
      throw new UnauthorizedException('Credenziali non valide.');
    }

    // I clienti devono confermare l'indirizzo: è l'unico contatto certo e
    // serve anche per recuperare la password.
    if (utente.ruolo === 'cliente' && !utente.emailVerificata) {
      throw new UnauthorizedException(
        'Conferma il tuo indirizzo e-mail per accedere: controlla la casella di posta.',
      );
    }

    const sessione = await this.sessioni.crea(utente.id, indirizzoIp, agenteUtente);

    await this.prisma.utente.update({
      where: { id: utente.id },
      data: { ultimoAccessoIl: new Date() },
    });

    return {
      utente: {
        id: utente.id,
        email: utente.email,
        nome: utente.nome,
        cognome: utente.cognome,
        ruolo: utente.ruolo,
        attivo: utente.attivo,
      },
      sessione,
    };
  }

  async cambiaPassword(
    utenteId: string,
    passwordAttuale: string,
    passwordNuova: string,
  ): Promise<void> {
    const utente = await this.prisma.utente.findUnique({ where: { id: utenteId } });

    if (!utente?.passwordHash || !(await argon2.verify(utente.passwordHash, passwordAttuale))) {
      throw new UnauthorizedException('La password attuale non è corretta.');
    }

    await this.prisma.utente.update({
      where: { id: utenteId },
      data: { passwordHash: await this.calcolaHashPassword(passwordNuova) },
    });

    // Un cambio password invalida tutte le sessioni, compresa quella corrente.
    await this.sessioni.revocaTutte(utenteId);
  }

  /**
   * Esegue un hash fittizio quando l'utente non esiste, così che il tempo di
   * risposta non permetta di distinguere un indirizzo e-mail registrato.
   */
  private async sprecaTempo(password: string): Promise<false> {
    await argon2.hash(password, OPZIONI_ARGON2);

    return false;
  }
}
