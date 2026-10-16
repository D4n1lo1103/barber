import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  fasciaContenutaIn,
  NOMI_GIORNI,
  orarioDaMinuti,
  type Assenza,
  type DatiCreazioneAssenza,
  type FasciaSettimanale,
  type GiornoSettimana,
} from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrariServizio {
  constructor(private readonly prisma: PrismaService) {}

  async leggiOrariApertura(): Promise<FasciaSettimanale[]> {
    const fasce = await this.prisma.orarioApertura.findMany({
      orderBy: [{ giornoSettimana: 'asc' }, { minutoInizio: 'asc' }],
    });

    return fasce.map(this.componiFascia);
  }

  /** Sostituisce l'intero orario di apertura: più semplice da gestire di modifiche parziali. */
  async sostituisciOrariApertura(fasce: FasciaSettimanale[]): Promise<FasciaSettimanale[]> {
    await this.verificaOrariOperatoriCompatibili(fasce);

    await this.prisma.$transaction([
      this.prisma.orarioApertura.deleteMany(),
      this.prisma.orarioApertura.createMany({ data: fasce }),
    ]);

    return this.leggiOrariApertura();
  }

  async leggiOrariOperatore(operatoreId: string): Promise<FasciaSettimanale[]> {
    await this.verificaOperatore(operatoreId);

    const fasce = await this.prisma.orarioOperatore.findMany({
      where: { operatoreId },
      orderBy: [{ giornoSettimana: 'asc' }, { minutoInizio: 'asc' }],
    });

    return fasce.map(this.componiFascia);
  }

  /** Un operatore non può lavorare quando il salone è chiuso. */
  async sostituisciOrariOperatore(
    operatoreId: string,
    fasce: FasciaSettimanale[],
  ): Promise<FasciaSettimanale[]> {
    await this.verificaOperatore(operatoreId);

    const apertura = await this.leggiOrariApertura();

    for (const fascia of fasce) {
      const aperturaDelGiorno = apertura.filter(
        (voce) => voce.giornoSettimana === fascia.giornoSettimana,
      );

      if (!fasciaContenutaIn(fascia, aperturaDelGiorno)) {
        throw new BadRequestException(
          `L'orario di ${NOMI_GIORNI[fascia.giornoSettimana as GiornoSettimana].toLowerCase()} ` +
            `(${orarioDaMinuti(fascia.minutoInizio)}–${orarioDaMinuti(fascia.minutoFine)}) ` +
            'è fuori dagli orari di apertura del salone.',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.orarioOperatore.deleteMany({ where: { operatoreId } }),
      this.prisma.orarioOperatore.createMany({
        data: fasce.map((fascia) => ({ ...fascia, operatoreId })),
      }),
    ]);

    return this.leggiOrariOperatore(operatoreId);
  }

  async elencaAssenze(operatoreId?: string, dal?: Date, al?: Date): Promise<Assenza[]> {
    const assenze = await this.prisma.assenza.findMany({
      where: {
        operatoreId,
        inizio: al ? { lt: al } : undefined,
        fine: dal ? { gt: dal } : undefined,
      },
      orderBy: { inizio: 'asc' },
    });

    return assenze.map((assenza) => ({
      id: assenza.id,
      operatoreId: assenza.operatoreId,
      tipo: assenza.tipo,
      inizio: assenza.inizio.toISOString(),
      fine: assenza.fine.toISOString(),
      note: assenza.note,
    }));
  }

  async creaAssenza(dati: DatiCreazioneAssenza): Promise<Assenza> {
    await this.verificaOperatore(dati.operatoreId);

    try {
      const creata = await this.prisma.assenza.create({
        data: {
          operatoreId: dati.operatoreId,
          tipo: dati.tipo,
          inizio: new Date(dati.inizio),
          fine: new Date(dati.fine),
          note: dati.note,
        },
      });

      return {
        id: creata.id,
        operatoreId: creata.operatoreId,
        tipo: creata.tipo,
        inizio: creata.inizio.toISOString(),
        fine: creata.fine.toISOString(),
        note: creata.note,
      };
    } catch (errore) {
      // Il database rifiuta le assenze sovrapposte dello stesso operatore.
      if (this.eViolazioneDiEsclusione(errore)) {
        throw new BadRequestException('Esiste già un’assenza che si sovrappone a questo periodo.');
      }

      throw errore;
    }
  }

  async rimuoviAssenza(id: string): Promise<void> {
    const assenza = await this.prisma.assenza.findUnique({ where: { id } });

    if (!assenza) {
      throw new NotFoundException('Assenza non trovata.');
    }

    await this.prisma.assenza.delete({ where: { id } });
  }

  /**
   * Restringere gli orari di apertura non deve lasciare operatori al lavoro
   * fuori orario: la modifica viene rifiutata con un messaggio chiaro.
   */
  private async verificaOrariOperatoriCompatibili(apertura: FasciaSettimanale[]): Promise<void> {
    const orariOperatori = await this.prisma.orarioOperatore.findMany({
      include: { operatore: { select: { nome: true, cognome: true } } },
    });

    for (const orario of orariOperatori) {
      const aperturaDelGiorno = apertura.filter(
        (fascia) => fascia.giornoSettimana === orario.giornoSettimana,
      );

      if (!fasciaContenutaIn(orario, aperturaDelGiorno)) {
        throw new BadRequestException(
          `I nuovi orari lasciano fuori l'orario di ${orario.operatore.nome} ` +
            `${orario.operatore.cognome} di ${NOMI_GIORNI[orario.giornoSettimana as GiornoSettimana].toLowerCase()} ` +
            `(${orarioDaMinuti(orario.minutoInizio)}–${orarioDaMinuti(orario.minutoFine)}). ` +
            'Aggiorna prima gli orari di lavoro.',
        );
      }
    }
  }

  private async verificaOperatore(operatoreId: string): Promise<void> {
    const operatore = await this.prisma.utente.findFirst({
      where: { id: operatoreId, ruolo: { in: ['titolare', 'dipendente'] } },
    });

    if (!operatore) {
      throw new NotFoundException('Operatore non trovato.');
    }
  }

  private componiFascia(fascia: {
    giornoSettimana: number;
    minutoInizio: number;
    minutoFine: number;
  }): FasciaSettimanale {
    return {
      giornoSettimana: fascia.giornoSettimana,
      minutoInizio: fascia.minutoInizio,
      minutoFine: fascia.minutoFine,
    };
  }

  private eViolazioneDiEsclusione(errore: unknown): boolean {
    const messaggio = (errore as { message?: string }).message ?? '';

    return messaggio.includes('assenze_senza_sovrapposizioni');
  }
}
