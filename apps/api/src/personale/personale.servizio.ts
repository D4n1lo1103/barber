import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DatiCreazioneDipendente, DatiModificaOperatore, Operatore } from '@barber/shared';
import { SessioniServizio } from '../autenticazione/sessioni.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenServizio } from '../autenticazione/token.servizio.js';
import { NotificheServizio } from '../notifiche/notifiche.servizio.js';

interface RigaUtente {
  id: string;
  nome: string;
  cognome: string;
  email: string | null;
  numeroWhatsapp: string | null;
  ruolo: 'titolare' | 'dipendente' | 'cliente';
  attivo: boolean;
  passwordHash: string | null;
}

@Injectable()
export class PersonaleServizio {
  constructor(
    private readonly prisma: PrismaService,
    private readonly token: TokenServizio,
    private readonly sessioni: SessioniServizio,
    private readonly notifiche: NotificheServizio,
  ) {}

  async elenca(): Promise<Operatore[]> {
    const personale = await this.prisma.utente.findMany({
      where: { ruolo: { in: ['titolare', 'dipendente'] } },
      orderBy: [{ ruolo: 'asc' }, { cognome: 'asc' }, { nome: 'asc' }],
    });

    return personale.map((utente) => this.componi(utente as RigaUtente));
  }

  /**
   * Crea l'account di un dipendente e il relativo invito.
   * Il titolare non sceglie né conosce la password: la imposta il dipendente
   * tramite il link di attivazione.
   */
  async creaDipendente(
    dati: DatiCreazioneDipendente,
  ): Promise<{ operatore: Operatore; token: string; scadeIl: Date }> {
    const esistente = await this.prisma.utente.findUnique({ where: { email: dati.email } });

    if (esistente) {
      throw new ConflictException('Esiste già un account con questo indirizzo e-mail.');
    }

    const creato = await this.prisma.utente.create({
      data: {
        nome: dati.nome,
        cognome: dati.cognome,
        email: dati.email,
        numeroWhatsapp: dati.numeroWhatsapp ?? null,
        ruolo: 'dipendente',
        // L'account esiste ma non è utilizzabile finché il dipendente non
        // sceglie la password tramite l'invito.
        passwordHash: null,
      },
    });

    await this.estendiChiusureFuture(creato.id);

    const invito = await this.token.crea(creato.id);

    // L'invito al personale va sempre via e-mail: i messaggi WhatsApp sono
    // previsti per i clienti.
    await this.notifiche.inviaInvitoAttivazione(
      { nome: creato.nome, email: dati.email, numeroWhatsapp: null, consensoWhatsapp: false },
      invito.token,
    );

    return {
      operatore: this.componi(creato as RigaUtente),
      token: invito.token,
      scadeIl: invito.scadeIl,
    };
  }

  /**
   * Le chiusure del salone valgono per tutti: un operatore aggiunto dopo ne
   * eredita quelle future, altrimenti risulterebbe prenotabile a salone chiuso.
   */
  private async estendiChiusureFuture(operatoreId: string): Promise<void> {
    const chiusure = await this.prisma.assenza.groupBy({
      by: ['inizio', 'fine', 'note'],
      where: { tipo: 'chiusura', fine: { gt: new Date() } },
    });

    if (chiusure.length === 0) {
      return;
    }

    await this.prisma.assenza.createMany({
      data: chiusure.map((chiusura) => ({
        operatoreId,
        tipo: 'chiusura' as const,
        inizio: chiusura.inizio,
        fine: chiusura.fine,
        note: chiusura.note,
      })),
    });
  }

  async modifica(id: string, dati: DatiModificaOperatore): Promise<Operatore> {
    await this.leggiOperatore(id);

    const aggiornato = await this.prisma.utente.update({
      where: { id },
      data: {
        nome: dati.nome,
        cognome: dati.cognome,
        numeroWhatsapp: dati.numeroWhatsapp === undefined ? undefined : dati.numeroWhatsapp,
      },
    });

    return this.componi(aggiornato as RigaUtente);
  }

  /**
   * Disattiva un dipendente: l'account non può più accedere e le sue sessioni
   * vengono revocate. Lo storico resta, quindi l'account non viene cancellato.
   */
  async disattiva(id: string, idRichiedente: string): Promise<Operatore> {
    const operatore = await this.leggiOperatore(id);

    if (operatore.ruolo === 'titolare') {
      throw new BadRequestException("L'account del titolare non può essere disattivato.");
    }

    if (operatore.id === idRichiedente) {
      throw new BadRequestException('Non puoi disattivare il tuo stesso account.');
    }

    const aggiornato = await this.prisma.utente.update({
      where: { id },
      data: { attivo: false },
    });
    await this.sessioni.revocaTutte(id);

    return this.componi(aggiornato as RigaUtente);
  }

  async riattiva(id: string): Promise<Operatore> {
    await this.leggiOperatore(id);

    const aggiornato = await this.prisma.utente.update({ where: { id }, data: { attivo: true } });

    return this.componi(aggiornato as RigaUtente);
  }

  /** Genera un nuovo invito, ad esempio se il primo è scaduto. */
  async rigeneraInvito(id: string): Promise<{ token: string; scadeIl: Date }> {
    const operatore = await this.leggiOperatore(id);

    if (operatore.ruolo === 'titolare') {
      throw new BadRequestException('Il titolare ha già un account attivo.');
    }

    const invito = await this.token.crea(operatore.id);

    if (operatore.email) {
      await this.notifiche.inviaInvitoAttivazione(
        {
          nome: operatore.nome,
          email: operatore.email,
          numeroWhatsapp: null,
          consensoWhatsapp: false,
        },
        invito.token,
      );
    }

    return invito;
  }

  private async leggiOperatore(id: string) {
    const operatore = await this.prisma.utente.findFirst({
      where: { id, ruolo: { in: ['titolare', 'dipendente'] } },
    });

    if (!operatore) {
      throw new NotFoundException('Operatore non trovato.');
    }

    return operatore;
  }

  private componi(utente: RigaUtente): Operatore {
    return {
      id: utente.id,
      nome: utente.nome,
      cognome: utente.cognome,
      // Gli operatori hanno sempre un'e-mail: è con quella che accedono.
      email: utente.email ?? '',
      numeroWhatsapp: utente.numeroWhatsapp,
      ruolo: utente.ruolo as 'titolare' | 'dipendente',
      attivo: utente.attivo,
      accountAttivato: utente.passwordHash !== null,
    };
  }
}
