// Fortschritt, Level und Sammlung.
//
// Alles hier wird aus dem Ereignisprotokoll berechnet, nichts wird
// zusaetzlich gespeichert. Die Stellschrauben stehen oben und lassen
// sich aendern, ohne die Logik darunter zu lesen.

import { BEWERTUNG } from './planer.js'
import { punkteFuer } from './punkte.js'
import { bedarfFuerStufe, levelAus } from './stufen.js'
import { PROBLEM_SCHWELLE } from './meldungen.js'

// Levelkurve und Bauabschnitte stehen in stufen.js. Hier nur
// weitergereicht, damit alle bisherigen Aufrufe unveraendert bleiben.
export { bedarfFuerStufe, levelAus }

export const KONFIG = {
  // XP je Antwort, nach Bewertung
  xp: { 1: 2, 2: 6, 3: 10, 4: 8 },
  // XP je Punkt der Aufgabe. Schwere Aufgaben zaehlen mehr, weil sie
  // mehr Punkte tragen - eine Skala statt zweier Systeme.
  xpJePunkt: 0.9,
  // XP fuer eine abgelegte Pruefung, je erreichtem Punkt
  xpJePruefungspunkt: 6,
  xpPruefungBestanden: 120,
  // Anteil bereits gemeisterter Items, die zur Auffrischung trotzdem
  // ins Tagespensum kommen.
  auffrischungAnteil: 0.12,
  // Die Levelkurve ist nach stufen.js gewandert - sie haengt jetzt an
  // den Bauwerken und laeuft ueber mehrere hundert Stufen.
  // Intervallgrenzen in Tagen fuer die Beherrschungsgrade
  beherrschung: { angelernt: 0, sicher: 7, gefestigt: 21, gemeistert: 60 },
  // Anteil der Items einer Einheit, der mindestens "sicher" sein muss,
  // damit die Detailkarte freigeschaltet wird
  kartenSchwelle: 0.8,
  // Fehltage pro Monat, die die Serie nicht brechen
  kulanztage: 2,
}

const TAG = 24 * 60 * 60 * 1000

// Stufen tragen Raenge. Das ist die sichtbare Belohnung des Aufstiegs -
// kein Spielzeug, sondern die Laufbahn, die du ohnehin durchlaeufst.
// Welche Laufbahn (Architektur oder Pharmazie), entscheidet die
// "Gestaltung" des aktiven Pakets - siehe RAENGE_NACH_GESTALTUNG und den
// gleichnamigen Mechanismus in stufen.js. Dieselben ab-Schwellen fuer
// beide Laufbahnen, damit sich der Aufstiegstakt nicht unterscheidet.
export const RAENGE_ARCH = [
  { ab: 1, name: 'Grundlagen' },
  { ab: 4, name: 'Vorpraktikum' },
  { ab: 8, name: 'Zeichner' },
  { ab: 13, name: 'Entwurfsverfasser' },
  { ab: 19, name: 'Werkplaner' },
  { ab: 26, name: 'Bauleiter' },
  { ab: 34, name: 'Projektleiter' },
  { ab: 45, name: 'Architekt' },
  { ab: 60, name: 'Prüfsachverständiger' },
  { ab: 80, name: 'Baumeister' },
]

export const RAENGE_PHARMA = [
  { ab: 1, name: 'Grundlagen' },
  { ab: 4, name: 'PTA-Praktikum' },
  { ab: 8, name: 'Rezeptar' },
  { ab: 13, name: 'Approbation' },
  { ab: 19, name: 'Stationsapotheker' },
  { ab: 26, name: 'Fachapotheker' },
  { ab: 34, name: 'Betriebsleiter' },
  { ab: 45, name: 'Apothekenleiter' },
  { ab: 60, name: 'Gutachter' },
  { ab: 80, name: 'Standesvertreter' },
]

const RAENGE_NACH_GESTALTUNG = { arch: RAENGE_ARCH, pharma: RAENGE_PHARMA }

// Rueckwaertskompatibel als Vorgabe, falls irgendwo (noch) ohne
// Gestaltung aufgerufen wird.
export const RAENGE = RAENGE_ARCH

export function raengeFuer(gestaltung = 'arch') {
  return RAENGE_NACH_GESTALTUNG[gestaltung] ?? RAENGE_ARCH
}

export function rangFuer(stufe, gestaltung = 'arch') {
  const raenge = raengeFuer(gestaltung)
  let treffer = raenge[0]
  for (const r of raenge) if (stufe >= r.ab) treffer = r
  return treffer
}

export function naechsterRang(stufe, gestaltung = 'arch') {
  return raengeFuer(gestaltung).find((r) => r.ab > stufe) ?? null
}

export const GRADE = ['neu', 'angelernt', 'sicher', 'gefestigt', 'gemeistert']

// Wurde die Referenzhilfe im Trainingsmodus genutzt, zaehlt das Item
// nur halb. Das steht im Ereignis, nicht in der Anzeige - sonst waere
// die Kuerzung beim naechsten Neuberechnen wieder verschwunden.
export function xpFuerEreignis(ereignis, item) {
  const grund = KONFIG.xp[ereignis.bewertung] ?? 0
  const faktor = punkteFuer(item) * KONFIG.xpJePunkt
  const hilfe = ereignis.hilfe ? 0.5 : 1
  return Math.round(grund * faktor * hilfe)
}

