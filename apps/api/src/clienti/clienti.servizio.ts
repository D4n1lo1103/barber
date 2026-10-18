import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Cliente,
  DatiCreazioneCliente,
  DatiModificaCliente,
  DatiRicercaClienti,
  ElencoClienti,
} from '@barber/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvitiServizio } from '../personale/inviti.servizio.js';

interface RigaCliente {
  id: string;
  nome: string;
  cognome: string;
  numeroWhatsapp: string | null;
  email: string | null;
  note: string;
  attivo: boolean;
  passwordHash: string | null;
  creatoIl: Date;
}

@Injectable()
export class ClientiServizio {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inviti: InvitiServizio,
  ) {}

  async elenca(dati: DatiRicercaClienti): Promise<ElencoClienti> {
    const cerca = dati.cerca.trim();
    const filtro = {
      ruolo: 'cliente' as const,
      ...(cerca
        ? {
            OR: [
              { nome: { contains: cerca, mode: 'insensitive' as const } },
              { cognome: { contains: cerca, mode: 'insensitive' as const } },
              { numeroWhatsapp: { contains: cerca } },
              { email: { contains: cerca, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [righe, totale] = await Promise.all([
      this.prisma.utente.findMany({
        where: filtro,
        orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
        skip: (dati.pagina - 1) * dati.perPagina,
        take: dati.perPagina,
      }),
      this.prisma.utente.count({ where: filtro }),
    ]);

    return {
      clienti: righe.map((riga) => this.componi(riga)),
      totale,
      pagina: dati.pagina,
      perPagina: dati.perPagina,
    };
  }

  async leggi(id: string): Promise<Cliente> {
    return this.componi(await this.leggiRiga(id));
  }

  /**
   * Scheda creata dal personale, ad esempio per un cliente al telefono.
   * Il personale non imposta mai la password: viene generato un invito con cui
   * il cliente attiva il proprio account. Un numero già presente non crea un
   * duplicato: la scheda esistente viene segnalata a chi sta inserendo.
   */
  async crea(
    dati: DatiCreazioneCliente,
  ): Promise<{ cliente: Cliente; token: string; scadeIl: Date }> {
    const perNumero = await this.prisma.utente.findFirst({
      where: { numeroWhatsapp: dati.numeroWhatsapp },
    });

    if (perNumero) {
      throw new ConflictException(
        `Questo numero è già collegato alla scheda di ${perNumero.nome} ${perNumero.cognome}.`,
      );
    }

    if (dati.email) {
      const perEmail = await this.prisma.utente.findUnique({ where: { email: dati.email } });

      if (perEmail) {
        throw new ConflictException('Esiste già un account con questo indirizzo e-mail.');
      }
    }

    const creato = await this.prisma.utente.create({
      data: {
        nome: dati.nome,
        cognome: dati.cognome,
        numeroWhatsapp: dati.numeroWhatsapp,
        email: dati.email ?? null,
        note: dati.note,
        ruolo: 'cliente',
        // L'account esiste ma non è utilizzabile finché il cliente non
        // sceglie la password tramite l'invito.
        passwordHash: null,
      },
    });

    const invito = await this.inviti.crea(creato.id);

    return { cliente: this.componi(creato), token: invito.token, scadeIl: invito.scadeIl };
  }

  async modifica(id: string, dati: DatiModificaCliente): Promise<Cliente> {
    await this.leggiRiga(id);

    if (dati.numeroWhatsapp) {
      const altro = await this.prisma.utente.findFirst({
        where: { numeroWhatsapp: dati.numeroWhatsapp, id: { not: id } },
      });

      if (altro) {
        throw new ConflictException(
          `Questo numero è già collegato alla scheda di ${altro.nome} ${altro.cognome}.`,
        );
      }
    }

    if (dati.email) {
      const altro = await this.prisma.utente.findFirst({
        where: { email: dati.email, id: { not: id } },
      });

      if (altro) {
        throw new ConflictException('Esiste già un account con questo indirizzo e-mail.');
      }
    }

    const aggiornato = await this.prisma.utente.update({
      where: { id },
      data: {
        nome: dati.nome,
        cognome: dati.cognome,
        numeroWhatsapp: dati.numeroWhatsapp,
        email: dati.email === undefined ? undefined : dati.email,
        note: dati.note,
      },
    });

    return this.componi(aggiornato);
  }

  /** Nuovo invito, ad esempio se il primo è scaduto o non è arrivato. */
  async rigeneraInvito(id: string): Promise<{ token: string; scadeIl: Date }> {
    const cliente = await this.leggiRiga(id);

    if (cliente.passwordHash) {
      throw new ConflictException('Il cliente ha già attivato il proprio account.');
    }

    return this.inviti.crea(cliente.id);
  }

  /** Usato dal servizio appuntamenti: verifica che il cliente esista e sia attivo. */
  async verificaCliente(id: string): Promise<RigaCliente> {
    const cliente = await this.leggiRiga(id);

    if (!cliente.attivo) {
      throw new ConflictException('La scheda di questo cliente è disattivata.');
    }

    return cliente;
  }

  private async leggiRiga(id: string): Promise<RigaCliente> {
    const cliente = await this.prisma.utente.findFirst({ where: { id, ruolo: 'cliente' } });

    if (!cliente) {
      throw new NotFoundException('Cliente non trovato.');
    }

    return cliente;
  }

  private componi(riga: RigaCliente): Cliente {
    return {
      id: riga.id,
      nome: riga.nome,
      cognome: riga.cognome,
      numeroWhatsapp: riga.numeroWhatsapp,
      email: riga.email,
      note: riga.note,
      attivo: riga.attivo,
      accountAttivato: riga.passwordHash !== null,
      creatoIl: riga.creatoIl.toISOString(),
    };
  }
}
