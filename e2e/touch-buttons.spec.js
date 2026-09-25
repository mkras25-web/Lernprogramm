import { test, expect, devices } from '@playwright/test'

// Regressionstest fuer einen Bug: ohne user-select/touch-action auf
// <button> interpretiert Safari auf dem iPhone einen Tipp leicht als
// Text-markieren statt als Klick - der Tastendruck kommt dann nie an,
// die Profilwahl (und jeder andere Knopf) haengt fest. Fix: globale
// button-Regel in app/src/styles.css.
//
// Wichtig: die eigentliche native Geste (Finger bewegt sich beim Tippen
// minimal, Safari startet daraufhin eine Textauswahl) laesst sich mit
// Playwrights synthetischem tap() NICHT reproduzieren - ein Test, der
// das versucht, ist ohne UND mit Fix gleichermassen gruen und prueft
// nichts. Die tatsaechlich wirksame Pruefung ist deshalb, ob die dafuer
// noetigen CSS-Eigenschaften auf <button> ankommen.
test.use({ ...devices['iPhone 13'] })

test('Buttons haben die noetigen Touch-CSS-Eigenschaften gesetzt', async ({ page }) => {
  await page.goto('/')
  const knopf = page.getByRole('button', { name: 'Profil anlegen' })
  await expect(knopf).toBeVisible()

  const eigenschaften = await knopf.evaluate((el) => {
    const stil = getComputedStyle(el)
    return {
      userSelect: stil.webkitUserSelect || stil.userSelect,
      touchCallout: stil.getPropertyValue('-webkit-touch-callout'),
      touchAction: stil.touchAction,
    }
  })

  expect(eigenschaften.userSelect).toBe('none')
  expect(eigenschaften.touchAction).toBe('manipulation')
})

test('Profil anlegen funktioniert per Tipp (Grundfunktion, ohne die native Geste zu pruefen)', async ({ page }) => {
  await page.goto('/')

  await page.getByPlaceholder('Name für ein neues Profil').fill('Touch-Test')
  await page.getByRole('button', { name: 'Profil anlegen' }).tap()
  await page.locator('.profilKnopf', { hasText: 'Touch-Test' }).tap()

  // Mobil ist .navigation standardmaessig ausgeblendet und oeffnet sich
  // erst ueber navMenuKnopf (siehe touch-nav.spec.js fuer den Menu-Test
  // selbst) - hier zaehlt nur, dass die App ueberhaupt angekommen ist.
  await expect(page.locator('.navMenuKnopf')).toBeVisible()
})
