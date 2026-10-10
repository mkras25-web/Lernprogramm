import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Rauchtest fuer den kompletten Einstiegspfad: Profil anlegen oeffnet
// die eigentliche App (IndexedDB-Speicher, Paketlader, Navigation).
// Jeder Test startet mit leerem Speicher (storageState nicht gesetzt,
// eigener Browser-Kontext pro Test), damit immer der "Erstkontakt"-Pfad
// aus ProfilGate.jsx durchlaufen wird.
test('Profil anlegen fuehrt in die App mit sichtbarer Navigation', async ({ page }) => {
  await page.goto('/')

  await profilAnlegen(page, 'E2E-Test')

  // "Profil anlegen" legt das Profil nur an (siehe ProfilGate.jsx) - erst
  // ein Klick auf die Profilzeile selbst waehlt es aktiv und oeffnet App.jsx.
  await page.locator('.profilKnopf', { hasText: 'E2E-Test' }).click()

  await expect(page.locator('nav.navigation')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Themen' })).toBeVisible()
})
