import { z } from 'zod';

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
  DURATA_SESSIONE_ORE: z.coerce.number().int().positive().max(720).default(12),
  IDENTIFICATIVO_INSTALLAZIONE: z.string().min(1).default('locale'),
  SENTRY_DSN: z.string().optional(),
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
