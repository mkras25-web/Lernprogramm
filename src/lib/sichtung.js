// Sichtung: Bewertung der Items durch dich selbst, unabhaengig vom
// Lernfortschritt. Gespeichert wird sie in der Marke des Items, damit
// sie zusammen mit Lesezeichen und Notizen exportiert wird.

// ︎ erzwingt die einfache Text-/Linien-Darstellung dieser Symbole
// (siehe App.jsx NAVIGATION fuer den Hintergrund).
export const KATEGORIEN = [
  { id: 'relevant', name: 'Relevant', symbol: '●︎', lernbar: true },
  { id: 'spaeter', name: 'Später', symbol: '◔︎', lernbar: false },
  { id: 'ueberarbeiten', name: 'Überarbeiten', symbol: '✎︎', lernbar: false },
  { id: 'streichen', name: 'Streichen', symbol: '✕︎', lernbar: false },
]

export const UNGESICHTET = { id: 'ungesichtet', name: 'Ungesichtet', symbol: '○︎', lernbar: true }

export function kategorieAus(marke) {
  return KATEGORIEN.find((k) => k.id === marke?.kategorie) ?? UNGESICHTET
}

// Items, die gelernt und in der Statistik gezaehlt werden.
export function istLernbar(marke) {
  return kategorieAus(marke).lernbar
}

export function lernbareItems(items, marken) {
  return items.filter((i) => istLernbar(marken.get(i.id)))
}

// Bearbeitete Fassungen ueberschreiben Frage und Antwort des Pakets.
// Das Paket selbst bleibt unveraendert - Aenderungen sind deine
// Ebene darueber und wandern mit dem Export.
export function itemsAnreichern(items, marken) {
  return items.map((item) => {
    const marke = marken.get(item.id)
    if (!marke?.frage && !marke?.antwort) return item
    return {
      ...item,
      frage: marke.frage ?? item.frage,
      antwort: marke.antwort ?? item.antwort,
      bearbeitet: true,
    }
  })
}
