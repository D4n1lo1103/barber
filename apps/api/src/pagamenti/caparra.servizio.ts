import { Injectable, Logger } from '@nestjs/common';
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

  async registra(movimento: MovimentoDaRegistrare): Promise<void> {
    const { appuntamentoId, clienteId, tipo, importoCentesimi } = movimento;
    const motivo = movimento.motivo ?? '';
    const autoreId = movimento.autoreId ?? null;

    await this.prisma.$transaction(async (transazione) => {
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
    });

    this.logger.log(
      `Movimento ${tipo} di ${importoCentesimi} centesimi sull'appuntamento ${appuntamentoId}.`,
    );
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
  async saldoCredito(clienteId: string): Promise<number> {
    const somma = await this.prisma.movimentoCredito.aggregate({
      where: { clienteId },
      _sum: { importoCentesimi: true },
    });

    return somma._sum.importoCentesimi ?? 0;
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
