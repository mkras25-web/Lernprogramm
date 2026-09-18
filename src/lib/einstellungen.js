// Einstellungen. Getrennt vom Ereignisprotokoll: Sie beschreiben Geraet
// und Geschmack, nicht den Lernfortschritt.
//
// Jedes Nutzerprofil (siehe profile.js) hat eigene Einstellungen, u. a.
// weil unterschiedliche Profile auch unterschiedliche Inhaltspakete
// lernen koennen sollen (aktivesPaket).

// ALTER_SCHLUESSEL war der einzige, profillose Speicherort vor der
// Einfuehrung von Nutzerprofilen - fuer die einmalige Uebernahme.
export const ALTER_SCHLUESSEL = 'einstellungen'

function schluesselFuer(profilId) {
  return `einstellungen_${profilId}`
}

// Die Tupfer sind nur die Vorschau im Auswahlfenster. Die tatsaechlichen
// Rollen der Farben stehen als CSS-Block in styles.css, weil dort auch
// Sonderfaelle wie helle Zeichenblaetter geregelt werden muessen.
export const PALETTEN = [
  { id: 'lehm', name: 'Lehm', dunkel: false, tupfer: ['#f0ead2', '#dde5b6', '#adc178', '#a98467', '#6c584c'] },
  { id: 'kalk', name: 'Kalk', dunkel: false, tupfer: ['#f4f1ea', '#e6e2d6', '#7d8471', '#9a9382', '#2f3128'] },
  { id: 'terracotta', name: 'Terrakotta', dunkel: false, tupfer: ['#f6ede4', '#ecd9c6', '#c1734a', '#b08968', '#43312a'] },
  { id: 'marine', name: 'Marine', dunkel: false, tupfer: ['#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#e63946'] },
  { id: 'signal', name: 'Signal', dunkel: false, tupfer: ['#edf2f4', '#8d99ae', '#2b2d42', '#ef233c', '#d90429'] },
  { id: 'ocker', name: 'Ocker', dunkel: false, tupfer: ['#ffe6a7', '#bb9457', '#99582a', '#6f1d1b', '#432818'] },
  { id: 'spektrum', name: 'Spektrum', dunkel: false, tupfer: ['#f94144', '#f8961e', '#f9c74f', '#43aa8b', '#577590'] },
  { id: 'kupfer', name: 'Kupfergrün', dunkel: false, tupfer: ['#edddd4', '#c44536', '#197278', '#283d3b', '#772e25'] },
  { id: 'seekarte', name: 'Seekarte', dunkel: false, tupfer: ['#d9dcd6', '#81c3d7', '#3a7ca5', '#2f6690', '#16425b'] },
  { id: 'lagune', name: 'Lagune', dunkel: false, tupfer: ['#f8ffe5', '#06d6a0', '#1b9aaa', '#ffc43d', '#ef476f'] },
  { id: 'dunkel', name: 'Dunkel', dunkel: true, tupfer: ['#1d211a', '#333a2c', '#adc178', '#8a7360', '#edeade'] },
]

export const SCHRIFTGROESSEN = [
  { wert: 90, name: 'Klein' },
  { wert: 100, name: 'Normal' },
  { wert: 112, name: 'Groß' },
  { wert: 125, name: 'Sehr groß' },
]

export const STANDARD = {
  aktivesPaket: 'arch-de',
  letzteSicherung: null,
  palette: 'lehm',
  schriftgroesse: 100,
  farbenblind: false,
  animationen: true,
  breite: 'breit',
  neuProTag: 6,
  maxProTag: 30,
  reihenfolge: 'gemischt',
  bewertungsstufen: 4,
  ungeprueftZulassen: true,
  vertiefungZeigen: true,
  ueberspringenErlauben: true,
  skizzenSichern: true,
  sichtungWeiter: false,
  aufstiegFeiern: true,
}

function systemDunkel() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  } catch {
    return false
  }
}

export function laden(profilId) {
  try {
    const roh = localStorage.getItem(schluesselFuer(profilId))
    const gespeichert = roh ? JSON.parse(roh) : {}
    // Nur beim allerersten Start (noch keine eigene Wahl gespeichert)
    // nach Systemvoreinstellung starten - eine einmal getroffene Wahl
    // wird nie von der Systemeinstellung ueberschrieben.
    const standard = { ...STANDARD }
    if (gespeichert.palette === undefined && systemDunkel()) standard.palette = 'dunkel'
    return { ...standard, ...gespeichert }
  } catch {
    return { ...STANDARD }
  }
}

export function speichern(profilId, einstellungen) {
  localStorage.setItem(schluesselFuer(profilId), JSON.stringify(einstellungen))
}

export function anwenden(e) {
  const wurzel = document.documentElement
  wurzel.dataset.palette = e.palette
  wurzel.dataset.animationen = e.animationen ? 'an' : 'aus'
  wurzel.dataset.farbenblind = e.farbenblind ? 'an' : 'aus'
  wurzel.style.setProperty('--spaltenbreite', e.breite === 'breit' ? '104rem' : '68rem')
  wurzel.style.fontSize = `${e.schriftgroesse}%`
}
