// Beantwortet stichprobenartig Karten in mehreren Modi und meldet Haenger/Fehler.
// Aufruf (aus app/):  node e2e/remote/modi.cjs <ausgabeordner> '[["Schnellrunde",8],["Training",5],["Neues lernen",6],["Nur Skizzen",3]]'
// Modus = Beschriftung des Knopfes auf "Heute" ("Lernen" ist der grosse Knopf). Screenshots der Endzustaende und
// unbekannter Zustaende landen im Ausgabeordner. Zeichenaufgaben: nur die Pruefpunkte werden abgehakt, nicht gezeichnet.
const { start } = require('./lib.cjs')
const out = process.argv[2] || '.'
const plan = JSON.parse(process.argv[3] || '[["Lernen",7],["Schnellrunde",8],["Training",5],["Neues lernen",6]]')

;(async () => {
  const { b, p, probleme } = await start()
  const bewertungen = ['Gut', 'Leicht', 'Schwer', 'Gut', 'Nochmal', 'Leicht', 'Gut']
  let gesamt = 0
  for (const [modus, n] of plan) {
    await p.locator('nav button, nav a', { hasText: /Heute\s*$/ }).first().click().catch(() => {})
    await p.waitForTimeout(1200)
    const karte = modus === 'Lernen' ? p.getByRole('button', { name: /^Lernen$/ }).first() : p.locator('button', { hasText: modus }).first()
    if (!(await karte.count())) { console.log(`${modus}: Knopf nicht gefunden`); continue }
    if (await karte.isDisabled().catch(() => false)) { console.log(`${modus}: deaktiviert (nichts zu tun)`); continue }
    await karte.click()
    await p.waitForTimeout(1500)
    let bew = 0, schritt = 0, haenger = 0
    const notizen = []
    while (bew < n && schritt < 80) {
      schritt++
      const knoepfe = (await p.locator('button:visible').allInnerTexts()).map((k) => k.replace(/\s+/g, ' ').trim())
      const hat = (re) => knoepfe.find((k) => re.test(k))
      const body = (await p.locator('body').innerText()).replace(/\n+/g, ' | ')
      if (/Sitzung beendet/.test(body)) break
      let aktion
      if (await p.locator('button:visible[disabled][title*="Prüfpunkte"]').count()) {
        // Zeichenaufgaben: erst alle Pruefpunkte abhaken, dann bewerten
        const boxen = p.locator('input[type=checkbox]:visible')
        const nb = await boxen.count()
        for (let k = 0; k < nb; k++) await boxen.nth(k).check().catch(() => {})
        notizen.push('Prüfpunkte abgehakt: ' + nb)
        await p.waitForTimeout(300)
        continue
      }
      if (hat(/^(Nochmal|Schwer|Gut|Leicht)\b/)) {
        const w = bewertungen[(gesamt + bew) % bewertungen.length]
        await p.locator('button:visible', { hasText: new RegExp('^' + w) }).first().click(); bew++; aktion = 'bewertet'
      } else if (hat(/Antwort zeigen/)) { await p.keyboard.press('Space'); aktion = 'zeigen' }
      else if (hat(/Zur ersten Karte|^Weiter|Nächste|Verstanden|Zur Karte|Los geht/)) { await p.keyboard.press('Space'); aktion = 'weiter' }
      else if (await p.locator('input[type=number]:visible, input[type=text]:visible').count()) {
        const f = p.locator('input[type=number]:visible, input[type=text]:visible').first()
        await f.fill('1'); await f.press('Enter'); aktion = 'eingabe'
      } else if (hat(/Prüfen|Antwort prüfen|Abgeben|Auswerten|Überprüfen/)) {
        await p.locator('button:visible', { hasText: /Prüfen|Abgeben|Auswerten|Überprüfen/ }).first().click(); aktion = 'prüfen'
      } else {
        aktion = 'unbekannt'
        notizen.push(`UNBEKANNT@${schritt}: ${body.slice(0, 160)} :: ${knoepfe.slice(-7).join(' / ')}`)
        await p.screenshot({ path: `${out}/unbekannt-${modus.replace(/\W/g, '')}-${schritt}.png` })
        await p.keyboard.press('Space')
      }
      haenger = aktion === 'unbekannt' ? haenger + 1 : 0
      if (haenger >= 3) { notizen.push('ABBRUCH (3x unbekannt)'); break }
      await p.waitForTimeout(450)
    }
    await p.screenshot({ path: `${out}/ende-${modus.replace(/\W/g, '')}.png` })
    gesamt += bew
    console.log(`${modus}: ${bew} Karten bewertet in ${schritt} Schritten`)
    notizen.forEach((t) => console.log('   ' + t))
    await p.keyboard.press('Escape')
    await p.getByRole('button', { name: /Zurück/ }).first().click({ timeout: 1500 }).catch(() => {})
    await p.waitForTimeout(500)
  }
  console.log('Gesamt bewertet:', gesamt)
  console.log('Probleme (JS-Fehler, HTTP >= 400):', probleme)
  await b.close()
})()
