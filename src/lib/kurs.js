// Kurse und Klausurvorbereitung (2026-10-12).
//
// Ein Kurs ist eine eigene Sammlung von Fragen (z. B. ein Unikurs). Die
// Fragen bleiben im Gesamtpool und lernen dort normal mit - die
// Kursmarke ist nur ein Filter. Zugehoerigkeit steht in der Marke der
// Frage (marke.kurse = [kursId, ...]), die Kurse selbst und die
// Klausurtermine im Kursplan (speicher.js). Der Web-Chat kann Fragen mit
// dem Itemfeld "kurse": ["<kennung>"] als kursrelevant VORSCHLAGEN; in
// den Kurs kommen sie erst, wenn man sie uebernimmt.
//
// Alles hier ist rein rechnend (keine Speicherzugriffe) und getestet
// (kurs.test.js).

import { BEWERTUNG, retrievabilityAm } from './planer.js'

const TAG = 24 * 60 * 60 * 1000

// Ab dieser vorhergesagten Behaltenswahrscheinlichkeit am Klausurtag gilt
// eine Frage als klausurreif (zusaetzlich zur strengen Regel unten).
export const KURS_ZIEL_STANDARD = 0.95
// So viele Tage vor der Klausur kommen Fragen, die FSRS erst nach dem
// Termin wieder zeigen wuerde, vorgezogen dran.
export const VORZIEH_FENSTER = 7
// Neue Fragen sollen bis zu diesem Abstand vor der Klausur eingefuehrt
// sein, damit sie noch mindestens einmal wiederholt werden.
export const NEU_PUFFER = 3

export function istImKurs(marke, kursId) {
  return Array.isArray(marke?.kurse) && marke.kurse.includes(kursId)
}

export function kursItems(items, marken, kursId) {
  return items.filter((i) => istImKurs(marken.get(i.id), kursId))
}

// Marken-Aenderung fuer "Frage in den Kurs / aus dem Kurs". Entfernen
// einer vorgeschlagenen Frage merkt sich die Abwahl, damit "Vorschlaege
// uebernehmen" sie nicht wieder hineinholt. null loescht das Feld.
export function kursAenderung(marke, kursId, rein) {
  const kurse = new Set(marke?.kurse ?? [])
  const abgewaehlt = new Set(marke?.kurseAbgewaehlt ?? [])
  if (rein) {
    kurse.add(kursId)
    abgewaehlt.delete(kursId)
  } else {
    kurse.delete(kursId)
    abgewaehlt.add(kursId)
  }
  return {
    kurse: kurse.size ? [...kurse] : null,
    kurseAbgewaehlt: abgewaehlt.size ? [...abgewaehlt] : null,
  }
}

// Kurs-Kennungen, die im Inhalt vorkommen (Itemfeld "kurse"), mit Anzahl -
// zur Auswahl beim Anlegen eines Kurses statt freier Eingabe.
export function kennungenImInhalt(items) {
  const zaehler = new Map()
  for (const i of items) {
    for (const k of Array.isArray(i.kurse) ? i.kurse : []) {
      if (typeof k === 'string' && k) zaehler.set(k, (zaehler.get(k) ?? 0) + 1)
    }
  }
  return zaehler
}

// Vom Inhalt vorgeschlagen, noch nicht im Kurs und nicht abgewaehlt.
export function vorschlaege(items, marken, kurs) {
  if (!kurs?.kennung) return []
  return items.filter((i) => {
    if (!Array.isArray(i.kurse) || !i.kurse.includes(kurs.kennung)) return false
    const m = marken.get(i.id)
    return !istImKurs(m, kurs.id) && !(m?.kurseAbgewaehlt ?? []).includes(kurs.id)
  })
}

