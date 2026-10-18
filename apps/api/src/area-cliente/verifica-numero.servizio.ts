import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import type { EsitoRichiestaCodice } from '@barber/shared';
import { TokenServizio } from '../autenticazione/token.servizio.js';
import { NotificheServizio } from '../notifiche/notifiche.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Verifica del numero di telefono del cliente con un codice di sei cifre.
 *
 * Il codice arriva su WhatsApp, che è il canale da verificare; se il salone non
 * ha ancora attivato WhatsApp arriva via e-mail, così la verifica resta
 * possibile. Un numero verificato è quello che permette di collegare con
 * sicurezza una scheda creata dal personale.
 */
@Injectable()
export class VerificaNumeroServizio {
  private readonly logger = new Logger(VerificaNumeroServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly token: TokenServizio,
    private readonly notifiche: NotificheServizio,
  ) {}

  /** Invia un codice al numero del cliente. */
  async inviaCodice(clienteId: string): Promise<EsitoRichiestaCodice> {
    const cliente = await this.prisma.utente.findUniqueOrThrow({
      where: { id: clienteId },
      select: {
        nome: true,
        email: true,
        numeroWhatsapp: true,
        numeroVerificato: true,
        consensoWhatsappIl: true,
      },
    });

    if (!cliente.numeroWhatsapp) {
      throw new BadRequestException('Indica prima il tuo numero WhatsApp.');
    }

    if (cliente.numeroVerificato) {
      throw new ConflictException('Il tuo numero è già verificato.');
    }

    const codice = await this.token.creaCodice(clienteId);
    const canale = await this.notifiche.inviaCodiceVerificaNumero(
      {
        nome: cliente.nome,
        email: cliente.email,
        numeroWhatsapp: cliente.numeroWhatsapp,
        // Il codice di verifica è il messaggio che rende possibile il
        // consenso: si invia anche a chi non l'ha ancora dato.
        consensoWhatsapp: true,
      },
      codice.token,
    );

    if (canale === 'nessuno') {
      throw new BadRequestException(
        'Non è stato possibile inviare il codice: controlla numero e indirizzo e-mail.',
      );
    }

    return { canale, scadeIl: codice.scadeIl.toISOString() };
  }

  /**
   * Conferma il codice. Un numero già verificato da un altro account viene
   * rifiutato: due schede con lo stesso numero verificato non devono esistere.
   */
  async confermaCodice(clienteId: string, codice: string): Promise<void> {
    const riga = await this.token.risolviCodice(clienteId, codice);
    const cliente = await this.prisma.utente.findUniqueOrThrow({
      where: { id: clienteId },
      select: { numeroWhatsapp: true },
    });

    if (!cliente.numeroWhatsapp) {
      throw new BadRequestException('Indica prima il tuo numero WhatsApp.');
    }

    const altro = await this.prisma.utente.findFirst({
      where: {
        id: { not: clienteId },
        numeroWhatsapp: cliente.numeroWhatsapp,
        numeroVerificato: true,
      },
      select: { id: true },
    });

    if (altro) {
      throw new ConflictException(
        'Questo numero è già verificato su un altro account. Contatta il salone.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.utente.update({ where: { id: clienteId }, data: { numeroVerificato: true } }),
      this.prisma.tokenUtente.update({ where: { id: riga.id }, data: { usatoIl: new Date() } }),
    ]);

    this.logger.log('Numero di telefono verificato.');
  }
}
