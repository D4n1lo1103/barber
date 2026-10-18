import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DatiImpostazioniWhatsapp, EsitoInvioDiProva, StatoWhatsapp } from '@barber/shared';
import {
  CAPARRA_PERCENTUALE_PREDEFINITA,
  ORE_LIMITE_PREAVVISO_PREDEFINITO,
  type DatiRegoleSalone,
  type RegoleSalone,
} from '@barber/shared';
import { NOMI_MODELLI_PREDEFINITI } from '../notifiche/modelli-whatsapp.js';
import type { Ambiente } from '../configurazione/ambiente.js';
import { MITTENTE_WHATSAPP, type MittenteWhatsapp } from '../notifiche/mittente-whatsapp.js';
import { NotificheServizio } from '../notifiche/notifiche.servizio.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Colonne dei messaggi WhatsApp. */
const CAMPI_WHATSAPP = {
  whatsappAttivo: true,
  whatsappIdNumero: true,
  whatsappModelloConferma: true,
  whatsappModelloPromemoria: true,
  whatsappModelloInvito: true,
  whatsappModelloVerifica: true,
} as const;

/** Colonne che compongono le regole: lette e restituite sempre insieme. */
const CAMPI_REGOLE = {
  oreLimitePreavviso: true,
  spostamentoComeAnnullamento: true,
  oreAnticipoPromemoria: true,
  caparraAttiva: true,
  caparraPercentuale: true,
  restituzioneCaparra: true,
} as const;

/**
 * Regole di annullamento, spostamento e caparra del salone. Sono impostazioni
 * salvate nel database, non valori fissi nel codice: il titolare le cambia
 * dall'interfaccia.
 */
@Injectable()
export class ImpostazioniServizio {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configurazione: ConfigService<Ambiente, true>,
    @Inject(forwardRef(() => NotificheServizio))
    private readonly notifiche: NotificheServizio,
    @Inject(MITTENTE_WHATSAPP) private readonly whatsapp: MittenteWhatsapp,
  ) {}

  /**
   * Impostazioni dei messaggi WhatsApp. Il token non viene mai restituito:
   * l'interfaccia sa soltanto se è presente, perché senza token i messaggi non
   * partono e dirlo chiaramente evita di far credere il contrario.
   */
  async leggiWhatsapp(): Promise<StatoWhatsapp> {
    const installazione = await this.prisma.installazione.findFirst({
      select: CAMPI_WHATSAPP,
    });

    return {
      attivo: installazione?.whatsappAttivo ?? false,
      idNumero: installazione?.whatsappIdNumero ?? '',
      modelli: {
        confermaPrenotazione:
          installazione?.whatsappModelloConferma ?? NOMI_MODELLI_PREDEFINITI.confermaPrenotazione,
        promemoria: installazione?.whatsappModelloPromemoria ?? NOMI_MODELLI_PREDEFINITI.promemoria,
        invitoAttivazione:
          installazione?.whatsappModelloInvito ?? NOMI_MODELLI_PREDEFINITI.invitoAttivazione,
        verificaNumero:
          installazione?.whatsappModelloVerifica ?? NOMI_MODELLI_PREDEFINITI.verificaNumero,
      },
      tokenConfigurato: Boolean(this.configurazione.get('WHATSAPP_TOKEN', { infer: true })),
      finto: this.whatsapp.finto,
    };
  }

  async salvaWhatsapp(dati: DatiImpostazioniWhatsapp): Promise<StatoWhatsapp> {
    const installazione = await this.prisma.installazione.findFirst({ select: { id: true } });

    if (!installazione) {
      throw new NotFoundException('Installazione non configurata.');
    }

    await this.prisma.installazione.update({
      where: { id: installazione.id },
      data: {
        whatsappAttivo: dati.attivo,
        whatsappIdNumero: dati.idNumero,
        whatsappModelloConferma: dati.modelli.confermaPrenotazione,
        whatsappModelloPromemoria: dati.modelli.promemoria,
        whatsappModelloInvito: dati.modelli.invitoAttivazione,
        whatsappModelloVerifica: dati.modelli.verificaNumero,
      },
    });

    return this.leggiWhatsapp();
  }

  /**
   * Invio di prova, per verificare la configurazione prima di contare sui
   * messaggi. Con il mittente finto il messaggio viene solo registrato, e la
   * risposta lo dichiara.
   */
  async inviaProva(numeroWhatsapp: string): Promise<EsitoInvioDiProva> {
    const esito = await this.notifiche.inviaProva(numeroWhatsapp);

    return {
      inviato: esito.canale === 'whatsapp',
      canale: esito.canale,
      dettaglio: esito.dettaglio,
    };
  }

  async leggiRegole(): Promise<RegoleSalone> {
    const installazione = await this.prisma.installazione.findFirst({
      select: CAMPI_REGOLE,
    });

    return (
      installazione ?? {
        oreLimitePreavviso: ORE_LIMITE_PREAVVISO_PREDEFINITO,
        spostamentoComeAnnullamento: false,
        oreAnticipoPromemoria: 24,
        caparraAttiva: false,
        caparraPercentuale: CAPARRA_PERCENTUALE_PREDEFINITA,
        restituzioneCaparra: 'rimborso',
      }
    );
  }

  async salvaRegole(dati: DatiRegoleSalone): Promise<RegoleSalone> {
    const installazione = await this.prisma.installazione.findFirst({ select: { id: true } });

    if (!installazione) {
      throw new NotFoundException('Installazione non configurata.');
    }

    const aggiornata = await this.prisma.installazione.update({
      where: { id: installazione.id },
      data: {
        oreLimitePreavviso: dati.oreLimitePreavviso,
        spostamentoComeAnnullamento: dati.spostamentoComeAnnullamento,
        oreAnticipoPromemoria: dati.oreAnticipoPromemoria,
        caparraAttiva: dati.caparraAttiva,
        caparraPercentuale: dati.caparraPercentuale,
        restituzioneCaparra: dati.restituzioneCaparra,
      },
      select: CAMPI_REGOLE,
    });

    return aggiornata;
  }
}
