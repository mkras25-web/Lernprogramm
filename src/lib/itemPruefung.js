// Leichte Pruefung beim Laden (T4, 2026-10-13): Eine einzelne fehlerhafte
// Karte (z. B. mehrfachauswahl ohne optionen) soll nicht die ganze App zum
// Absturz bringen. Solche Karten werden beim Laden ausgefiltert und gezaehlt;
// die gruendliche Pruefung macht weiterhin paketpruefung.py beim Einspielen.
//
// Geprueft wird nur, was die Anzeige wirklich braucht - keine Stilregeln.

const istListe = (x) => Array.isArray(x) && x.length > 0
const istText = (x) => typeof x === 'string' && x.trim() !== ''

const BRAUCHT = {
  karte: () => null,
  freitext: () => null,
  skizze: () => null,
  numerisch: (i) => (typeof i.wert === 'number' ? null : 'wert fehlt oder ist keine Zahl'),
  mehrfachauswahl: (i) => {
    if (!istListe(i.optionen)) return 'optionen fehlen'
    const richtig = Array.isArray(i.richtig) ? i.richtig : [i.richtig]
    if (richtig.length === 0 || richtig.some((r) => !Number.isInteger(r) || r < 0 || r >= i.optionen.length)) {
      return 'richtig liegt nicht in den optionen'
    }
    return null
  },
  zuordnung: (i) =>
    istListe(i.paare) && i.paare.every((p) => Array.isArray(p) && p.length >= 2) ? null : 'paare fehlen oder sind unvollständig',
  reihenfolge: (i) => (istListe(i.schritte) ? null : 'schritte fehlen'),
  bildbeschriftung: (i) => (istListe(i.punkte) ? null : 'punkte fehlen'),
  fehlersuche: (i) => (istListe(i.bereiche) ? null : 'bereiche fehlen'),
  vergleich: (i) => (istListe(i.seiten) ? null : 'seiten fehlen'),
  rechnen: (i) => (istListe(i.variablen) && istText(i.formel) ? null : 'variablen oder formel fehlen'),
  fall: (i) =>
    istListe(i.teile) && i.teile.every((t) => t && istText(t.frage)) ? null : 'teile fehlen oder sind unvollständig',
}

// Liefert den Grund, warum ein Item nicht angezeigt werden kann, oder null.
export function itemFehler(item) {
  if (!item || typeof item !== 'object') return 'kein Objekt'
  if (!istText(item.id)) return 'id fehlt'
  if (!istText(item.frage)) return 'frage fehlt'
  const pruefen = BRAUCHT[item.typ]
  if (!pruefen) return `unbekannter typ "${item.typ}"`
  return pruefen(item)
}
