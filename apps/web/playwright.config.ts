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
    baseURL: 'http://localhost:5173',
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
      testIgnore: '**/procedura-guidata.e2e.ts',
      dependencies: ['preparazione'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: PERCORSO_SESSIONE_TITOLARE },
      testIgnore: '**/procedura-guidata.e2e.ts',
      dependencies: ['preparazione'],
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
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
    },
  ],
});
