import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  dataLocale,
  fineGiornoLocale,
  giorniConsecutivi,
  giornoSettimanaLocale,
  GIORNI_MASSIMI_PRENOTAZIONE,
  inizioGiornoLocale,
  partiData,
  slotLiberi,
  type DatiRichiestaDisponibilita,
  type DisponibilitaGiorno,
  type Fascia,
  type Occupazione,
  type ServizioDellAppuntamento,
} from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Granularità usata se l'installazione non è ancora configurata. */
const GRANULARITA_PREDEFINITA = 15;
const MINUTI_BLOCCO_SLOT_PREDEFINITI = 10;

export interface ServiziScelti {
  servizi: ServizioDellAppuntamento[];
  durataMinuti: number;
  prezzoTotaleCentesimi: number;
}

/**
 * Calcolo della disponibilità di un operatore: combina orari di lavoro,
 * assenze e appuntamenti già presenti.
 */
@Injectable()
export class DisponibilitaServizio {
  constructor(private readonly prisma: PrismaService) {}

  /** Minuti di blocco dello slot durante il pagamento della caparra. */
  async minutiBloccoSlot(): Promise<number> {
    const installazione = await this.prisma.installazione.findFirst({
      select: { minutiBloccoSlot: true },
    });

    return installazione?.minutiBloccoSlot ?? MINUTI_BLOCCO_SLOT_PREDEFINITI;
  }

  async granularitaSlot(): Promise<number> {
    const installazione = await this.prisma.installazione.findFirst({
      select: { granularitaSlotMin: true },
    });

    return installazione?.granularitaSlotMin ?? GRANULARITA_PREDEFINITA;
  }

  /** Verifica che l'operatore esista, sia attivo e possa ricevere appuntamenti. */
  async verificaOperatore(operatoreId: string): Promise<void> {
    const operatore = await this.prisma.utente.findFirst({
      where: { id: operatoreId, ruolo: { in: ['titolare', 'dipendente'] } },
      select: { attivo: true },
    });

    if (!operatore) {
      throw new NotFoundException('Operatore non trovato.');
    }

    if (!operatore.attivo) {
      throw new BadRequestException('L’operatore non è più in servizio.');
    }
  }

  /**
   * Servizi scelti nell'ordine indicato, con nome, prezzo e durata del momento:
   * vengono copiati nell'appuntamento, così un cambio di listino non altera gli
   * appuntamenti già fissati. Vengono accettati solo servizi attivi che
   * l'operatore è abilitato a erogare tutti.
   */
  async leggiServiziScelti(operatoreId: string, servizioIds: string[]): Promise<ServiziScelti> {
    const trovati = await this.prisma.servizio.findMany({
      where: { id: { in: servizioIds } },
      include: { operatoriAbilitati: { where: { operatoreId }, select: { operatoreId: true } } },
    });

    const perId = new Map(trovati.map((servizio) => [servizio.id, servizio]));
    const servizi: ServizioDellAppuntamento[] = [];

    for (const id of servizioIds) {
      const servizio = perId.get(id);

      if (!servizio) {
        throw new NotFoundException('Uno dei servizi scelti non esiste.');
      }

      if (!servizio.attivo) {
        throw new BadRequestException(`Il servizio «${servizio.nome}» non è più disponibile.`);
      }

      if (servizio.operatoriAbilitati.length === 0) {
        throw new BadRequestException(
          `L’operatore scelto non esegue il servizio «${servizio.nome}».`,
        );
      }

      servizi.push({
        servizioId: servizio.id,
        nome: servizio.nome,
        prezzoCentesimi: servizio.prezzoCentesimi,
        durataMinuti: servizio.durataMinuti,
      });
    }

    return {
      servizi,
      durataMinuti: servizi.reduce((somma, servizio) => somma + servizio.durataMinuti, 0),
      prezzoTotaleCentesimi: servizi.reduce(
        (somma, servizio) => somma + servizio.prezzoCentesimi,
        0,
      ),
    };
  }

  /** Fasce di lavoro dell'operatore in un giorno locale del salone. */
  async fasceLavoro(operatoreId: string, giorno: string): Promise<Fascia[]> {
    const inizio = inizioGiornoLocale(giorno);

    if (!inizio) {
      throw new BadRequestException('Data non valida.');
    }

    const fasce = await this.prisma.orarioOperatore.findMany({
      where: { operatoreId, giornoSettimana: giornoSettimanaLocale(inizio) },
      orderBy: { minutoInizio: 'asc' },
      select: { minutoInizio: true, minutoFine: true },
    });

    return fasce;
  }

