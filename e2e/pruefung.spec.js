import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Pruefung unterbrechen und fortsetzen (14A), Rueckfragen (15A),
// Auswertung mit eigener Antwort (16A) - 2026-10-10.
async function angemeldet(page, name) {
  await page.goto('/')
  await profilAnlegen(page, name)
  await page.locator('.profilKnopf', { hasText: name }).click()
  await page.locator('.navKnopf', { hasText: 'Prüfungen' }).click()
}

test('Pruefung ueberlebt den Bildschirmwechsel und laesst sich auf Heute fortsetzen', async ({ page }) => {
  await angemeldet(page, 'Pruefling')
  await page.locator('.artKachel', { hasText: 'Wochenprüfung' }).click()
  await expect(page.locator('.lernkopf .pensumZahl')).toContainText('1/12')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect(page.locator('.lernkopf .pensumZahl')).toContainText('2/12')

  await page.locator('.navKnopf', { hasText: 'Heute' }).click()
  const aufruf = page.locator('.aufruf', { hasText: 'Angefangene Prüfung' })
  await expect(aufruf).toBeVisible()
  await aufruf.getByRole('button', { name: 'Fortsetzen' }).click()
  await expect(page.locator('.lernkopf .pensumZahl')).toContainText('2/12')

  // Neu laden: weiterhin da
  await page.reload()
  await page.waitForSelector('nav.navigation, .profilKnopf', { state: 'attached' })
  if (await page.locator('.profilKnopf').count()) await page.locator('.profilKnopf', { hasText: 'Pruefling' }).click()
  await page.locator('.navKnopf', { hasText: 'Prüfungen' }).click()
  await expect(page.locator('.lernkopf .pensumZahl')).toContainText('2/12')
})

test('Abbrechen und Abgeben mit offenen Fragen fragen nach', async ({ page }) => {
  await angemeldet(page, 'Rueckfrage')
  await page.locator('.artKachel', { hasText: 'Wochenprüfung' }).click()
  await page.locator('.lernkopf .textknopf', { hasText: 'Abbrechen' }).click()
  await expect(page.getByRole('heading', { name: 'Prüfung verwerfen?' })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter bearbeiten' }).click()
  await expect(page.locator('.lernkopf')).toBeVisible()

  for (let i = 0; i < 11; i++) await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await page.getByRole('button', { name: 'Prüfung abgeben' }).click()
  await expect(page.getByRole('heading', { name: 'Wirklich abgeben?' })).toBeVisible()
  await page.getByRole('button', { name: 'Trotzdem abgeben' }).click()
  await expect(page.locator('.ergebnisblatt')).toBeVisible()
  await expect(page.locator('.antwortVergleich').first()).toContainText('Deine Antwort')

  // Auswertung ueberlebt den Wechsel
  await page.locator('.navKnopf', { hasText: 'Heute' }).click()
  await expect(page.locator('.aufruf', { hasText: 'Prüfung noch nicht gespeichert' })).toBeVisible()
  await page.locator('.navKnopf', { hasText: 'Prüfungen' }).click()
  await expect(page.locator('.ergebnisblatt')).toBeVisible()
})
