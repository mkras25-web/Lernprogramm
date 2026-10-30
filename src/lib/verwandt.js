// Verwechslungspaare (L4, 2026-10-13): Karten aus verwandten Themen kommen
// im Tagespensum bewusst nacheinander. Gemischtes Ueben wirkt am staerksten,
// wenn aehnliche, leicht verwechselbare Kategorien direkt gegeneinander
// stehen (Brunmair & Richter 2019) - Warmdach/Kaltdach, §30/§34/§35 BauGB.
//
// Verwandt heisst: ein Thema nennt das andere in "siehe" (Themen- oder
// Itemebene), oder zwei Karten verschiedener Themen teilen ein Tag.

// Karten reihum nach Thema anordnen (erstes Thema zuerst, sonst in der
// Reihenfolge des ersten Auftretens), Reihenfolge je Thema bleibt. Fuer
// "Gemischt mit verwandten Themen": pensumBauen nimmt neue Karten von vorn -
// ohne das kaemen alle neuen aus dem ersten Thema der Paketreihenfolge.
export function reihumNachThema(items, erstesThema = null) {
  const jeThema = new Map()
  if (erstesThema) jeThema.set(erstesThema, [])
  for (const i of items) {
    if (!jeThema.has(i.themaId)) jeThema.set(i.themaId, [])
    jeThema.get(i.themaId).push(i)
  }
  const listen = [...jeThema.values()].filter((l) => l.length > 0)
  const ergebnis = []
  for (let n = 0; ergebnis.length < items.length; n++) {
    for (const l of listen) if (n < l.length) ergebnis.push(l[n])
  }
  return ergebnis
}

// Themen-ID -> Menge verwandter Themen-IDs (symmetrisch).
export function verwandteThemen(themen = [], items = []) {
  const karte = new Map()
  const verbinden = (a, b) => {
    if (!a || !b || a === b) return
    if (!karte.has(a)) karte.set(a, new Set())
    if (!karte.has(b)) karte.set(b, new Set())
    karte.get(a).add(b)
    karte.get(b).add(a)
  }
  for (const t of themen) for (const ziel of t.siehe ?? []) verbinden(t.id, ziel)
  for (const i of items) for (const ziel of i.siehe ?? []) verbinden(i.themaId, ziel)
  return karte
}

function verwandt(a, b, themenKarte) {
  if (a.themaId === b.themaId) return false
  if (themenKarte.get(a.themaId)?.has(b.themaId)) return true
  if ((a.siehe ?? []).includes(b.themaId) || (b.siehe ?? []).includes(a.themaId)) return true
  const tags = new Set((a.tags ?? []).map((t) => String(t).toLowerCase()))
  return (b.tags ?? []).some((t) => tags.has(String(t).toLowerCase()))
}

// Ordnet ein (schon gemischtes) Pensum so um, dass auf eine Karte - wo
// moeglich - eine verwandte aus einem anderen Thema folgt. Gesucht wird nur
// in den naechsten `fenster` Karten, und nach jedem Paar folgt wieder eine
// freie Karte: sonst klebten ganze Themenbloecke zusammen und das Mischen
// waere aufgehoben. Die Menge der Karten bleibt gleich.
export function verwandteNebeneinander(pensum, themenKarte, fenster = 12) {
  const rest = [...pensum]
  const ergebnis = []
  let gerade = false // die letzte Karte war schon der zweite Teil eines Paares
  while (rest.length > 0) {
    const karte = rest.shift()
    ergebnis.push(karte)
    if (gerade) {
      gerade = false
      continue
    }
    const j = rest.slice(0, fenster).findIndex((k) => verwandt(karte, k, themenKarte))
    if (j >= 0) {
      ergebnis.push(rest.splice(j, 1)[0])
      gerade = true
    }
  }
  return ergebnis
}
