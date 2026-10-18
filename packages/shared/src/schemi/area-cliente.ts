import { z } from 'zod';
import { STATI_APPUNTAMENTO } from '../dominio/appuntamento.js';
import { schemaCognome, schemaNome, schemaNumeroWhatsapp } from './comuni.js';
import { schemaIdentificativo } from './servizi.js';

const schemaIstante = z.iso.datetime({ message: 'Data e ora non valide.' });

/**
 * Prenotazione dal cliente. Non esiste l'opzione "senza caparra", riservata al
 * personale, e non si sceglie "operatore indifferente": l'operatore è sempre
 * esplicito.
 */
export const schemaPrenotazioneCliente = z.object({
  operatoreId: schemaIdentificativo,
  servizioIds: z
    .array(schemaIdentificativo)
    .min(1, 'Scegli almeno un servizio.')
    .max(6, 'Troppi servizi in un solo appuntamento.')
    .refine(
      (servizi) => new Set(servizi).size === servizi.length,
      'Hai scelto due volte lo stesso servizio.',
    ),
  inizio: schemaIstante,
});

export type DatiPrenotazioneCliente = z.infer<typeof schemaPrenotazioneCliente>;

export const schemaSpostamentoCliente = z.object({ inizio: schemaIstante });

export type DatiSpostamentoCliente = z.infer<typeof schemaSpostamentoCliente>;

/** Appuntamento come lo vede il cliente, con le azioni che può compiere. */
export const schemaAppuntamentoCliente = z.object({
  id: z.uuid(),
  stato: z.enum(STATI_APPUNTAMENTO),
  inizio: z.string(),
  fine: z.string(),
  durataMinuti: z.number().int(),
  prezzoTotaleCentesimi: z.number().int(),
  operatore: z.object({ id: z.uuid(), nome: z.string(), cognome: z.string() }),
  servizi: z.array(z.object({ nome: z.string(), prezzoCentesimi: z.number().int() })),
  /**
   * Servizi ancora presenti in catalogo: servono a ricalcolare gli orari
   * disponibili quando il cliente sposta l'appuntamento.
   */
  servizioIds: z.array(z.uuid()),
  puoAnnullare: z.boolean(),
  puoSpostare: z.boolean(),
});

export type AppuntamentoCliente = z.infer<typeof schemaAppuntamentoCliente>;

export const schemaModificaProfilo = z.object({
  nome: schemaNome.optional(),
  cognome: schemaCognome.optional(),
  numeroWhatsapp: schemaNumeroWhatsapp.optional(),
  /** Consenso ai messaggi WhatsApp: revocabile in qualsiasi momento. */
  consensoWhatsapp: z.boolean().optional(),
});

export type DatiModificaProfilo = z.infer<typeof schemaModificaProfilo>;

export const schemaProfiloCliente = z.object({
  id: z.uuid(),
  nome: z.string(),
  cognome: z.string(),
  email: z.string().nullable(),
  numeroWhatsapp: z.string().nullable(),
  emailVerificata: z.boolean(),
  /** La verifica del numero arriva con i messaggi WhatsApp (fase 7). */
  numeroVerificato: z.boolean(),
  consensoTrattamentoIl: z.string().nullable(),
  consensoWhatsappIl: z.string().nullable(),
  creatoIl: z.string(),
});

export type ProfiloCliente = z.infer<typeof schemaProfiloCliente>;

/** Copia dei propri dati, come richiede il diritto di accesso (GDPR). */
export const schemaEsportazioneDati = z.object({
  profilo: schemaProfiloCliente,
  appuntamenti: z.array(
    z.object({
      inizio: z.string(),
      fine: z.string(),
      stato: z.enum(STATI_APPUNTAMENTO),
      operatore: z.string(),
      servizi: z.array(z.string()),
      prezzoTotaleCentesimi: z.number().int(),
    }),
  ),
  /** Momento in cui la copia è stata prodotta. */
  esportatoIl: z.string(),
});

export type EsportazioneDati = z.infer<typeof schemaEsportazioneDati>;

export const STATI_RICHIESTA_CANCELLAZIONE = ['in_attesa', 'evasa', 'rifiutata'] as const;

export type StatoRichiestaCancellazione = (typeof STATI_RICHIESTA_CANCELLAZIONE)[number];

export const ETICHETTE_RICHIESTA_CANCELLAZIONE: Readonly<
  Record<StatoRichiestaCancellazione, string>
> = {
  in_attesa: 'In attesa',
  evasa: 'Evasa',
  rifiutata: 'Rifiutata',
};

export const schemaRichiestaCancellazioneDati = z.object({
  motivo: z.string().trim().max(500, 'Il motivo è troppo lungo.').default(''),
});

export type DatiRichiestaCancellazioneDati = z.infer<typeof schemaRichiestaCancellazioneDati>;

export const schemaRichiestaCancellazione = z.object({
  id: z.uuid(),
  stato: z.enum(STATI_RICHIESTA_CANCELLAZIONE),
  motivo: z.string(),
  notaTitolare: z.string(),
  richiestaIl: z.string(),
  evasaIl: z.string().nullable(),
  cliente: z.object({
    id: z.uuid(),
    nome: z.string(),
    cognome: z.string(),
    email: z.string().nullable(),
  }),
  /** Appuntamenti futuri ancora in agenda: il titolare li valuta prima di evadere. */
  appuntamentiFuturi: z.number().int(),
});

export type RichiestaCancellazione = z.infer<typeof schemaRichiestaCancellazione>;

/** Esito deciso dal titolare su una richiesta di cancellazione. */
export const schemaEvasioneRichiesta = z.object({
  azione: z.enum(['anonimizza', 'rifiuta'], { message: 'Indica come procedere.' }),
  nota: z.string().trim().max(500, 'La nota è troppo lunga.').default(''),
});

export type DatiEvasioneRichiesta = z.infer<typeof schemaEvasioneRichiesta>;
