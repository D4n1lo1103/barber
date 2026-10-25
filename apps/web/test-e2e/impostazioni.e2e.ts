import { expect, test } from '@playwright/test';

/**
 * Gestione del catalogo, del personale e degli orari da parte del titolare.
 * Usa la sessione preparata e i dati demo del profilo barbiere.
 */
test.describe('Impostazioni del salone', () => {
  test.describe.configure({ mode: 'serial' });

  test('il titolare raggiunge le impostazioni dal pannello', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Impostazioni del salone' }).click();

    await expect(page).toHaveURL(/\/impostazioni$/);
    await expect(page.getByRole('heading', { name: 'Barberia Centrale' })).toBeVisible();
  });

  test('mostra i dati del salone e salva una modifica', async ({ page }) => {
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Salone' }).click();

    await expect(page.getByLabel('Nome del salone')).toHaveValue('Barberia Centrale');
    // Il profilo si vede ma non si cambia.
    await expect(page.getByText('Scelto al primo avvio e non modificabile')).toBeVisible();

    const blocco = page.getByLabel('Blocco dello slot durante il pagamento (minuti)');
    await blocco.fill('12');
    await page.getByRole('button', { name: 'Salva i dati del salone' }).click();
    await expect(page.getByText('Dati del salone salvati.')).toBeVisible();

    // Si rimette il valore dei dati demo per i test che seguono.
    await blocco.fill('10');
    await page.getByRole('button', { name: 'Salva i dati del salone' }).click();
    await expect(page.getByText('Dati del salone salvati.')).toBeVisible();
  });

  test('aggiunge un servizio al catalogo e poi lo disattiva', async ({ page }) => {
    const nomeServizio = `Rasatura di prova ${Date.now()}`;
    await page.goto('/impostazioni');

    await page.getByLabel('Nome', { exact: true }).fill(nomeServizio);
    await page.getByLabel('Prezzo').fill('18,50');
    await page.getByLabel('Durata (minuti)').fill('30');
    await page.getByRole('button', { name: 'Aggiungi servizio' }).click();

    const voce = page.locator('li', { hasText: nomeServizio });
    await expect(voce).toContainText('18,50');
    await expect(voce).toContainText('30 min');

    await voce.getByRole('button', { name: 'Disattiva' }).click();

    await expect(page.locator('li', { hasText: nomeServizio })).toContainText('(disattivato)');
  });

  test('rifiuta una durata non compatibile con gli slot', async ({ page }) => {
    await page.goto('/impostazioni');

    await page.getByLabel('Nome', { exact: true }).fill('Servizio non valido');
    await page.getByLabel('Prezzo').fill('10,00');
    await page.getByLabel('Durata (minuti)').fill('20');
    await page.getByRole('button', { name: 'Aggiungi servizio' }).click();

    await expect(page.getByRole('alert')).toContainText('multiplo di 15 minuti');
  });

  test('crea un dipendente e mostra il link di attivazione una sola volta', async ({ page }) => {
    const email = `nuovo.dipendente.${Date.now()}@salone.test`;
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Personale' }).click();

    await page.getByLabel('Nome', { exact: true }).fill('Chiara');
    await page.getByLabel('Cognome').fill('Gialli');
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Crea account' }).click();

    await expect(page.getByRole('heading', { name: /Link di attivazione/ })).toBeVisible();
    await expect(page.getByText(/\/attivazione\?token=/)).toBeVisible();
    await expect(page.locator('li', { hasText: email })).toContainText('account da attivare');
  });

  test('il dipendente attiva l account dal link e accede', async ({ page, context }) => {
    const email = `attiva.${Date.now()}@salone.test`;
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Personale' }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Dario');
    await page.getByLabel('Cognome').fill('Rosa');
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Crea account' }).click();

    const collegamento = await page.getByText(/\/attivazione\?token=/).innerText();

    await context.clearCookies();
    await page.goto(collegamento);
    await page.getByLabel('Password', { exact: true }).fill('password-del-dipendente');
    await page.getByLabel('Conferma la password').fill('password-del-dipendente');
    await page.getByRole('button', { name: 'Attiva account' }).click();

    await expect(page).toHaveURL(/\/accesso$/, { timeout: 10_000 });

    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Password').fill('password-del-dipendente');
    await page.getByRole('button', { name: 'Accedi' }).click();

    await expect(page.getByRole('heading', { name: /Ciao Dario/ })).toBeVisible();
    // Il dipendente non vede le impostazioni del salone.
    await expect(page.getByRole('link', { name: 'Impostazioni del salone' })).toHaveCount(0);
  });

  test('salva gli orari di apertura del salone', async ({ page }) => {
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Orari' }).click();

    // Si parte da uno stato noto: niente fasce di lunedì.
    const lunediApertura = page.locator('[data-giorno="1"]').first();
    for (const rimuovi of await lunediApertura.getByRole('button', { name: /^Rimuovi/ }).all()) {
      await rimuovi.click();
    }

    await page.getByRole('button', { name: 'Aggiungi una fascia a lunedì' }).first().click();
    await page.getByRole('button', { name: 'Salva orari' }).first().click();

    await expect(page.getByRole('status')).toContainText('Orari salvati.');
    await expect(
      page.locator('[data-giorno="1"]').first().locator('input[type="time"]').first(),
    ).toHaveValue('09:00');
  });

  test('rifiuta un orario di lavoro fuori dagli orari di apertura', async ({ page }) => {
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Orari' }).click();

    // L'apertura del lunedì salvata dal test precedente è 09:00–13:00.
    const sezioneOperatore = page.locator('[data-giorno="1"]').last();
    for (const rimuovi of await sezioneOperatore.getByRole('button', { name: /^Rimuovi/ }).all()) {
      await rimuovi.click();
    }

    await page.getByRole('button', { name: 'Aggiungi una fascia a lunedì' }).last().click();
    await sezioneOperatore.locator('input[type="time"]').first().fill('08:00');
    await page.getByRole('button', { name: 'Salva orari' }).last().click();

    await expect(page.getByRole('alert')).toContainText('fuori dagli orari di apertura');
  });

  test('registra una chiusura del salone e poi la rimuove', async ({ page }) => {
    const motivo = `Chiusura di prova ${Date.now()}`;
    // Data lontana, per non interferire con gli appuntamenti degli altri test.
    const fra90Giorni = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Orari' }).click();

    await page.getByLabel('Dal').fill(fra90Giorni);
    await page.getByLabel('Al (compreso)').fill(fra90Giorni);
    await page.getByLabel('Motivo').fill(motivo);
    await page.getByRole('button', { name: 'Registra chiusura' }).click();

    const voce = page.locator('li', { hasText: motivo });
    await expect(voce).toContainText('operatori');

    await voce.getByRole('button', { name: /Rimuovi la chiusura/ }).click();

    await expect(page.locator('li', { hasText: motivo })).toHaveCount(0);
  });
});
