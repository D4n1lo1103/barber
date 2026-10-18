import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  DatiCreazioneProdotto,
  DatiModificaProdotto,
  DatiMovimentoGiacenza,
  MovimentoMagazzino,
  Prodotto,
} from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Riga del database, come serve per comporre la risposta. */
interface RigaProdotto {
  id: string;
  nome: string;
  descrizione: string;
  prezzoCentesimi: number;
  giacenza: number;
  scortaMinima: number;
  attivo: boolean;
  ordine: number;
}

/**
 * Catalogo dei prodotti e giacenze di magazzino.
 *
 * La giacenza **non si modifica scrivendoci sopra**: ogni variazione passa da
 * un movimento, che resta come registro di audit con data, quantità, autore e
 * motivo. Lo stesso vale per i carichi e per le correzioni dell'inventario,
 * che solo il titolare può registrare.
 */
@Injectable()
export class ProdottiServizio {
  private readonly logger = new Logger(ProdottiServizio.name);

  constructor(private readonly prisma: PrismaService) {}

  async elenca(soloAttivi = false): Promise<Prodotto[]> {
    const prodotti = await this.prisma.prodotto.findMany({
      where: soloAttivi ? { attivo: true } : undefined,
      orderBy: [{ ordine: 'asc' }, { nome: 'asc' }],
    });

    return prodotti.map((prodotto) => this.componi(prodotto));
  }

  /** Prodotti attivi arrivati alla scorta minima o sotto: avviso al personale. */
  async sottoScorta(): Promise<Prodotto[]> {
    const prodotti = await this.prisma.$queryRaw<RigaProdotto[]>`
      SELECT "id", "nome", "descrizione", "prezzoCentesimi", "giacenza", "scortaMinima",
             "attivo", "ordine"
      FROM "prodotti"
      WHERE "attivo" AND "scortaMinima" > 0 AND "giacenza" <= "scortaMinima"
      ORDER BY "giacenza" ASC, "nome" ASC
    `;

    return prodotti.map((prodotto) => this.componi(prodotto));
  }

  async leggi(id: string): Promise<Prodotto> {
    return this.componi(await this.leggiRiga(id));
  }

  async crea(dati: DatiCreazioneProdotto, autoreId: string): Promise<Prodotto> {
    const esistente = await this.prisma.prodotto.findUnique({ where: { nome: dati.nome } });

    if (esistente) {
      throw new ConflictException('Esiste già un prodotto con questo nome.');
    }

    const ultimo = await this.prisma.prodotto.findFirst({
      orderBy: { ordine: 'desc' },
      select: { ordine: true },
    });

    const creato = await this.prisma.$transaction(async (transazione) => {
      const prodotto = await transazione.prodotto.create({
        data: {
          nome: dati.nome,
          descrizione: dati.descrizione,
          prezzoCentesimi: dati.prezzoCentesimi,
          giacenza: dati.giacenza,
          scortaMinima: dati.scortaMinima,
          ordine: (ultimo?.ordine ?? 0) + 1,
        },
      });

      // Anche la giacenza iniziale è un movimento: il magazzino non ha righe
      // che nascono dal nulla.
      if (dati.giacenza > 0) {
        await transazione.movimentoMagazzino.create({
          data: {
            prodottoId: prodotto.id,
            causa: 'carico',
            quantita: dati.giacenza,
            giacenzaFinale: dati.giacenza,
            motivo: 'Giacenza iniziale alla creazione del prodotto.',
            autoreId,
          },
        });
      }

      return prodotto;
    });

    this.logger.log(`Prodotto creato: ${creato.nome}.`);

    return this.componi(creato);
  }

  /**
   * Modifica i dati del prodotto. La giacenza resta fuori: si cambia solo con
   * un movimento motivato.
   */
  async modifica(id: string, dati: DatiModificaProdotto): Promise<Prodotto> {
    await this.leggiRiga(id);

    if (dati.nome) {
      const omonimo = await this.prisma.prodotto.findFirst({
        where: { nome: dati.nome, id: { not: id } },
        select: { id: true },
      });

      if (omonimo) {
        throw new ConflictException('Esiste già un prodotto con questo nome.');
      }
    }

    const aggiornato = await this.prisma.prodotto.update({ where: { id }, data: dati });

    return this.componi(aggiornato);
  }