// XP einer Pruefung. Bewusst grosszuegig - eine Pruefung kostet
// Konzentration und ist der ehrlichste Test des Gelernten.
export function xpFuerPruefung(pruefung) {
  const grund = Math.round((pruefung.erreicht ?? 0) * KONFIG.xpJePruefungspunkt)
  return grund + (pruefung.bestanden ? KONFIG.xpPruefungBestanden : 0)
}

export function xpGesamt(ereignisse, items) {
  const nachId = new Map(items.map((i) => [i.id, i]))
  return ereignisse.reduce((summe, e) => summe + xpFuerEreignis(e, nachId.get(e.itemId)), 0)
}

export function beherrschungsgrad(zustand) {
  if (!zustand || zustand.gesamtAntworten === 0) return 'neu'
  const { intervall, gesamtAntworten, fehler } = zustand
  const quote = fehler / gesamtAntworten
  const g = KONFIG.beherrschung
  if (intervall >= g.gemeistert && quote < 0.3) return 'gemeistert'
  if (intervall >= g.gefestigt) return 'gefestigt'
  if (intervall >= g.sicher) return 'sicher'
  return 'angelernt'
}

// Fortschritt je Modul. Die Modulliste kommt aus dem Paket, damit auch
// Module ohne Inhalte sichtbar bleiben.
export function moduleAuswerten(module, items, zustaende) {
  const nachModul = new Map(
    module.map((m) => [
      m.id,
      { ...m, gesamt: 0, begonnen: 0, sicher: 0, faellig: 0, themen: new Set() },
    ])
  )

  for (const item of items) {
    const modul = nachModul.get(item.modulId)
    if (!modul) continue
    const zustand = zustaende.get(item.id)
    const grad = beherrschungsgrad(zustand)

    modul.gesamt += 1
    modul.themen.add(item.themaId)
    if (grad !== 'neu') modul.begonnen += 1
    if (GRADE.indexOf(grad) >= 2) modul.sicher += 1
    if (zustand && zustand.faelligAb <= Date.now()) modul.faellig += 1
  }

  return [...nachModul.values()].map((m) => ({
    ...m,
    themen: m.themen.size,
    anteil: m.gesamt ? m.sicher / m.gesamt : 0,
  }))
}

// Detailkarten: eine je Thema, freigeschaltet ueber Beherrschung.
// Das Bild der Karte ist der Detailschnitt des Themas.
export function kartenAuswerten(items, zustaende, themen = []) {
  const bilder = new Map(themen.map((t) => [t.id, t.bild]))
  const gruppen = new Map()

  for (const item of items) {
    if (!gruppen.has(item.themaId)) {
      gruppen.set(item.themaId, {
        id: item.themaId,
        titel: item.themaTitel,
        modulTitel: item.modulTitel,
        bild: bilder.get(item.themaId),
        gesamt: 0,
        sicher: 0,
        gemeistert: 0,
      })
    }
    const gruppe = gruppen.get(item.themaId)
    if (!gruppe.bild && item.referenz) gruppe.bild = item.referenz
    const grad = beherrschungsgrad(zustaende.get(item.id))
    gruppe.gesamt += 1
    if (GRADE.indexOf(grad) >= 2) gruppe.sicher += 1
    if (grad === 'gemeistert') gruppe.gemeistert += 1
  }

  return [...gruppen.values()].map((e) => {
    const anteil = e.gesamt ? e.sicher / e.gesamt : 0
    const meisterAnteil = e.gesamt ? e.gemeistert / e.gesamt : 0
    return {
      ...e,
      anteil,
      frei: anteil >= KONFIG.kartenSchwelle,
      rang: meisterAnteil >= 0.8 ? 'Meisterschaft' : anteil >= 0.95 ? 'Ausführung' : 'Entwurf',
    }
  })
}

// Serie in Tagen. Kulanztage werden je Kalendermonat gezaehlt - so,
// wie es die Beschriftung verspricht. Ein Fehltag im September zehrt
// also nicht am Vorrat des Augusts.
export function serieBerechnen(ereignisse) {
  if (ereignisse.length === 0) return { tage: 0, kulanzOffen: KONFIG.kulanztage }

  const tage = new Set(ereignisse.map((e) => new Date(e.ts).toDateString()))
  const verbrauchtJeMonat = new Map()
  let serie = 0

  const zeiger = new Date()
  zeiger.setHours(0, 0, 0, 0)

  for (let i = 0; i < 400; i++) {
    if (tage.has(zeiger.toDateString())) {
      serie += 1
    } else if (i > 0) {
      const monat = `${zeiger.getFullYear()}-${zeiger.getMonth()}`
      const schon = verbrauchtJeMonat.get(monat) ?? 0
      if (schon >= KONFIG.kulanztage) break
      verbrauchtJeMonat.set(monat, schon + 1)
    }
    zeiger.setTime(zeiger.getTime() - TAG)
  }

  const jetzt = new Date()
  const aktuellerMonat = `${jetzt.getFullYear()}-${jetzt.getMonth()}`
  const verbrauchtImMonat = verbrauchtJeMonat.get(aktuellerMonat) ?? 0

  return { tage: serie, kulanzOffen: KONFIG.kulanztage - verbrauchtImMonat }
}

// -------------------------------------------------------------- CSV-Export
//
// Ergaenzt den JSON-Rohexport (speicher.js exportieren()) um eine
// Tabellenform fuer eigene Auswertung in Excel/Calc. Semikolon als
// Trenner und ein BOM am Anfang, weil Excel unter Windows sonst weder
// die Spalten noch Umlaute richtig erkennt.
const BEWERTUNGSNAMEN = { 1: 'Nochmal', 2: 'Schwer', 3: 'Gut', 4: 'Leicht' }

