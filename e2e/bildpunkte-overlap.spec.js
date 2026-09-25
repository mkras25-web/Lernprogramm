import { test, expect } from '@playwright/test'

// Regressionstest fuer einen Bug: bei nah beieinanderliegenden Punkten
// in Bildbeschriftungs-Aufgaben rendert .bildpunktHuelle (durch das
// transform ein eigener Stapelkontext) sonst in DOM-Reihenfolge - der
// spaetere Punkt liegt dann immer ueber dem offenen Auswahlfenster
// eines fruaheren, benachbarten Punkts und blockiert dessen Eintraege.
// Fix: .bildpunktHuelle.offen bekommt einen hoeheren z-index
// (app/src/styles.css, app/src/components/Bildpunkte.jsx).
test('Auswahlfenster eines Punkts bleibt trotz nahem Nachbarn vollstaendig bedienbar', async ({ page }) => {
  await page.goto('/e2e/fixtures/bildpunkte.html')
  await page.waitForSelector('.bildpunkt')

  const knoepfe = await page.locator('.bildpunkt').all()
  await knoepfe[0].click()
  await page.waitForSelector('.punktwahl')

  const eintraege = page.locator('.punktwahlEintrag')
  await expect(eintraege).toHaveCount(2)

  // Fuer jeden Eintrag: das oberste Element an seiner Mitte muss der
  // Eintrag selbst sein - nicht der Nummernkreis des Nachbarpunkts.
  for (const eintrag of await eintraege.all()) {
    const box = await eintrag.boundingBox()
    const mitte = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const oberstesIstEintrag = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('punktwahlEintrag'),
      mitte
    )
    expect(oberstesIstEintrag).toBe(true)
  }

  // Funktional: Klick auf "Alpha" muss tatsaechlich ankommen, nicht am
  // Nachbarpunkt vorbeigehen.
  await page.click('.punktwahlEintrag:has-text("Alpha")')
  await expect(page.locator('.bildpunkt.belegt')).toHaveCount(1)
})
