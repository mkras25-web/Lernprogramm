// Pruefungen entstehen automatisch aus den vorhandenen Items - es gibt
// keine eigens gebauten Pruefungsfragen. Damit waechst jede Pruefung
// mit dem Paket mit.

import { beherrschungsgrad } from './fortschritt.js'
import { anteilRichtig, note, punkteFuer, selbstBewertbar } from './punkte.js'

// Ab dieser Zahl gepruefter Items gilt ein Thema als pruefungsreif.
export const REIFE_SCHWELLE = 8

export const PRUEFUNGSARTEN = {
  monat: {
    id: 'monat', titel: 'Monatsprüfung', anzahl: 30, zeichen: '◆',
    text: 'Querschnitt über alles Gelernte',
  },
  woche: {
    id: 'woche', titel: 'Wochenprüfung', anzahl: 12, zeichen: '◇',
    text: 'Kurzer Durchgang für zwischendurch',
  },
  frei: {
    id: 'frei', titel: 'Freie Prüfung', anzahl: 20, zeichen: '○',
    text: 'Selbst gewählter Umfang',
  },
  thema: {
    id: 'thema', titel: 'Themenprüfung', anzahl: 12, zeichen: '▣',
    text: 'Ein Thema in der Tiefe',
  },
  bereich: {
    id: 'bereich', titel: 'Bereichsprüfung', anzahl: 20, zeichen: '▦',
    text: 'Alle Module eines Fachbereichs',
  },
  diagnose: {
    id: 'diagnose', titel: 'Diagnoseprüfung', anzahl: 10, zeichen: '◉',
    text: 'Vor dem Lernen: was sitzt schon?',
  },
  nach: {
    id: 'nach', titel: 'Nachprüfung', anzahl: 15, zeichen: '↻',
    text: 'Nur die zuletzt falschen Fragen',
  },
}

export function gepruefteItems(items, bereich = {}) {
  let auswahl = items.filter((i) => i.geprueft !== false)
  if (bereich.modulId) auswahl = auswahl.filter((i) => i.modulId === bereich.modulId)
  if (bereich.themaId) auswahl = auswahl.filter((i) => i.themaId === bereich.themaId)
  if (bereich.bereich) auswahl = auswahl.filter((i) => i.bereich === bereich.bereich)
  return auswahl
}

// Gewichtung: Schwaeche zieht, Unbekanntes auch, Sicheres seltener.
// Aus jedem Thema hoechstens ein Viertel, damit keine Pruefung an
// einem einzigen Thema haengt.
export function pruefungBauen(items, zustaende, { anzahl = 30, bereich = {}, nurIds = null } = {}) {
  let auswahl = gepruefteItems(items, bereich)
  if (nurIds) {
    const menge = new Set(nurIds)
    auswahl = auswahl.filter((i) => menge.has(i.id))
  }

  const bewertet = auswahl.map((item) => {
    const zustand = zustaende.get(item.id)
    const grad = beherrschungsgrad(zustand)
    let gewicht = { neu: 1.2, angelernt: 1.8, sicher: 1.2, gefestigt: 0.8, gemeistert: 0.5 }[grad] ?? 1
    if (zustand?.fehler > 0) gewicht += Math.min(zustand.fehler * 0.4, 1.5)
    return { item, gewicht: gewicht * (0.6 + Math.random() * 0.8) }
  })

  bewertet.sort((a, b) => b.gewicht - a.gewicht)

  const proThema = Math.max(2, Math.ceil(anzahl / 4))
  const zaehler = new Map()
  const gewaehlt = []

  for (const { item } of bewertet) {
    if (gewaehlt.length >= anzahl) break
    const bisher = zaehler.get(item.themaId) ?? 0
    if (bisher >= proThema) continue
    zaehler.set(item.themaId, bisher + 1)
    gewaehlt.push(item)
  }

  if (gewaehlt.length < anzahl) {
    for (const { item } of bewertet) {
      if (gewaehlt.length >= anzahl) break
      if (!gewaehlt.includes(item)) gewaehlt.push(item)
    }
  }

  return gewaehlt.sort(() => Math.random() - 0.5)
}

// Auswertung mit Teilpunkten. Nicht beantwortete Fragen zaehlen als
// falsch - eine Luecke ist im Ernstfall auch keine halbe Antwort.
export function auswerten(items, antworten) {
  return items.map((item) => {
    const eingabe = antworten[item.id]
    const punkte = punkteFuer(item)
    if (selbstBewertbar(item.typ)) {
      const anteil = anteilRichtig(item, eingabe)
      return {
        item,
        eingabe,
        punkte,
        erreicht: Math.round(anteil * punkte * 10) / 10,
        anteil,
        automatisch: true,
      }
    }
    return { item, eingabe, punkte, erreicht: null, anteil: null, automatisch: false }
  })
}

export function ergebnisRechnen(ergebnisse) {
  const moeglich = ergebnisse.reduce((s, e) => s + e.punkte, 0)
  const erreicht = ergebnisse.reduce((s, e) => s + (e.erreicht ?? 0), 0)
  const prozent = moeglich ? Math.round((erreicht / moeglich) * 100) : 0
  const bewertung = note(prozent)
  return {
    moeglich: Math.round(moeglich * 10) / 10,
    erreicht: Math.round(erreicht * 10) / 10,
    prozent,
    note: bewertung.name,
    bestanden: bewertung.bestanden,
  }
}

export function monatspruefungFaellig(pruefungen) {
  const letzte = pruefungen.filter((p) => p.art === 'monat').sort((a, b) => b.ts - a.ts)[0]
  if (!letzte) return true
  return Date.now() - letzte.ts > 30 * 24 * 60 * 60 * 1000
}

// Themen, deren Pruefung wiederholt werden muss, weil sie beim
// letzten Mal nicht bestanden wurde.
export function offeneWiederholungen(pruefungen) {
  const jeThema = new Map()
  for (const p of [...pruefungen].sort((a, b) => a.ts - b.ts)) {
    if (p.themaId) jeThema.set(p.themaId, p)
  }
  return [...jeThema.values()].filter((p) => !p.bestanden)
}

// Vorschlag, welches Thema als Naechstes geprueft werden sollte:
// lange nicht geprueft, genug Material, schwaches Ergebnis.
export function pruefungsplan(themen, items, zustaende, pruefungen, anzahl = 3) {
  const letzte = new Map()
  for (const p of pruefungen) {
    if (!p.themaId) continue
    const bisher = letzte.get(p.themaId)
    if (!bisher || p.ts > bisher.ts) letzte.set(p.themaId, p)
  }

  return themen
    .filter((t) => !t.geplant)
    .map((t) => {
      const eigene = gepruefteItems(items, { themaId: t.id })
      const vorher = letzte.get(t.id)
      const tageHer = vorher ? (Date.now() - vorher.ts) / 86400000 : null
      let dringlichkeit = 0
      if (eigene.length >= REIFE_SCHWELLE) {
        dringlichkeit = vorher ? Math.min(tageHer / 30, 2) : 1.5
        if (vorher && !vorher.bestanden) dringlichkeit += 2
        else if (vorher && vorher.prozent < 70) dringlichkeit += 0.8
      }
      return {
        thema: t,
        verfuegbar: eigene.length,
        reif: eigene.length >= REIFE_SCHWELLE,
        letzte: vorher ?? null,
        dringlichkeit,
      }
    })
    .filter((e) => e.reif)
    .sort((a, b) => b.dringlichkeit - a.dringlichkeit)
    .slice(0, anzahl)
}

export { note }
export { selbstBewertbar as automatischBewertbar }
