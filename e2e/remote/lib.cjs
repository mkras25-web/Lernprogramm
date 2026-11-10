// Stichproben-Tests gegen den ECHTEN Test-Auftritt (Server-Profile), nicht Teil von `npm run test:e2e`
// (das testet lokal mit dem Vite-Dev-Server). Aufruf aus app/:  node e2e/remote/modi.cjs <ausgabeordner> '<plan>'
// Standard: https://test.maxkrasko.com, Profil "test" (offen, nur vom Admin loeschbar) = der Testaccount
// (Nutzerwunsch 2026-11-11). Anderes Ziel: Umgebungsvariablen LERNPROGRAMM_URL / LERNPROGRAMM_PROFIL.
// Jeder frische Browser-Kontext gilt dem Server als NEUES Geraet (aelteste Geraete-Datei wird verdraengt).
const { chromium } = require('playwright')

exports.URL = process.env.LERNPROGRAMM_URL || 'https://test.maxkrasko.com/'
exports.PROFIL = process.env.LERNPROGRAMM_PROFIL || 'test'

exports.start = async (breite = 1280, hoehe = 900) => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: breite, height: hoehe } })
  const p = await ctx.newPage()
  const probleme = []
  p.on('pageerror', (e) => probleme.push('PAGEERROR ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) probleme.push('CONSOLE ' + m.text()) })
  // kennwerte.json ist optional (404 normal); bilder-lokal/* gibt es nie auf dem Server (Prinzip 2, 404 normal)
  p.on('response', (r) => { if (r.status() >= 400 && !/favicon|kennwerte\.json|bilder-lokal/.test(r.url())) probleme.push(`HTTP ${r.status()} ${r.url()}`) })
  await p.goto(exports.URL)
  await p.waitForTimeout(2000)
  await p.getByText(exports.PROFIL, { exact: true }).first().click() // offenes Profil: kein Passwort noetig
  await p.waitForTimeout(3500)
  await p.getByText('Nein danke').click({ timeout: 2000 }).catch(() => {}) // Willkommenskarte
  return { b, p, probleme }
}
