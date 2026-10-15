import { test, expect } from '@playwright/test'
import { aufdecken, ersteKarte, profilAnlegen } from './hilfen.js'

// Runde 5 (2026-10-10): Bildschirmadressen, neue Bildschirme, Querwege,
// Tastatur-Navigation, Sichten-Schalter, Profilnamen, Klausur-Countdown.
async function angemeldet(page, name) {
  await page.goto('/')
  await profilAnlegen(page, name)
  await page.locator('.profilKnopf', { hasText: name }).click()
  await expect(page.locator('nav.navigation')).toBeVisible()
}

test('Bildschirmadresse: Zurueck und Neuladen bleiben auf dem Bildschirm', async ({ page }) => {
  await angemeldet(page, 'Adresse')
  await page.locator('.navKnopf', { hasText: 'Themen' }).click()
  await expect(page).toHaveURL(/#\/themen$/)
  await page.locator('.navKnopf', { hasText: 'Normen' }).click()
  await expect(page).toHaveURL(/#\/glossar$/)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Themen', exact: true })).toBeVisible()
  await page.reload()
  await page.waitForSelector('nav.navigation, .profilKnopf', { state: 'attached' })
  if (await page.locator('.profilKnopf').count()) await page.locator('.profilKnopf', { hasText: 'Adresse' }).click()
  await expect(page.getByRole('heading', { name: 'Themen', exact: true })).toBeVisible()
})

test('Tastatur: G dann T oeffnet Themen, / springt in die Suche', async ({ page }) => {
  await angemeldet(page, 'Tasten')
  await page.keyboard.press('g')
  await page.keyboard.press('t')
  await expect(page.getByRole('heading', { name: 'Themen', exact: true })).toBeVisible()
  await page.keyboard.press('/')
  await expect(page.locator('.suchfeld')).toBeFocused()
})

test('Fehlerbuch und Mein Heft sammeln, Querweg oeffnet die Karte in Nachschlagen', async ({ page }) => {
  await angemeldet(page, 'Sammeln')
  await page.locator('button', { hasText: /^Lernen$/ }).first().click()
  await ersteKarte(page)
  await page.locator('.markenKnopf', { hasText: 'Lesezeichen' }).click()
  const frage = (await page.locator('.frage').innerText()).trim()
  await page.keyboard.press('Space')
  await page.keyboard.press('1') // Nochmal = Fehler
  await page.locator('.lernkopf .textknopf', { hasText: 'Zurück' }).click()

  await page.locator('.navKnopf', { hasText: 'Fehlerbuch' }).click()
  await expect(page.locator('.trefferKarte', { hasText: frage.slice(0, 40) })).toContainText('1× falsch')
  await page.locator('.navKnopf', { hasText: 'Mein Heft' }).click()
  await expect(page.locator('.trefferKarte', { hasText: frage.slice(0, 40) })).toContainText('Lesezeichen')
  await page.getByRole('button', { name: 'In Nachschlagen öffnen' }).first().click()
  await expect(page.locator('.itemansicht')).toContainText(frage.slice(0, 40))
})

test('Sammlung ist ein Reiter unter Fortschritt', async ({ page }) => {
  await angemeldet(page, 'Reiter')
  await page.locator('.navKnopf', { hasText: 'Fortschritt' }).click()
  await page.locator('.auswertungReiter .reiterKnopf', { hasText: 'Sammlung' }).click()
  await expect(page).toHaveURL(/#\/sammlung$/)
  await expect(page.locator('.navKnopf', { hasText: 'Fortschritt' })).toHaveClass(/aktiv/)
})

test('Nachschlagen: Checkboxen erst im Sichten-Modus', async ({ page }) => {
  await angemeldet(page, 'Sichten')
  await page.locator('.navKnopf', { hasText: 'Nachschlagen' }).click()
  await expect(page.locator('.sichtungKopf input[type=checkbox]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Sichten', exact: true }).click()
  await expect(page.locator('.sichtungKopf input[type=checkbox]').first()).toBeVisible()
})

test('Doppelter Profilname wird abgelehnt', async ({ page }) => {
  await page.goto('/')
  for (let i = 0; i < 2; i++) {
    await profilAnlegen(page, 'Doppelt')
  }
  await expect(page.locator('.profilKnopf', { hasText: 'Doppelt' })).toHaveCount(1)
  await expect(page.locator('.meldung')).toContainText('gibt es schon')
})

test('Klausurtermin erscheint als Countdown auf Heute', async ({ page }) => {
  await angemeldet(page, 'Klausur')
  await page.locator('.navKnopf', { hasText: 'Einstellungen' }).click()
  const zeile = page.locator('.zeile', { hasText: 'Klausurtermine' })
  await zeile.getByPlaceholder('z. B. Bauphysik').fill('Bauphysik')
  const datum = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10)
  await zeile.locator('input[type=date]').fill(datum)
  await zeile.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.locator('.navKnopf', { hasText: 'Heute' }).click()
  await expect(page.locator('.klausurLeiste')).toContainText('Klausur Bauphysik')
  await expect(page.locator('.klausurLeiste')).toContainText(/in 1[12] Tagen/)
})

test('Lernzettel eines Themas ist erreichbar und druckbar', async ({ page }) => {
  await angemeldet(page, 'Zettel')
  await page.locator('.navKnopf', { hasText: 'Themen' }).click()
  await page.locator('.artKnopf', { hasText: 'Themen zeigen' }).first().click()
  await page.locator('.artKnopf', { hasText: 'Lernzettel' }).first().click()
  await expect(page.locator('.lernzettel .zettelKarte').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Drucken / als PDF' })).toBeVisible()
})
