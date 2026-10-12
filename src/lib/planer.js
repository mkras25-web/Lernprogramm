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


// Uebungsmodi: zaehlen fuer XP und Statistik voll, fuer die Planung aber
// hoechstens einmal pro Karte und Tag (Nutzerentscheidung 2026-10-10).
// Vorher schob z. B. fuenfmal "Gut" im Marathon eine Karte Monate weit.
export const UEBUNGSARTEN = ['marathon', 'schnell', 'fehlerstapel', 'endspurt']

export const ZIEL_BEHALTENSRATE_STANDARD = 0.9

const planerCache = new Map()
function planer(zielBehaltensrate = ZIEL_BEHALTENSRATE_STANDARD) {
  if (!planerCache.has(zielBehaltensrate)) {
    planerCache.set(
      zielBehaltensrate,
      fsrs(
        generatorParameters({
          request_retention: zielBehaltensrate,
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
  return planerCache.get(zielBehaltensrate)
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
export function zustaendeBerechnen(ereignisse, { zielBehaltensrate } = {}) {
  const f = planer(zielBehaltensrate)
  const zustaende = new Map()
  const geplantAmTag = new Set() // `${itemId}|${tag}` - fuer die Uebungsregel

  for (const e of ereignisse) {
    const vorher = zustaende.get(e.itemId)
    const tag = tagesSchluessel(e.ts)
    const schluessel = `${e.itemId}|${tag}`
    const istUebung = UEBUNGSARTEN.includes(e.art)
    const zaehltFuerPlan = !istUebung || !geplantAmTag.has(schluessel)

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
export function retrievabilityAm(karte, zeitpunkt) {
  if (!karte?.last_review || !(karte.stability > 0)) return 0
  return planer().get_retrievability(karte, new Date(zeitpunkt), false)
}

// Vorschau fuer die Bewertungsknoepfe: welches Intervall (in Tagen)
// ergaebe jede Bewertung jetzt? zustand darf fehlen (neue Karte).
export function intervallVorschau(zustand, { zielBehaltensrate, jetzt = Date.now() } = {}) {
  const f = planer(zielBehaltensrate)
  const karte = zustand?.karte ?? createEmptyCard(new Date(jetzt))
  const zeit = new Date(Math.max(jetzt, karte.last_review?.getTime() ?? 0))
  const ergebnis = {}
  for (const b of [BEWERTUNG.NOCHMAL, BEWERTUNG.SCHWER, BEWERTUNG.GUT, BEWERTUNG.LEICHT]) {
    ergebnis[b] = f.next(karte, zeit, b).card.scheduled_days
  }
  return ergebnis
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
