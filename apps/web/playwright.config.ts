import { defineConfig, devices } from '@playwright/test';
import { PERCORSO_SESSIONE_TITOLARE } from './test-e2e/costanti';

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
    { name: 'preparazione', testMatch: '**/*.setup.ts' },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: PERCORSO_SESSIONE_TITOLARE },
      dependencies: ['preparazione'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: PERCORSO_SESSIONE_TITOLARE },
      dependencies: ['preparazione'],
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @barber/api start',
      url: 'http://localhost:3000/api/stato',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter @barber/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
    },
  ],
});
