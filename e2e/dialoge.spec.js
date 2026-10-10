import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Dialoge einheitlich (51A, 2026-10-10): Fokus hinein, Tab bleibt drin,
// Escape schliesst, Fokus kehrt zurueck.
async function angemeldet(page, name) {
  await page.goto('/')
  await profilAnlegen(page, name)
  await page.locator('.profilKnopf', { hasText: name }).click()
  await expect(page.locator('nav.navigation')).toBeVisible()
}

test('Palettenfenster: Fokus drin, Tab bleibt drin, Escape schliesst und gibt Fokus zurueck', async ({ page }) => {
  await angemeldet(page, 'Dialog')
  await page.locator('.navKnopf', { hasText: 'Einstellungen' }).click()
  const oeffner = page.locator('button.paletteZeile').first()
  await oeffner.focus()
  await page.keyboard.press('Enter')
  const dialog = page.locator('.schleier[role=dialog]')
  await expect(dialog).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.querySelector('.schleier').contains(document.activeElement))).toBe(true)
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.querySelector('.schleier').contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(oeffner).toBeFocused()
})

test('Tastenhilfe ueber "?" oeffnen und mit Escape schliessen', async ({ page }) => {
  await angemeldet(page, 'Hilfe')
  await page.keyboard.press('?')
  await expect(page.locator('.schleier[role=dialog]')).toContainText('Tastenkürzel')
  await page.keyboard.press('Escape')
  await expect(page.locator('.schleier')).toHaveCount(0)
})
