import { test, expect } from '@playwright/test'
import { aufdecken, profilAnlegen } from './hilfen.js'

// Lernwochen (Fortschritt, 2026-10-15): Wochenzeilen statt 7x20-Raster,
// Details per Antippen (kein Hover am iPhone).
test('Lernwochen: heute gelernt, Tag und Woche antippen zeigt Einzelheiten', async ({ page }) => {
  await page.goto('/')
  await profilAnlegen(page, 'Wochen')
  await page.locator('.profilKnopf', { hasText: 'Wochen' }).click()
  await page.locator('button', { hasText: /^Lernen$/ }).first().click()
  await aufdecken(page)
  await page.keyboard.press('3')
  await expect.poll(() => page.locator('.pensumZahl').innerText()).toMatch(/^1 von/)
  await page.locator('.lernkopf .textknopf', { hasText: 'Zurück' }).click()
  await page.goto('/#/fortschritt')
  const block = page.locator('.lernwochenBlock')
  await expect(block.locator('.lwZeile:not(.lwKopf)')).toHaveCount(1) // nur die laufende Woche
  await expect(block.locator('.lwDetail')).toHaveText(/^Heute: 1 Antwort · \d+ min · 100 % gewusst$/)
  await expect(block.locator('.lwSumme').nth(1)).toHaveText('1')
  await block.locator('.lwDatum').first().click()
  await expect(block.locator('.lwDetail')).toHaveText(/^Woche ab \d+\.\d+\.: 1 Antwort an 1 Tag/)
  await expect(page.locator('.lwZeile.gewaehlt')).toHaveCount(1)
  await block.locator('button.feld.heute').click()
  await expect(block.locator('.lwDetail')).toHaveText(/^Heute: 1 Antwort/)
  await expect(page.locator('.feld.gewaehlt')).toHaveCount(1)
})
