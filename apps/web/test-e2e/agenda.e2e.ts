import { expect, test } from '@playwright/test';

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

/** Primo mercoledì utile: il salone demo apre da martedì a sabato. */
function prossimoMercoledi(): string {
  let istante = new Date(Date.now() + 24 * 60 * 60 * 1000);

  while (FORMATO_SETTIMANA.format(istante) !== 'Wed') {
    istante = new Date(istante.getTime() + 24 * 60 * 60 * 1000);
  }

  return FORMATO_GIORNO.format(istante);
}

/**
 * Flusso critico della fase 3: il personale crea una scheda cliente, prenota un
 * appuntamento scegliendo servizi e orario fra quelli disponibili e poi lo
 * chiude dall'agenda.
 */
test.describe('Agenda del personale', () => {
  test.describe.configure({ mode: 'serial' });

  const marcatore = String(Date.now()).slice(-6);
  const cognomeCliente = `Prova${marcatore}`;
  const giorno = prossimoMercoledi();

  test('crea una scheda cliente e mostra il link di attivazione', async ({ page }) => {
    await page.goto('/clienti');

    await page.getByRole('button', { name: 'Nuova scheda' }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Cliente');
    await page.getByLabel('Cognome').fill(cognomeCliente);
    await page.getByLabel('Numero WhatsApp').fill(`+39340555${marcatore}`);
    await page.getByRole('button', { name: 'Crea scheda' }).click();

    await expect(page.getByText(/Consegna al cliente questo link/)).toBeVisible();
    await expect(page.getByText(/\/attivazione\?token=/)).toBeVisible();

    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(page.getByRole('link', { name: new RegExp(cognomeCliente) })).toBeVisible();
  });

  test('prenota un appuntamento dall’agenda e lo completa', async ({ page }, informazioni) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Agenda' }).click();
    await expect(page).toHaveURL(/\/agenda$/);

    await page.getByRole('button', { name: 'Nuovo appuntamento' }).click();

    // Cliente: la ricerca usa la scheda creata nel test precedente.
    await page.getByRole('textbox', { name: 'Cliente' }).fill(cognomeCliente);
    await page.getByRole('button', { name: new RegExp(cognomeCliente) }).click();
    await expect(page.getByRole('button', { name: 'Cambia' })).toBeVisible();

    // Primo servizio disponibile per l'operatore proposto.
    await page
      .locator('fieldset', { hasText: 'Servizi' })
      .locator('input[type=checkbox]')
      .first()
      .check();
    await expect(page.getByText(/Durata totale/)).toBeVisible();

    await page.getByLabel('Giorno').fill(giorno);
    const orari = page.locator('fieldset', { hasText: 'Orario' }).getByRole('button');
    // I progetti del browser girano in parallelo sugli stessi dati: ciascuno
    // prende un orario diverso, altrimenti il secondo trova lo slot occupato.
    const orario = informazioni.project.name === 'mobile' ? orari.last() : orari.first();
    await expect(orario).toBeVisible();
    const etichettaOrario = (await orario.textContent())?.trim() ?? '';
    await orario.click();

    await page.getByRole('button', { name: 'Salva appuntamento' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // L'agenda accetta il giorno nell'indirizzo: si va direttamente a quello
    // dell'appuntamento appena inserito.
    await page.goto(`/agenda?giorno=${giorno}`);
    const evento = page.getByText(`Cliente ${cognomeCliente}`).first();
    await expect(evento).toBeVisible();

    await evento.click();
    const dettaglio = page.getByRole('dialog');
    await expect(dettaglio).toContainText(etichettaOrario);
    await expect(dettaglio).toContainText('Confermato');

    await dettaglio.getByRole('button', { name: 'Segna completato' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await evento.click();
    await expect(page.getByRole('dialog')).toContainText('Completato');
  });

  test('lo storico del cliente riporta l’appuntamento', async ({ page }) => {
    await page.goto('/clienti');
    await page.getByLabel('Cerca').fill(cognomeCliente);
    await page.getByRole('link', { name: new RegExp(cognomeCliente) }).click();

    await expect(page.getByRole('heading', { name: 'Storico appuntamenti' })).toBeVisible();
    await expect(page.getByRole('listitem').first()).toContainText('Completato');
  });
});