function csvFeld(wert) {
  const text = wert === undefined || wert === null ? '' : String(wert)
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function csvAusEreignissen(ereignisse, items) {
  const nachId = new Map(items.map((i) => [i.id, i]))
  const kopf = [
    'Datum', 'Uhrzeit', 'Modul', 'Thema', 'ItemId', 'Frage',
    'Bewertung', 'DauerSekunden', 'Hilfe',
  ]
  const zeilen = [...ereignisse]
    .sort((a, b) => a.ts - b.ts)
    .map((e) => {
      const item = nachId.get(e.itemId)
      const datum = new Date(e.ts)
      return [
        datum.toLocaleDateString('de-DE'),
        datum.toLocaleTimeString('de-DE'),
        item?.modulTitel ?? '',
        item?.themaTitel ?? '',
        e.itemId,
        item?.frage ?? '',
        BEWERTUNGSNAMEN[e.bewertung] ?? e.bewertung,
        e.dauerMs ? Math.round(e.dauerMs / 1000) : '',
        e.hilfe ? 'ja' : '',
      ]
    })
  const text = [kopf, ...zeilen].map((zeile) => zeile.map(csvFeld).join(';')).join('\r\n')
  return `﻿${text}`
}

// Fortschritt je Thema, fuer Themenliste und Statistik.
export function themenAuswerten(items, zustaende) {
  const karte = new Map()
  for (const item of items) {
    if (!karte.has(item.themaId)) {
      karte.set(item.themaId, {
        id: item.themaId,
        titel: item.themaTitel,
        modulTitel: item.modulTitel,
        gesamt: 0,
        sicher: 0,
        faellig: 0,
        antworten: 0,
        fehler: 0,
      })
    }
    const eintrag = karte.get(item.themaId)
    const zustand = zustaende.get(item.id)
    eintrag.gesamt += 1
    if (GRADE.indexOf(beherrschungsgrad(zustand)) >= 2) eintrag.sicher += 1
    if (zustand && zustand.faelligAb <= Date.now()) eintrag.faellig += 1
    if (zustand) {
      eintrag.antworten += zustand.gesamtAntworten
      eintrag.fehler += zustand.fehler
    }
  }
  for (const e of karte.values()) {
    e.anteil = e.gesamt ? e.sicher / e.gesamt : 0
    e.trefferquote = e.antworten ? Math.round(((e.antworten - e.fehler) / e.antworten) * 100) : null
  }
  return karte
}

// Antworten je Tag fuer die Jahresansicht.
export function tagesverlauf(ereignisse, anzahlTage = 140) {
  const zaehler = new Map()
  for (const e of ereignisse) {
    const schluessel = new Date(e.ts).toDateString()
    zaehler.set(schluessel, (zaehler.get(schluessel) ?? 0) + 1)
  }

  const felder = []
  const zeiger = new Date()
  zeiger.setHours(0, 0, 0, 0)
  for (let i = 0; i < anzahlTage; i++) {
    felder.unshift({
      datum: new Date(zeiger),
      anzahl: zaehler.get(zeiger.toDateString()) ?? 0,
    })
    zeiger.setTime(zeiger.getTime() - TAG)
  }
  return felder
}

// Faellige Items der naechsten Tage - die Vorschau auf die Arbeitslast.
export function faelligkeitsvorschau(zustaende, tage = 7) {
  const felder = Array.from({ length: tage }, () => 0)
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)

  for (const zustand of zustaende.values()) {
    const abstand = Math.floor((zustand.faelligAb - heute.getTime()) / TAG)
    if (abstand < 0) felder[0] += 1
    else if (abstand < tage) felder[abstand] += 1
  }
  return felder
}

// Items mit den meisten Fehlern - der Uebungsstapel "Baustellen".
export function baustellen(items, zustaende, anzahl = 10) {
  return items
    .map((item) => ({ item, zustand: zustaende.get(item.id) }))
    .filter((e) => e.zustand && e.zustand.fehler > 0)
    .sort((a, b) => b.zustand.fehler - a.zustand.fehler)
    .slice(0, anzahl)
}

// Meilensteinkarten entstehen nicht durchs Lernen einzelner Themen,
// sondern durch Ausdauer, Breite und Bewaehrung. Jeder Eintrag nennt
// eine Kennzahl und ein Ziel - dadurch laesst sich auch der Weg
// dorthin anzeigen, nicht nur das Erreichen.
// Meilensteine geben XP - wenig genug, dass sie den taeglichen
// Fortschritt wuerzen und nicht ersetzen. Grosse Ziele geben mehr,
// aber gedeckelt.
export const MEILENSTEIN_XP_GRUND = 50

// Sieben Stufen je Meilenstein statt nur erreicht/nicht erreicht -
// jede Stufe braucht ein Vielfaches des urspruenglichen Ziels, damit
// es bis zur hoechsten Stufe bewusst sehr lange dauert. Farben/Namen
// sind feste Materialfarben, unabhaengig von der gewaehlten Palette
// (siehe .stempel.stufe-* in styles.css).
export const MEILENSTEIN_STUFEN = [
  { stufe: 1, name: 'Bronze', multiplikator: 1 },
  { stufe: 2, name: 'Silber', multiplikator: 2 },
  { stufe: 3, name: 'Gold', multiplikator: 5 },
  { stufe: 4, name: 'Platin', multiplikator: 10 },
  { stufe: 5, name: 'Saphir', multiplikator: 25 },
  { stufe: 6, name: 'Rubin', multiplikator: 50 },
  { stufe: 7, name: 'Diamant', multiplikator: 100 },
]

