import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DatiCreazioneServizio, DatiModificaServizio, Servizio } from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ServiziServizio {
  constructor(private readonly prisma: PrismaService) {}

  /** Elenco del catalogo; i soli servizi attivi se richiesto. */
  async elenca(soloAttivi = false): Promise<Servizio[]> {
    const servizi = await this.prisma.servizio.findMany({
      where: soloAttivi ? { attivo: true } : undefined,
      orderBy: [{ ordine: 'asc' }, { nome: 'asc' }],
      include: { operatoriAbilitati: { select: { operatoreId: true } } },
    });

    return servizi.map((servizio) => ({
      id: servizio.id,
      nome: servizio.nome,
      descrizione: servizio.descrizione,
      prezzoCentesimi: servizio.prezzoCentesimi,
      durataMinuti: servizio.durataMinuti,
      attivo: servizio.attivo,
      ordine: servizio.ordine,
      operatoriAbilitati: servizio.operatoriAbilitati.map((voce) => voce.operatoreId),
    }));
  }

  async crea(dati: DatiCreazioneServizio): Promise<Servizio> {
    await this.verificaDurata(dati.durataMinuti);
    await this.verificaOperatori(dati.operatoriAbilitati);

    const ultimo = await this.prisma.servizio.findFirst({ orderBy: { ordine: 'desc' } });

    try {
      const creato = await this.prisma.servizio.create({
        data: {
          nome: dati.nome,
          descrizione: dati.descrizione,
          prezzoCentesimi: dati.prezzoCentesimi,
          durataMinuti: dati.durataMinuti,
          ordine: (ultimo?.ordine ?? -1) + 1,
          operatoriAbilitati: {
            create: dati.operatoriAbilitati.map((operatoreId) => ({ operatoreId })),
          },
        },
        include: { operatoriAbilitati: { select: { operatoreId: true } } },
      });

      return this.componi(creato);
    } catch (errore) {
      throw this.traduciErrore(errore);
    }
  }

  async modifica(id: string, dati: DatiModificaServizio): Promise<Servizio> {
    const esistente = await this.leggiOLancia(id);

    if (dati.durataMinuti !== undefined) {
      await this.verificaDurata(dati.durataMinuti);
    } else if (dati.attivo === true && !esistente.attivo) {
      // Riattivare un servizio lo rimette in agenda: la granularità può essere
      // cambiata mentre era spento, e una durata fuori passo non trova slot.
      await this.verificaDurata(esistente.durataMinuti);
    }

    if (dati.operatoriAbilitati) {
      await this.verificaOperatori(dati.operatoriAbilitati);
    }

    try {
      const aggiornato = await this.prisma.servizio.update({
        where: { id },
        data: {
          nome: dati.nome,
          descrizione: dati.descrizione,
          prezzoCentesimi: dati.prezzoCentesimi,
          durataMinuti: dati.durataMinuti,
          attivo: dati.attivo,
          operatoriAbilitati: dati.operatoriAbilitati
            ? {
                deleteMany: {},
                create: dati.operatoriAbilitati.map((operatoreId) => ({ operatoreId })),
              }
            : undefined,
        },
        include: { operatoriAbilitati: { select: { operatoreId: true } } },
      });

      return this.componi(aggiornato);
    } catch (errore) {
      throw this.traduciErrore(errore);
    }
  }

  /**
   * I servizi non si cancellano: restano nello storico degli appuntamenti.
   * La disattivazione li toglie dalle nuove prenotazioni.
   */
  async disattiva(id: string): Promise<Servizio> {
    await this.leggiOLancia(id);

    const aggiornato = await this.prisma.servizio.update({
      where: { id },
      data: { attivo: false },
      include: { operatoriAbilitati: { select: { operatoreId: true } } },
    });

    return this.componi(aggiornato);
  }

  async riordina(idOrdinati: string[]): Promise<void> {
    const esistenti = await this.prisma.servizio.findMany({ select: { id: true } });
    const insieme = new Set(esistenti.map((servizio) => servizio.id));

    if (idOrdinati.length !== insieme.size || idOrdinati.some((id) => !insieme.has(id))) {
      throw new BadRequestException('L’elenco deve contenere tutti i servizi, una volta sola.');
    }

    await this.prisma.$transaction(
      idOrdinati.map((id, posizione) =>
        this.prisma.servizio.update({ where: { id }, data: { ordine: posizione } }),
      ),
    );
  }

  /** La durata deve essere multipla della granularità degli slot dell'agenda. */
  private async verificaDurata(durataMinuti: number): Promise<void> {
    const installazione = await this.prisma.installazione.findFirst();
    const granularita = installazione?.granularitaSlotMin ?? 15;

    if (durataMinuti % granularita !== 0) {
      throw new BadRequestException(
        `La durata deve essere un multiplo di ${granularita} minuti, la granularità dell’agenda.`,
      );
    }
  }

  private async verificaOperatori(operatoriAbilitati: string[]): Promise<void> {
    if (operatoriAbilitati.length === 0) {
      return;
    }

    const trovati = await this.prisma.utente.count({
      where: { id: { in: operatoriAbilitati }, ruolo: { in: ['titolare', 'dipendente'] } },
    });

    if (trovati !== new Set(operatoriAbilitati).size) {
      throw new BadRequestException('Uno degli operatori indicati non esiste.');
    }
  }

  private async leggiOLancia(id: string) {
    const servizio = await this.prisma.servizio.findUnique({ where: { id } });

    if (!servizio) {
      throw new NotFoundException('Servizio non trovato.');
    }

    return servizio;
  }

  private componi(servizio: {
    id: string;
    nome: string;
    descrizione: string;
    prezzoCentesimi: number;
    durataMinuti: number;
    attivo: boolean;
    ordine: number;
    operatoriAbilitati: { operatoreId: string }[];
  }): Servizio {
    return {
      id: servizio.id,
      nome: servizio.nome,
      descrizione: servizio.descrizione,
      prezzoCentesimi: servizio.prezzoCentesimi,
      durataMinuti: servizio.durataMinuti,
      attivo: servizio.attivo,
      ordine: servizio.ordine,
      operatoriAbilitati: servizio.operatoriAbilitati.map((voce) => voce.operatoreId),
    };
  }

  private traduciErrore(errore: unknown): Error {
    if ((errore as { code?: string }).code === 'P2002') {
      return new ConflictException('Esiste già un servizio con questo nome.');
    }

    return errore instanceof Error ? errore : new Error('Operazione non riuscita.');
  }
}
