import { createHash, randomBytes } from 'node:crypto';
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