// Jede erreichte Stufe zaehlt einzeln (nicht nur die hoechste) - der
// Sprung von Bronze zu Silber soll sich in XP genauso lohnen wie jeder
// andere. m braucht stufe/ziele aus meilensteineAuswerten().
export function xpFuerMeilenstein(m) {
  if (!m?.stufe) return 0
  const ziele = m.ziele ?? zieleFuer(m)
  let summe = 0
  for (let i = 0; i < m.stufe; i++) {
    summe += MEILENSTEIN_XP_GRUND + Math.min(250, Math.round(ziele[i] * 0.5))
  }
  return summe
}

export function xpFuerMeilensteine(liste) {
  return (liste ?? [])
    .filter((m) => m.frei)
    .reduce((summe, m) => summe + xpFuerMeilenstein(m), 0)
}

// ︎ (Text-Darstellungs-Selektor) hinter jedem Zeichen - ohne das
// rendert z. B. Safari manche dieser Symbole (Zahnrad, Stern) farbig
// als Emoji statt als einfaches Linienzeichen wie die anderen.
export const MEILENSTEIN_SYMBOLE = {
  ausdauer: '◷︎',
  gewohnheit: '☼︎',
  menge: '▦︎',
  vielfalt: '◈︎',
  zeichnen: '✎︎',
  pruefung: '✓︎',
  beherrschung: '★︎',
  ordnung: '⊞︎',
}

export const MEILENSTEIN_GRUPPEN = {
  ausdauer: 'Ausdauer',
  gewohnheit: 'Gewohnheit',
  menge: 'Umfang',
  vielfalt: 'Vielfalt',
  zeichnen: 'Zeichnen',
  pruefung: 'Prüfungen',
  beherrschung: 'Beherrschung',
  ordnung: 'Ordnung',
}

