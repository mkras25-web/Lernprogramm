// Punktesystem. Eine Aufgabe zaehlt so viel, wie sie an Denkarbeit
// kostet - nicht jede Frage ist gleich viel wert. Dieselben Punkte
// steuern die XP beim Lernen und die Wertung in Pruefungen.

export const PUNKTE = {
  karte: 1,
  mehrfachauswahl: 2,
  numerisch: 2,
  vergleich: 2,
  zuordnung: 3,
  reihenfolge: 3,
  fehlersuche: 3,
  freitext: 3,
  bildbeschriftung: 4,
  rechnen: 4,
  skizze: 4,
  // Fallaufgabe: mehrere aufeinander aufbauende Teilfragen (21E)
  fall: 4,
}

export const PUNKTE_STANDARD = 1

export function punkteFuer(item) {
  return PUNKTE[item?.typ] ?? PUNKTE_STANDARD
}

// Zuordnung: Mehrere Paare duerfen dieselbe rechte Seite haben (zweimal
// "93 %"). Richtig ist deshalb jede Wahl mit dem passenden Text, nicht
// nur genau der Index des eigenen Paares.
export function paarRichtig(item, i, gewaehlt) {
  if (gewaehlt === undefined || gewaehlt === null) return false
  return item.paare[gewaehlt]?.[1] === item.paare[i][1]
}

// Auswahlliste fuer die rechte Spalte: jeder Text nur einmal, vertreten
// durch sein erstes Vorkommen. Die Reihenfolge von `reihe` bleibt.
export function paarOptionen(item, reihe) {
  return reihe.filter((j) => ersterPaarIndex(item, j) === j)
}

// Gespeicherte Wahl auf den Index abbilden, den die Auswahlliste zeigt.
export function ersterPaarIndex(item, j) {
  if (j === undefined || j === null) return j
  return item.paare.findIndex((p) => p[1] === item.paare[j]?.[1])
}

// Anteil der erreichten Punkte, zwischen 0 und 1. Aufgaben mit
// mehreren Teilantworten werden anteilig gewertet - wer sieben von
// neun Punkten richtig benennt, hat nicht nichts gewusst.
export function anteilRichtig(item, eingabe) {
  if (eingabe === undefined || eingabe === null) return 0

  switch (item.typ) {
    case 'mehrfachauswahl': {
      const gewaehlt = new Set(eingabe)
      const richtig = new Set(item.richtig)
      const treffer = [...richtig].filter((r) => gewaehlt.has(r)).length
      const falsch = [...gewaehlt].filter((g) => !richtig.has(g)).length
      return Math.max(0, (treffer - falsch) / richtig.size)
    }

    case 'zuordnung': {
      const treffer = item.paare.filter((_, i) => paarRichtig(item, i, eingabe[i])).length
      return treffer / item.paare.length
    }

    case 'bildbeschriftung': {
      const treffer = item.punkte.filter((p, i) => eingabe[p.nr] === i).length
      return treffer / item.punkte.length
    }

    case 'reihenfolge': {
      if (!Array.isArray(eingabe)) return 0
      const treffer = eingabe.filter((wert, i) => wert === i).length
      return treffer / item.schritte.length
    }

    case 'numerisch': {
      const zahl = parseFloat(String(eingabe).replace(',', '.'))
      if (Number.isNaN(zahl)) return 0
      return Math.abs(zahl - item.wert) <= (item.toleranz ?? 0) ? 1 : 0
    }

    case 'fehlersuche':
      return eingabe === item.fehlerNr ? 1 : 0

    case 'vergleich':
      return eingabe === item.richtig ? 1 : 0

    default:
      return 0
  }
}

// Typen, bei denen die App selbst urteilen kann.
export function selbstBewertbar(typ) {
  return ['mehrfachauswahl', 'numerisch', 'zuordnung', 'reihenfolge',
          'bildbeschriftung', 'fehlersuche', 'vergleich'].includes(typ)
}

export const NOTENSTUFEN = [
  { ab: 92, name: 'sehr gut', bestanden: true },
  { ab: 81, name: 'gut', bestanden: true },
  { ab: 67, name: 'befriedigend', bestanden: true },
  { ab: 50, name: 'ausreichend', bestanden: true },
  { ab: 0, name: 'nicht bestanden', bestanden: false },
]

export function note(prozent) {
  return NOTENSTUFEN.find((n) => prozent >= n.ab) ?? NOTENSTUFEN[NOTENSTUFEN.length - 1]
}
