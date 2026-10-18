import { expect, test } from '@playwright/test';

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

/**
 * Area del cliente: registrazione con consensi e, come cliente dei dati demo,
 * prenotazione online e diritti sui propri dati.
 *
 * I test partono senza sessione: quella salvata è del titolare.
 */
test.describe('Area del cliente', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ mode: 'serial' });

  test('la registrazione raccoglie i consensi e chiede di confermare l’e-mail', async ({
    page,
  }) => {
    const marcatore = String(Date.now()).slice(-7);
    const email = `cliente.prova.${marcatore}@cliente.test`;

    await page.goto('/registrazione');

    await page.getByLabel('Nome', { exact: true }).fill('Marta');
    await page.getByLabel('Cognome').fill('Esposito');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Numero WhatsApp').fill(`+3934055${marcatore}`);
    await page.getByLabel('Password', { exact: true }).fill('password-di-prova-123');

    // Senza il consenso obbligatorio la registrazione non parte.
    await page.getByRole('button', { name: /Crea l/ }).click();
    await expect(page.getByText(/devi accettare il trattamento/i)).toBeVisible();

    await page.getByRole('checkbox', { name: /trattamento dei miei dati/i }).check();
    await page.getByRole('button', { name: /Crea l/ }).click();

    await expect(page.getByRole('heading', { name: /Controlla la tua e-mail/i })).toBeVisible();

    // Finché l'indirizzo non è confermato l'accesso è rifiutato.
    await page.goto('/accesso');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('password-di-prova-123');
    await page.getByRole('button', { name: 'Accedi' }).click();

    await expect(page.getByRole('alert')).toContainText('Conferma');
  });

  test('un cliente registrato prenota, sposta e annulla dall’app', async ({ page }) => {
    await page.goto('/accesso');
    await page.getByLabel('E-mail', { exact: true }).fill(EMAIL_CLIENTE);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD_DEMO);
    await page.getByRole('button', { name: 'Accedi' }).click();

    await expect(page).toHaveURL(/\/area-cliente$/);
    await expect(page.getByRole('heading', { name: /Ciao/ })).toBeVisible();

    await page.getByRole('button', { name: 'Prenota' }).click();

    // Primo servizio disponibile e primo operatore proposto.
    await page.locator('label', { hasText: /min ·/ }).first().click();
    await page
      .getByRole('button', { name: /Luca|Sara|Marco/ })
      .first()
      .click();

    // Giorno lavorativo esplicito: oggi il salone può essere chiuso e gli
    // orari entro due ore non sono prenotabili.
    await page.getByLabel('Giorno').fill(prossimoVenerdi());

    const orari = page.locator('fieldset', { hasText: 'Orario' }).getByRole('button');
    await expect(orari.first()).toBeVisible({ timeout: 10_000 });
    await orari.last().click();

    await page.getByRole('button', { name: /Conferma la prenotazione/ }).click();

    // Si torna all'elenco, con l'appuntamento appena creato fra i prossimi.
    await expect(page.getByRole('heading', { name: 'Prossimi appuntamenti' })).toBeVisible();
    const primo = page.getByRole('listitem').first();
    await expect(primo.getByRole('button', { name: 'Annulla' })).toBeVisible();

    await primo.getByRole('button', { name: 'Annulla' }).click();

    await expect(page.getByRole('heading', { name: 'Storico' })).toBeVisible();
  });

  test('il cliente gestisce consensi e dati personali', async ({ page }) => {
    await page.goto('/accesso');
    await page.getByLabel('E-mail', { exact: true }).fill(EMAIL_CLIENTE);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD_DEMO);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(page).toHaveURL(/\/area-cliente$/);

    await page.getByRole('button', { name: 'Profilo e dati' }).click();

    const consenso = page.getByRole('checkbox', { name: /WhatsApp/i });
    const eraAttivo = await consenso.isChecked();
    await consenso.click();
    await expect(consenso).toBeChecked({ checked: !eraAttivo });

    // La copia dei dati si scarica come file JSON.
    const scaricamento = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Scarica i miei dati' }).click();
    expect((await scaricamento).suggestedFilename()).toBe('i-miei-dati.json');

    await page.getByRole('button', { name: 'Chiedi la cancellazione' }).click();
    await expect(page.getByRole('dialog')).toContainText('in forma anonima');
    await page.getByRole('button', { name: 'Chiudi la finestra' }).click();
  });
});