// Felder je Meilenstein:
// - ziel: Bronze-Ziel; die weiteren Stufen sind Vielfache davon
//   (MEILENSTEIN_STUFEN.multiplikator).
// - ziele (optional): eigene Stufenziele statt der Vielfachen - fuer
//   Werte, bei denen x100 unsinnig waere. Weniger als sieben Eintraege =
//   weniger Stufen ([5] = nur Bronze).
// - deckel (optional): Kennzahl, die vom Umfang des Pakets begrenzt ist
//   ('items', 'themen', 'module', 'typen'). Stufen ueber dem Paketumfang
//   fallen weg, die letzte wird "alles" - sonst stuende z. B. "400 Items
//   sicher" bei einem Paket mit 337 Items. Waechst das Paket, wachsen
//   die Stufen mit (die oberste kann dann wieder offen sein).
export const MEILENSTEINE = [
  // Ausdauer
  { id: 'ms-serie-3', gruppe: 'ausdauer', titel: 'Drei Tage am Stück', feld: 'serie', ziel: 3 },
  { id: 'ms-serie-7', gruppe: 'ausdauer', titel: 'Eine Woche am Stück', feld: 'serie', ziel: 7 },
  { id: 'ms-serie-30', gruppe: 'ausdauer', titel: 'Ein Monat am Stück', feld: 'serie', ziel: 30 },
  { id: 'ms-serie-100', gruppe: 'ausdauer', titel: 'Hundert Tage am Stück', feld: 'serie', ziel: 100 },
  { id: 'ms-tage-30', gruppe: 'ausdauer', titel: 'Dreißig aktive Tage', feld: 'aktiveTage', ziel: 30 },
  { id: 'ms-tage-100', gruppe: 'ausdauer', titel: 'Hundert aktive Tage', feld: 'aktiveTage', ziel: 100 },
  { id: 'ms-zeit-600', gruppe: 'ausdauer', titel: 'Zehn Stunden gelernt', feld: 'minuten', ziel: 600, einheit: ' min' },
  { id: 'ms-zeit-3000', gruppe: 'ausdauer', titel: 'Fünfzig Stunden gelernt', feld: 'minuten', ziel: 3000, einheit: ' min' },
  { id: 'ms-langer-atem', gruppe: 'ausdauer', titel: 'Langer Atem', feld: 'langeBloecke', ziel: 3 },

  // Gewohnheit
  { id: 'ms-frueh', gruppe: 'gewohnheit', titel: 'Frühaufsteher', feld: 'fruehTage', ziele: [5, 10, 25, 50, 100, 200, 365] },
  { id: 'ms-nacht', gruppe: 'gewohnheit', titel: 'Nachteule', feld: 'nachtTage', ziele: [5, 10, 25, 50, 100, 200, 365] },
  { id: 'ms-wochenende', gruppe: 'gewohnheit', titel: 'Wochenendbaustelle', feld: 'wochenenden', ziele: [4, 8, 16, 26, 52, 104, 156] },
  { id: 'ms-rueckkehr', gruppe: 'gewohnheit', titel: 'Wieder an Bord', feld: 'rueckkehren', ziele: [1, 2, 3, 5, 8, 12, 20] },

  // Umfang
  { id: 'ms-antworten-100', gruppe: 'menge', titel: 'Hundert Antworten', feld: 'antworten', ziel: 100 },
  { id: 'ms-antworten-1000', gruppe: 'menge', titel: 'Tausend Antworten', feld: 'antworten', ziel: 1000 },
  { id: 'ms-antworten-5000', gruppe: 'menge', titel: 'Fünftausend Antworten', feld: 'antworten', ziel: 5000 },
  { id: 'ms-bester-tag', gruppe: 'menge', titel: 'Starker Tag', feld: 'besterTag', ziele: [50, 100, 150, 200, 300, 400, 500] },
  { id: 'ms-marathon', gruppe: 'menge', titel: 'Marathonläufer', feld: 'marathonAntworten', ziele: [200, 400, 1000, 2000, 4000, 7000, 10000] },
  { id: 'ms-schnell', gruppe: 'menge', titel: 'Schnelldenker', feld: 'schnellAntworten', ziel: 100 },
  // Die Stufen-Meilensteine bilden schon selbst eine Leiter - als
  // Vielfache gerechnet hiesse Diamant fuer "Stufe zehn" Stufe 1000.
  { id: 'ms-stufe-5', gruppe: 'menge', titel: 'Stufe fünf', feld: 'stufe', ziele: [5] },
  { id: 'ms-stufe-10', gruppe: 'menge', titel: 'Stufe zehn', feld: 'stufe', ziele: [10] },
  { id: 'ms-stufe-25', gruppe: 'menge', titel: 'Stufe fünfundzwanzig', feld: 'stufe', ziele: [25] },
  { id: 'ms-stufe-50', gruppe: 'menge', titel: 'Erstes Bauwerk fertig', feld: 'stufe', ziele: [50] },
  { id: 'ms-stufe-75', gruppe: 'menge', titel: 'Stadthaus im Rohbau', feld: 'stufe', ziele: [75] },
  { id: 'ms-stufe-100', gruppe: 'menge', titel: 'Zweites Bauwerk fertig', feld: 'stufe', ziele: [100] },
  // ^ Diese drei Titel erzaehlen konkret vom Architektur-Bauwerk - fuer
  // andere Gestaltungen (Pharmazie) ueberschrieben, siehe
  // MEILENSTEIN_TITEL_GESTALTUNG unten. Absichtlich nicht generisch
  // umformuliert: die Architektur-Formulierung bleibt fuer bestehende
  // Nutzer unveraendert (Vorgabe = "arch").
  { id: 'ms-xp-5000', gruppe: 'menge', titel: 'Fünftausend XP', feld: 'xp', ziel: 5000 },
  { id: 'ms-module-3', gruppe: 'menge', titel: 'Drei Module begonnen', feld: 'moduleBegonnen', ziel: 3, deckel: 'module' },

  // Vielfalt
  { id: 'ms-typen', gruppe: 'vielfalt', titel: 'Alleskönner', feld: 'typen', ziele: [3, 5, 7, 9, 11, 13], deckel: 'typen' },
  { id: 'ms-themen-besucht', gruppe: 'vielfalt', titel: 'Themenwanderer', feld: 'themenBesucht', ziel: 5, deckel: 'themen' },
  { id: 'ms-thema-komplett', gruppe: 'vielfalt', titel: 'Einmal komplett', feld: 'themenKomplett', ziel: 1, deckel: 'themen' },

  // Zeichnen
  { id: 'ms-skizze-1', gruppe: 'zeichnen', titel: 'Erste Zeichnung', feld: 'skizzen', ziel: 1 },
  { id: 'ms-skizze-10', gruppe: 'zeichnen', titel: 'Zehn Zeichnungen', feld: 'skizzen', ziel: 10 },
  { id: 'ms-skizze-50', gruppe: 'zeichnen', titel: 'Fünfzig Zeichnungen', feld: 'skizzen', ziel: 50 },
  { id: 'ms-skizze-100', gruppe: 'zeichnen', titel: 'Hundert Zeichnungen', feld: 'skizzen', ziel: 100 },
  { id: 'ms-ohne-hilfe', gruppe: 'zeichnen', titel: 'Ohne Spickzettel', feld: 'skizzenOhneHilfe', ziel: 10 },

  // Pruefungen
  { id: 'ms-pruefung-1', gruppe: 'pruefung', titel: 'Erste Prüfung', feld: 'pruefungen', ziel: 1 },
  { id: 'ms-pruefung-10', gruppe: 'pruefung', titel: 'Zehn Prüfungen', feld: 'pruefungen', ziel: 10 },
  { id: 'ms-pruefung-bestanden', gruppe: 'pruefung', titel: 'Erste bestandene Prüfung', feld: 'bestanden', ziel: 1 },
  { id: 'ms-pruefung-serie', gruppe: 'pruefung', titel: 'Fünf bestandene in Folge', feld: 'bestandenSerie', ziel: 5 },
  // Zaehlen Pruefungen ab 81 bzw. 92 % - frueher war die beste Prozentzahl
  // das Feld, dann hiesse Silber 162 %.
  { id: 'ms-pruefung-gut', gruppe: 'pruefung', titel: 'Mindestens gut geschrieben', feld: 'pruefungenGut', ziel: 1 },
  { id: 'ms-pruefung-sehrgut', gruppe: 'pruefung', titel: 'Sehr gut geschrieben', feld: 'pruefungenSehrGut', ziel: 1 },
  { id: 'ms-volle-punktzahl', gruppe: 'pruefung', titel: 'Volle Punktzahl', feld: 'pruefungenVoll', ziele: [1, 2, 3, 5, 10, 15, 25] },
  { id: 'ms-breit-geprueft', gruppe: 'pruefung', titel: 'Breit geprüft', feld: 'themenGeprueft', ziel: 3, deckel: 'themen' },

  // Beherrschung
  { id: 'ms-sicher-50', gruppe: 'beherrschung', titel: 'Fünfzig Items sicher', feld: 'sicher', ziel: 50, deckel: 'items' },
  { id: 'ms-sicher-200', gruppe: 'beherrschung', titel: 'Zweihundert Items sicher', feld: 'sicher', ziel: 200, deckel: 'items' },
  { id: 'ms-gemeistert-25', gruppe: 'beherrschung', titel: 'Fünfundzwanzig gemeistert', feld: 'gemeistert', ziel: 25, deckel: 'items' },
  { id: 'ms-langzeit', gruppe: 'beherrschung', titel: 'Langzeitgedächtnis', feld: 'langzeit', ziel: 10, deckel: 'items' },
  { id: 'ms-thema-1', gruppe: 'beherrschung', titel: 'Erstes Thema gemeistert', feld: 'gemeisterteThemen', ziel: 1, deckel: 'themen' },
  { id: 'ms-thema-5', gruppe: 'beherrschung', titel: 'Fünf Themen gemeistert', feld: 'gemeisterteThemen', ziel: 5, deckel: 'themen' },
  { id: 'ms-karten-5', gruppe: 'beherrschung', titel: 'Fünf Detailkarten', feld: 'detailkarten', ziel: 5, deckel: 'themen' },
  { id: 'ms-problem-geloest', gruppe: 'beherrschung', titel: 'Problem gelöst', feld: 'problemeGeloest', ziel: 3, deckel: 'items' },
  { id: 'ms-aus-fehlern', gruppe: 'beherrschung', titel: 'Aus Fehlern gelernt', feld: 'ausFehlern', ziel: 25, deckel: 'items' },
  { id: 'ms-trefferserie', gruppe: 'beherrschung', titel: 'Trefferserie', feld: 'trefferserie', ziel: 25 },
  { id: 'ms-fehlerfrei', gruppe: 'beherrschung', titel: 'Fehlerfreier Tag', feld: 'fehlerfreieTage', ziel: 3 },

  // Ordnung
  { id: 'ms-gesichtet-50', gruppe: 'ordnung', titel: 'Fünfzig Items gesichtet', feld: 'gesichtet', ziel: 50, deckel: 'items' },
  { id: 'ms-gesichtet-200', gruppe: 'ordnung', titel: 'Zweihundert gesichtet', feld: 'gesichtet', ziel: 200, deckel: 'items' },
  { id: 'ms-notizen-10', gruppe: 'ordnung', titel: 'Zehn eigene Notizen', feld: 'notizen', ziel: 10, deckel: 'items' },
  { id: 'ms-qualitaet', gruppe: 'ordnung', titel: 'Qualitätsprüfer', feld: 'meldungen', ziel: 5, deckel: 'items' },
  // Kann nur 0 oder 1 sein - als Vielfache gerechnet hiesse Diamant
  // "100 von 1".
  { id: 'ms-gesichert', gruppe: 'ordnung', titel: 'Fortschritt gesichert', feld: 'sicherungen', ziele: [1] },
]

