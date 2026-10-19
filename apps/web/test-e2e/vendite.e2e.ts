import { expect, test } from '@playwright/test';

/**
 * Vendita di prodotti in negozio. I prodotti arrivano dai dati demo: uno è
 * esaurito e uno è sotto la scorta minima, così si verificano anche l'avviso
 * delle scorte e il rifiuto di vendere ciò che non c'è.
 */
test.describe('Vendite in negozio', () => {
  test.describe.configure({ mode: 'serial' });

  /** Riga di un prodotto nell'elenco vendibile, non fra le vendite passate. */
  function rigaProdotto(page: import('@playwright/test').Page, nome: string) {
    return page
      .getByRole('list', { name: 'Prodotti in vendita' })
      .getByRole('listitem')
      .filter({ hasText: nome });
  }

  /** Riga di una vendita registrata. */
  function rigaVendita(page: import('@playwright/test').Page, nome: string) {
    return page
      .getByRole('list', { name: 'Vendite registrate' })
      .getByRole('listitem')
      .filter({ hasText: nome });
  }

  test('il personale registra una vendita e il magazzino si scarica', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Vendite' }).click();
    await expect(page).toHaveURL(/\/vendite$/);

    // L'avviso elenca i prodotti in esaurimento dei dati demo.
    await expect(page.getByRole('status').first()).toContainText('Scorte in esaurimento');

    const pettine = rigaProdotto(page, 'Pettine in legno');
    await expect(pettine).toContainText('20 pezzi disponibili');

    await pettine.getByLabel('Pezzi').fill('2');
    await expect(page.getByText(/Totale:/)).toContainText('18,00');

    await page.getByRole('button', { name: 'Registra la vendita' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Vendita registrata' })).toBeVisible();
    // La giacenza mostrata scende di due pezzi.
    await expect(rigaProdotto(page, 'Pettine in legno')).toContainText('18 pezzi disponibili');
  });

  test('un prodotto esaurito non si può vendere', async ({ page }) => {
    await page.goto('/vendite');

    const olio = rigaProdotto(page, 'Olio da barba');
    await expect(olio).toContainText('esaurito');
    await expect(olio.getByLabel('Pezzi')).toBeDisabled();
  });

  test('la vendita si annulla e i pezzi tornano in magazzino', async ({ page }) => {
    await page.goto('/vendite');

    const vendita = rigaVendita(page, 'Pettine in legno')
      .filter({ has: page.getByRole('button', { name: 'Annulla' }) })
      .first();
    await vendita.getByRole('button', { name: 'Annulla' }).click();

    await page.getByLabel('Motivo').fill('Registrata per errore.');
    await page.getByRole('button', { name: 'Annulla la vendita' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'tornati in magazzino' }),
    ).toBeVisible();
    await expect(rigaProdotto(page, 'Pettine in legno')).toContainText('20 pezzi disponibili');
  });

  test('il titolare corregge la giacenza con un movimento motivato', async ({ page }) => {
    await page.goto('/impostazioni');
    await page.getByRole('button', { name: 'Prodotti', exact: true }).click();

    const cera = page.getByRole('listitem').filter({ hasText: 'Cera modellante' }).first();
    await cera.getByRole('button', { name: 'Giacenza' }).click();

    await page.getByLabel('Variazione (pezzi)').fill('-10');
    await page.getByLabel('Motivo').fill('Prova del limite di giacenza.');
    await page.getByRole('button', { name: 'Registra il movimento' }).click();

    // La giacenza non può andare sotto zero: il movimento viene rifiutato.
    await expect(page.getByRole('alert')).toContainText('sotto zero');

    await page.getByLabel('Variazione (pezzi)').fill('6');
    await page.getByLabel('Motivo').fill('Consegna del fornitore.');
    await page.getByRole('button', { name: 'Registra il movimento' }).click();

    await expect(page.getByRole('status').first()).toContainText('9 pezzi');
  });
});
