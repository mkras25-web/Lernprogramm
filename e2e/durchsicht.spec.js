import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Durchsicht (2026-10-17): Pruefstand aus durchsicht.json wird angezeigt,
// eine geaenderte Karte wartet auf Zustimmung, Annehmen/Ablehnen landet in
// der Marke. Die Akte kommt hier aus einer festen Attrappe (route), damit
// der Test nicht vom echten Pruefstand des Pakets abhaengt.
const AKTE = {
  fassung: 1,
  eintraege: {
    'bk-oef-001': {
      art: 'aufgabe', thema: 'bk-oeffnungen', stand: 'geaendert', hash: 'h-e2e', datum: '2026-10-17',
      ebenen: ['fach', 'sprache'],
      aenderung: { grund: 'E2E-Grund', beleg: 'E2E-Buch S. 1', vorher: { frage: 'ALTE E2E-FRAGE' } },
    },
    'bk-oef-003': { art: 'aufgabe', thema: 'bk-oeffnungen', stand: 'geprueft', hash: 'x', datum: '2026-10-17', ebenen: ['fach'] },
  },
}

async function oeffnen(page) {
  await page.route('**/pakete/arch-de/durchsicht.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(AKTE) })
  )
  await page.goto('/')
  await profilAnlegen(page, 'Durchsicht')
  await page.locator('.profilKnopf', { hasText: 'Durchsicht' }).click()
  await expect(page.locator('nav.navigation')).toBeVisible()
}

test('wartende Aenderung: Hinweis auf Heute, Vorher/Nachher, Annehmen', async ({ page }) => {
  await oeffnen(page)
  await expect(page.getByText('Eine Änderung wartet auf dich')).toBeVisible()
  await page.getByRole('button', { name: 'Ansehen' }).click()

  // Nachschlagen mit Filter "wartet auf dich": genau die eine Karte
  await expect(page.locator('.trefferKarte')).toHaveCount(1)
  await expect(page.locator('.trefferKarte .durchsichtMarke.wartet')).toBeVisible()
  await page.locator('.trefferOeffnen').first().click()

  const block = page.locator('.durchsichtBlock')
  await expect(block).toContainText('E2E-Grund')
  await expect(block).toContainText('E2E-Buch S. 1')
  await expect(block.locator('.diffWeg').first()).toContainText('ALTE')
  await block.getByRole('button', { name: /Änderung annehmen/ }).click()
  await expect(block).toContainText('Angenommen')
  await expect(page.locator('.itemansicht .durchsichtMarke.geprueft')).toBeVisible()

  // Zuruecknehmen bringt die Knoepfe wieder
  await block.getByRole('button', { name: 'Entscheidung zurücknehmen' }).click()
  await expect(block.getByRole('button', { name: /Ablehnen/ })).toBeVisible()
})

test('Ablehnen zeigt sofort die alte Fassung, Filter geprueft zaehlt', async ({ page }) => {
  await oeffnen(page)
  await page.getByRole('button', { name: 'Ansehen' }).click()
  await page.locator('.trefferOeffnen').first().click()
  await page.locator('.durchsichtBlock').getByRole('button', { name: /Ablehnen/ }).click()
  await expect(page.locator('.itemansicht .frage')).toHaveText('ALTE E2E-FRAGE')
  await expect(page.locator('.itemansicht .durchsichtMarke.abgelehnt')).toBeVisible()

  await page.getByRole('button', { name: 'Zurück zur Liste' }).click()
  await page.locator('.wahlKnopf', { hasText: '✓︎ geprüft' }).click()
  await expect(page.locator('.trefferKarte')).toHaveCount(1)
})
