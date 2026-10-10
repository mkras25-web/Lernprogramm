import { test, expect } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'
import fs from 'node:fs'

// Neue optionale Inhaltsfelder (Runde 4, 2026-10-10). Die Lerninhalte selbst
// bleiben unberuehrt: der Test schiebt die Felder nur im Browser in die
// erste Themendatei ein (Netzwerk-Abfang), so wie sie der Web-Chat kuenftig
// liefern kann - warum, lernziele, siehe und der Typ "fall".
const ITEMDATEI = '**/pakete/arch-de/items/bk-sockel.json'

async function mitTestfeldern(page) {
  await page.route(ITEMDATEI, async (route) => {
    const antwort = await route.fetch()
    const daten = await antwort.json()
    daten.lernziele = ['Du kannst die Lage der Dichtebene am Sockel begründen.']
    daten.siehe = ['bp-feuchte']
    const mc = daten.items.find((i) => i.typ === 'mehrfachauswahl')
    mc.warum = mc.optionen.map((_, i) => `Begründung ${i + 1}`)
    daten.items.unshift({
      id: 'test-fall-001',
      typ: 'fall',
      frage: 'TESTFALL: Bestandsbau mit feuchtem Sockel.',
      antwort: 'Gesamtfazit des Falls.',
      teile: [
        { frage: 'Woher kommt die Feuchte?', antwort: 'Spritzwasser und Bodenfeuchte.' },
        { frage: 'Wo liegt die Dichtebene?', antwort: 'Außen auf der tragenden Wand.' },
      ],
      quelle: 'Testquelle, S. 1',
      stand: '2026-10',
      geprueft: true,
      siehe: ['bp-feuchte'],
    })
    await route.fulfill({ response: antwort, json: daten })
  })
}

async function angemeldet(page, name) {
  await page.goto('/')
  await profilAnlegen(page, name)
  await page.locator('.profilKnopf', { hasText: name }).click()
  await expect(page.locator('nav.navigation')).toBeVisible()
}

test('Fallaufgabe: Teile einzeln aufdecken, Querverweis oeffnet das andere Thema', async ({ page }) => {
  await mitTestfeldern(page)
  await angemeldet(page, 'Fall')
  await page.locator('.blaetternLink').click() // am Desktop Textlink statt Kachel (41A)
  await expect(page.locator('.frage')).toContainText('TESTFALL')
  await expect(page.locator('.fallAntwort')).toHaveCount(0)
  await page.getByRole('button', { name: 'Teil 1 aufdecken' }).click()
  await expect(page.locator('.fallAntwort')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Teil 2 aufdecken' })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.locator('.fallAntwort')).toHaveCount(2)
  await page.locator('.sieheAuch .markenKnopf').first().click()
  await expect(page.locator('.schleier .grosseKarte')).toBeVisible()
})

test('Lernziele und Querverweise im Erklaerstueck, Begruendung je Option in Nachschlagen', async ({ page }) => {
  await mitTestfeldern(page)
  await angemeldet(page, 'Lernziele')
  await page.locator('.navKnopf', { hasText: 'Themen' }).click()
  await page.locator('.artKnopf', { hasText: 'Themen zeigen' }).first().click()
  await page.locator('.artKnopf', { hasText: 'Erklärung' }).first().click()
  await expect(page.locator('.lernziele')).toContainText('Dichtebene am Sockel')
  await expect(page.locator('.sieheAuch')).toBeVisible()

  await page.locator('.textknopf', { hasText: 'Zurück' }).first().click()
  await page.locator('.navKnopf', { hasText: 'Nachschlagen' }).click()
  const sockel = JSON.parse(fs.readFileSync('public/pakete/arch-de/items/bk-sockel.json', 'utf8'))
  const mc = sockel.items.find((i) => i.typ === 'mehrfachauswahl')
  await page.locator('.suchfeld').fill(mc.frage.split(' ').slice(0, 5).join(' '))
  await page.locator('.trefferOeffnen').first().click()
  await expect(page.locator('.optionWarum').first()).toContainText('Begründung')
})

test('Karte melden und als Markdown fuer den Web-Chat exportieren', async ({ page }, info) => {
  await angemeldet(page, 'Melden')
  await page.locator('button', { hasText: /^Lernen$/ }).first().click()
  await page.locator('.markenKnopf', { hasText: 'Melden' }).click()
  await page.locator('.meldenFeld .wahlKnopf', { hasText: 'Quelle prüfen' }).click()
  await page.locator('.meldenFeld textarea').fill('Seitenzahl stimmt nicht')
  await page.locator('.meldenFeld .knopf', { hasText: 'Melden' }).click()
  await expect(page.locator('.markenKnopf', { hasText: 'Gemeldet' })).toBeVisible()
  const itemId = await page.locator('.frage').innerText()
  await page.locator('.lernkopf .textknopf', { hasText: 'Zurück' }).click()

  await page.locator('.navKnopf', { hasText: 'Einstellungen' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.zeile', { hasText: 'Meldungen für den Web-Chat' }).getByRole('button', { name: 'Exportieren' }).click(),
  ])
  const datei = info.outputPath('meldungen.md')
  await download.saveAs(datei)
  const text = fs.readFileSync(datei, 'utf8')
  expect(text).toContain('Quelle prüfen – Seitenzahl stimmt nicht')
  expect(text).toContain(itemId.slice(0, 30))
})

test('Neuer Inhaltsstand wird einmal gemeldet (22A)', async ({ page }) => {
  await angemeldet(page, 'Paketstand')
  // Ersten Stand merken lassen, dann mit veraenderter Karte + neuer Karte neu laden
  await page.waitForTimeout(500)
  await mitTestfeldern(page)
  await page.reload()
  await page.waitForSelector('nav.navigation, .profilKnopf', { state: 'attached' })
  if (await page.locator('.profilKnopf').count()) await page.locator('.profilKnopf', { hasText: 'Paketstand' }).click()
  await expect(page.locator('.meldung')).toContainText('Neuer Inhaltsstand')
  await expect(page.locator('.meldung')).toContainText('1 neue Karte,')
  await expect(page.locator('.meldung')).toContainText('1 überarbeitet')
})
