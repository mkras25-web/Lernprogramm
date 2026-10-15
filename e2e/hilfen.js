import { expect } from '@playwright/test'

// WebKit nimmt unter voller Parallel-Last gelegentlich die Eingabe an,
// bevor React das Feld uebernommen hat - der Knopf blieb dann gesperrt und
// der Test lief in den Zeitablauf. Deshalb: eintippen, bis der Knopf frei ist.
export async function profilAnlegen(page, name, { tippen = false } = {}) {
  const feld = page.getByPlaceholder('Name für ein neues Profil')
  const knopf = page.getByRole('button', { name: 'Profil anlegen' })
  await expect(async () => {
    await feld.fill(name)
    await expect(knopf).toBeEnabled({ timeout: 1000 })
  }).toPass({ timeout: 15000 })
  if (tippen) await knopf.tap()
  else await knopf.click()
}

// Einfuehrungsschritt (D4, seit 2026-10-13): vor der ersten neuen Karte
// eines Themas steht die Kurzerklaerung mit "Zur ersten Karte". Ein
// frisches Testprofil sieht ihn fast immer - die Leertaste wuerde dort nur
// zur Karte weiterschalten statt aufzudecken.
export async function ersteKarte(page) {
  await page.locator('.frage, button:has-text("Zur ersten Karte")').first().waitFor()
  const einstieg = page.locator('button', { hasText: 'Zur ersten Karte' })
  if (await einstieg.count()) await einstieg.first().click()
  await page.locator('.frage').first().waitFor()
}

// Aktuelle Karte per Leertaste aufdecken (Einfuehrung vorher wegklicken).
export async function aufdecken(page) {
  await ersteKarte(page)
  await page.keyboard.press('Space')
}