  /** Disattivazione: il prodotto esce dal listino ma resta nelle vendite passate. */
  async disattiva(id: string): Promise<Prodotto> {
    await this.leggiRiga(id);
    const aggiornato = await this.prisma.prodotto.update({
      where: { id },
      data: { attivo: false },
    });

    return this.componi(aggiornato);
  }

  async riordina(ordine: string[]): Promise<Prodotto[]> {
    const prodotti = await this.prisma.prodotto.findMany({ select: { id: true } });

    if (ordine.length !== prodotti.length) {
      throw new ConflictException('L’elenco dell’ordine non comprende tutti i prodotti.');
    }

    await this.prisma.$transaction(
      ordine.map((id, posizione) =>
        this.prisma.prodotto.update({ where: { id }, data: { ordine: posizione + 1 } }),
      ),
    );

    return this.elenca();
  }

  /**
   * Carico o correzione della giacenza, riservati al titolare.
   *
   * La giacenza non può scendere sotto zero: l'aggiornamento condizionato
   * rifiuta la variazione se non c'è abbastanza merce, e il vincolo del
   * database resta l'ultima difesa.
   */
  async registraMovimento(
    id: string,
    dati: DatiMovimentoGiacenza,
    autoreId: string,
  ): Promise<Prodotto> {
    const prodotto = await this.leggiRiga(id);

    if (prodotto.giacenza + dati.quantita < 0) {
      throw new ConflictException(
        `In magazzino ci sono ${prodotto.giacenza} pezzi di «${prodotto.nome}»: ` +
          'la giacenza non può andare sotto zero.',
      );
    }

    const aggiornato = await this.prisma.$transaction(async (transazione) => {
      const esito = await transazione.prodotto.updateMany({
        where: { id, giacenza: { gte: -dati.quantita } },
        data: { giacenza: { increment: dati.quantita } },
      });

      if (esito.count === 0) {
        throw new ConflictException(
          'La giacenza è cambiata nel frattempo: ricontrolla e ripeti il movimento.',
        );
      }

      const riga = await transazione.prodotto.findUniqueOrThrow({ where: { id } });

      await transazione.movimentoMagazzino.create({
        data: {
          prodottoId: id,
          causa: dati.causa,
          quantita: dati.quantita,
          giacenzaFinale: riga.giacenza,
          motivo: dati.motivo,
          autoreId,
        },
      });

      return riga;
    });

    this.logger.log(
      `Giacenza di ${aggiornato.nome}: ${dati.quantita > 0 ? '+' : ''}${dati.quantita} ` +
        `(${dati.causa}), ora ${aggiornato.giacenza}.`,
    );

    return this.componi(aggiornato);
  }

  /** Movimenti di un prodotto, dal più recente. */
  async movimenti(id: string, limite = 50): Promise<MovimentoMagazzino[]> {
    await this.leggiRiga(id);

    const movimenti = await this.prisma.movimentoMagazzino.findMany({
      where: { prodottoId: id },
      orderBy: { creatoIl: 'desc' },
      take: limite,
      include: { autore: { select: { nome: true, cognome: true } } },
    });

    return movimenti.map((movimento) => ({
      id: movimento.id,
      causa: movimento.causa,
      quantita: movimento.quantita,
      giacenzaFinale: movimento.giacenzaFinale,
      motivo: movimento.motivo,
      autore: movimento.autore
        ? { nome: movimento.autore.nome, cognome: movimento.autore.cognome }
        : null,
      creatoIl: movimento.creatoIl.toISOString(),
    }));
  }

  private async leggiRiga(id: string): Promise<RigaProdotto> {
    const prodotto = await this.prisma.prodotto.findUnique({ where: { id } });

    if (!prodotto) {
      throw new NotFoundException('Prodotto non trovato.');
    }

    return prodotto;
  }

  private componi(riga: RigaProdotto): Prodotto {
    return {
      id: riga.id,
      nome: riga.nome,
      descrizione: riga.descrizione,
      prezzoCentesimi: riga.prezzoCentesimi,
      giacenza: riga.giacenza,
      scortaMinima: riga.scortaMinima,
      // Zero disattiva l'avviso: un prodotto senza soglia non è mai sotto scorta.
      sottoScorta: riga.scortaMinima > 0 && riga.giacenza <= riga.scortaMinima,
      attivo: riga.attivo,
      ordine: riga.ordine,
    };
  }
}
