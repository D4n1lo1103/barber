import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  totaleVendita,
  type DatiAnnullamentoVendita,
  type DatiCreazioneVendita,
  type DatiRicercaVendite,
  type ElencoVendite,
  type Vendita,
} from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Dati inclusi per comporre la risposta. */
const INCLUDI = {
  righe: { orderBy: { nome: 'asc' } },
  cliente: { select: { id: true, nome: true, cognome: true } },
  registrataDa: { select: { nome: true, cognome: true } },
} as const;

/**
 * Vendite di prodotti in negozio, registrate dal personale.
 *
 * Non producono alcun documento per il cliente: sono registrazioni interne, da
 * cui dipendono lo scarico del magazzino e, in futuro, i KPI. Vendita e
 * scarico avvengono nella **stessa transazione**: non esiste una vendita senza
 * movimento di magazzino, né un movimento senza vendita.
 */
@Injectable()
export class VenditeServizio {
  private readonly logger = new Logger(VenditeServizio.name);

  constructor(private readonly prisma: PrismaService) {}

  async registra(dati: DatiCreazioneVendita, autoreId: string): Promise<Vendita> {
    const quantitaPerProdotto = new Map<string, number>();

    // Lo stesso prodotto può arrivare su due righe: si sommano, altrimenti il
    // controllo sulla giacenza guarderebbe una riga alla volta.
    for (const riga of dati.righe) {
      quantitaPerProdotto.set(
        riga.prodottoId,
        (quantitaPerProdotto.get(riga.prodottoId) ?? 0) + riga.quantita,
      );
    }

    const prodotti = await this.prisma.prodotto.findMany({
      where: { id: { in: [...quantitaPerProdotto.keys()] } },
    });

    if (prodotti.length !== quantitaPerProdotto.size) {
      throw new NotFoundException('Uno dei prodotti scelti non esiste.');
    }

    const disattivato = prodotti.find((prodotto) => !prodotto.attivo);

    if (disattivato) {
      throw new BadRequestException(`Il prodotto «${disattivato.nome}» non è più in vendita.`);
    }

    for (const prodotto of prodotti) {
      const richiesti = quantitaPerProdotto.get(prodotto.id)!;

      if (prodotto.giacenza < richiesti) {
        throw new ConflictException(
          `Di «${prodotto.nome}» ci sono ${prodotto.giacenza} pezzi in magazzino, ` +
            `ne servono ${richiesti}.`,
        );
      }
    }

    if (dati.clienteId) {
      await this.verificaCliente(dati.clienteId);
    }

    if (dati.appuntamentoId) {
      await this.verificaAppuntamento(dati.appuntamentoId, dati.clienteId);
    }

    const righe = [...quantitaPerProdotto.entries()].map(([prodottoId, quantita]) => {
      const prodotto = prodotti.find((candidato) => candidato.id === prodottoId)!;

      // Nome e prezzo vengono copiati: il listino può cambiare domani.
      return {
        prodottoId,
        nome: prodotto.nome,
        prezzoCentesimi: prodotto.prezzoCentesimi,
        quantita,
      };
    });

    const creata = await this.prisma.$transaction(async (transazione) => {
      const vendita = await transazione.vendita.create({
        data: {
          clienteId: dati.clienteId ?? null,
          appuntamentoId: dati.appuntamentoId ?? null,
          totaleCentesimi: totaleVendita(righe),
          note: dati.note,
          registrataDaId: autoreId,
          righe: { create: righe },
        },
      });

      for (const riga of righe) {
        // Aggiornamento condizionato: se nel frattempo la giacenza è scesa,
        // nessuna riga viene toccata e la vendita non si chiude.
        const esito = await transazione.prodotto.updateMany({
          where: { id: riga.prodottoId, giacenza: { gte: riga.quantita } },
          data: { giacenza: { decrement: riga.quantita } },
        });

        if (esito.count === 0) {
          throw new ConflictException(
            `Di «${riga.nome}» non ci sono più abbastanza pezzi in magazzino.`,
          );
        }

        const prodotto = await transazione.prodotto.findUniqueOrThrow({
          where: { id: riga.prodottoId },
          select: { giacenza: true },
        });

        await transazione.movimentoMagazzino.create({
          data: {
            prodottoId: riga.prodottoId,
            causa: 'vendita',
            quantita: -riga.quantita,
            giacenzaFinale: prodotto.giacenza,
            motivo: 'Vendita in negozio.',
            venditaId: vendita.id,
            autoreId,
          },
        });
      }

      return vendita;
    });

    this.logger.log(
      `Vendita registrata: ${righe.length} prodotti, ${creata.totaleCentesimi} centesimi.`,
    );

    return this.leggi(creata.id);
  }

