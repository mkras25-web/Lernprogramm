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
  { id: 'lehm', name: 'Lehm', dunkel: false, tupfer: ['#f0ead2', '#dde5b6', '#788d41', '#a98467', '#6c584c'] },
  { id: 'kalk', name: 'Kalk', dunkel: false, tupfer: ['#f4f1ea', '#e6e2d6', '#7d8471', '#9a9382', '#2f3128'] },
  { id: 'terracotta', name: 'Terrakotta', dunkel: false, tupfer: ['#f6ede4', '#ecd9c6', '#c1734a', '#b08968', '#43312a'] },
  { id: 'marine', name: 'Marine', dunkel: false, tupfer: ['#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#e63946'] },
  { id: 'signal', name: 'Signal', dunkel: false, tupfer: ['#edf2f4', '#8d99ae', '#2b2d42', '#ef233c', '#d90429'] },
  { id: 'ocker', name: 'Ocker', dunkel: false, tupfer: ['#ffe6a7', '#bb9457', '#99582a', '#6f1d1b', '#432818'] },
  { id: 'spektrum', name: 'Spektrum', dunkel: false, tupfer: ['#f94144', '#f8961e', '#f9c74f', '#3e9d81', '#577590'] },
  { id: 'kupfer', name: 'Kupfergrün', dunkel: false, tupfer: ['#edddd4', '#c44536', '#197278', '#283d3b', '#772e25'] },
  { id: 'seekarte', name: 'Seekarte', dunkel: false, tupfer: ['#d9dcd6', '#81c3d7', '#3a7ca5', '#2f6690', '#16425b'] },
  { id: 'lagune', name: 'Lagune', dunkel: false, tupfer: ['#f8ffe5', '#05a47b', '#1b9aaa', '#ffc43d', '#ef476f'] },
  { id: 'dunkel', name: 'Dunkel', dunkel: true, tupfer: ['#1d211a', '#333a2c', '#adc178', '#8a7360', '#edeade'] },
  { id: 'amethyst', name: 'Amethyst', dunkel: false, tupfer: ['#f3eef6', '#e6dcee', '#ad8232', '#9b7ba3', '#6e4a74'] },
  { id: 'fjord', name: 'Fjord', dunkel: false, tupfer: ['#eef2f3', '#dbe6e8', '#c96b56', '#8aa3aa', '#51707a'] },
  { id: 'waldgruen', name: 'Waldgrün', dunkel: false, tupfer: ['#f2f1e4', '#dbe4c4', '#a8752f', '#8a9a5b', '#3f5c33'] },
  { id: 'koralle', name: 'Koralle', dunkel: false, tupfer: ['#fdf1e7', '#fbdccb', '#1f7d78', '#c98a6e', '#8a4a3a'] },
  { id: 'graphit', name: 'Graphit', dunkel: true, tupfer: ['#1a1d21', '#2c343c', '#3ec9e0', '#5b6b76', '#9fb0bb'] },
  // Farbsicher (Okabe-Ito): Blau fuer richtig/Fortschritt, Orange fuer
  // falsch/Warnung - fuer Rot-Gruen- und Blau-Gelb-Schwaeche gleich gut
  // unterscheidbar. Der Farbenblindmodus waehlt sie automatisch.
  { id: 'farbsicher', name: 'Farbsicher', dunkel: false, farbsicher: true, tupfer: ['#f4f4f1', '#d9e7f2', '#0072b2', '#a64b00', '#1f2328'] },
  { id: 'farbsicher-dunkel', name: 'Farbsicher dunkel', dunkel: true, farbsicher: true, tupfer: ['#16191d', '#1f3448', '#56b4e9', '#e69f00', '#eef1f4'] },
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
  // FSRS: angestrebte Behaltenswahrscheinlichkeit beim Wiederholen.
  // Hoeher = mehr Wiederholungen, sicherer; niedriger = weniger Aufwand.
  zielBehaltensrate: 0.9,
  // Eigene FSRS-Gewichte (L7): { w: [21 Zahlen], basis, datum } oder null
  fsrsGewichte: null,
  // Tagesziel in Antworten (0 = aus). Ein Ziel, keine Obergrenze.
  tagesziel: 0,
  // Klausurtermine fuer den Countdown auf Heute: [{ id, titel, datum }]
  klausuren: [],
  reihenfolge: 'gemischt',
  bewertungsstufen: 4,
  ungeprueftZulassen: true,
  // true = zeigen, 'einklappen' = erst ueberlegen, dann aufklappen (L2), false = aus
  vertiefungZeigen: true,
  // Themen, deren Einfuehrungsschritt (D4) auf diesem Geraet gelesen ist
  eingefuehrt: [],
  ueberspringenErlauben: true,
  skizzenSichern: true,
  // Zeichenfragen (Typ "skizze") weder lernen noch pruefen.
  zeichenAusblenden: false,
  sichtungWeiter: false,
  aufstiegFeiern: true,
  dropboxAuto: true,
  dropboxSkizzen: false,
  // Palette, Schrift usw. mit den anderen Geraeten abgleichen (nur dieses
  // Geraet; die Lern-Einstellungen reisen immer mit).
  aussehenAbgleichen: true,
}

