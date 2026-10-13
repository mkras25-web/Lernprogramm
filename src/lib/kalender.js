// Semesterkalender (F8, 2026-10-13): erwartete Lernlast je Tag ueber alle
// Kurse und Themen, mit Klausurterminen - bei mehreren Klausuren gleichzeitig
// fehlt sonst das Gesamtbild. Rein rechnend, ohne Export.
//
// Grobe Vorschau: faellige Wiederholungen nach dem heutigen Planungsstand
// plus neue Karten im Tagesrhythmus (neuProTag), solange neue da sind.
// Wiederholungen, die aus kuenftigem Lernen entstehen, sind nicht
// enthalten - die Zahlen sind eine Untergrenze.

const TAG = 24 * 60 * 60 * 1000

function tagesBeginn(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function lastvorschau({ zustaende, neueAnzahl = 0, neuProTag = 6, maxProTag = 30, klausuren = [], tage = 56, jetzt = Date.now() }) {
  const heute = tagesBeginn(jetzt)
  const felder = Array.from({ length: tage }, (_, i) => ({
    datum: heute + i * TAG,
    faellig: 0,
    neu: 0,
    klausuren: [],
  }))
  for (const z of zustaende.values()) {
    const abstand = Math.floor((tagesBeginn(z.faelligAb) - heute) / TAG)
    if (abstand < 0) felder[0].faellig += 1
    else if (abstand < tage) felder[abstand].faellig += 1
  }
  let rest = neueAnzahl
  for (const f of felder) {
    f.neu = Math.min(rest, neuProTag)
    rest -= f.neu
  }
  for (const k of klausuren) {
    if (!k.datum) continue
    const abstand = Math.round((new Date(`${k.datum}T00:00`).getTime() - heute) / TAG)
    if (abstand >= 0 && abstand < tage) felder[abstand].klausuren.push(k)
  }
  for (const f of felder) {
    f.summe = f.faellig + f.neu
    f.ueberlast = f.summe > maxProTag
  }
  return felder
}

// Wochen ab Montag fuer die Darstellung: [[feld|null x 7], ...]
export function nachWochen(felder) {
  if (felder.length === 0) return []
  const versatz = (new Date(felder[0].datum).getDay() + 6) % 7 // Montag = 0
  const zellen = [...Array(versatz).fill(null), ...felder]
  const wochen = []
  for (let i = 0; i < zellen.length; i += 7) {
    const woche = zellen.slice(i, i + 7)
    while (woche.length < 7) woche.push(null)
    wochen.push(woche)
  }
  return wochen
}