function tagesBeginn(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Naechste anstehende Klausur eines Kurses (heute zaehlt noch).
export function naechsteKlausur(kursId, klausuren, jetzt = Date.now()) {
  const heute = tagesBeginn(jetzt)
  return (klausuren ?? [])
    .filter((k) => k.kursId === kursId && k.datum)
    .map((k) => ({ ...k, zeit: new Date(`${k.datum}T00:00`).getTime() }))
    .filter((k) => k.zeit >= heute)
    .sort((a, b) => a.zeit - b.zeit)[0] ?? null
}

export function tageBis(klausur, jetzt = Date.now()) {
  return Math.round((new Date(`${klausur.datum}T00:00`).getTime() - tagesBeginn(jetzt)) / TAG)
}

// Strenge Regel gegen Kurzzeitgedaechtnis: die letzten zwei Antworten
// mindestens "Gut", und nicht beide am selben Tag.
export function strengSicher(antworten) {
  const letzte = antworten.slice(-2)
  if (letzte.length < 2) return false
  if (letzte.some((e) => e.bewertung < BEWERTUNG.GUT)) return false
  return tagesBeginn(letzte[0].ts) !== tagesBeginn(letzte[1].ts)
}

function antwortenJeItem(ereignisse) {
  const karte = new Map()
  for (const e of [...ereignisse].sort((a, b) => a.ts - b.ts)) {
    if (!karte.has(e.itemId)) karte.set(e.itemId, [])
    karte.get(e.itemId).push(e)
  }
  return karte
}

// Klausurreife je Frage. Zeitpunkt: Klausurtag (Beginn), ohne Klausur
// "jetzt". Liefert { eintraege: [{ item, r, streng, sicher }], sicher,
// gesamt, anteil, zeitpunkt }.
export function klausurreife(items, zustaende, ereignisse, { zeitpunkt = Date.now(), ziel = KURS_ZIEL_STANDARD } = {}) {
  const jeItem = antwortenJeItem(ereignisse)
  const eintraege = items.map((item) => {
    const z = zustaende.get(item.id)
    const r = z?.karte ? retrievabilityAm(z.karte, zeitpunkt) : 0
    const streng = strengSicher(jeItem.get(item.id) ?? [])
    return { item, r, streng, sicher: r >= ziel && streng }
  })
  const sicher = eintraege.filter((e) => e.sicher).length
  return {
    eintraege,
    sicher,
    gesamt: eintraege.length,
    anteil: eintraege.length ? sicher / eintraege.length : 0,
    zeitpunkt,
  }
}

// Tagesportion fuer den Kurs. Regeln (bewusst einfach):
// 1. Faellige Kursfragen (normale FSRS-Faelligkeit) - immer.
// 2. Vorziehen: in den letzten VORZIEH_FENSTER Tagen vor der Klausur die
//    Fragen, die FSRS erst nach dem Termin zeigen wuerde, deren Behalten
//    am Klausurtag aber unter dem Ziel laege. Verteilt auf die
//    restlichen Tage, die wackligsten zuerst.
// 3. Neue Kursfragen: so viele, dass alle bis NEU_PUFFER Tage vor der
//    Klausur eingefuehrt sind; ohne Klausur neuProTag.
// Zaehlt fuer FSRS normal (Betriebsart "kursplan").
export function klausurplan(items, zustaende, { klausur = null, jetzt = Date.now(), ziel = KURS_ZIEL_STANDARD, neuProTag = 6 } = {}) {
  const faellig = []
  const neu = []
  const vorziehbar = []
  const termin = klausur ? new Date(`${klausur.datum}T00:00`).getTime() : null
  const tage = klausur ? Math.max(0, tageBis(klausur, jetzt)) : null

  for (const item of items) {
    const z = zustaende.get(item.id)
    if (!z) {
      neu.push(item)
      continue
    }
    if (z.faelligAb <= jetzt) {
      faellig.push({ item, faelligAb: z.faelligAb })
      continue
    }
    if (termin !== null && z.faelligAb > termin) {
      const r = retrievabilityAm(z.karte, termin)
      if (r < ziel) vorziehbar.push({ item, r })
    }
  }

  faellig.sort((a, b) => a.faelligAb - b.faelligAb)
  let vorgezogen = []
  if (termin !== null && tage <= VORZIEH_FENSTER) {
    vorziehbar.sort((a, b) => a.r - b.r)
    const proTag = Math.ceil(vorziehbar.length / Math.max(1, tage))
    vorgezogen = vorziehbar.slice(0, proTag).map((e) => e.item)
  }
  const neuAnzahl = termin === null
    ? neuProTag
    : Math.ceil(neu.length / Math.max(1, tage - NEU_PUFFER))

  return {
    pensum: [...faellig.map((e) => e.item), ...vorgezogen, ...neu.slice(0, neuAnzahl)],
    faellig: faellig.length,
    vorgezogen: vorgezogen.length,
    neu: Math.min(neu.length, neuAnzahl),
    neuGesamt: neu.length,
  }
}

// Endspurt: alle Kursfragen, die (noch) nicht klausurreif sind - die
// wackligsten zuerst. "Nochmal" haengt eine Karte einmal ans Ende; fuer
// FSRS zaehlt nur die erste Bewertung des Tages (planer.js).
export function endspurt(reife) {
  return reife.eintraege
    .filter((e) => !e.sicher)
    .sort((a, b) => a.r - b.r)
    .map((e) => e.item)
}