// --- Einstellungen abgleichen (2026-10-15, Profil-System c) -----------------
// Reisen mit Sicherung und Dropbox, je Einstellung die juengere Aenderung.
// Lern-Einstellungen immer (sonst plant das Handy mit anderen FSRS-Gewichten
// als der PC), das Aussehen nur, wenn "aussehenAbgleichen" an ist.
// Geraetebezogenes (aktives Paket, Dropbox-Schalter, letzte Sicherung,
// gelesene Einfuehrungen) bleibt lokal.
export const ABGLEICH_LERNEN = [
  'neuProTag', 'maxProTag', 'zielBehaltensrate', 'fsrsGewichte', 'tagesziel',
  'reihenfolge', 'bewertungsstufen', 'ungeprueftZulassen', 'vertiefungZeigen',
  'ueberspringenErlauben', 'skizzenSichern', 'zeichenAusblenden', 'sichtungWeiter',
  'aufstiegFeiern',
]
export const ABGLEICH_AUSSEHEN = ['palette', 'schriftgroesse', 'farbenblind', 'paletteVorFarbenblind', 'animationen', 'breite']
const standSchluessel = (profilId) => `einstellungen_stand_${profilId}` // { name: ts der letzten Aenderung }

function rohLesen(profilId) {
  try {
    const roh = localStorage.getItem(schluesselFuer(profilId))
    return roh ? JSON.parse(roh) : null
  } catch {
    return null
  }
}

