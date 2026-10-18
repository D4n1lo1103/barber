import { expect, test } from '@playwright/test';

const PASSWORD_DEMO = process.env.PASSWORD_DEMO ?? 'password-demo-salone';
/** Cliente dei dati demo con consenso dato e numero da verificare. */
const EMAIL_CLIENTE = 'elena.moretti@cliente.test';

/**
 * Messaggi di servizio: il titolare configura WhatsApp dalle impostazioni e il
 * cliente verifica il proprio numero.
 *
 * L'installazione di prova non ha il token di Meta, quindi i messaggi vengono
 * solo registrati: l'interfaccia lo dichiara, e il codice di verifica arriva
 * via e-mail come ripiego. È esattamente il comportamento da verificare.
 */
test.describe('Messaggi di servizio', () => {
  test.describe.configure({ mode: 'serial' });

  test('il titolare trova la scheda Messaggi e l’avviso sul token mancante', async ({ page }) => {
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Messaggi', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Messaggi WhatsApp' })).toBeVisible();
    // Senza token l'interfaccia non lascia credere che i messaggi partano.
    await expect(page.getByRole('status').first()).toContainText('WHATSAPP_TOKEN');
    await expect(page.getByLabel(/Conferma della prenotazione/)).toHaveValue(
      'conferma_prenotazione',
    );
  });

  test('l’invio di prova dichiara che il messaggio è stato solo registrato', async ({ page }) => {
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Messaggi', exact: true }).click();

    await page.getByLabel('Numero di prova').fill('+393405550099');
    await page.getByRole('button', { name: 'Invia la prova' }).click();

    // L'esito compare in cima, sopra l'avviso sul token mancante.
    await expect(page.getByRole('status').first()).toContainText('registrato');
  });

  test('il cliente chiede il codice per verificare il numero', async ({ browser }) => {
    const contesto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await contesto.newPage();

    await page.goto('/accesso');
    await page.getByLabel('E-mail', { exact: true }).fill(EMAIL_CLIENTE);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD_DEMO);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(page).toHaveURL(/\/area-cliente$/);

    await page.getByRole('button', { name: 'Profilo e dati' }).click();
    await expect(page.getByText(/Verifica il tuo numero/)).toBeVisible();

    await page.getByRole('button', { name: 'Invia il codice' }).click();

    // Senza WhatsApp attivo il codice arriva via e-mail: il campo del codice
    // compare comunque, pronto per essere compilato.
    // Senza WhatsApp attivo l'avviso dice che il codice è arrivato per e-mail.
    await expect(page.getByRole('status').first()).toContainText('codice');
    await expect(page.getByLabel('Codice ricevuto')).toBeVisible();

    // Un codice sbagliato viene rifiutato con un messaggio chiaro.
    await page.getByLabel('Codice ricevuto').fill('000000');
    await page.getByRole('button', { name: 'Conferma il numero' }).click();
    await expect(page.getByRole('alert')).toContainText('Codice');

    await contesto.close();
  });
});
