import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Validità dell'invito ad attivare l'account. */
export const GIORNI_VALIDITA_INVITO = 7;

@Injectable()
export class InvitiServizio {
  constructor(private readonly prisma: PrismaService) {}

  private calcolaHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Genera un invito per un utente e restituisce il token in chiaro:
   * viene mostrato una sola volta a chi crea l'account e, dalla fase 5,
   * inviato per e-mail. Nel database resta solo l'hash.
   */
  async crea(utenteId: string): Promise<{ token: string; scadeIl: Date }> {
    const token = randomBytes(32).toString('base64url');
    const scadeIl = new Date(Date.now() + GIORNI_VALIDITA_INVITO * 24 * 60 * 60 * 1000);

    // Un nuovo invito sostituisce quelli ancora validi dello stesso utente.
    await this.prisma.invitoAttivazione.deleteMany({ where: { utenteId, usatoIl: null } });
    await this.prisma.invitoAttivazione.create({
      data: { utenteId, tokenHash: this.calcolaHash(token), scadeIl },
    });

    return { token, scadeIl };
  }

  /** Verifica il token e restituisce l'utente a cui appartiene. */
  async risolvi(token: string) {
    const invito = await this.prisma.invitoAttivazione.findUnique({
      where: { tokenHash: this.calcolaHash(token) },
      include: { utente: true },
    });

    if (!invito || invito.usatoIl || invito.scadeIl <= new Date() || !invito.utente.attivo) {
      throw new BadRequestException('Link di attivazione non valido o scaduto.');
    }

    return invito;
  }

  async segnaUsato(id: string): Promise<void> {
    await this.prisma.invitoAttivazione.update({
      where: { id },
      data: { usatoIl: new Date() },
    });
  }
}
