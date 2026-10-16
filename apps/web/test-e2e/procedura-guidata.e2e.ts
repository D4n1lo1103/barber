import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

/**
 * Procedura guidata al primo avvio. Il test parte da un database azzerato e
 * verifica che il salone venga configurato una sola volta.
 */
const CHIAVE = process.env.CHIAVE_INSTALLAZIONE ?? '';

function azzeraInstallazione() {
  execFileSync('pnpm', ['--filter', '@barber/api', 'azzera'], { cwd: '../..', stdio: 'ignore' });
}

test.describe.configure({ mode: 'serial' });

test.describe('Procedura guidata al primo avvio', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(() => {
    azzeraInstallazione();
  });

  async function compilaFinoAllUltimoPasso(page: import('@playwright/test').Page) {
    await page.goto('/');
    await expect(page).toHaveURL(/\/procedura-guidata$/);

    await expect(page.getByRole('radio', { name: /Barbiere/ })).toBeChecked();
    await page.getByRole('button', { name: 'Avanti' }).click();

    await page.getByLabel('Nome del salone').fill('Barberia Centrale');
    await page.getByLabel('Indirizzo').fill('Via Giuseppe Garibaldi 14');
    await page.getByLabel('Città').fill('Bologna');
    await page.getByLabel('Telefono').fill('+393401112233');
    await page.getByLabel('E-mail del salone').fill('info@barberiacentrale.test');
    await page.getByRole('button', { name: 'Avanti' }).click();

    await expect(page.getByLabel("Durata di uno slot dell'agenda")).toHaveValue('15');
    await page.getByRole('button', { name: 'Avanti' }).click();

    await expect(page.getByText(/Catalogo iniziale \(6 selezionati\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Avanti' }).click();

    await page.getByLabel('Nome', { exact: true }).fill('Luca');
    await page.getByLabel('Cognome').fill('Bianchi');
    await page.getByLabel('E-mail del titolare').fill('titolare@salone.test');
    await page.getByLabel('Password', { exact: true }).fill('password-demo-salone');
  }

  test('ogni installazione parte dalla procedura guidata', async ({ page }) => {
    await page.goto('/accesso');

    await expect(page).toHaveURL(/\/procedura-guidata$/);
    await expect(page.getByRole('heading', { name: 'Configurazione del salone' })).toBeVisible();
  });

  test('la procedura rifiuta una chiave di installazione errata', async ({ page }) => {
    await compilaFinoAllUltimoPasso(page);
    await page.getByLabel('Chiave di installazione').fill('chiave-sbagliata-ma-lunga');

    await page.getByRole('button', { name: 'Completa la configurazione' }).click();

    await expect(page.getByRole('alert')).toContainText('Chiave di installazione non valida.');
  });

  test('configura il salone e porta alla pagina di accesso', async ({ page }) => {
    await compilaFinoAllUltimoPasso(page);
    await page.getByLabel('Chiave di installazione').fill(CHIAVE);

    await page.getByRole('button', { name: 'Completa la configurazione' }).click();

    await expect(page).toHaveURL(/\/accesso$/);
    await expect(page.getByText('Barberia Centrale')).toBeVisible();
  });

  test('a installazione configurata la procedura non è più raggiungibile', async ({ page }) => {
    await page.goto('/procedura-guidata');

    await expect(page).toHaveURL(/\/accesso$/);
  });
});
