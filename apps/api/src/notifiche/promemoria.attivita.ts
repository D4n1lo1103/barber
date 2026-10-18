import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { CODA_PROMEMORIA, CodaServizio } from '../attivita/coda.servizio.js';
import { ImpostazioniServizio } from '../impostazioni/impostazioni.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificheServizio } from './notifiche.servizio.js';

/** Ogni cinque minuti: l'anticipo del promemoria è in ore, basta e avanza. */
const CRON_PROMEMORIA = '*/5 * * * *';

/**
 * Promemoria degli appuntamenti, con l'anticipo scelto dal titolare.
 *
 * Invece di programmare un'attività per ogni appuntamento, un'attività
 * ricorrente cerca gli appuntamenti confermati che entrano nella finestra
 * dell'anticipo e non hanno ancora ricevuto il promemoria. Così un cambio
 * dell'anticipo vale subito per tutti, e un appuntamento spostato non lascia
 * dietro di sé un promemoria programmato all'orario sbagliato.
 *
 * `promemoriaInviatoIl` viene segnato prima dell'invio: se l'attività ripassa,
 * o se gira su due processi, nessuno riceve il promemoria due volte.
 */
@Injectable()
export class PromemoriaAttivita implements OnModuleInit {
  private readonly logger = new Logger(PromemoriaAttivita.name);

  constructor(
    private readonly coda: CodaServizio,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ImpostazioniServizio))
    private readonly impostazioni: ImpostazioniServizio,
    private readonly notifiche: NotificheServizio,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.coda.registra(CODA_PROMEMORIA, async () => {
      await this.inviaDovuti();
    });
    await this.coda.programmaRicorrente(CODA_PROMEMORIA, CRON_PROMEMORIA);
  }

  /** Invia i promemoria dovuti adesso. Restituisce quanti ne ha inviati. */
  async inviaDovuti(): Promise<number> {
    const regole = await this.impostazioni.leggiRegole();
    const adesso = new Date();
    const limite = new Date(adesso.getTime() + regole.oreAnticipoPromemoria * 60 * 60 * 1000);

    const dovuti = await this.prisma.appuntamento.findMany({
      where: {
        stato: 'confermato',
        promemoriaInviatoIl: null,
        inizio: { gt: adesso, lte: limite },
      },
      orderBy: { inizio: 'asc' },
      // Un lotto per passaggio: con cinque minuti di cadenza non si accumula.
      take: 100,
      include: {
        cliente: {
          select: { nome: true, email: true, numeroWhatsapp: true, consensoWhatsappIl: true },
        },
        operatore: { select: { nome: true, cognome: true } },
        servizi: { orderBy: { ordine: 'asc' }, select: { nome: true } },
      },
    });

    let inviati = 0;

    for (const appuntamento of dovuti) {
      // Si segna prima: un errore di invio non deve produrre un secondo
      // messaggio al passaggio successivo, e la coda delle e-mail ritenta da sé.
      const segnati = await this.prisma.appuntamento.updateMany({
        where: { id: appuntamento.id, promemoriaInviatoIl: null },
        data: { promemoriaInviatoIl: new Date() },
      });

      if (segnati.count === 0) {
        continue;
      }

      try {
        await this.notifiche.inviaPromemoria(
          {
            nome: appuntamento.cliente.nome,
            email: appuntamento.cliente.email,
            numeroWhatsapp: appuntamento.cliente.numeroWhatsapp,
            consensoWhatsapp: appuntamento.cliente.consensoWhatsappIl !== null,
          },
          appuntamento,
        );
        inviati += 1;
      } catch (errore) {
        this.logger.error(`Promemoria non inviato per ${appuntamento.id}.`, errore);
      }
    }

    if (inviati > 0) {
      this.logger.log(`${inviati} promemoria inviati.`);
    }

    return inviati;
  }
}
