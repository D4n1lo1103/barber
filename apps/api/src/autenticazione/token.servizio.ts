import { createHash, randomBytes, randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { TipoToken } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/** Validità dei token, in ore, per tipo. */
const ORE_VALIDITA: Readonly<Record<TipoToken, number>> = {
  // L'invito ad attivare l'account viene consegnato a mano o inviato: serve
  // tempo perché la persona lo usi.
  attivazione: 7 * 24,
  verifica_email: 48,
  // La reimpostazione della password è un'operazione sensibile: finestra breve.
  reset_password: 2,
  // Il codice di verifica del numero si usa subito: pochi minuti bastano.
  verifica_numero: 0.25,
};

export interface TokenGenerato {
  token: string;
  scadeIl: Date;
}

/**
 * Token a uso singolo inviati per e-mail: attivazione dell'account, verifica
 * dell'indirizzo e reimpostazione della password. Nel database resta solo
 * l'hash, così un accesso in lettura ai dati non permette di usarli.
 */
@Injectable()
export class TokenServizio {
  constructor(private readonly prisma: PrismaService) {}

  private calcolaHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Hash di un codice corto, legato all'utente.
   *
   * Due persone possono ricevere per caso lo stesso codice di sei cifre, e
   * `tokenHash` è unico: legando l'hash all'utente le collisioni scompaiono e
   * un codice vale solo per chi l'ha chiesto.
   */
  private calcolaHashCodice(utenteId: string, codice: string): string {
    return createHash('sha256').update(`${utenteId}:${codice}`).digest('hex');
  }

  /**
   * Genera un token e restituisce il valore in chiaro: viene inserito nel link
   * inviato all'utente e non è più recuperabile.
   */
  async crea(utenteId: string, tipo: TipoToken = 'attivazione'): Promise<TokenGenerato> {
    const token = randomBytes(32).toString('base64url');
    const scadeIl = new Date(Date.now() + ORE_VALIDITA[tipo] * 60 * 60 * 1000);

    // Un nuovo token dello stesso tipo sostituisce quelli ancora validi.
    await this.prisma.tokenUtente.deleteMany({ where: { utenteId, tipo, usatoIl: null } });
    await this.prisma.tokenUtente.create({
      data: { utenteId, tipo, tokenHash: this.calcolaHash(token), scadeIl },
    });

    return { token, scadeIl };
  }

  /**
   * Genera un codice numerico di sei cifre, per la verifica del numero di
   * telefono: va dettato o copiato da un messaggio, quindi deve essere corto.
   *
   * Nel database resta solo l'hash, come per i token lunghi. Un codice corto
   * si indovina più facilmente, perciò la finestra di validità è di pochi
   * minuti e le rotte che lo accettano hanno un limite di frequenza.
   */
  async creaCodice(utenteId: string): Promise<TokenGenerato> {
    // randomInt è uniforme: evita lo sbilanciamento di un modulo su byte casuali.
    const codice = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const scadeIl = new Date(Date.now() + ORE_VALIDITA.verifica_numero * 60 * 60 * 1000);

    await this.prisma.tokenUtente.deleteMany({
      where: { utenteId, tipo: 'verifica_numero', usatoIl: null },
    });
    await this.prisma.tokenUtente.create({
      data: {
        utenteId,
        tipo: 'verifica_numero',
        tokenHash: this.calcolaHashCodice(utenteId, codice),
        scadeIl,
      },
    });

    return { token: codice, scadeIl };
  }

  /**
   * Risolve un codice di verifica sapendo già di chi è: due utenti potrebbero
   * avere lo stesso codice, quindi non basta cercarlo per hash.
   */
  async risolviCodice(utenteId: string, codice: string) {
    const riga = await this.prisma.tokenUtente.findFirst({
      where: {
        utenteId,
        tipo: 'verifica_numero',
        tokenHash: this.calcolaHashCodice(utenteId, codice),
        usatoIl: null,
        scadeIl: { gt: new Date() },
      },
    });

    if (!riga) {
      throw new BadRequestException('Codice non valido o scaduto. Chiedine uno nuovo.');
    }

    return riga;
  }

  /** Verifica il token e restituisce la riga con l'utente a cui appartiene. */
  async risolvi(token: string, tipo: TipoToken = 'attivazione') {
    const riga = await this.prisma.tokenUtente.findUnique({
      where: { tokenHash: this.calcolaHash(token) },
      include: { utente: true },
    });

    if (
      !riga ||
      riga.tipo !== tipo ||
      riga.usatoIl ||
      riga.scadeIl <= new Date() ||
      !riga.utente.attivo
    ) {
      throw new BadRequestException('Link non valido o scaduto.');
    }

    return riga;
  }

  async segnaUsato(id: string): Promise<void> {
    await this.prisma.tokenUtente.update({ where: { id }, data: { usatoIl: new Date() } });
  }

  /** Rimuove i token scaduti o già usati: li ripulisce un'attività periodica. */
  async rimuoviScaduti(): Promise<number> {
    const esito = await this.prisma.tokenUtente.deleteMany({
      where: { OR: [{ scadeIl: { lte: new Date() } }, { usatoIl: { not: null } }] },
    });

    return esito.count;
  }
}
