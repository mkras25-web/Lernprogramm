// Ableitung des Lernzustands aus dem Ereignisprotokoll.
//
// Diese Datei ist die einzige Stelle mit Algorithmuswissen. Ein Wechsel
// auf FSRS tauscht sie aus; die Ereignisse bleiben unveraendert, weil
// dort nur Rohdaten stehen: wann wurde was wie bewertet.

export const BEWERTUNG = {
  NOCHMAL: 1,
  SCHWER: 2,
  GUT: 3,
  LEICHT: 4,
}

const TAG = 24 * 60 * 60 * 1000
const LEICHTIGKEIT_START = 2.5
const LEICHTIGKEIT_MIN = 1.3

// SM-2 mit zwei Lernschritten. Rueckgabe in Tagen.
function naechstesIntervall(zustand, bewertung) {
  let { intervall, leichtigkeit, wiederholungen } = zustand

  if (bewertung === BEWERTUNG.NOCHMAL) {
    return {
      intervall: 0,
      leichtigkeit: Math.max(LEICHTIGKEIT_MIN, leichtigkeit - 0.2),
      wiederholungen: 0,
    }
  }

  const anpassung = { 2: -0.15, 3: 0, 4: 0.15 }[bewertung] ?? 0
  leichtigkeit = Math.max(LEICHTIGKEIT_MIN, leichtigkeit + anpassung)

  if (wiederholungen === 0) intervall = 1
  else if (wiederholungen === 1) intervall = bewertung === BEWERTUNG.LEICHT ? 5 : 3
  else intervall = Math.round(intervall * leichtigkeit)

  if (bewertung === BEWERTUNG.SCHWER) intervall = Math.max(1, Math.round(intervall * 0.7))

  return { intervall, leichtigkeit, wiederholungen: wiederholungen + 1 }
}

// Baut je Item den aktuellen Zustand auf. Ereignisse muessen nach
// Zeit sortiert uebergeben werden.
export function zustaendeBerechnen(ereignisse) {
  const zustaende = new Map()

  for (const e of ereignisse) {
    const vorher = zustaende.get(e.itemId) ?? {
      intervall: 0,
      leichtigkeit: LEICHTIGKEIT_START,
      wiederholungen: 0,
      gesamtAntworten: 0,
      fehler: 0,
    }
    const nachher = naechstesIntervall(vorher, e.bewertung)
    zustaende.set(e.itemId, {
      ...nachher,
      faelligAb: e.ts + nachher.intervall * TAG,
      zuletzt: e.ts,
      gesamtAntworten: vorher.gesamtAntworten + 1,
      fehler: vorher.fehler + (e.bewertung === BEWERTUNG.NOCHMAL ? 1 : 0),
    })
  }

  return zustaende
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

  const pensum = faellig.map((f) => f.item)
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
