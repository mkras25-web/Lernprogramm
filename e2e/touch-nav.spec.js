import { test, expect, devices } from '@playwright/test'
import { profilAnlegen } from './hilfen.js'

// Regressionstest fuer die mobile Navigation (Umbau 2026-10-10): statt
// eines schwebenden Menueknopfs mit 3x3-Kachel-Overlay (lief bei 320px
// seitlich aus dem Bild und verdeckte Inhalte) gibt es eine untere
// Leiste mit vier Hauptzielen plus "Mehr", das die uebrigen fuenf Ziele
// als Blatt von unten oeffnet. Ab 60rem bleibt es bei der immer
// sichtbaren Seitenleiste (siehe App.jsx, Mobil-Block in styles.css).
async function angemeldet(page, name) {
  await page.goto('/')
  await profilAnlegen(page, name)
  await page.locator('.profilKnopf', { hasText: name }).click()
}

test.describe('Mobil (< 60rem)', () => {
  // Nur die Kontext-Optionen von devices['iPhone 13'], ohne
  // defaultBrowserType - das laesst sich nicht innerhalb einer
  // describe-Gruppe setzen (erzwingt einen neuen Worker-Browsertyp).
  const { defaultBrowserType, ...iphoneKontext } = devices['iPhone 13']
  test.use(iphoneKontext)

  test('Seitenleiste versteckt, untere Leiste mit 4 Zielen + Mehr', async ({ page }) => {
    await angemeldet(page, 'Nav-Mobil')

    await expect(page.locator('nav.navigation')).toBeHidden()
    await expect(page.locator('.tabLeiste')).toBeVisible()
    await expect(page.locator('.tabLeiste .tabKnopf')).toHaveCount(5)
    await expect(page.locator('.tabLeiste')).toContainText('Prüfungen')
  })

  test('Hauptziel in der Leiste navigiert direkt', async ({ page }) => {
    await angemeldet(page, 'Nav-Tab')
    await page.locator('.tabKnopf', { hasText: 'Themen' }).tap()

    await expect(page.getByRole('heading', { name: 'Themen' })).toBeVisible()
    await expect(page.locator('.tabKnopf', { hasText: 'Themen' })).toHaveClass(/aktiv/)
  })

  test('"Mehr" oeffnet das Blatt, Auswahl navigiert und schliesst es', async ({ page }) => {
    await angemeldet(page, 'Nav-Mehr')
    await page.locator('.tabKnopf', { hasText: 'Mehr' }).tap()
    await expect(page.locator('.mehrBlatt')).toBeVisible()
    await expect(page.locator('.mehrZeile')).toHaveCount(6)

    await page.locator('.mehrZeile', { hasText: 'Einstellungen' }).tap()
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible()
    await expect(page.locator('.mehrBlatt')).toHaveCount(0)
    // Ziel aus "Mehr" aktiv -> "Mehr"-Tab markiert
    await expect(page.locator('.tabKnopf', { hasText: 'Mehr' })).toHaveClass(/aktiv/)
  })

  test('Tippen auf den Hintergrund schliesst das Blatt ohne zu navigieren', async ({ page }) => {
    await angemeldet(page, 'Nav-Backdrop')
    await page.locator('.tabKnopf', { hasText: 'Mehr' }).tap()
    await expect(page.locator('.mehrBlatt')).toBeVisible()

    await page.locator('.mehrSchleier').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('.mehrBlatt')).toHaveCount(0)
    await expect(page.locator('.tabKnopf', { hasText: 'Heute' })).toHaveClass(/aktiv/)
  })
})

test.describe('Desktop (>= 60rem)', () => {
  test('Seitenleiste ist immer sichtbar, keine untere Leiste', async ({ page }) => {
    await angemeldet(page, 'Nav-Desktop')

    await expect(page.locator('nav.navigation')).toBeVisible()
    await expect(page.locator('.navigation .navKnopf')).toHaveCount(10)
    await expect(page.locator('.tabLeiste')).toBeHidden()
  })

  // Regressionstest: beim Umbau auf die fruehere mobile Kachel-Uebersicht
  // wurde "background: none; border: none;" versehentlich aus der
  // gemeinsamen .navKnopf-Basisregel entfernt und nirgends fuer Desktop
  // wiederhergestellt. Ohne das fallen die Sidebar-Knoepfe auf den
  // Browser-Standard-Button-Rahmen zurueck statt flach zu bleiben.
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

  // Leiste und Blatt sind in der Basis-CSS aus und werden nur im
  // Mobil-Block eingeschaltet - selbst ein gewaltsam eingefuegtes Blatt
  // darf am Desktop nicht erscheinen.
  test('Mobile Leiste/Blatt koennen am Desktop strukturell nicht erscheinen', async ({ page }) => {
    await angemeldet(page, 'Nav-Desktop-Erzwungen')
    await page.waitForSelector('nav.navigation')
    await page.evaluate(() => {
      const s = document.createElement('div')
      s.className = 'mehrSchleier'
      s.innerHTML = '<div class="mehrBlatt">x</div>'
      document.body.appendChild(s)
    })
    await expect(page.locator('.mehrSchleier')).toBeHidden()
    await expect(page.locator('.tabLeiste')).toHaveCSS('display', 'none')
  })
})
