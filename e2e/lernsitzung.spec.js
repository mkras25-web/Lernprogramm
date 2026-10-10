import { test, expect } from '@playwright/test'

// Kritische Pfade der Lernsitzung (2026-10-10 ergaenzt, vor dem Umbau der
// Wiederholungsplanung): Tastatur, Rueckgaengig, Notiz-Schreibmarke.
async function angemeldet(page, name) {
  await page.goto('/')
  await page.getByPlaceholder('Name für ein neues Profil').fill(name)
  await page.getByRole('button', { name: 'Profil anlegen' }).click()
  await page.locator('.profilKnopf', { hasText: name }).click()
  await page.locator('button', { hasText: /^Lernen$/ }).first().click()
  await expect(page.locator('.lernkopf')).toBeVisible()
}

const stand = (page) => page.locator('.pensumZahl').innerText()

test('Leertaste deckt auf, 3 bewertet, Rueckstelltaste macht rueckgaengig', async ({ page }) => {
  await angemeldet(page, 'Tastatur')
  const vorher = await stand(page)
  expect(vorher).toMatch(/^0\//)
  await page.keyboard.press('Space')
  await expect(page.locator('.bewertung')).toBeVisible()
  await page.keyboard.press('3')
  await expect.poll(() => stand(page)).toMatch(/^1\//)
  await page.keyboard.press('Backspace')
  await expect.poll(() => stand(page)).toMatch(/^0\//)
})

test('Per Tab angesteuerter Knopf reagiert auf Enter statt aufzudecken', async ({ page }) => {
  await angemeldet(page, 'Tabfokus')
  const lesezeichen = page.locator('.markenKnopf', { hasText: 'Lesezeichen' })
  await lesezeichen.focus()
  // :focus-visible wie bei echter Tastaturbedienung erzwingen
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(lesezeichen).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(lesezeichen).toHaveClass(/aktiv/)
  await expect(page.locator('.antwort')).toHaveCount(0)
})

test('Notiz: Tippen in der Mitte laesst die Schreibmarke an ihrem Platz', async ({ page }) => {
  await angemeldet(page, 'Notiz')
  await page.locator('.markenKnopf', { hasText: 'Notiz' }).click()
  const feld = page.locator('textarea.notizfeld')
  await feld.fill('AAAA BBBB')
  await feld.evaluate((el) => el.setSelectionRange(2, 2))
  await feld.pressSequentially('xyz', { delay: 120 })
  await expect(feld).toHaveValue('AAxyzAA BBBB')
})
