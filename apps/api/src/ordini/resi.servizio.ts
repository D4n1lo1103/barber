import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GIORNI_RECESSO,
  recessoAperto,
  rimborsoDovuto,
  type DatiDecisioneReso,
  type DatiRichiestaReso,
  type Ordine,
} from '@barber/shared';
import { PagamentiServizio } from '../pagamenti/pagamenti.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdiniServizio } from './ordini.servizio.js';

/**
 * Resi degli ordini online, entro i quattordici giorni di recesso.
 *
 * Il percorso è quello deciso con il titolare: il cliente apre la richiesta
 * dall'area clienti, il titolare approva o rifiuta con motivazione, e al
 * rientro della merce registra il rimborso, che ricarica la giacenza.
 *
 * La **data della richiesta resta scritta anche su un rifiuto**: è il dato che
 * conta se il cliente contesta di aver esercitato il recesso in tempo.
 */
@Injectable()
export class ResiServizio {
  private readonly logger = new Logger(ResiServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordini: OrdiniServizio,
    private readonly pagamenti: PagamentiServizio,
  ) {}

  /** Richiesta di reso del cliente: solo sui propri ordini consegnati. */
  async richiedi(ordineId: string, dati: DatiRichiestaReso, clienteId: string): Promise<Ordine> {
    const ordine = await this.prisma.ordine.findFirst({
      where: { id: ordineId, clienteId },
      include: {
        righe: true,
        resi: { include: { righe: true } },
      },
    });

    if (!ordine) {
      throw new NotFoundException('Ordine non trovato.');
    }

    if (
      !recessoAperto({ stato: ordine.stato, consegnatoIl: ordine.consegnatoIl, adesso: new Date() })
    ) {
      throw new ConflictException(
        ordine.stato === 'consegnato'
          ? `I ${GIORNI_RECESSO} giorni per il recesso sono passati: contatta il salone.`
          : 'Si può chiedere il reso solo di un ordine già consegnato.',
      );
    }

    if (ordine.resi.some((reso) => reso.stato === 'richiesto')) {
      throw new ConflictException('C’è già una richiesta di reso in attesa su questo ordine.');
    }

    // Pezzi già impegnati in un reso non rifiutato: non si rendono due volte.
    const giaRese = new Map<string, number>();

    for (const reso of ordine.resi) {
      if (reso.stato === 'rifiutato') {
        continue;
      }

      for (const riga of reso.righe) {
        giaRese.set(riga.rigaOrdineId, (giaRese.get(riga.rigaOrdineId) ?? 0) + riga.quantita);
      }
    }

    const righe = dati.righe.map((scelta) => {
      const riga = ordine.righe.find((candidata) => candidata.id === scelta.rigaOrdineId);

      if (!riga) {
        throw new BadRequestException('Uno dei prodotti indicati non è in questo ordine.');
      }

      const disponibili = riga.quantita - (giaRese.get(riga.id) ?? 0);

      if (scelta.quantita > disponibili) {
        throw new BadRequestException(
          disponibili === 0
            ? `«${riga.nome}» è già stato reso.`
            : `Di «${riga.nome}» puoi restituire ancora ${disponibili} pezzi.`,
        );
      }

      return {
        rigaOrdineId: riga.id,
        quantita: scelta.quantita,
        prezzoCentesimi: riga.prezzoCentesimi,
      };
    });

    const reso = await this.prisma.richiestaReso.create({
      data: {
        ordineId,
        clienteId,
        motivoCliente: dati.motivo,
        importoRimborsoCentesimi: rimborsoDovuto(righe),
        righe: {
          create: righe.map((riga) => ({
            rigaOrdineId: riga.rigaOrdineId,
            quantita: riga.quantita,
          })),
        },
      },
    });

    this.logger.log(`Reso ${reso.id} richiesto sull'ordine ${ordine.numero}.`);

    return this.ordini.leggiDelCliente(ordineId, clienteId);
  }

