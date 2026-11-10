// Oeffnet alle Bildschirme und prueft auf JS-Fehler und waagerechten Ueberlauf.
// Aufruf (aus app/):  node e2e/remote/screens.cjs <ausgabeordner> [breite]     z. B. 1280 oder 390 (Handy)
const { start } = require('./lib.cjs')
const out = process.argv[2] || '.'
const breite = Number(process.argv[3] || 1280)

;(async () => {
  const { b, p, probleme } = await start(breite, breite < 600 ? 844 : 900)
  const mobil = breite < 960
  const bildschirme = ['Themen', 'Prüfungen', 'Kalender', 'Durchsicht', 'Nachschlagen', 'Bilder', 'Mein Heft', 'Fehlerbuch', 'Skizzen', 'Fortschritt', 'Einstellungen']
  for (const name of bildschirme) {
    try {
      if (mobil) {
        const direkt = p.locator('nav button', { hasText: new RegExp(name + '\\s*$') })
        if (await direkt.count()) await direkt.first().click()
        else { await p.locator('nav button', { hasText: /Mehr/ }).first().click(); await p.waitForTimeout(300); await p.getByText(name, { exact: true }).first().click() }
      } else await p.locator('nav button, nav a', { hasText: new RegExp(name + '\\s*$') }).first().click()
      await p.waitForTimeout(900)
      const ueberlauf = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      const kopf = (await p.locator('main, [role=main]').first().innerText().catch(() => '')).replace(/\n+/g, ' | ').slice(0, 110)
      await p.screenshot({ path: `${out}/${breite}-${name.replace(/\W/g, '')}.png` })
      console.log(`${name.padEnd(13)} ueberlauf=${ueberlauf}px  ${kopf}`)
    } catch (e) { console.log(`${name}: FEHLER ${e.message.split('\n')[0]}`) }
  }
  console.log('Probleme (JS-Fehler, HTTP >= 400):', probleme)
  await b.close()
})()
