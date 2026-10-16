import { expect, test } from '@playwright/test';

/**
 * Flusso critico della fase 0: protezione delle rotte, errore di credenziali,
 * sessione persistente e uscita. Richiede i dati demo
 * (`pnpm --filter @barber/api seed`).
 */
test.describe('Accesso del personale', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('una rotta protetta rimanda alla pagina di accesso', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/accesso$/);
    await expect(page.getByRole('heading', { name: 'Accedi' })).toBeVisible();
  });

  test('un indirizzo e-mail non valido viene bloccato dalla validazione', async ({ page }) => {
    await page.goto('/accesso');
    await page.getByLabel('E-mail').fill('non-una-email');
    await page.getByLabel('Password').fill('password-lunga-di-prova');
    await page.getByRole('button', { name: 'Accedi' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/accesso$/);
  });

  test('le credenziali errate mostrano un messaggio e non creano la sessione', async ({
    page,
    context,
  }) => {
    await page.goto('/accesso');
    await page.getByLabel('E-mail').fill('titolare@salone.test');
    await page.getByLabel('Password').fill('password-sbagliata-1');
    await page.getByRole('button', { name: 'Accedi' }).click();

    await expect(page.getByRole('alert')).toContainText('Credenziali non valide.');
    expect((await context.cookies()).find((voce) => voce.name === 'sessione')).toBeUndefined();
  });
});

test.describe('Sessione del titolare', () => {
  test('il pannello mostra il ruolo e la sessione sopravvive al ricaricamento', async ({
    page,
    context,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Ciao/ })).toBeVisible();
    await expect(page.getByText('Titolare')).toBeVisible();

    const cookieSessione = (await context.cookies()).find((voce) => voce.name === 'sessione');
    expect(cookieSessione?.httpOnly).toBe(true);

    await page.reload();
    await expect(page.getByRole('heading', { name: /Ciao/ })).toBeVisible();
  });

  test('l uscita riporta alla pagina di accesso e invalida la sessione', async ({
    page,
    context,
  }, informazioni) => {
    // Il flusso non dipende dal viewport e consuma la sessione: basta un browser.
    test.skip(informazioni.project.name !== 'chromium', 'Flusso indipendente dal viewport.');
    // Sessione propria: l'uscita non deve invalidare quella condivisa dagli altri test.
    await context.clearCookies();
    await page.goto('/accesso');
    await page.getByLabel('E-mail').fill('dipendente@salone.test');
    await page.getByLabel('Password').fill(process.env.PASSWORD_DEMO ?? 'password-demo-salone');
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(page.getByRole('heading', { name: /Ciao/ })).toBeVisible();

    await page.getByRole('button', { name: 'Esci' }).click();

    await expect(page).toHaveURL(/\/accesso$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/accesso$/);
  });
});
