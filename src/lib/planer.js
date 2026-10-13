// Ableitung des Lernzustands aus dem Ereignisprotokoll.
//
// Diese Datei ist die einzige Stelle mit Algorithmuswissen. Seit
// 2026-10-10 rechnet sie mit FSRS (Bibliothek ts-fsrs, Referenz-
// implementierung der open-spaced-repetition-Gruppe, Version fest
// eingetragen) statt mit SM-2. Die Ereignisse bleiben unveraendert - dort
// stehen nur Rohdaten (wann wurde was wie bewertet), der Zustand wird bei
// jedem Start daraus neu berechnet. Ein Wechsel des Verfahrens braucht
// deshalb keine Datenmigration.
//
// Nach aussen bleibt die Form des Zustands gleich (intervall in Tagen,
// faelligAb, fehler, gesamtAntworten, zuletzt) - Fortschritt, Pruefungen,
// Beherrschungsgrade lesen nur diese Felder.

import { createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs'

export const BEWERTUNG = {
  NOCHMAL: 1,
  SCHWER: 2,
  GUT: 3,
  LEICHT: 4,
}


// Fuer die Planung zaehlt nur die ERSTE Bewertung einer Karte am Tag -
// in allen Betriebsarten (2026-10-10 nur Uebungsmodi, seit 2026-10-12
// ueberall, Nutzerentscheidung). Sie misst, ob die Karte wirklich sass;
// ein "Gut" beim zweiten Versuch nach "Nochmal" ist nur Kurzzeit-
// gedaechtnis, und jedes weitere "Nochmal" bestrafte die Karte erneut.
// XP und Statistik zaehlen weiter jede Antwort.

export const ZIEL_BEHALTENSRATE_STANDARD = 0.9

// Eigene FSRS-Gewichte (L7, 2026-10-13): mit Einspielen/fsrs_anpassen.py
// aus den eigenen Antworten berechnet und in den Einstellungen eingetragen.
// Nur eine vollstaendige Liste von 21 Zahlen (FSRS-6, ts-fsrs 5) zaehlt,
// sonst gelten die Standardgewichte.
export function gueltigeGewichte(gewichte) {
  return Array.isArray(gewichte) && gewichte.length === 21 && gewichte.every((w) => Number.isFinite(w))
    ? gewichte
    : null
}

const planerCache = new Map()
function planer(zielBehaltensrate = ZIEL_BEHALTENSRATE_STANDARD, gewichte = null) {
  const w = gueltigeGewichte(gewichte)
  const schluessel = `${zielBehaltensrate}|${w ? w.join(',') : 'standard'}`
  if (!planerCache.has(schluessel)) {
    planerCache.set(
      schluessel,
      fsrs(
        generatorParameters({
          request_retention: zielBehaltensrate,
          ...(w ? { w } : {}),
          // Keine Lernschritte im Minutenbereich: das Wiederholen am selben
          // Tag erledigt die Sitzung selbst ("Nochmal" haengt die Karte ans
          // Ende). Ohne Zufallsstreuung, damit Vorschau und Planung
          // uebereinstimmen und Tests reproduzierbar sind.
          enable_short_term: false,
          enable_fuzz: false,
        })
      )
    )
  }
  return planerCache.get(schluessel)
}

function tagesSchluessel(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function zustandAusKarte(karte, extra) {
  return {
    intervall: karte.scheduled_days,
    faelligAb: karte.due.getTime(),
    stabilitaet: karte.stability,
    schwierigkeit: karte.difficulty,
    wiederholungen: karte.reps,
    karte,
    ...extra,
  }
}

// Baut je Item den aktuellen Zustand auf. Ereignisse muessen nach
// Zeit sortiert uebergeben werden.
export function zustaendeBerechnen(ereignisse, { zielBehaltensrate, gewichte } = {}) {
  const f = planer(zielBehaltensrate, gewichte)
  const zustaende = new Map()
  const geplantAmTag = new Set() // `${itemId}|${tag}` - erste Bewertung des Tages

  for (const e of ereignisse) {
    const vorher = zustaende.get(e.itemId)
    const tag = tagesSchluessel(e.ts)
    const schluessel = `${e.itemId}|${tag}`
    const zaehltFuerPlan = !geplantAmTag.has(schluessel)

    let karte = vorher?.karte ?? createEmptyCard(new Date(e.ts))
    if (zaehltFuerPlan && e.bewertung >= 1 && e.bewertung <= 4) {
      // Ein Ereignis darf zeitlich nicht vor der letzten Wiederholung
      // liegen (Uhrabweichung zwischen Geraeten) - dann auf diese ziehen.
      const zeit = new Date(Math.max(e.ts, karte.last_review?.getTime() ?? 0))
      karte = f.next(karte, zeit, e.bewertung).card
      geplantAmTag.add(schluessel)
    }

    zustaende.set(
      e.itemId,
      zustandAusKarte(karte, {
        zuletzt: e.ts,
        gesamtAntworten: (vorher?.gesamtAntworten ?? 0) + 1,
        fehler: (vorher?.fehler ?? 0) + (e.bewertung === BEWERTUNG.NOCHMAL ? 1 : 0),
      })
    )
  }

  return zustaende
}

// Vorhergesagte Behaltenswahrscheinlichkeit (0..1) einer Karte zu einem
// Zeitpunkt - fuer die Klausurreife (kurs.js). Neue Karte = 0.
export function retrievabilityAm(karte, zeitpunkt, gewichte = null) {
  if (!karte?.last_review || !(karte.stability > 0)) return 0
  return planer(ZIEL_BEHALTENSRATE_STANDARD, gewichte).get_retrievability(karte, new Date(zeitpunkt), false)
}

// Kalibrierung (F6/L7, 2026-10-13): Fuer jede planungswirksame
// Wiederholung (erste Bewertung des Tages einer schon bekannten Karte) die
// vorhergesagte Behaltenswahrscheinlichkeit p und ob die Karte tatsaechlich
// gewusst wurde (alles ausser "Nochmal"). Daraus ergibt sich die echte
// Behaltensrate (wie "True Retention" in Anki) neben der Vorhersage.
export function wiederholungenBewerten(ereignisse, { zielBehaltensrate, gewichte } = {}) {
  const f = planer(zielBehaltensrate, gewichte)
  const karten = new Map()
  const geplantAmTag = new Set()
  const ergebnis = []
  for (const e of ereignisse) {
    if (!(e.bewertung >= 1 && e.bewertung <= 4)) continue
    const schluessel = `${e.itemId}|${tagesSchluessel(e.ts)}`
    if (geplantAmTag.has(schluessel)) continue
    geplantAmTag.add(schluessel)
    let karte = karten.get(e.itemId) ?? createEmptyCard(new Date(e.ts))
    const zeit = new Date(Math.max(e.ts, karte.last_review?.getTime() ?? 0))
    if (karte.last_review && karte.stability > 0) {
      ergebnis.push({
        itemId: e.itemId,
        ts: e.ts,
        p: f.get_retrievability(karte, zeit, false),
        gewusst: e.bewertung !== BEWERTUNG.NOCHMAL,
      })
    }
    karte = f.next(karte, zeit, e.bewertung).card
    karten.set(e.itemId, karte)
  }
  return ergebnis
}

// Zusammenfassung einer Liste aus wiederholungenBewerten.
export function behaltensrate(liste) {
  if (liste.length === 0) return { anzahl: 0, tatsaechlich: null, vorhergesagt: null }
  const gewusst = liste.filter((w) => w.gewusst).length
  const p = liste.reduce((summe, w) => summe + w.p, 0)
  return { anzahl: liste.length, tatsaechlich: gewusst / liste.length, vorhergesagt: p / liste.length }
}

// Vorschau fuer die Bewertungsknoepfe: welches Intervall (in Tagen)
// ergaebe jede Bewertung jetzt? zustand darf fehlen (neue Karte).
export function intervallVorschau(zustand, { zielBehaltensrate, gewichte, jetzt = Date.now() } = {}) {
  const f = planer(zielBehaltensrate, gewichte)
  const karte = zustand?.karte ?? createEmptyCard(new Date(jetzt))
  const zeit = new Date(Math.max(jetzt, karte.last_review?.getTime() ?? 0))
  const ergebnis = {}
  for (const b of [BEWERTUNG.NOCHMAL, BEWERTUNG.SCHWER, BEWERTUNG.GUT, BEWERTUNG.LEICHT]) {
    ergebnis[b] = f.next(karte, zeit, b).card.scheduled_days
  }
  return ergebnis
}

// Wurde die Karte heute schon bewertet? Dann aendert eine weitere
// Bewertung die Planung nicht mehr (siehe zustaendeBerechnen).
export function heuteBewertet(zustand, jetzt = Date.now()) {
  return zustand?.zuletzt !== undefined && tagesSchluessel(zustand.zuletzt) === tagesSchluessel(jetzt)
}

// Karten, deren letzte Bewertung HEUTE "Nochmal" war - die Liste
// "Heute nicht gewusst" auf dem Heute-Bildschirm. Wer sie spaeter am Tag
// doch noch richtig hat, faellt wieder heraus. Neueste zuerst.
export function heuteNichtGewusst(ereignisse, jetzt = Date.now()) {
  const heute = tagesSchluessel(jetzt)
  const letzte = new Map()
  for (const e of ereignisse) {
    if (tagesSchluessel(e.ts) !== heute) continue
    const vorher = letzte.get(e.itemId)
    if (!vorher || e.ts >= vorher.ts) letzte.set(e.itemId, e)
  }
  return [...letzte.values()]
    .filter((e) => e.bewertung === BEWERTUNG.NOCHMAL)
    .sort((a, b) => b.ts - a.ts)
    .map((e) => e.itemId)
}

// "Nochmal" haengt eine Karte nur EINMAL pro Sitzung erneut ans Ende
// (Nutzerentscheidung 2026-10-12). Wer sie auch beim zweiten Mal nicht
// weiss, sieht sie erst wieder, wenn FSRS sie faellig stellt - sonst
// konnte eine Sitzung mit einer unbekannten Karte endlos laufen.
// Wiederholung = dieselbe Karte stand in dieser Sitzung schon frueher.
export function istWiederholung(pensum, position) {
  const id = pensum[position]?.id
  return id !== undefined && pensum.slice(0, position).some((i) => i.id === id)
}

export function pensumNachNochmal(pensum, position) {
  if (istWiederholung(pensum, position)) return pensum
  return [...pensum, pensum[position]]
}

// "4 T.", "3 Mon.", "1,2 J." - kurz genug fuer die Bewertungsknoepfe.
export function intervallKurz(tage) {
  if (tage < 1) return 'heute'
  if (tage < 31) return `${tage} T.`
  if (tage < 365) return `${Math.round(tage / 30.4)} Mon.`
  return `${(tage / 365).toLocaleString('de-DE', { maximumFractionDigits: 1 })} J.`
}

// Tagespensum: faellige Wiederholungen zuerst, dann neue Items bis zum
// Limit. Die Reihenfolge ist bewusst nicht zufaellig, sondern nach
// Faelligkeit sortiert, damit lange Ueberfaellige nicht liegenbleiben.
export function pensumBauen(
  items,
  zustaende,
  { neuProTag = 6, maxProTag = 30, auffrischungAnteil = 0.12 } = {}
) {
  const jetzt = Date.now()
  const faellig = []
  const neu = []
  const sitzt = []

  for (const item of items) {
    const zustand = zustaende.get(item.id)
    if (!zustand) neu.push(item)
    else if (zustand.faelligAb <= jetzt) faellig.push({ item, faelligAb: zustand.faelligAb })
    else if (zustand.intervall >= 21) sitzt.push(item)
  }

  faellig.sort((a, b) => a.faelligAb - b.faelligAb)

  // Obergrenze gilt auch fuer Faellige (Nutzerentscheidung 2026-10-10):
  // nach einer Pause kommen hoechstens maxProTag, die am laengsten
  // ueberfaelligen zuerst; der Rest wartet bis morgen. Neue Karten
  // pausieren automatisch, solange so ein Rueckstand besteht (dann bleibt
  // unten kein Platz).
  const pensum = faellig.slice(0, maxProTag).map((f) => f.item)
  const aufgeschoben = Math.max(0, faellig.length - pensum.length)
  const platz = Math.max(0, maxProTag - pensum.length)
  const neueItems = neu.slice(0, Math.min(neuProTag, platz))
  pensum.push(...neueItems)

  // Auffrischung: einige laengst sichere Items kommen trotzdem dran.
  // Ohne das verschwindet gut Gelerntes fuer Monate aus dem Blick und
  // faellt dann unangenehm auf einmal wieder an.
  const restPlatz = Math.max(0, maxProTag - pensum.length)
  const anzahlAuffrischung = Math.min(
    restPlatz,
    Math.round((pensum.length || 1) * auffrischungAnteil)
  )
  if (anzahlAuffrischung > 0 && sitzt.length > 0) {
    const gemischt = [...sitzt].sort(() => Math.random() - 0.5)
    pensum.push(...gemischt.slice(0, anzahlAuffrischung))
  }

  return {
    pensum,
    // Was davon tatsaechlich heute im Pensum steckt (Heute zeigte frueher
    // "43 neu", gemeint war neuGesamt - alle je ungesehenen Items).
    neuImPensum: neueItems.length,
    aufgeschoben,
    wiederholungImPensum: pensum.length - neueItems.length,
    faelligGesamt: faellig.length,
    neuGesamt: neu.length,
    auffrischung: Math.min(anzahlAuffrischung, sitzt.length),
  }
}

export function statistik(ereignisse, zustaende) {
  const heuteBeginn = new Date()
  heuteBeginn.setHours(0, 0, 0, 0)

  const heute = ereignisse.filter((e) => e.ts >= heuteBeginn.getTime())
  const richtig = ereignisse.filter((e) => e.bewertung !== BEWERTUNG.NOCHMAL).length

  return {
    antwortenHeute: heute.length,
    lernzeitHeuteMin: Math.round(heute.reduce((s, e) => s + (e.dauerMs ?? 0), 0) / 60000),
    antwortenGesamt: ereignisse.length,
    trefferquote: ereignisse.length ? Math.round((richtig / ereignisse.length) * 100) : null,
    itemsBegonnen: zustaende.size,
  }
}
