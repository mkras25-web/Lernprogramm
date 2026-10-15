import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Themenseite mit eigener Adresse, Zurueck aus "Erst raten" und der Wechsel
// Schreiben/Skizzieren in "Aus dem Kopf" (Pruefrunde 2026-10-13, behoben
// 2026-10-15).
async function themenseite(page, name) {
  await page.goto('/')
  await profilAnlegen(page, name)
  await page.locator('.profilKnopf', { hasText: name }).click()
  await page.goto('/#/themen')
  await page.locator('button.artKnopf', { hasText: 'Themen zeigen' }).first().click()
  await page.locator('button.artKnopf', { hasText: 'Erklärung' }).first().click()
  await expect(page.locator('.erklaerung')).toBeVisible()
}

test('Themenseite hat eine Adresse, ueberlebt Neuladen, Zurueck schliesst sie', async ({ page }) => {
  await themenseite(page, 'Adresse')
  await expect(page).toHaveURL(/#\/themen\/thema\/[^/]+$/)
  const titel = await page.locator('h1.ueberschrift').innerText()
  await page.reload()
  await expect(page.locator('h1.ueberschrift')).toHaveText(titel)
  await page.locator('button.textknopf', { hasText: 'Zurück' }).first().click()
  await expect(page.locator('.erklaerung')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/themen$/)
  // Browser-Zurueck/Vor oeffnet und schliesst die Themenseite ebenso
  await page.goForward()
  await expect(page.locator('h1.ueberschrift')).toHaveText(titel)
  await page.goBack()
  await expect(page.locator('.erklaerung')).toHaveCount(0)
})

test('Zurueck aus "Erst raten" fuehrt zur Themenseite', async ({ page }) => {
  await themenseite(page, 'Raten')
  const titel = await page.locator('h1.ueberschrift').innerText()
  await page.locator('button.artKnopf', { hasText: 'Erst raten' }).click()
  await expect(page.locator('.lernkopf')).toBeVisible()
  await page.locator('button.textknopf', { hasText: 'Zurück' }).first().click()
  await expect(page.locator('h1.ueberschrift')).toHaveText(titel)
  await expect(page.locator('.erklaerung')).toBeVisible()
})

test('Aus dem Kopf: Wechsel Skizzieren/Schreiben verwirft die Zeichnung nicht', async ({ page }) => {
  await themenseite(page, 'Kopf')
  await page.locator('button.artKnopf', { hasText: 'Aus dem Kopf' }).click()
  await page.locator('button.wahlKnopf', { hasText: 'Skizzieren' }).click()
  const flaeche = page.locator('canvas.flaeche')
  const box = await flaeche.boundingBox()
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 })
  await page.mouse.up()
  await page.locator('button.wahlKnopf', { hasText: 'Schreiben' }).click()
  await page.locator('textarea.notizfeld').fill('Text dazu')
  await page.locator('button.wahlKnopf', { hasText: 'Skizzieren' }).click()
  await page.locator('button.wahlKnopf', { hasText: 'Schreiben' }).click()
  await expect(page.locator('textarea.notizfeld')).toHaveValue('Text dazu')
  await page.locator('button', { hasText: 'Fertig – jetzt vergleichen' }).click()
  await expect(page.locator('img[alt="Deine Skizze"]')).toBeVisible()
  await expect(page.locator('.eigeneAntwort')).toHaveText('Text dazu')
})

test('Sitzungsende nennt die Zahl der nicht gewussten Karten', async ({ page }) => {
  await page.goto('/')
  await profilAnlegen(page, 'Bilanz')
  await page.locator('.profilKnopf', { hasText: 'Bilanz' }).click()
  await page.locator('button', { hasText: /^Lernen$/ }).first().click()
  await expect(page.locator('.lernkopf')).toBeVisible()
  // Je nach Mischung steht vorn der Einfuehrungsschritt eines neuen Themas (D4)
  const einstieg = page.locator('button', { hasText: /Zur ersten Karte|Antwort zeigen/ }).first()
  if (/Zur ersten Karte/.test(await einstieg.innerText())) await einstieg.click()
  await page.locator('button', { hasText: 'Antwort zeigen' }).click()
  await expect(page.locator('.bewertung')).toBeVisible()
  await page.keyboard.press('1')
  // "Nochmal" haengt die Karte hinten an - der Zaehler bleibt, die Bewertung verschwindet
  await expect(page.locator('.bewertung')).toHaveCount(0)
  await page.locator('button.textknopf', { hasText: 'Zurück' }).first().click()
  await expect(page.locator('.meldung')).toContainText('1 Karte nicht gewusst')
})

test('Schmales PC-Fenster: Tasten im Auswahlblatt decken die Karte dahinter nicht auf', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('/')
  await profilAnlegen(page, 'Blatt')
  await page.locator('.profilKnopf', { hasText: 'Blatt' }).click()
  await page.locator('.artKachel', { hasText: 'Durchblättern' }).click()
  // Durchblaettern laeuft in fester Reihenfolge - bis zur ersten Zuordnung
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.auswahlKnopf').count()) break
    const zeigen = page.locator('button', { hasText: /Antwort zeigen|Referenz zeigen|Zur ersten Karte/ }).first()
    if (/Zur ersten Karte/.test(await zeigen.innerText())) { await zeigen.click(); continue }
    await zeigen.click()
    await page.locator('.steuerung button', { hasText: /^Weiter/ }).first().click()
  }
  await page.locator('.auswahlKnopf').first().click()
  await expect(page.locator('.mehrBlatt')).toBeVisible()
  // Fokus liegt auf der ersten Zeile: Leertaste waehlt sie, deckt aber nicht auf
  await page.keyboard.press('Space')
  await expect(page.locator('.mehrBlatt')).toHaveCount(0)
  await expect(page.locator('.auswahlKnopf').first()).not.toHaveClass(/leer/)
  await expect(page.locator('button', { hasText: 'Antwort zeigen' })).toBeVisible()
  // Enter ebenso, und Ziffern bewerten nichts dahinter
  await page.locator('.auswahlKnopf').first().click()
  await page.keyboard.press('3')
  await expect(page.locator('.mehrBlatt')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.mehrBlatt')).toHaveCount(0)
  await expect(page.locator('button', { hasText: 'Antwort zeigen' })).toBeVisible()
})