// Nur die Meilensteine, die woertlich vom Architektur-Bauwerk erzaehlen,
// brauchen eine eigene Formulierung je Gestaltung - alle anderen Titel
// ("Hundert Antworten", "Zehn Zeichnungen", ...) sind fachneutral und
// bleiben unveraendert.
const MEILENSTEIN_TITEL_GESTALTUNG = {
  'ms-stufe-50': { pharma: 'Erste Charge fertig' },
  'ms-stufe-75': { pharma: 'Zweite Charge in Arbeit' },
  'ms-stufe-100': { pharma: 'Zweite Charge fertig' },
  'ms-wochenende': { pharma: 'Wochenendschicht' },
}

// Stufenziele eines Meilensteins, bei Bedarf auf den Paketumfang
// begrenzt (siehe "deckel" oben).
export function zieleFuer(m, umfang = {}) {
  const roh = m.ziele ?? MEILENSTEIN_STUFEN.map((s) => Math.max(1, Math.round(m.ziel * s.multiplikator)))
  const grenze = m.deckel ? umfang[m.deckel] : undefined
  if (grenze === undefined) return roh
  const max = Math.max(1, grenze)
  const unter = roh.filter((z) => z < max)
  return [...unter, max].slice(0, MEILENSTEIN_STUFEN.length)
}

