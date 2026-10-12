import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Kritische Pfade der Lernsitzung (2026-10-10 ergaenzt, vor dem Umbau der
// Wiederholungsplanung): Tastatur, Rueckgaengig, Notiz-Schreibmarke.
async function angemeldet(page, name) {
  await page.goto('/')
  await profilAnlegen(page, name)
  await page.locator('.profilKnopf', { hasText: name }).click()
  await page.locator('button', { hasText: /^Lernen$/ }).first().click()
  await expect(page.locator('.lernkopf')).toBeVisible()
}

const stand = (page) => page.locator('.pensumZahl').innerText()

test('Leertaste deckt auf, 3 bewertet, Rueckstelltaste macht rueckgaengig', async ({ page }) => {
  await angemeldet(page, 'Tastatur')
  const vorher = await stand(page)
  expect(vorher).toMatch(/^0 von/)
  await page.keyboard.press('Space')
  await expect(page.locator('.bewertung')).toBeVisible()
  await page.keyboard.press('3')
  await expect.poll(() => stand(page)).toMatch(/^1 von/)
  await page.keyboard.press('Backspace')
  await expect.poll(() => stand(page)).toMatch(/^0 von/)
})

test('Per Tab angesteuerter Knopf reagiert auf Enter statt aufzudecken', async ({ page }) => {
  await angemeldet(page, 'Tabfokus')
  const lesezeichen = page.locator('.markenKnopf', { hasText: 'Lesezeichen' })
  await lesezeichen.focus()
  // wie bei echter Tastaturbedienung per Tab ankommen
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

async function ereignisAnzahl(page) {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases()
    const name = dbs.map((d) => d.name).find((n) => n?.startsWith('lernprogramm_'))
    const db = await new Promise((ok, nein) => {
      const a = indexedDB.open(name)
      a.onsuccess = () => ok(a.result)
      a.onerror = () => nein(a.error)
    })
    const n = await new Promise((ok) => {
      const r = db.transaction('ereignisse').objectStore('ereignisse').count()
      r.onsuccess = () => ok(r.result)
    })
    db.close()
    return n
  })
}

test('Neubewertung nach dem Zurueckblaettern ersetzt die alte Bewertung (2A)', async ({ page }) => {
  await angemeldet(page, 'Neubewertung')
  await page.keyboard.press('Space')
  await page.keyboard.press('3')
  await expect.poll(() => stand(page)).toMatch(/^1 von/)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => stand(page)).toMatch(/^0 von/)
  await page.keyboard.press('Space')
  await page.keyboard.press('4')
  await expect.poll(() => stand(page)).toMatch(/^1 von/)
  expect(await ereignisAnzahl(page)).toBe(1)
})

test('Am Sitzungsende erscheint eine Bilanz (9B)', async ({ page }) => {
  await angemeldet(page, 'Bilanz')
  await page.locator('.lernkopf .textknopf', { hasText: 'Zurück' }).click()
  await page.locator('.artKachel', { hasText: 'Schnellrunde' }).click()
  await page.keyboard.press('Space')
  await page.keyboard.press('3')
  await page.locator('.lernkopf .textknopf', { hasText: 'Zurück' }).click()
  await expect(page.locator('.meldung')).toContainText('Sitzung beendet · 1 Antwort, 1 richtig')
})

test('Bewertungsknoepfe zeigen das naechste Intervall (8A)', async ({ page }) => {
  await angemeldet(page, 'Vorschau')
  await page.keyboard.press('Space')
  await expect(page.locator('.bewertung .intervallHinweis')).toHaveCount(4)
  await expect(page.locator('.bewertung .knopf', { hasText: 'Leicht' }).locator('.intervallHinweis')).toHaveText(/\d+ (T\.|Mon\.)/)
})

test('Nach Mausklick auf einen Knopf deckt die Leertaste weiterhin auf', async ({ page }) => {
  await angemeldet(page, 'Mausklick')
  await page.locator('.markenKnopf', { hasText: 'Lesezeichen' }).click()
  await expect(page.locator('.markenKnopf', { hasText: 'Lesezeichen' })).toHaveClass(/aktiv/)
  await page.keyboard.press('Space')
  await expect(page.locator('.bewertung')).toBeVisible()
  await expect(page.locator('.markenKnopf', { hasText: 'Lesezeichen' })).toHaveClass(/aktiv/)
})

test('Zweimal Nochmal: Karte kommt in derselben Sitzung nicht ein drittes Mal', async ({ page }) => {
  await angemeldet(page, 'Nochmal')
  const gesamt = async () => Number((await stand(page)).match(/von (\d+)/)[1])
  const anfang = await gesamt()
  const frage = (await page.locator('.frage').innerText()).trim()
  await page.locator('button', { hasText: 'Antwort zeigen' }).click()
  await page.keyboard.press('1')
  await expect.poll(gesamt).toBe(anfang + 1)
  // Klick statt Leertaste: steht der Fokus in einem Eingabefeld
  // (numerisch), tippt die Leertaste dort hinein
  // bis zur Wiederholung weiterbewerten (Gut)
  for (let i = 1; i < anfang; i++) {
    await page.locator('button', { hasText: 'Antwort zeigen' }).click()
    await expect(page.locator('.bewertung')).toBeVisible()
    await page.keyboard.press('3')
    await expect.poll(() => stand(page)).toMatch(new RegExp(`^${i + 1} von`))
  }
  await expect(page.locator('.frage')).toHaveText(frage)
  await page.locator('button', { hasText: 'Antwort zeigen' }).click()
  await expect(page.locator('.urteilZeile', { hasText: 'Zweiter Versuch' })).toBeVisible()
  await page.keyboard.press('1')
  // Sitzung endet, statt die Karte erneut anzuhaengen
  await expect(page.locator('.lernkopf')).toHaveCount(0)
  // ... und steht auf Heute unter "Heute nicht gewusst"
  const liste = page.locator('.nichtGewusst')
  await expect(liste.locator('h2')).toHaveText('Heute nicht gewusst (1)')
  await expect(liste.locator('summary')).toHaveText(frage)
})