  /**
   * Annullamento di una vendita registrata per errore: la giacenza torna come
   * prima e il motivo resta scritto. La riga della vendita non si cancella.
   */
  async annulla(id: string, dati: DatiAnnullamentoVendita, autoreId: string): Promise<Vendita> {
    const vendita = await this.prisma.vendita.findUnique({
      where: { id },
      include: { righe: true },
    });

    if (!vendita) {
      throw new NotFoundException('Vendita non trovata.');
    }

    if (vendita.annullataIl) {
      throw new ConflictException('Questa vendita è già stata annullata.');
    }

    await this.prisma.$transaction(async (transazione) => {
      await transazione.vendita.update({
        where: { id },
        data: {
          annullataIl: new Date(),
          annullataDaId: autoreId,
          motivoAnnullamento: dati.motivo,
        },
      });

      for (const riga of vendita.righe) {
        if (!riga.prodottoId) {
          // Prodotto eliminato dal catalogo: non c'è giacenza da ripristinare.
          continue;
        }

        const prodotto = await transazione.prodotto.update({
          where: { id: riga.prodottoId },
          data: { giacenza: { increment: riga.quantita } },
        });

        await transazione.movimentoMagazzino.create({
          data: {
            prodottoId: riga.prodottoId,
            causa: 'annullamento_vendita',
            quantita: riga.quantita,
            giacenzaFinale: prodotto.giacenza,
            motivo: dati.motivo,
            venditaId: id,
            autoreId,
          },
        });
      }
    });

    this.logger.log(`Vendita ${id} annullata da ${autoreId}.`);

    return this.leggi(id);
  }

  async leggi(id: string): Promise<Vendita> {
    const vendita = await this.prisma.vendita.findUnique({ where: { id }, include: INCLUDI });

    if (!vendita) {
      throw new NotFoundException('Vendita non trovata.');
    }

    return this.componi(vendita);
  }

  async elenca(dati: DatiRicercaVendite): Promise<ElencoVendite> {
    const where = dati.clienteId ? { clienteId: dati.clienteId } : {};
    const [vendite, totale] = await Promise.all([
      this.prisma.vendita.findMany({
        where,
        orderBy: { creataIl: 'desc' },
        skip: (dati.pagina - 1) * dati.perPagina,
        take: dati.perPagina,
        include: INCLUDI,
      }),
      this.prisma.vendita.count({ where }),
    ]);

    return {
      vendite: vendite.map((vendita) => this.componi(vendita)),
      totale,
      pagina: dati.pagina,
      perPagina: dati.perPagina,
    };
  }

  private async verificaCliente(clienteId: string): Promise<void> {
    const cliente = await this.prisma.utente.findFirst({
      where: { id: clienteId, ruolo: 'cliente' },
      select: { attivo: true },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente non trovato.');
    }

    if (!cliente.attivo) {
      throw new ConflictException('La scheda di questo cliente è disattivata.');
    }
  }

  /** L'appuntamento collegato deve essere dello stesso cliente, se indicato. */
  private async verificaAppuntamento(
    appuntamentoId: string,
    clienteId: string | undefined,
  ): Promise<void> {
    const appuntamento = await this.prisma.appuntamento.findUnique({
      where: { id: appuntamentoId },
      select: { clienteId: true },
    });

    if (!appuntamento) {
      throw new NotFoundException('Appuntamento non trovato.');
    }

    if (clienteId && appuntamento.clienteId !== clienteId) {
      throw new BadRequestException(
        'L’appuntamento scelto è di un altro cliente: controlla la vendita.',
      );
    }
  }

  private componi(riga: {
    id: string;
    totaleCentesimi: number;
    note: string;
    appuntamentoId: string | null;
    annullataIl: Date | null;
    motivoAnnullamento: string;
    creataIl: Date;
    righe: { nome: string; prezzoCentesimi: number; quantita: number }[];
    cliente: { id: string; nome: string; cognome: string } | null;
    registrataDa: { nome: string; cognome: string } | null;
  }): Vendita {
    return {
      id: riga.id,
      totaleCentesimi: riga.totaleCentesimi,
      righe: riga.righe.map((prodotto) => ({
        nome: prodotto.nome,
        prezzoCentesimi: prodotto.prezzoCentesimi,
        quantita: prodotto.quantita,
      })),
      cliente: riga.cliente,
      appuntamentoId: riga.appuntamentoId,
      note: riga.note,
      registrataDa: riga.registrataDa,
      annullataIl: riga.annullataIl?.toISOString() ?? null,
      motivoAnnullamento: riga.motivoAnnullamento,
      creataIl: riga.creataIl.toISOString(),
    };
  }
}
