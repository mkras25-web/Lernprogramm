import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Regressionstest fuer eine ganze Fehlerklasse (zweiter Fall nach dem
// .navKnopf-Hintergrund-Bug): eine Desktop-Override-Regel wurde in
// einem @media-Block platziert, der VOR der Basisregel im Text steht.
// Bei gleicher Spezifitaet gewinnt die spaeter im Text stehende Regel -
// unabhaengig von der Media Query. Die Mobil-Regel (display:flex)
// gewann dadurch selbst bei Desktop-Breite gegen die Grid-Regel, Ring
// und Titel wirkten "mittig" statt in festen Spalten ausgerichtet.
test('Themenzeile ist bei Desktop-Breite ein festes Grid, nicht die Mobil-Flex-Regel', async ({ page }) => {
  await page.goto('/')
  await profilAnlegen(page, 'Themenzeile-Desktop')
  await page.locator('.profilKnopf', { hasText: 'Themenzeile-Desktop' }).click()
  await page.locator('.navKnopf', { hasText: 'Themen' }).click()

  const zeile = page.locator('.themenzeile:not(.geplant)').first()
  await expect(zeile).toBeVisible()
  await expect(zeile).toHaveCSS('display', 'grid')
})