  /**
   * Decisione del titolare. L'approvazione non rimborsa ancora nulla: si
   * attende che la merce rientri in negozio, e allora si registra il rimborso.
   */
  async decidi(resoId: string, dati: DatiDecisioneReso, autoreId: string): Promise<Ordine> {
    const reso = await this.prisma.richiestaReso.findUnique({
      where: { id: resoId },
      select: { stato: true, ordineId: true },
    });

    if (!reso) {
      throw new NotFoundException('Richiesta di reso non trovata.');
    }

    if (reso.stato !== 'richiesto') {
      throw new ConflictException('Questa richiesta di reso è già stata valutata.');
    }

    await this.prisma.richiestaReso.update({
      where: { id: resoId },
      data: {
        stato: dati.approvato ? 'approvato' : 'rifiutato',
        motivoRifiuto: dati.approvato ? '' : dati.motivoRifiuto,
        decisoIl: new Date(),
        decisaDaId: autoreId,
      },
    });

    this.logger.log(`Reso ${resoId} ${dati.approvato ? 'approvato' : 'rifiutato'} da ${autoreId}.`);

    return this.ordini.leggi(reso.ordineId);
  }

  /**
   * Merce rientrata: la giacenza torna disponibile e il rimborso viene emesso.
   *
   * Il denaro torna da dove è arrivato: la parte pagata con carta si rimborsa
   * al fornitore, la parte coperta dal credito torna credito.
   */
  async registraRientro(resoId: string, autoreId: string): Promise<Ordine> {
    const reso = await this.prisma.richiestaReso.findUnique({
      where: { id: resoId },
      include: {
        righe: { include: { rigaOrdine: true } },
        ordine: true,
      },
    });

    if (!reso) {
      throw new NotFoundException('Richiesta di reso non trovata.');
    }

    if (reso.stato !== 'approvato') {
      throw new ConflictException(
        'Solo un reso approvato può rientrare: valuta prima la richiesta.',
      );
    }

    const dovuto = reso.importoRimborsoCentesimi;
    const pagatoConCarta = await this.pagamenti.pagatoConCartaSullOrdine(reso.ordineId);
    // Il credito copre quello che la carta non ha pagato.
    const daRimborsareConCarta = Math.min(dovuto, pagatoConCarta);
    const daRestituireInCredito = dovuto - daRimborsareConCarta;

    const riferimentoRimborso = await this.pagamenti.rimborsaOrdine(
      reso.ordineId,
      daRimborsareConCarta,
    );

    await this.prisma.$transaction(async (transazione) => {
      await transazione.richiestaReso.update({
        where: { id: resoId },
        data: {
          stato: 'rimborsato',
          rimborsatoIl: new Date(),
          riferimentoRimborso,
          creditoRestituitoCentesimi: daRestituireInCredito,
        },
      });

      for (const riga of reso.righe) {
        if (!riga.rigaOrdine.prodottoId) {
          // Prodotto eliminato dal catalogo: non c'è giacenza da ricaricare.
          continue;
        }

        const prodotto = await transazione.prodotto.update({
          where: { id: riga.rigaOrdine.prodottoId },
          data: { giacenza: { increment: riga.quantita } },
        });

        await transazione.movimentoMagazzino.create({
          data: {
            prodottoId: riga.rigaOrdine.prodottoId,
            causa: 'reso_ordine',
            quantita: riga.quantita,
            giacenzaFinale: prodotto.giacenza,
            motivo: `Reso rientrato dall’ordine numero ${reso.ordine.numero}.`,
            ordineId: reso.ordineId,
            autoreId,
          },
        });
      }

      if (daRestituireInCredito > 0) {
        await transazione.movimentoCredito.create({
          data: {
            clienteId: reso.clienteId,
            ordineId: reso.ordineId,
            importoCentesimi: daRestituireInCredito,
            motivo: `Reso dell’ordine numero ${reso.ordine.numero}: credito restituito.`,
            autoreId,
          },
        });
      }

      // Se è rientrato tutto, l'ordine è chiuso come rimborsato. Un reso
      // parziale lo lascia consegnato: il cliente ha tenuto qualcosa.
      const righeOrdine = await transazione.rigaOrdine.findMany({
        where: { ordineId: reso.ordineId },
        include: { righeReso: { include: { reso: { select: { stato: true } } } } },
      });

      const rientratoTutto = righeOrdine.every((riga) => {
        const rese = riga.righeReso
          .filter((rigaReso) => rigaReso.reso.stato === 'rimborsato')
          .reduce((totale, rigaReso) => totale + rigaReso.quantita, 0);

        return rese >= riga.quantita;
      });

      if (rientratoTutto) {
        await transazione.ordine.update({
          where: { id: reso.ordineId },
          data: { stato: 'rimborsato' },
        });
      }
    });

    this.logger.log(
      `Reso ${resoId} rimborsato: ${daRimborsareConCarta} centesimi con carta, ` +
        `${daRestituireInCredito} in credito.`,
    );

    return this.ordini.leggi(reso.ordineId);
  }
}
