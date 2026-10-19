import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { PERCORSO_SESSIONE_TITOLARE } from './test-e2e/costanti';

/**
 * I test end-to-end usano le stesse variabili dell'ambiente di sviluppo
 * (in particolare la chiave di installazione), lette dal file .env del
 * monorepo quando non sono già presenti nell'ambiente.
 */
function caricaVariabiliAmbiente(): void {
  let contenuto: string;

  try {
    contenuto = readFileSync('../../.env', 'utf8');
  } catch {
    return;
  }

  for (const riga of contenuto.split('\n')) {
    const corrispondenza = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(riga);

    if (corrispondenza?.[1] && !process.env[corrispondenza[1]]) {
      process.env[corrispondenza[1]] = corrispondenza[2]?.replace(/^"(.*)"$/, '$1');
    }
  }
}

caricaVariabiliAmbiente();

/**
 * Test end-to-end dei flussi critici. Richiede il database avviato
 * (`docker compose up -d database`) e le migrazioni applicate.
 */
export default defineConfig({
  testDir: './test-e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5180',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'installazione',
      testMatch: '**/procedura-guidata.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'preparazione',
      testMatch: '**/*.setup.ts',
      dependencies: ['installazione'],
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: PERCORSO_SESSIONE_TITOLARE },
      testIgnore: [
        '**/procedura-guidata.e2e.ts',
        '**/caparra.e2e.ts',
        '**/messaggi.e2e.ts',
        '**/vendite.e2e.ts',
      ],
      dependencies: ['preparazione'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: PERCORSO_SESSIONE_TITOLARE },
      // Su mobile si verifica l'accesso: le impostazioni e la procedura
      // guidata modificano dati condivisi e girano una volta sola.
      testIgnore: [
        '**/procedura-guidata.e2e.ts',
        '**/impostazioni.e2e.ts',
        '**/caparra.e2e.ts',
        '**/messaggi.e2e.ts',
        '**/vendite.e2e.ts',
      ],
      dependencies: ['preparazione'],
    },
    {
      // Le vendite scaricano il magazzino, condiviso fra i test: girano
      // dopo gli altri, da sole.
      name: 'vendite',
      testMatch: '**/vendite.e2e.ts',
      use: { ...devices['Desktop Chrome'], storageState: PERCORSO_SESSIONE_TITOLARE },
      dependencies: ['chromium', 'mobile'],
    },
    {
      // I messaggi si configurano dalle impostazioni, che sono condivise:
      // gira dopo gli altri, come la caparra.
      name: 'messaggi',
      testMatch: '**/messaggi.e2e.ts',
      use: { ...devices['Desktop Chrome'], storageState: PERCORSO_SESSIONE_TITOLARE },
      dependencies: ['chromium', 'mobile'],
    },
    {
      // La caparra è un'impostazione del salone: attivarla cambia il
      // comportamento di tutte le prenotazioni, quindi gira per ultima e da
      // sola, e alla fine la rimette come l'ha trovata.
      name: 'caparra',
      testMatch: '**/caparra.e2e.ts',
      use: { ...devices['Desktop Chrome'], storageState: PERCORSO_SESSIONE_TITOLARE },
      dependencies: ['chromium', 'mobile'],
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @barber/api start',
      url: 'http://localhost:3000/api/stato',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      // I test ripetono gli accessi e la procedura guidata molte volte:
      // il limite di frequenza è verificato dai test di integrazione.
      env: { ...process.env, LIMITI_FREQUENZA_DISATTIVI: 'true' } as Record<string, string>,
    },
    {
      command: 'pnpm --filter @barber/web dev',
      url: 'http://localhost:5180',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
    },
  ],
});
