import { test, expect } from '@playwright/test'

// Regressionstest fuer eine ganze Klasse von Bugs: auf schmalen
// Breiten liefen wiederholt einzelne Elemente seitlich ueber (fehlender
// min-width:0 bei Flex-/Grid-Kindern, feste minmax()-Mindestbreiten
// groesser als der verfuegbare Platz, fehlendes Leerzeichen zwischen
// Text und Badge im JSX). Statt jeden Einzelfall zu testen: generisch
// pro Bildschirm pruefen, dass nichts aus .schirm herausragt und die
// Seite nicht breiter als das Fenster wird.
//
// Seit 2026-10-10 bei allen fuenf Pflichtformaten der Testregel in
// CLAUDE.md ("Testregel Mobil"), nicht mehr nur bei 320px.
const FORMATE = [
  { width: 320, height: 568 },
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
]

const HAUPT = ['Themen', 'Prüfungen', 'Fortschritt']
const MEHR = ['Nachschlagen', 'Normen', 'Mein Heft', 'Fehlerbuch', 'Skizzen', 'Einstellungen']

async function keinOverflow(page, name, breite) {
  const treffer = await page.evaluate((w) => {
    const ergebnisse = []
    if (document.documentElement.scrollWidth > w + 1) {
      ergebnisse.push(`Seite: ${document.documentElement.scrollWidth - w}px breiter als Fenster`)
    }
    document.querySelectorAll('.schirm, .schirm *').forEach((el) => {
      const stil = getComputedStyle(el)
      if (
        (stil.overflow === 'visible' || stil.overflow === '') &&
        el.scrollWidth > el.clientWidth + 2 &&
        el.clientWidth > 0
      ) {
        ergebnisse.push(`${el.className || el.tagName}: ${el.scrollWidth - el.clientWidth}px`)
      }
    })
    return ergebnisse
  }, breite)
  expect(treffer, `Overflow auf "${name}" bei ${breite}px: ${treffer.join(', ')}`).toEqual([])
}

for (const format of FORMATE) {
  test.describe(`${format.width}x${format.height}`, () => {
    test.use({ viewport: format, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })

    test(`Kein horizontaler Overflow auf keinem Bildschirm (${format.width}px)`, async ({ page }) => {
      await page.goto('/')
      await page.getByPlaceholder('Name für ein neues Profil').fill('Overflow-Test')
      await page.getByRole('button', { name: 'Profil anlegen' }).tap()
      await page.locator('.profilKnopf', { hasText: 'Overflow-Test' }).tap()
      await page.waitForSelector('.tabLeiste')
      await keinOverflow(page, 'Heute', format.width)

      for (const ziel of HAUPT) {
        await page.locator('.tabKnopf', { hasText: ziel }).tap()
        await page.waitForTimeout(150)
        await keinOverflow(page, ziel, format.width)
      }
      // Sammlung ist ein Reiter unter Fortschritt
      await page.locator('.tabKnopf', { hasText: 'Fortschritt' }).tap()
      await page.locator('.auswertungReiter .reiterKnopf', { hasText: 'Sammlung' }).tap()
      await page.waitForTimeout(150)
      await keinOverflow(page, 'Sammlung', format.width)
      for (const ziel of MEHR) {
        await page.locator('.tabKnopf', { hasText: 'Mehr' }).tap()
        await page.locator('.mehrZeile', { hasText: ziel }).tap()
        await page.waitForTimeout(150)
        await keinOverflow(page, ziel, format.width)
      }
    })
  })
}
