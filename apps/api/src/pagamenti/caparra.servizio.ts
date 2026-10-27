import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SituazioneCaparre } from '@barber/shared';
import {
  accreditaCredito,
  caparraPagataDaMovimenti,
  caparraTrattenutaDaMovimenti,
  type TipoMovimentoCaparra,
} from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Un movimento da registrare nel registro della caparra. */
export interface MovimentoDaRegistrare {
  appuntamentoId: string;
  clienteId: string;
  tipo: TipoMovimentoCaparra;
  importoCentesimi: number;
  motivo?: string;
  /** Nullo quando il movimento lo produce il sistema. */
  autoreId?: string | null;
}

/**
 * Registro dei movimenti della caparra e del credito del cliente.
 *
 * Le righe non si modificano né si cancellano: sono il registro di audit
 * richiesto dai requisiti (data, importo, autore e motivo su ogni movimento).
 * La conversione in credito scrive anche il movimento di credito, così il
 * saldo resta la somma dei suoi movimenti e non c'è un secondo totale da
 * tenere allineato.
 */
@Injectable()
export class CaparraServizio {
  private readonly logger = new Logger(CaparraServizio.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un movimento della caparra. Con una transazione in corso il
   * movimento entra in quella, così sta o cade insieme all'operazione che lo
   * ha prodotto.
   */
  async registra(
    movimento: MovimentoDaRegistrare,
    transazioneEsterna?: Prisma.TransactionClient,
  ): Promise<void> {
    const { appuntamentoId, clienteId, tipo, importoCentesimi } = movimento;
    const motivo = movimento.motivo ?? '';
    const autoreId = movimento.autoreId ?? null;

    const scrivi = async (transazione: Prisma.TransactionClient) => {
      await transazione.movimentoCaparra.create({
        data: { appuntamentoId, clienteId, tipo, importoCentesimi, motivo, autoreId },
      });

      if (accreditaCredito(tipo)) {
        await transazione.movimentoCredito.create({
          data: {
            clienteId,
            appuntamentoId,
            importoCentesimi,
            motivo: motivo || 'Caparra convertita in credito.',
            autoreId,
          },
        });
      }
    };

    await (transazioneEsterna ? scrivi(transazioneEsterna) : this.prisma.$transaction(scrivi));

    this.logger.log(
      `Movimento ${tipo} di ${importoCentesimi} centesimi sull'appuntamento ${appuntamentoId}.`,
    );
  }

  /**
   * Movimenti e credito di un cliente: sono dati economici, quindi li legge
   * solo il titolare.
   */
  async situazioneDelCliente(clienteId: string): Promise<SituazioneCaparre> {
    const [movimentiCaparra, movimentiCredito, saldoCreditoCentesimi] = await Promise.all([
      this.prisma.movimentoCaparra.findMany({
        where: { clienteId },
        orderBy: { creatoIl: 'desc' },
        take: 100,
        include: { autore: { select: { nome: true, cognome: true } } },
      }),
      this.prisma.movimentoCredito.findMany({
        where: { clienteId },
        orderBy: { creatoIl: 'desc' },
        take: 100,
      }),
      this.saldoCredito(clienteId),
    ]);

    return {
      saldoCreditoCentesimi,
      movimentiCaparra: movimentiCaparra.map((movimento) => ({
        id: movimento.id,
        appuntamentoId: movimento.appuntamentoId,
        tipo: movimento.tipo,
        importoCentesimi: movimento.importoCentesimi,
        motivo: movimento.motivo,
        autore: movimento.autore
          ? { nome: movimento.autore.nome, cognome: movimento.autore.cognome }
          : null,
        creatoIl: movimento.creatoIl.toISOString(),
      })),
      movimentiCredito: movimentiCredito.map((movimento) => ({
        id: movimento.id,
        importoCentesimi: movimento.importoCentesimi,
        motivo: movimento.motivo,
        appuntamentoId: movimento.appuntamentoId,
        creatoIl: movimento.creatoIl.toISOString(),
      })),
    };
  }

  /** Accredita o utilizza credito senza passare da un movimento di caparra. */
  async registraCredito(dati: {
    clienteId: string;
    importoCentesimi: number;
    motivo: string;
    appuntamentoId?: string | null;
    autoreId?: string | null;
  }): Promise<void> {
    await this.prisma.movimentoCredito.create({
      data: {
        clienteId: dati.clienteId,
        importoCentesimi: dati.importoCentesimi,
        motivo: dati.motivo,
        appuntamentoId: dati.appuntamentoId ?? null,
        autoreId: dati.autoreId ?? null,
      },
    });
  }

  /** Saldo del credito: somma dei movimenti, senza scadenza. */
  async saldoCredito(clienteId: string, transazione?: Prisma.TransactionClient): Promise<number> {
    const somma = await (transazione ?? this.prisma).movimentoCredito.aggregate({
      where: { clienteId },
      _sum: { importoCentesimi: true },
    });

    return somma._sum.importoCentesimi ?? 0;
  }

  /**
   * Blocca la riga del cliente per il resto della transazione.
   *
   * **Va chiamata come prima istruzione della transazione**, prima di qualsiasi
   * scrittura che citi il cliente. Inserire una riga con una chiave esterna
   * verso `utenti` prende da sé un blocco condiviso su quella riga: due
   * transazioni che lo prendono entrambe e poi chiedono il blocco esclusivo si
   * aspettano a vicenda, e PostgreSQL ne uccide una per deadlock. Prendendo
   * subito il blocco esclusivo, la seconda transazione aspetta la prima e
   * basta.
   *
   * Serve solo quando la transazione spenderà del credito: se non lo spende,
   * non c'è nessun saldo da proteggere e nessuna attesa da imporre.
   */
  async bloccaCliente(transazione: Prisma.TransactionClient, clienteId: string): Promise<void> {
    await transazione.$queryRaw`SELECT id FROM utenti WHERE id = ${clienteId}::uuid FOR UPDATE`;
  }

  /**
   * Scala un importo dal credito del cliente.
   *
   * Il saldo è la somma dei movimenti, quindi leggerlo e poi scrivere non
   * basta: due richieste contemporanee leggerebbero lo stesso saldo e lo
   * spenderebbero entrambe, mandandolo sotto zero. Il blocco preso da
   * `bloccaCliente` fa aspettare la seconda, che così vede il saldo aggiornato.
   *
   * Va chiamata dentro la transazione che registra l'operazione pagata con il
   * credito: se quella fallisce, il credito non risulta speso.
   */
  async spendiCredito(
    transazione: Prisma.TransactionClient,
    dati: {
      clienteId: string;
      importoCentesimi: number;
      motivo: string;
      appuntamentoId?: string | null;
      ordineId?: string | null;
    },
  ): Promise<void> {
    if (dati.importoCentesimi <= 0) {
      return;
    }

    // Di norma il blocco c'è già (preso in testa alla transazione); ripeterlo
    // non costa nulla e protegge chi chiamasse questo metodo da solo.
    await this.bloccaCliente(transazione, dati.clienteId);

    const saldo = await this.saldoCredito(dati.clienteId, transazione);

    if (saldo < dati.importoCentesimi) {
      throw new ConflictException(
        'Il credito disponibile è cambiato: ricarica la pagina e riprova.',
      );
    }

    await transazione.movimentoCredito.create({
      data: {
        clienteId: dati.clienteId,
        importoCentesimi: -dati.importoCentesimi,
        motivo: dati.motivo,
        appuntamentoId: dati.appuntamentoId ?? null,
        ordineId: dati.ordineId ?? null,
      },
    });
  }

  /**
   * Caparra effettivamente pagata e non ancora restituita su un appuntamento.
   * È la base di ogni decisione: si rimborsa o si trattiene solo ciò che è
   * entrato davvero.
   */
  async caparraPagata(appuntamentoId: string): Promise<number> {
    const movimenti = await this.prisma.movimentoCaparra.findMany({
      where: { appuntamentoId },
      select: { tipo: true, importoCentesimi: true },
    });

    return caparraPagataDaMovimenti(movimenti);
  }

  /** La caparra di questo appuntamento è stata trattenuta e non più restituita. */
  async trattenuta(appuntamentoId: string): Promise<number> {
    const movimenti = await this.prisma.movimentoCaparra.findMany({
      where: { appuntamentoId },
      select: { tipo: true, importoCentesimi: true },
    });

    return caparraTrattenutaDaMovimenti(movimenti);
  }
}
