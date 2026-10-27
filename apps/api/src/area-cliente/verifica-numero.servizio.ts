import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { EsitoRichiestaCodice } from '@barber/shared';
import { TokenServizio } from '../autenticazione/token.servizio.js';
import { NotificheServizio } from '../notifiche/notifiche.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Verifica del numero di telefono del cliente con un codice di sei cifre.
 *
 * Il codice parte **solo su WhatsApp**, cioè sul canale da verificare: un
 * codice recapitato via e-mail dimostrerebbe soltanto che chi lo riceve
 * possiede quella casella, e con quella prova si otterrebbe la scheda legata a
 * un numero di qualcun altro. Se il salone non ha ancora attivato WhatsApp la
 * verifica non è disponibile.
 *
 * Un numero verificato è l'unica cosa che permette di unire a sé una scheda
 * creata dal personale.
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

    if (canale !== 'whatsapp') {
      throw new BadRequestException(
        'La verifica del numero richiede i messaggi WhatsApp, che il salone non ha attivato. ' +
          'Contatta il salone.',
      );
    }

    return { canale, scadeIl: codice.scadeIl.toISOString() };
  }

  /**
   * Conferma il codice. Un numero già verificato da un altro account viene
   * rifiutato: due schede con lo stesso numero verificato non devono esistere.
   *
   * Dimostrato il possesso del numero, le schede non rivendicate con lo stesso
   * numero — quelle che il personale ha creato per una prenotazione al
   * telefono — vengono unite a questo account, con il loro storico.
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

    const numeroWhatsapp = cliente.numeroWhatsapp;
    const altro = await this.prisma.utente.findFirst({
      where: {
        id: { not: clienteId },
        numeroWhatsapp,
        numeroVerificato: true,
      },
      select: { id: true },
    });

    if (altro) {
      throw new ConflictException(
        'Questo numero è già verificato su un altro account. Contatta il salone.',
      );
    }

    const unite = await this.prisma.$transaction(async (transazione) => {
      await transazione.utente.update({
        where: { id: clienteId },
        data: { numeroVerificato: true },
      });
      await transazione.tokenUtente.update({
        where: { id: riga.id },
        data: { usatoIl: new Date() },
      });

      return this.unisciSchedeNonRivendicate(transazione, clienteId, numeroWhatsapp);
    });

    this.logger.log(
      unite > 0
        ? `Numero di telefono verificato: ${unite} scheda/e del salone unita/e all'account.`
        : 'Numero di telefono verificato.',
    );
  }

  /**
   * Unisce all'account le schede con lo stesso numero che non appartengono
   * ancora a nessuno: niente password, numero non verificato, non anonimizzate.
   * Sono le schede che il personale crea per chi prenota al telefono.
   *
   * Lo storico viene spostato riga per riga e la scheda vuota viene eliminata,
   * così il cliente ne ha una sola. Ogni relazione che punta al cliente ha
   * `onDelete: Restrict`: se un domani ne venisse aggiunta una che qui non
   * viene spostata, l'eliminazione fallirebbe e l'intera transazione verrebbe
   * annullata, invece di perdere dati in silenzio.
   */
  private async unisciSchedeNonRivendicate(
    transazione: Prisma.TransactionClient,
    clienteId: string,
    numeroWhatsapp: string,
  ): Promise<number> {
    const schede = await transazione.utente.findMany({
      where: {
        id: { not: clienteId },
        numeroWhatsapp,
        ruolo: 'cliente',
        passwordHash: null,
        numeroVerificato: false,
        anonimizzataIl: null,
      },
      select: { id: true, note: true },
    });

    if (schede.length === 0) {
      return 0;
    }

    const destinatario = await transazione.utente.findUniqueOrThrow({
      where: { id: clienteId },
      select: { note: true },
    });

    for (const scheda of schede) {
      const dove = { where: { clienteId: scheda.id }, data: { clienteId } };

      await transazione.appuntamento.updateMany(dove);
      await transazione.pagamento.updateMany(dove);
      await transazione.movimentoCaparra.updateMany(dove);
      await transazione.movimentoCredito.updateMany(dove);
      await transazione.vendita.updateMany(dove);
      await transazione.ordine.updateMany(dove);
      await transazione.richiestaReso.updateMany(dove);
      await transazione.richiestaCancellazione.updateMany(dove);

      // Eventuali inviti ancora in giro per questa scheda spariscono con lei.
      await transazione.utente.delete({ where: { id: scheda.id } });
    }

    // Le note del personale sono l'unico dato della scheda che non si
    // ricostruisce dallo storico: vengono accodate a quelle dell'account.
    const note = [destinatario.note, ...schede.map((scheda) => scheda.note)]
      .map((testo) => testo.trim())
      .filter((testo) => testo !== '');

    if (note.length > 0) {
      await transazione.utente.update({
        where: { id: clienteId },
        data: { note: [...new Set(note)].join('\n') },
      });
    }

    return schede.length;
  }
}
