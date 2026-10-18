import { expect, test, type Page } from '@playwright/test';

const PASSWORD_DEMO = process.env.PASSWORD_DEMO ?? 'password-demo-salone';
const EMAIL_CLIENTE = 'giulia.rossi@cliente.test';

const FORMATO_GIORNO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const FORMATO_SETTIMANA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Rome',
  weekday: 'short',
});

/** Primo venerdì utile: il salone demo apre da martedì a sabato. */
function prossimoVenerdi(): string {
  let istante = new Date(Date.now() + 24 * 60 * 60 * 1000);

  while (FORMATO_SETTIMANA.format(istante) !== 'Fri') {
    istante = new Date(istante.getTime() + 24 * 60 * 60 * 1000);
  }

  return FORMATO_GIORNO.format(istante);
}

/** Attiva o disattiva la caparra dalle impostazioni, come titolare. */
async function impostaCaparra(page: Page, attiva: boolean): Promise<void> {
  await page.goto('/impostazioni');
  await page.getByRole('button', { name: 'Regole', exact: true }).click();

  const spunta = page.getByRole('checkbox', { name: /Richiedi la caparra/i });
  await expect(spunta).toBeVisible();

  if ((await spunta.isChecked()) !== attiva) {
    await spunta.click();
  }

  await page.getByRole('button', { name: 'Salva le regole' }).click();
  await expect(page.getByRole('status')).toContainText('Regole salvate');
}

/**
 * Flusso della caparra: il titolare l'attiva, il cliente prenota, paga e
 * l'appuntamento risulta confermato solo dopo l'esito del pagamento.
 *
 * L'installazione di prova non ha le chiavi di Stripe, quindi il pagamento
 * passa dalla pagina del fornitore finto: nessun denaro viene movimentato.
 */
test.describe('Caparra alla prenotazione', () => {
  test.describe.configure({ mode: 'serial' });

  test('il titolare attiva la caparra dalle impostazioni', async ({ page }) => {
    await impostaCaparra(page, true);

    await expect(page.getByLabel(/Percentuale della caparra/)).toBeEnabled();
  });

  test('il cliente prenota, paga la caparra e l’appuntamento viene confermato', async ({
    browser,
  }) => {
    // Sessione pulita: quella salvata è del titolare.
    const contesto = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await contesto.newPage();

    await page.goto('/accesso');
    await page.getByLabel('E-mail', { exact: true }).fill(EMAIL_CLIENTE);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD_DEMO);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(page).toHaveURL(/\/area-cliente$/);

    await page.getByRole('button', { name: 'Prenota' }).click();
    await page.locator('label', { hasText: /min ·/ }).first().click();
    await page
      .getByRole('button', { name: /Luca|Sara|Marco/ })
      .first()
      .click();
    await page.getByLabel('Giorno').fill(prossimoVenerdi());

    const orari = page.locator('fieldset', { hasText: 'Orario' }).getByRole('button');
    await expect(orari.first()).toBeVisible({ timeout: 10_000 });
    await orari.last().click();

    // Il riquadro della caparra annuncia l'importo prima di prenotare.
    await expect(page.getByRole('heading', { name: 'Caparra' })).toBeVisible();

    await page.getByRole('button', { name: /Prenota e paga la caparra/ }).click();

    // Si finisce sulla pagina del fornitore: qui è quella finta.
    await expect(page).toHaveURL(/\/pagamento-finto/);
    await expect(page.getByRole('heading', { name: 'Pagamento di prova' })).toBeVisible();

    await page.getByRole('button', { name: 'Pagamento riuscito' }).click();

    // Tornati nell'area cliente, l'appuntamento risulta confermato e la
    // caparra pagata. L'elenco contiene anche appuntamenti di altri test,
    // quindi si cerca quello con la caparra.
    await expect(page).toHaveURL(/\/area-cliente/);
    const conCaparra = page.getByRole('listitem').filter({ hasText: 'Caparra pagata' }).first();
    await expect(conCaparra).toBeVisible();
    await expect(conCaparra).toContainText('Confermato');

    // Annullamento tempestivo: la caparra viene restituita secondo le regole
    // e l'appuntamento esce dai prossimi.
    await conCaparra.getByRole('button', { name: 'Annulla' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Caparra pagata' })).toHaveCount(0);

    await contesto.close();
  });

  test('il titolare vede i movimenti della caparra nella scheda cliente', async ({ page }) => {
    await page.goto('/clienti');
    await page.getByRole('link', { name: /Giulia Rossi/ }).click();

    await expect(page.getByRole('heading', { name: 'Caparre e credito' })).toBeVisible();
    await expect(page.getByText('Caparra pagata').first()).toBeVisible();
  });

  test('la caparra torna disattivata per gli altri test', async ({ page }) => {
    await impostaCaparra(page, false);
  });
});
