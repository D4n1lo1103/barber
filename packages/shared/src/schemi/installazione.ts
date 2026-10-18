import { z } from 'zod';
import { FORME_RESTITUZIONE } from '../dominio/caparra.js';
import { GRANULARITA_SLOT_AMMESSE } from '../dominio/configurazione-profilo.js';
import { PROFILI } from '../dominio/profilo.js';
import {
  schemaCognome,
  schemaEmail,
  schemaNome,
  schemaNumeroWhatsapp,
  schemaPassword,
} from './comuni.js';

export const schemaServizioIniziale = z.object({
  nome: z.string().trim().min(2, 'Il nome del servizio è troppo corto.').max(80),
  descrizione: z.string().trim().max(300).default(''),
  prezzoCentesimi: z
    .number()
    .int('Il prezzo deve essere un importo valido.')
    .min(0, 'Il prezzo non può essere negativo.')
    .max(100_000_000, 'Il prezzo è troppo alto.'),
  durataMinuti: z
    .number()
    .int('La durata deve essere in minuti interi.')
    .min(5, 'La durata minima è di 5 minuti.')
    .max(480, 'La durata massima è di 8 ore.'),
});

export type ServizioIniziale = z.infer<typeof schemaServizioIniziale>;

export const schemaDatiSalone = z.object({
  nomeSalone: z.string().trim().min(2, 'Indica il nome del salone.').max(80),
  indirizzo: z.string().trim().min(5, "Indica l'indirizzo del salone.").max(160),
  citta: z.string().trim().min(2, 'Indica la città.').max(80),
  telefono: schemaNumeroWhatsapp,
  emailSalone: schemaEmail,
});

export const schemaTitolare = z.object({
  nome: schemaNome,
  cognome: schemaCognome,
  email: schemaEmail,
  password: schemaPassword,
});

/**
 * Dati della procedura guidata al primo avvio.
 * Le durate dei servizi devono essere multiple della granularità degli slot,
 * altrimenti l'agenda non riesce a comporre gli appuntamenti.
 */
export const schemaProceduraGuidata = z
  .object({
    profilo: z.enum(PROFILI),
    salone: schemaDatiSalone,
    titolare: schemaTitolare,
    granularitaSlotMinuti: z
      .number()
      .int()
      .refine(
        (valore) => (GRANULARITA_SLOT_AMMESSE as readonly number[]).includes(valore),
        `La granularità deve essere una fra: ${GRANULARITA_SLOT_AMMESSE.join(', ')} minuti.`,
      ),
    minutiBloccoSlot: z
      .number()
      .int()
      .min(5, 'Il blocco dello slot deve durare almeno 5 minuti.')
      .max(60, 'Il blocco dello slot non può superare i 60 minuti.'),
    venditaOnlineAttiva: z.boolean(),
    servizi: z
      .array(schemaServizioIniziale)
      .min(1, 'Seleziona almeno un servizio.')
      .max(50, 'Troppi servizi nel catalogo iniziale.'),
  })
  .refine(
    (dati) =>
      dati.servizi.every((servizio) => servizio.durataMinuti % dati.granularitaSlotMinuti === 0),
    {
      message: 'Le durate dei servizi devono essere multiple della granularità degli slot.',
      path: ['servizi'],
    },
  );

export type DatiProceduraGuidata = z.infer<typeof schemaProceduraGuidata>;

/** Stato dell'installazione, consultabile senza autenticazione. */
export const schemaStatoInstallazione = z.object({
  configurata: z.boolean(),
  profilo: z.enum(PROFILI).nullable(),
  nomeSalone: z.string().nullable(),
  venditaOnlineAttiva: z.boolean(),
  /** Granularità degli slot dell'agenda, in minuti: serve alla griglia dell'agenda. */
  granularitaSlotMinuti: z.number().int().positive(),
  /** Ore entro cui il cliente può annullare dall'app. */
  oreLimitePreavviso: z.number().int(),
  /** Se vero lo spostamento segue le regole dell'annullamento. */
  spostamentoComeAnnullamento: z.boolean(),
  /** Se vero la prenotazione online richiede il pagamento della caparra. */
  caparraAttiva: z.boolean(),
  /** Percentuale della caparra: l'area clienti mostra l'importo prima di pagare. */
  caparraPercentuale: z.number().int(),
  /** Forma con cui viene restituita una caparra annullata in tempo. */
  restituzioneCaparra: z.enum(FORME_RESTITUZIONE),
  /** Minuti di blocco dello slot durante il pagamento. */
  minutiBloccoSlot: z.number().int().positive(),
});

export type StatoInstallazione = z.infer<typeof schemaStatoInstallazione>;
