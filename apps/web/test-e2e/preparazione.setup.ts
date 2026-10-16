import { expect, test as preparazione } from '@playwright/test';
import { PERCORSO_SESSIONE_TITOLARE } from './costanti';

const EMAIL_TITOLARE = 'titolare@salone.test';
const PASSWORD_DEMO = process.env.PASSWORD_DEMO ?? 'password-demo-salone';

/**
 * Effettua un solo accesso e salva la sessione su file: i test autenticati la
 * riusano, senza superare il limite di frequenza dell'endpoint di accesso.
 */
preparazione('accesso del titolare', async ({ page }) => {
  await page.goto('/accesso');
  await page.getByLabel('E-mail').fill(EMAIL_TITOLARE);
  await page.getByLabel('Password').fill(PASSWORD_DEMO);
  await page.getByRole('button', { name: 'Accedi' }).click();

  await expect(page.getByRole('heading', { name: /Ciao/ })).toBeVisible();

  await page.context().storageState({ path: PERCORSO_SESSIONE_TITOLARE });
});