export function einstellungsStand(profilId) {
  try {
    return JSON.parse(localStorage.getItem(standSchluessel(profilId)) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

const gleich = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Fuer exportieren(): nur Einstellungen, die je bewusst geaendert wurden -
// unveraenderte Standardwerte eines frischen Geraets setzen sich so nie gegen
// eine echte Wahl auf dem anderen Geraet durch.
export function einstellungenFuerAbgleich(profilId) {
  const stand = einstellungsStand(profilId)
  const werte = { ...STANDARD, ...(rohLesen(profilId) ?? {}) }
  const namen = [...ABGLEICH_LERNEN, ...ABGLEICH_AUSSEHEN].filter((k) => stand[k] > 0)
  if (!namen.length) return undefined
  return {
    werte: Object.fromEntries(namen.map((k) => [k, werte[k] ?? null])),
    stand: Object.fromEntries(namen.map((k) => [k, stand[k]])),
  }
}

// Fremde Einstellungen (Sicherung/Abgleich) einarbeiten. Liefert die Zahl
// der uebernommenen Werte; danach laden() neu aufrufen.
export function einstellungenUebernehmen(profilId, fremd) {
  if (!fremd || typeof fremd !== 'object' || !fremd.werte || !fremd.stand) return 0
  const roh = rohLesen(profilId) ?? {}
  const werte = { ...STANDARD, ...roh }
  const stand = einstellungsStand(profilId)
  const erlaubt = new Set([...ABGLEICH_LERNEN, ...(werte.aussehenAbgleichen !== false ? ABGLEICH_AUSSEHEN : [])])
  let anzahl = 0
  for (const [k, ts] of Object.entries(fremd.stand)) {
    if (!erlaubt.has(k) || typeof ts !== 'number' || !(k in fremd.werte)) continue
    if ((stand[k] ?? 0) >= ts) continue
    stand[k] = ts
    if (gleich(werte[k], fremd.werte[k])) continue
    if (fremd.werte[k] === null && k === 'paletteVorFarbenblind') delete roh[k]
    else roh[k] = fremd.werte[k]
    anzahl += 1
  }
  localStorage.setItem(schluesselFuer(profilId), JSON.stringify(roh))
  localStorage.setItem(standSchluessel(profilId), JSON.stringify(stand))
  return anzahl
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
    return farbenblindNachziehen({ ...standard, ...gespeichert })
  } catch {
    return { ...STANDARD }
  }
}

// Farbenblindmodus an/aus. Beim Einschalten wechselt die Palette auf die
// passende farbsichere (hell/dunkel wie die bisherige), die alte Wahl wird
// gemerkt und beim Ausschalten wiederhergestellt. Wer danach im Modus
// selbst eine andere Palette waehlt, behaelt sie - die Zeichen und Muster
// des Modus gelten in jeder Palette.
export function farbenblindSchalten(werte, an) {
  if (an === werte.farbenblind) return werte
  if (an) {
    const bisher = PALETTEN.find((p) => p.id === werte.palette)
    if (bisher?.farbsicher) return { ...werte, farbenblind: true }
    return {
      ...werte,
      farbenblind: true,
      paletteVorFarbenblind: werte.palette,
      palette: bisher?.dunkel ? 'farbsicher-dunkel' : 'farbsicher',
    }
  }
  const { paletteVorFarbenblind, ...rest } = werte
  const zurueck = PALETTEN.find((p) => p.farbsicher && p.id === werte.palette) && paletteVorFarbenblind
  return { ...rest, farbenblind: false, palette: zurueck || werte.palette }
}

// Profile, die den Modus schon vor den farbsicheren Paletten (2026-10-11)
// eingeschaltet hatten, bekamen frueher Blau/Orange per festem Tausch.
// Ohne diesen Schritt saehen sie jetzt wieder Gruen/Braun. Nur wenn noch
// nie umgeschaltet wurde (paletteVorFarbenblind fehlt) - sonst wuerde eine
// spaeter bewusst gewaehlte Palette bei jedem Laden ueberschrieben.
export function farbenblindNachziehen(werte) {
  if (!werte.farbenblind || werte.paletteVorFarbenblind !== undefined) return werte
  const bisher = PALETTEN.find((p) => p.id === werte.palette)
  if (bisher?.farbsicher) return { ...werte, paletteVorFarbenblind: null }
  return farbenblindSchalten({ ...werte, farbenblind: false }, true)
}

// Speichert Einstellungen. Mit vorherigeWerte (der zuletzt gespeicherte
// Stand DIESES Fensters) werden nur die Felder geschrieben, die sich hier
// wirklich geaendert haben - alles andere bleibt so, wie es im Speicher
// steht. Fehler bis 2026-10-16: es wurde immer der ganze Stand aus dem
// Arbeitsspeicher geschrieben. Ein zweites Fenster/Tab (oder ein Abgleich,
// der gerade Einstellungen eingelesen hatte) setzte so beim naechsten
// Speichern alte Werte zurueck, z. B. "Zeichenaufgaben" wieder auf An - und
// stempelte sie als neueste Aenderung, sodass sie per Dropbox weiterreisten.
// Ohne vorherigeWerte (Profilwahl) gilt der Vergleich mit dem Speicher.
export function speichern(profilId, einstellungen, vorherigeWerte) {
  const roh = rohLesen(profilId)
  // Allererster Stand eines Profils: komplett schreiben, nichts stempeln -
  // sonst schluegen die Standardwerte eines neuen Geraets die Wahl auf den
  // anderen.
  if (!roh) {
    localStorage.setItem(schluesselFuer(profilId), JSON.stringify(einstellungen))
    return
  }
  const gespeichert = { ...STANDARD, ...roh }
  const basis = vorherigeWerte ?? gespeichert
  const neu = { ...roh }
  const stand = einstellungsStand(profilId)
  const abgeglichen = new Set([...ABGLEICH_LERNEN, ...ABGLEICH_AUSSEHEN])
  let gestempelt = false
  let geschrieben = false
  for (const k of new Set([...Object.keys(einstellungen), ...Object.keys(basis)])) {
    if (gleich(basis[k], einstellungen[k])) continue // hier nicht geaendert
    if (gleich(gespeichert[k], einstellungen[k]) && k in roh) continue // steht schon so da
    if (einstellungen[k] === undefined) delete neu[k]
    else neu[k] = einstellungen[k]
    geschrieben = true
    if (abgeglichen.has(k)) {
      stand[k] = Date.now()
      gestempelt = true
    }
  }
  if (gestempelt) localStorage.setItem(standSchluessel(profilId), JSON.stringify(stand))
  if (geschrieben) localStorage.setItem(schluesselFuer(profilId), JSON.stringify(neu))
}

export function anwenden(e) {
  const wurzel = document.documentElement
  wurzel.dataset.palette = e.palette
  // Fuer Regeln, die nur in dunklen Paletten gelten (D6) - ohne jede
  // dunkle Palette einzeln aufzuzaehlen.
  wurzel.dataset.dunkel = PALETTEN.find((p) => p.id === e.palette)?.dunkel ? 'an' : 'aus'
  wurzel.dataset.animationen = e.animationen ? 'an' : 'aus'
  wurzel.dataset.farbenblind = e.farbenblind ? 'an' : 'aus'
  wurzel.style.setProperty('--spaltenbreite', e.breite === 'breit' ? '104rem' : '68rem')
  wurzel.style.fontSize = `${e.schriftgroesse}%`
}
