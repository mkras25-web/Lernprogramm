import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Fehler bis 2026-10-16: ein zweites Fenster mit altem Stand schrieb beim
// naechsten Speichern ALLE Einstellungen zurueck - "Zeichenaufgaben: Aus"
// sprang nach erneutem Anmelden wieder auf An.
const zeile = (page, titel) => page.locator('.zeile', { hasText: titel })

test('Zweites Fenster setzt eine Einstellung nicht zurueck und sieht die Aenderung', async ({ context, page }) => {
  await page.goto('/')
  await profilAnlegen(page, 'Zwei')
  await page.locator('.profilKnopf', { hasText: 'Zwei' }).click()
  await page.goto('/#/einstellungen')
  const zweites = await context.newPage()
  await zweites.goto('/#/einstellungen')
  if (await zweites.locator('.profilKnopf').count()) await zweites.locator('.profilKnopf', { hasText: 'Zwei' }).click()
  await zweites.goto('/#/einstellungen')
  await expect(zeile(zweites, 'Zeichenaufgaben (Skizzen)').locator('.wahlKnopf.aktiv')).toHaveText('An')

  await zeile(page, 'Zeichenaufgaben (Skizzen)').locator('.wahlKnopf', { hasText: 'Aus' }).click()
  // Das zweite Fenster uebernimmt die Aenderung (storage-Ereignis) ...
  await expect(zeile(zweites, 'Zeichenaufgaben (Skizzen)').locator('.wahlKnopf.aktiv')).toHaveText('Aus')
  // ... und eine eigene Aenderung dort setzt sie nicht zurueck
  await zeile(zweites, 'Animationen').locator('.wahlKnopf', { hasText: 'Aus' }).click()

  await page.locator('.navFuss').click()
  await page.locator('.profilKnopf', { hasText: 'Zwei' }).click()
  await page.goto('/#/einstellungen')
  await expect(zeile(page, 'Zeichenaufgaben (Skizzen)').locator('.wahlKnopf.aktiv')).toHaveText('Aus')
  await expect(zeile(page, 'Animationen').locator('.wahlKnopf.aktiv')).toHaveText('Aus')
})
