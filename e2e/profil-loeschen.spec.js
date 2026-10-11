import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Kritischer Pfad (52A, 2026-10-11): Profil loeschen entfernt Fortschritt,
// Datenbank und alle profilbezogenen Merker - und laesst andere Profile
// unberuehrt. Ohne "LÖSCHEN" bleibt der Knopf gesperrt.
test('Profil loeschen raeumt alles des Profils weg, das andere bleibt', async ({ page }) => {
  await page.goto('/')
  await profilAnlegen(page, 'Bleibt')
  await profilAnlegen(page, 'Weg')
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('lernprogramm_profile')).find((p) => p.name === 'Weg').id)

  // Etwas Fortschritt erzeugen: eine Karte bewerten
  await page.locator('.profilKnopf', { hasText: 'Weg' }).click()
  await page.locator('button', { hasText: /^Lernen$/ }).first().click()
  await page.keyboard.press('Space')
  await page.keyboard.press('3')
  await expect(page.locator('.pensumZahl')).toHaveText(/^1 von/)
  await page.goto('/#/heute')
  await page.locator('.navFuss').click()

  const vorher = await page.evaluate(async (id) => ({
    schluessel: Object.keys(localStorage).filter((k) => k.includes(id)),
    db: (await indexedDB.databases()).some((d) => d.name === `lernprogramm_${id}`),
  }), id)
  expect(vorher.db).toBe(true)
  expect(vorher.schluessel.length).toBeGreaterThan(0)

  await page.locator('.profilListe li', { hasText: 'Weg' }).getByRole('button', { name: 'Löschen' }).click()
  const endgueltig = page.locator('.schleier .knopf.gefahr')
  await expect(endgueltig).toBeDisabled()
  await page.locator('.schleier input').fill('löschen')
  await expect(endgueltig).toBeEnabled()
  await endgueltig.click()

  await expect(page.locator('.profilKnopf', { hasText: 'Weg' })).toHaveCount(0)
  await expect(page.locator('.profilKnopf', { hasText: 'Bleibt' })).toHaveCount(1)
  const nachher = await page.evaluate(async (id) => ({
    schluessel: Object.keys(localStorage).filter((k) => k.includes(id)),
    db: (await indexedDB.databases()).some((d) => d.name === `lernprogramm_${id}`),
  }), id)
  expect(nachher).toEqual({ schluessel: [], db: false })
})
