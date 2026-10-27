import { expect, test, type Browser, type Page } from '@playwright/test';

const PASSWORD_DEMO = process.env.PASSWORD_DEMO ?? 'password-demo-salone';
/** Cliente dei dati demo con consenso dato e numero da verificare. */
const EMAIL_CLIENTE = 'elena.moretti@cliente.test';

/**
 * Messaggi di servizio: il titolare configura WhatsApp dalle impostazioni e il
 * cliente verifica il proprio numero.
 *
 * L'installazione di prova non ha il token di Meta, quindi i messaggi vengono
 * solo registrati e l'interfaccia lo dichiara. Il codice di verifica del
 * numero, però, non ripiega sull'e-mail: dimostrerebbe il possesso della
 * casella e non del numero, e da quella prova dipende l'unione con la scheda
 * creata dal personale. Senza WhatsApp attivo la verifica non è disponibile.
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

  /** Apre l'area del cliente in una sessione pulita, sulla scheda del profilo. */
  async function profiloDelCliente(browser: Browser) {
    const contesto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await contesto.newPage();

    await page.goto('/accesso');
    await page.getByLabel('E-mail', { exact: true }).fill(EMAIL_CLIENTE);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD_DEMO);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(page).toHaveURL(/\/area-cliente$/);

    await page.getByRole('button', { name: 'Profilo e dati' }).click();
    await expect(page.getByText(/Verifica il tuo numero/)).toBeVisible();

    return { contesto, page };
  }

  /** Attiva o disattiva i messaggi WhatsApp dalla scheda Messaggi. */
  async function impostaWhatsapp(page: Page, attivo: boolean) {
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Messaggi', exact: true }).click();

    const interruttore = page.getByRole('checkbox', {
      name: /Invia i messaggi di servizio su WhatsApp/,
    });

    if ((await interruttore.isChecked()) !== attivo) {
      await interruttore.setChecked(attivo);
    }

    if (attivo) {
      // Per ruolo e non per etichetta: il testo dell'interruttore cita a sua
      // volta l'identificativo del numero mittente.
      await page
        .getByRole('textbox', { name: 'Identificativo del numero mittente' })
        .fill('123456789012345');
    }

    await page.getByRole('button', { name: 'Salva i messaggi' }).click();
    await expect(page.getByRole('status').first()).toBeVisible();
  }

  test('senza WhatsApp attivo la verifica del numero non è disponibile', async ({ browser }) => {
    const { contesto, page } = await profiloDelCliente(browser);

    await page.getByRole('button', { name: 'Invia il codice' }).click();

    // Nessun ripiego via e-mail: l'app spiega perché e manda dal salone.
    await expect(page.getByRole('alert')).toContainText('WhatsApp');
    await expect(page.getByLabel('Codice ricevuto')).toBeHidden();

    await contesto.close();
  });

  test('con WhatsApp attivo il cliente riceve il codice e uno sbagliato viene rifiutato', async ({
    browser,
    page,
  }) => {
    await impostaWhatsapp(page, true);

    const { contesto, page: pagina } = await profiloDelCliente(browser);

    await pagina.getByRole('button', { name: 'Invia il codice' }).click();

    await expect(pagina.getByRole('status').first()).toContainText('WhatsApp');
    await expect(pagina.getByLabel('Codice ricevuto')).toBeVisible();

    // Un codice sbagliato viene rifiutato con un messaggio chiaro.
    await pagina.getByLabel('Codice ricevuto').fill('000000');
    await pagina.getByRole('button', { name: 'Conferma il numero' }).click();
    await expect(pagina.getByRole('alert')).toContainText('Codice');

    await contesto.close();
    // Le impostazioni sono condivise: WhatsApp torna spento per gli altri test.
    await impostaWhatsapp(page, false);
  });
});
