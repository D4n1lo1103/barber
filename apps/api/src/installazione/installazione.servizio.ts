import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import {
  CAPARRA_PERCENTUALE_PREDEFINITA,
  configurazioneProfilo,
  ORE_LIMITE_PREAVVISO_PREDEFINITO,
  type DatiProceduraGuidata,
  type StatoInstallazione,
} from '@barber/shared';
import { AutenticazioneServizio } from '../autenticazione/autenticazione.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Ambiente } from '../configurazione/ambiente.js';

/** Usata finché la procedura guidata non ha fissato la granularità scelta. */
const GRANULARITA_PREDEFINITA = 15;
const MINUTI_BLOCCO_SLOT_PREDEFINITI = 10;

@Injectable()
export class InstallazioneServizio {
  private readonly logger = new Logger(InstallazioneServizio.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autenticazione: AutenticazioneServizio,
    private readonly configurazione: ConfigService<Ambiente, true>,
  ) {}

  /** Stato pubblico: il frontend decide se mostrare la procedura guidata o l'accesso. */
  async leggiStato(): Promise<StatoInstallazione> {
    const installazione = await this.prisma.installazione.findFirst();

    if (!installazione) {
      return {
        configurata: false,
        profilo: null,
        nomeSalone: null,
        venditaOnlineAttiva: false,
        granularitaSlotMinuti: GRANULARITA_PREDEFINITA,
        oreLimitePreavviso: ORE_LIMITE_PREAVVISO_PREDEFINITO,
        spostamentoComeAnnullamento: false,
        caparraAttiva: false,
        caparraPercentuale: CAPARRA_PERCENTUALE_PREDEFINITA,
        restituzioneCaparra: 'rimborso',
        minutiBloccoSlot: MINUTI_BLOCCO_SLOT_PREDEFINITI,
      };
    }

    return {
      configurata: installazione.configurata,
      profilo: installazione.configurata ? installazione.profilo : null,
      nomeSalone: installazione.configurata ? installazione.nomeSalone : null,
      venditaOnlineAttiva: installazione.venditaOnlineAttiva,
      granularitaSlotMinuti: installazione.granularitaSlotMin,
      // L'area clienti mostra entro quando si può annullare o spostare.
      oreLimitePreavviso: installazione.oreLimitePreavviso,
      spostamentoComeAnnullamento: installazione.spostamentoComeAnnullamento,
      // Serve all'area clienti per annunciare la caparra prima di prenotare.
      caparraAttiva: installazione.caparraAttiva,
      caparraPercentuale: installazione.caparraPercentuale,
      restituzioneCaparra: installazione.restituzioneCaparra,
      minutiBloccoSlot: installazione.minutiBloccoSlot,
    };
  }

  /**
   * Completa la procedura guidata al primo avvio: crea l'installazione,
   * l'account del titolare e il catalogo iniziale in un'unica transazione.
   * Può riuscire una sola volta.
   */
  async completaProceduraGuidata(dati: DatiProceduraGuidata, chiaveFornita: string): Promise<void> {
    this.verificaChiave(chiaveFornita);

    if ((await this.prisma.installazione.findFirst())?.configurata) {
      throw new ConflictException("L'installazione è già stata configurata.");
    }

    const configurazione = configurazioneProfilo(dati.profilo);
    const passwordHash = await this.autenticazione.calcolaHashPassword(dati.titolare.password);

    try {
      await this.prisma.$transaction(async (transazione) => {
        await transazione.installazione.create({
          data: {
            riga: 1,
            profilo: dati.profilo,
            nomeSalone: dati.salone.nomeSalone,
            indirizzo: dati.salone.indirizzo,
            citta: dati.salone.citta,
            telefono: dati.salone.telefono,
            emailSalone: dati.salone.emailSalone,
            granularitaSlotMin: dati.granularitaSlotMinuti,
            minutiBloccoSlot: dati.minutiBloccoSlot,
            venditaOnlineAttiva: dati.venditaOnlineAttiva,
            configurata: true,
          },
        });

        const titolare = await transazione.utente.create({
          data: {
            email: dati.titolare.email,
            passwordHash,
            nome: dati.titolare.nome,
            cognome: dati.titolare.cognome,
            ruolo: 'titolare',
            emailVerificata: true,
          },
        });

        // Orari di apertura proposti dal profilo (da martedì a sabato:
        // domenica e lunedì restano chiusi, cioè senza fasce) e orari di
        // lavoro del titolare, che è anche operatore. Il titolare può
        // cambiarli subito dalle impostazioni.
        const apertura = configurazione.aperturaPredefinita.map((fascia) => ({
          giornoSettimana: fascia.giornoSettimana,
          minutoInizio: fascia.minutoInizio,
          minutoFine: fascia.minutoFine,
        }));

        await transazione.orarioApertura.createMany({ data: apertura });
        await transazione.orarioOperatore.createMany({
          data: apertura.map((fascia) => ({ ...fascia, operatoreId: titolare.id })),
        });

        await transazione.servizio.createMany({
          data: dati.servizi.map((servizio, posizione) => ({
            nome: servizio.nome,
            descrizione: servizio.descrizione,
            prezzoCentesimi: servizio.prezzoCentesimi,
            durataMinuti: servizio.durataMinuti,
            ordine: posizione,
          })),
        });
      });
    } catch (errore) {
      throw this.traduciErrore(errore);
    }

    this.logger.log(
      `Installazione configurata: profilo ${dati.profilo}, ${dati.servizi.length} servizi, ` +
        `${configurazione.aperturaPredefinita.length} fasce di apertura predefinite.`,
    );
  }

  /** Catalogo e impostazioni proposte per un profilo, usati dalla procedura guidata. */
  leggiConfigurazioneProfilo(profilo: 'barbiere' | 'parrucchiere') {
    const configurazione = configurazioneProfilo(profilo);

    return {
      profilo: configurazione.profilo,
      etichetta: configurazione.etichetta,
      granularitaSlotMinuti: configurazione.granularitaSlotMinuti,
      minutiBloccoSlot: configurazione.minutiBloccoSlot,
      catalogoIniziale: configurazione.catalogoIniziale,
    };
  }

  /**
   * La procedura guidata è raggiungibile senza autenticazione: la chiave di
   * installazione, nota solo a chi ha predisposto il server, impedisce che un
   * estraneo configuri il salone prima del titolare.
   */
  private verificaChiave(chiaveFornita: string): void {
    const chiaveAttesa = this.configurazione.get('CHIAVE_INSTALLAZIONE', { infer: true });
    const attesa = Buffer.from(chiaveAttesa);
    const ricevuta = Buffer.from(chiaveFornita);

    if (attesa.length !== ricevuta.length || !timingSafeEqual(attesa, ricevuta)) {
      this.logger.warn('Tentativo di configurazione con chiave di installazione errata.');

      throw new ForbiddenException('Chiave di installazione non valida.');
    }
  }

  private traduciErrore(errore: unknown): Error {
    const codice = (errore as { code?: string }).code;

    // P2002: violazione di un vincolo di unicità (installazione già presente,
    // e-mail del titolare già usata, nome di servizio duplicato).
    if (codice === 'P2002') {
      return new ConflictException(
        "Configurazione non riuscita: l'installazione esiste già oppure ci sono dati duplicati.",
      );
    }

    this.logger.error('Errore durante la configurazione iniziale.', errore);

    return errore instanceof Error ? errore : new Error('Configurazione non riuscita.');
  }
}
