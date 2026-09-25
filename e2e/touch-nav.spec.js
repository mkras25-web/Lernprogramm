import { test, expect, devices } from '@playwright/test'

// Regressionstest fuer die mobile Navigation: bei neun Eintraegen war
// die frueher immer sichtbare Leiste (repeat(4, 1fr)) unsymmetrisch
// (4+4+1). Jetzt: auf Schmalbreiten hinter navMenuKnopf versteckt,
// oeffnet sich als 3x3-Kachelraster. Ab 60rem bleibt es bei der immer
// sichtbaren Seitenleiste (siehe App.jsx, styles.css).
async function angemeldet(page, name) {
  await page.goto('/')
  await page.getByPlaceholder('Name für ein neues Profil').fill(name)
  await page.getByRole('button', { name: 'Profil anlegen' }).click()
  await page.locator('.profilKnopf', { hasText: name }).click()
}

test.describe('Mobil (< 60rem)', () => {
  // Nur die Kontext-Optionen von devices['iPhone 13'], ohne
  // defaultBrowserType - das laesst sich nicht innerhalb einer
  // describe-Gruppe setzen (erzwingt einen neuen Worker-Browsertyp).
  const { defaultBrowserType, ...iphoneKontext } = devices['iPhone 13']
  test.use(iphoneKontext)

  test('Navigation ist versteckt, Menu-Knopf oeffnet ein 3x3-Kachelraster', async ({ page }) => {
    await angemeldet(page, 'Nav-Mobil')

    await expect(page.locator('nav.navigation')).toBeHidden()
    await expect(page.locator('.navMenuKnopf')).toBeVisible()

    await page.tap('.navMenuKnopf')
    await expect(page.locator('nav.navigation.offen')).toBeVisible()
    await expect(page.locator('.navigation.offen .navKnopf')).toHaveCount(9)
  })

  test('Auswahl eines Eintrags navigiert und schliesst das Menu', async ({ page }) => {
    await angemeldet(page, 'Nav-Wahl')
    await page.tap('.navMenuKnopf')
    await page.locator('.navigation.offen .navKnopf', { hasText: 'Themen' }).tap()

    await expect(page.getByRole('heading', { name: 'Themen' })).toBeVisible()
    await expect(page.locator('nav.navigation')).toBeHidden()
  })

  test('Tippen auf den Hintergrund schliesst das Menu ohne zu navigieren', async ({ page }) => {
    await angemeldet(page, 'Nav-Backdrop')
    await page.tap('.navMenuKnopf')
    await expect(page.locator('nav.navigation.offen')).toBeVisible()

    // Klick in eine Ecke der Flaeche, die kein Knopf ist.
    await page.locator('nav.navigation.offen').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('nav.navigation')).toBeHidden()
  })
})

test.describe('Desktop (>= 60rem)', () => {
  test('Seitenleiste ist immer sichtbar, kein Menu-Knopf', async ({ page }) => {
    await angemeldet(page, 'Nav-Desktop')

    await expect(page.locator('nav.navigation')).toBeVisible()
    await expect(page.locator('.navigation .navKnopf')).toHaveCount(9)
    await expect(page.locator('.navMenuKnopf')).toBeHidden()
  })

  // Regressionstest: beim Umbau auf die mobile Kachel-Uebersicht wurde
  // "background: none; border: none;" versehentlich aus der
  // gemeinsamen .navKnopf-Basisregel entfernt (gehoerte gedanklich zur
  // alten Bar) und nirgends fuer Desktop wiederhergestellt. Ohne das
  // fallen die Sidebar-Knoepfe auf den Browser-Standard-Button-Rahmen
  // zurueck (Kaesten/Schatten je nach Browser) statt flach zu bleiben.
  test('Nicht aktive Sidebar-Knoepfe bleiben ohne Hintergrund/Rahmen (kein Browser-Standard-Button-Look)', async ({ page }) => {
    await angemeldet(page, 'Nav-Desktop-Flach')

    const knopf = page.locator('.navigation .navKnopf').nth(1) // nicht der aktive erste
    const stil = await knopf.evaluate((el) => {
      const s = getComputedStyle(el)
      return { background: s.backgroundColor, boxShadow: s.boxShadow }
    })
    expect(stil.background).toBe('rgba(0, 0, 0, 0)')
    expect(stil.boxShadow).toBe('none')
  })

  // Regressionstest: die .offen-Kachel-Regeln (Box, Schatten, fixiertes
  // Overlay) hatten anfangs keine eigene Media-Query-Absicherung und
  // waren nur ueber hoehere CSS-Spezifitaet vom Desktop-Grundlayout
  // unterschieden - blieb die Klasse "offen" aus irgendeinem Grund im
  // DOM haengen, haetten sie trotzdem auf der Sidebar gegriffen. Jetzt
  // stehen sie hart in @media (max-width: 59.99rem).
  test('Erzwungene "offen"-Klasse hat bei Desktop-Breite keine Wirkung', async ({ page }) => {
    await angemeldet(page, 'Nav-Desktop-Erzwungen')
    await page.waitForSelector('nav.navigation')

    await page.evaluate(() => document.querySelector('nav.navigation').classList.add('offen'))
    await expect(page.locator('nav.navigation')).toHaveCSS('position', 'sticky')
    await expect(page.locator('nav.navigation')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const knopf = page.locator('.navigation .navKnopf').nth(1)
    await expect(knopf).toHaveCSS('box-shadow', 'none')
  })
})