// Alle Werte der neueren Meilensteine, die sich aus dem Ereignisprotokoll
// ergeben - einmal gerechnet, nicht je Meilenstein-Durchgang.
// ereignisse: Antworten, items: lernbare Items, zustaende: aus dem Planer.
export function meilensteinWerte(ereignisse, items, zustaende, pruefungen = []) {
  const sortiert = [...ereignisse].sort((a, b) => a.ts - b.ts)
  const richtig = (e) => e.bewertung !== BEWERTUNG.NOCHMAL
  const tagSchluessel = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const typVon = new Map(items.map((i) => [i.id, i.typ]))

  const fruehTage = new Set()
  const nachtTage = new Set()
  const jeTag = new Map() // Schluessel -> { anzahl, fehler, datum }
  let marathonAntworten = 0
  let schnellAntworten = 0
  let skizzenOhneHilfe = 0
  let trefferserie = 0
  let laufend = 0
  let langeBloecke = 0
  let blockStart = null
  let blockEnde = null
  const nochmalGesehen = new Set()
  const ausFehlern = new Set()

  for (const e of sortiert) {
    const d = new Date(e.ts)
    const tag = tagSchluessel(d)
    const stunde = d.getHours()
    if (stunde >= 4 && stunde < 8) fruehTage.add(tag)
    if (stunde >= 22 || stunde < 4) nachtTage.add(tag)
    if (!jeTag.has(tag)) jeTag.set(tag, { anzahl: 0, fehler: 0, datum: new Date(d.getFullYear(), d.getMonth(), d.getDate()) })
    const eintrag = jeTag.get(tag)
    eintrag.anzahl += 1
    if (!richtig(e)) eintrag.fehler += 1

    if (e.art === 'marathon') marathonAntworten += 1
    if (e.art === 'schnell') schnellAntworten += 1
    if (typVon.get(e.itemId) === 'skizze' && !e.hilfe && richtig(e)) skizzenOhneHilfe += 1

    laufend = richtig(e) ? laufend + 1 : 0
    trefferserie = Math.max(trefferserie, laufend)

    if (e.bewertung === BEWERTUNG.NOCHMAL) nochmalGesehen.add(e.itemId)
    else if (e.bewertung >= BEWERTUNG.GUT && nochmalGesehen.has(e.itemId)) ausFehlern.add(e.itemId)

    // Lernbloecke: Antworten mit hoechstens fuenf Minuten Abstand gehoeren
    // zusammen; ein Block zaehlt ab dreissig Minuten.
    const start = e.ts - (e.dauerMs ?? 0)
    if (blockEnde === null || start - blockEnde > 5 * 60000) {
      if (blockEnde !== null && blockEnde - blockStart >= 30 * 60000) langeBloecke += 1
      blockStart = start
    }
    blockEnde = e.ts
  }
  if (blockEnde !== null && blockEnde - blockStart >= 30 * 60000) langeBloecke += 1

  const tage = [...jeTag.values()].map((t) => t.datum).sort((a, b) => a - b)
  const tagNr = (d) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / TAG)
  const aktiv = new Set(tage.map(tagNr))
  let wochenenden = 0
  let rueckkehren = 0
  for (let i = 0; i < tage.length; i++) {
    if (tage[i].getDay() === 6 && aktiv.has(tagNr(tage[i]) + 1)) wochenenden += 1
    // Mindestens sieben Tage ohne Antwort dazwischen.
    if (i > 0 && tagNr(tage[i]) - tagNr(tage[i - 1]) > 7) rueckkehren += 1
  }

  const themen = new Map() // themaId -> { gesamt, gesehen }
  const typen = new Set()
  let problemeGeloest = 0
  let langzeit = 0
  for (const item of items) {
    const z = zustaende.get(item.id)
    if (!themen.has(item.themaId)) themen.set(item.themaId, { gesamt: 0, gesehen: 0 })
    const t = themen.get(item.themaId)
    t.gesamt += 1
    if (!z) continue
    t.gesehen += 1
    typen.add(item.typ)
    if ((z.fehler ?? 0) >= PROBLEM_SCHWELLE && (z.intervall ?? 0) >= 7) problemeGeloest += 1
    if ((z.intervall ?? 0) >= 180) langzeit += 1
  }

  const geprueft = new Set(
    pruefungen.filter((p) => p.bestanden && p.art === 'thema' && p.themaId).map((p) => p.themaId)
  )

  return {
    fruehTage: fruehTage.size,
    nachtTage: nachtTage.size,
    wochenenden,
    rueckkehren,
    langeBloecke,
    besterTag: Math.max(0, ...[...jeTag.values()].map((t) => t.anzahl)),
    fehlerfreieTage: [...jeTag.values()].filter((t) => t.anzahl >= 20 && t.fehler === 0).length,
    marathonAntworten,
    schnellAntworten,
    skizzenOhneHilfe,
    trefferserie,
    ausFehlern: ausFehlern.size,
    problemeGeloest,
    langzeit,
    typen: typen.size,
    themenBesucht: [...themen.values()].filter((t) => t.gesehen > 0).length,
    themenKomplett: [...themen.values()].filter((t) => t.gesamt > 0 && t.gesehen === t.gesamt).length,
    themenGeprueft: geprueft.size,
    pruefungenGut: pruefungen.filter((p) => (p.prozent ?? 0) >= 81).length,
    pruefungenSehrGut: pruefungen.filter((p) => (p.prozent ?? 0) >= 92).length,
    pruefungenVoll: pruefungen.filter((p) => (p.prozent ?? 0) >= 100).length,
  }
}

// umfang: { items, themen, module, typen } des aktiven Pakets, fuer die
// "deckel"-Meilensteine. Fehlt er, gelten die ungedeckelten Ziele.
export function meilensteineAuswerten(daten, gestaltung = 'arch', umfang = {}) {
  return MEILENSTEINE.map((m) => {
    const stand = daten[m.feld] ?? 0
    const ziele = zieleFuer(m, umfang)
    let stufe = 0
    for (const z of ziele) {
      if (stand < z) break
      stufe += 1
    }
    const maxStufe = stufe >= ziele.length
    const naechstesZiel = maxStufe ? null : ziele[stufe]
    const vorherigesZiel = stufe > 0 ? ziele[stufe - 1] : 0
    const anteil = maxStufe
      ? 1
      : Math.max(0, Math.min(1, (stand - vorherigesZiel) / (naechstesZiel - vorherigesZiel)))

    return {
      ...m,
      titel: MEILENSTEIN_TITEL_GESTALTUNG[m.id]?.[gestaltung] ?? m.titel,
      stand,
      ziele,
      stufe,
      maxStufe,
      // ziel bleibt fuer Abwaertskompatibilitaet das jeweils naechste
      // (noch nicht erreichte) Ziel - das letzte, sobald maximal.
      ziel: naechstesZiel ?? ziele[ziele.length - 1],
      anteil,
      frei: stufe > 0,
      beschreibung: maxStufe
        ? `Höchste Stufe (${MEILENSTEIN_STUFEN[ziele.length - 1].name}) erreicht`
        : `${naechstesZiel} für ${MEILENSTEIN_STUFEN[stufe].name}`,
    }
  })
}