  /**
   * Intervalli già occupati dell'operatore: appuntamenti che non sono stati
   * annullati e assenze. `escludiAppuntamentoId` serve quando si sposta un
   * appuntamento, che non deve bloccare se stesso.
   */
  async occupazioni(
    operatoreId: string,
    da: Date,
    a: Date,
    escludiAppuntamentoId?: string,
  ): Promise<Occupazione[]> {
    const [appuntamenti, assenze] = await Promise.all([
      this.prisma.appuntamento.findMany({
        where: {
          operatoreId,
          stato: { not: 'annullato' },
          inizio: { lt: a },
          fine: { gt: da },
          ...(escludiAppuntamentoId ? { id: { not: escludiAppuntamentoId } } : {}),
        },
        select: { inizio: true, fine: true },
      }),
      this.prisma.assenza.findMany({
        where: { operatoreId, inizio: { lt: a }, fine: { gt: da } },
        select: { inizio: true, fine: true },
      }),
    ]);

    return [...appuntamenti, ...assenze];
  }

  /**
   * Slot liberi per operatore, servizi e intervallo di giorni richiesti.
   * `oreMinimePreavviso` serve all'area clienti, che non può prenotare per
   * le due ore successive; il personale non ha preavviso minimo.
   */
  async calcola(
    dati: DatiRichiestaDisponibilita,
    opzioni: { oreMinimePreavviso?: number } = {},
  ): Promise<DisponibilitaGiorno[]> {
    await this.verificaOperatore(dati.operatoreId);

    if (!partiData(dati.dal)) {
      throw new BadRequestException('Data non valida.');
    }

    const { durataMinuti } = await this.leggiServiziScelti(dati.operatoreId, dati.servizioIds);
    const granularitaMinuti = await this.granularitaSlot();
    const giorni = giorniConsecutivi(dati.dal, dati.giorni);
    const da = inizioGiornoLocale(giorni[0]!)!;
    const a = fineGiornoLocale(giorni.at(-1)!)!;
    const occupazioni = await this.occupazioni(dati.operatoreId, da, a, dati.escludiAppuntamentoId);
    const fascePerGiorno = await this.fasceLavoroPerGiorni(dati.operatoreId, giorni);
    const adesso = new Date();
    const nonPrimaDi = new Date(
      adesso.getTime() + (opzioni.oreMinimePreavviso ?? 0) * 60 * 60 * 1000,
    );
    const limiteFuturo = new Date(
      adesso.getTime() + GIORNI_MASSIMI_PRENOTAZIONE * 24 * 60 * 60 * 1000,
    );

    return giorni.map((giorno) => ({
      giorno,
      slot: slotLiberi({
        giorno,
        durataMinuti,
        granularitaMinuti,
        fasceLavoro: fascePerGiorno.get(giorno) ?? [],
        occupazioni,
        nonPrimaDi,
        nonDopoDi: limiteFuturo,
      }).map((istante) => istante.toISOString()),
    }));
  }

  /**
   * Mappa giorno locale → fasce di lavoro: gli orari vengono letti una sola
   * volta per l'intero intervallo e poi distribuiti sui giorni richiesti.
   */
  async fasceLavoroPerGiorni(
    operatoreId: string,
    giorni: readonly string[],
  ): Promise<Map<string, Fascia[]>> {
    const fasce = await this.prisma.orarioOperatore.findMany({
      where: { operatoreId },
      orderBy: { minutoInizio: 'asc' },
      select: { giornoSettimana: true, minutoInizio: true, minutoFine: true },
    });

    return new Map(
      giorni.map((giorno) => {
        const istante = inizioGiornoLocale(giorno);
        const settimana = istante ? giornoSettimanaLocale(istante) : null;

        return [
          giorno,
          fasce
            .filter((fascia) => fascia.giornoSettimana === settimana)
            .map(({ minutoInizio, minutoFine }) => ({ minutoInizio, minutoFine })),
        ];
      }),
    );
  }

  /** Giorno locale del salone in cui cade un istante. */
  giornoDi(istante: Date): string {
    return dataLocale(istante);
  }
}
