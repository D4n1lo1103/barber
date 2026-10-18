import { z } from 'zod';

/**
 * Le variabili booleane restano stringhe "true"/"false": `ConfigService` può
 * restituire il valore grezzo dell'ambiente invece di quello convertito, e
 * una stringa "false" sarebbe comunque vera in una condizione. La conversione
 * si fa alla lettura, con `ambienteBooleano`.
 */
const schemaBooleano = z.enum(['true', 'false']);

/** Converte in booleano una variabile d'ambiente "true"/"false". */
export function ambienteBooleano(valore: 'true' | 'false' | boolean | undefined): boolean {
  return valore === true || valore === 'true';
}

/**
 * Validazione delle variabili d'ambiente: l'applicazione non deve avviarsi
 * con una configurazione incompleta o con segreti troppo deboli.
 */
const schemaAmbiente = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORTA: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL è obbligatoria.'),
  SEGRETO_SESSIONE: z.string().min(32, 'SEGRETO_SESSIONE deve avere almeno 32 caratteri.'),
  ORIGINE_WEB: z.url('ORIGINE_WEB deve essere un URL valido.'),
  // Richiesta per completare la procedura guidata al primo avvio: impedisce
  // che un estraneo configuri il salone prima del titolare.
  CHIAVE_INSTALLAZIONE: z.string().min(16, 'CHIAVE_INSTALLAZIONE deve avere almeno 16 caratteri.'),
  DURATA_SESSIONE_ORE: z.coerce.number().int().positive().max(720).default(12),
  IDENTIFICATIVO_INSTALLAZIONE: z.string().min(1).default('locale'),
  SENTRY_DSN: z.string().optional(),
  // ─── E-mail ───────────────────────────────────────────────────────────────
  // Senza SMTP_HOST l'invio resta disattivato: i messaggi vengono solo
  // registrati nei log, utile in sviluppo e nei test.
  SMTP_HOST: z.string().optional(),
  SMTP_PORTA: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_UTENTE: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Mittente dei messaggi, es. "Barberia Centrale <no-reply@salone.it>".
  SMTP_MITTENTE: z.string().default('Gestionale salone <no-reply@localhost>'),
  // "true" solo per le porte con TLS implicito (465).
  SMTP_TLS_IMPLICITO: schemaBooleano.default('false'),
  // Coda delle attività in background (pg-boss). Con "false" le attività
  // vengono eseguite subito, in linea: serve ai test automatici.
  CODA_ATTIVA: schemaBooleano.default('true'),
  // Solo per i test automatici: disattiva i limiti di frequenza.
  // In produzione il valore viene ignorato.
  LIMITI_FREQUENZA_DISATTIVI: schemaBooleano.default('false'),
});

export type Ambiente = z.infer<typeof schemaAmbiente>;

export function validaAmbiente(variabili: Record<string, unknown>): Ambiente {
  const risultato = schemaAmbiente.safeParse(variabili);

  if (!risultato.success) {
    const dettagli = risultato.error.issues
      .map((problema) => `${problema.path.join('.')}: ${problema.message}`)
      .join('\n');
    throw new Error(`Configurazione dell'ambiente non valida:\n${dettagli}`);
  }

  return risultato.data;
}
