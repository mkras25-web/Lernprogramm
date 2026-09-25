import { test, expect, devices } from '@playwright/test'

// Regressionstest fuer eine ganze Klasse von Bugs: auf schmalen
// Breiten liefen wiederholt einzelne Elemente seitlich ueber (fehlender
// min-width:0 bei Flex-/Grid-Kindern, feste minmax()-Mindestbreiten
// groesser als der verfuegbare Platz, fehlendes Leerzeichen zwischen
// Text und Badge im JSX). Statt jeden Einzelfall zu testen: einmal
// generisch pro Bildschirm bei der schmalsten sinnvollen Breite (ein
// iPhone SE, 320px) pruefen, dass nichts aus .schirm herausragt.
const { defaultBrowserType, ...schmalKontext } = devices['iPhone SE']
test.use(schmalKontext)

async function angemeldet(page, name) {
  await page.goto('/')
  await page.getByPlaceholder('Name für ein neues Profil').fill(name)
  await page.getByRole('button', { name: 'Profil anlegen' }).tap()
  await page.locator('.profilKnopf', { hasText: name }).tap()
  await page.waitForSelector('.navMenuKnopf')
}

async function keinOverflow(page, name) {
  const treffer = await page.evaluate(() => {
    const ergebnisse = []
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
  })
  expect(treffer, `Overflow auf "${name}": ${treffer.join(', ')}`).toEqual([])
}

const SEITEN = ['Themen', 'Nachschlagen', 'Normen', 'Prüfungen', 'Sammlung', 'Skizzen', 'Fortschritt', 'Einstellungen']

test('Kein horizontaler Overflow auf einem 320px-Handy, auf keinem Bildschirm', async ({ page }) => {
  await angemeldet(page, 'Overflow-Test')
  await keinOverflow(page, 'Heute')

  for (const ziel of SEITEN) {
    await page.tap('.navMenuKnopf')
    await page.locator('.navigation.offen .navKnopf', { hasText: ziel }).tap()
    await page.waitForTimeout(150)
    await keinOverflow(page, ziel)
  }
})