// Wochenbericht: die letzten sieben Tage gegen die sieben davor.
export function wochenbericht(ereignisse) {
  const jetzt = Date.now()
  const woche = 7 * TAG
  const diese = ereignisse.filter((e) => e.ts > jetzt - woche)
  const letzte = ereignisse.filter((e) => e.ts > jetzt - 2 * woche && e.ts <= jetzt - woche)

  const auswerten = (liste) => ({
    antworten: liste.length,
    minuten: Math.round(liste.reduce((s, e) => s + (e.dauerMs ?? 0), 0) / 60000),
    tage: new Set(liste.map((e) => new Date(e.ts).toDateString())).size,
    trefferquote: liste.length
      ? Math.round((liste.filter((e) => e.bewertung !== BEWERTUNG.NOCHMAL).length / liste.length) * 100)
      : null,
  })

  return { diese: auswerten(diese), letzte: auswerten(letzte) }
}

// --- Auswertungen fuer den Fortschrittsbildschirm -----------------

// Laengste je erreichte Serie, unabhaengig von der aktuellen.
export function laengsteSerie(ereignisse) {
  const tage = [...new Set(ereignisse.map((e) => new Date(e.ts).toDateString()))]
    .map((t) => new Date(t).setHours(0, 0, 0, 0))
    .sort((a, b) => a - b)

  let beste = 0
  let laufend = 0
  let vorher = null
  for (const tag of tage) {
    laufend = vorher !== null && tag - vorher === TAG ? laufend + 1 : 1
    beste = Math.max(beste, laufend)
    vorher = tag
  }
  return beste
}

// Verteilung der Antworten ueber den Tag, in vier Zeitfenstern.
export function tageszeiten(ereignisse) {
  const fenster = [
    { id: 'nacht', name: 'Nachts', von: 0, bis: 6, anzahl: 0 },
    { id: 'morgen', name: 'Morgens', von: 6, bis: 12, anzahl: 0 },
    { id: 'nachmittag', name: 'Nachmittags', von: 12, bis: 18, anzahl: 0 },
    { id: 'abend', name: 'Abends', von: 18, bis: 24, anzahl: 0 },
  ]
  for (const e of ereignisse) {
    const stunde = new Date(e.ts).getHours()
    const treffer = fenster.find((f) => stunde >= f.von && stunde < f.bis)
    if (treffer) treffer.anzahl += 1
  }
  return fenster
}

// Trefferquote je Itemtyp - zeigt, welche Aufgabenart schwerfaellt.
export function typStatistik(items, ereignisse) {
  const nachId = new Map(items.map((i) => [i.id, i]))
  const karte = new Map()
  for (const e of ereignisse) {
    const item = nachId.get(e.itemId)
    if (!item) continue
    if (!karte.has(item.typ)) karte.set(item.typ, { typ: item.typ, antworten: 0, richtig: 0 })
    const eintrag = karte.get(item.typ)
    eintrag.antworten += 1
    if (e.bewertung !== BEWERTUNG.NOCHMAL) eintrag.richtig += 1
  }
  return [...karte.values()]
    .map((e) => ({ ...e, quote: Math.round((e.richtig / e.antworten) * 100) }))
    .sort((a, b) => b.antworten - a.antworten)
}

// Bestwerte - die kleinen Rekorde, auf die man hinarbeiten kann.
export function rekorde(ereignisse) {
  const jeTag = new Map()
  for (const e of ereignisse) {
    const tag = new Date(e.ts).toDateString()
    if (!jeTag.has(tag)) jeTag.set(tag, { anzahl: 0, dauer: 0 })
    const eintrag = jeTag.get(tag)
    eintrag.anzahl += 1
    eintrag.dauer += e.dauerMs ?? 0
  }

  let besterTag = { anzahl: 0, datum: null }
  let laengsterTag = { minuten: 0, datum: null }
  for (const [tag, wert] of jeTag) {
    if (wert.anzahl > besterTag.anzahl) besterTag = { anzahl: wert.anzahl, datum: tag }
    const minuten = Math.round(wert.dauer / 60000)
    if (minuten > laengsterTag.minuten) laengsterTag = { minuten, datum: tag }
  }

  const gesamtMinuten = Math.round(
    ereignisse.reduce((s, e) => s + (e.dauerMs ?? 0), 0) / 60000
  )

  return {
    besterTag,
    laengsterTag,
    aktiveTage: jeTag.size,
    gesamtMinuten,
    laengsteSerie: laengsteSerie(ereignisse),
    schnitt: jeTag.size ? Math.round(ereignisse.length / jeTag.size) : 0,
  }
}

// Grobe Vorausschau: Wie lange dauert es beim aktuellen Tempo, bis
// alle Items mindestens sicher sitzen?
export function prognose(items, zustaende, ereignisse) {
  const sicher = items.filter(
    (i) => GRADE.indexOf(beherrschungsgrad(zustaende.get(i.id))) >= 2
  ).length
  const offen = items.length - sicher

  const vierWochen = ereignisse.filter((e) => e.ts > Date.now() - 28 * TAG)
  const neueProWoche =
    new Set(vierWochen.map((e) => e.itemId)).size / 4 || 0

  return {
    sicher,
    offen,
    anteil: items.length ? sicher / items.length : 0,
    wochen: neueProWoche > 0 ? Math.ceil(offen / neueProWoche) : null,
  }
}

export { BEWERTUNG }
