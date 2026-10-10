// Feste Reihenfolge waere auswendig lernbar - deshalb werden Antwort-
// optionen bei jedem Erscheinen neu gemischt. Deterministisch aus einem
// Seed, damit die Reihenfolge innerhalb einer Frage stabil bleibt
// (kein Springen bei jedem Neuzeichnen). Gemeinsam fuer Lernen und
// Pruefung - in der Pruefung fehlte das Mischen frueher ganz (die
// Loesung lag immer auf der Diagonale).
export function mischen(laenge, seed) {
  const reihe = Array.from({ length: laenge }, (_, i) => i)
  let zufall = seed
  for (let i = reihe.length - 1; i > 0; i--) {
    zufall = (zufall * 1103515245 + 12345) & 0x7fffffff
    const j = zufall % (i + 1)
    ;[reihe[i], reihe[j]] = [reihe[j], reihe[i]]
  }
  return reihe
}

// Zahl aus einem Text (z. B. Item-Id + Laufkennung) als Seed.
export function seedAus(text) {
  return String(text).split('').reduce((s, z) => (s * 31 + z.charCodeAt(0)) & 0x7fffffff, 7)
}
