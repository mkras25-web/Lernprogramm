// Fachbegriff-Lexikon (2026-10-29). Inhalt aus lexikon.json des Pakets
// (ANLEITUNG-THEMA-CHAT.md 2.4, entsteht im Themen-Chat). Hier nur
// Aufbereitung und das Finden der Begriffe in Fragen, Antworten und
// Erklaertexten - rein rechnend, getestet (lexikon.test.js).

// Gaengige deutsche Endungen, damit "Kellersohlen", "Gesimses" oder
// "Drahtankern", "zweischaligem" ohne eigene Variante gefunden werden. Unregelmaessiges
// (Umlaut-Plural, Synonyme) steht im Eintrag unter "varianten".
const ENDUNGEN = '(?:e|em|en|n|s|es|er|ern)?'

export function lexikonAufbereiten(daten) {
  const roh = Array.isArray(daten?.eintraege) ? daten.eintraege : []
  return roh
    .filter((e) => e && typeof e.id === 'string' && typeof e.begriff === 'string' && e.begriff.trim() && e.definition)
    .map((e) => ({ ...e, varianten: Array.isArray(e.varianten) ? e.varianten.filter((v) => typeof v === 'string' && v.trim()) : [] }))
    .sort((a, b) => a.begriff.localeCompare(b.begriff, 'de'))
}

function regexSicher(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Teilwoerter (2026-11-01): Mindestlaengen an den echten Karten gemessen.
// Vorne ist ein Treffer fast immer echt ("Sockel|abdichtung"), hinten nicht:
// "Setzung" steckt in "Voraussetzung" und "Festsetzung", "Abdichtung" dagegen
// sinnvoll in "Dachabdichtung".
const TEIL_VORNE = 6
const TEIL_HINTEN = 9

// Ein gemeinsames Suchmuster ueber alle Schreibformen. Laengere Formen
// zuerst, damit "Polystyrol-Extruderschaum" vor "Polystyrol" greift. Ganze
// Woerter gehen vor; sonst trifft ein langer Begriff auch als Wortteil, und
// nur dieser Teil wird unterstrichen ("Schaumglas|platte", "Dach|abdichtung").
// Gross-/Kleinschreibung zaehlt - deutsche Substantive.
export function begriffsMuster(eintraege) {
  const formZuId = new Map()
  for (const e of eintraege) {
    for (const form of [e.begriff, ...e.varianten]) {
      const f = form.trim()
      if (f && !formZuId.has(f)) formZuId.set(f, e.id)
    }
  }
  if (formZuId.size === 0) return null
  const formen = [...formZuId.keys()].sort((a, b) => b.length - a.length)
  const einzelwoerter = formen.filter((f) => /^\p{Lu}[\p{L}-]*\p{Ll}$/u.test(f))
  const vorne = einzelwoerter.filter((f) => f.length >= TEIL_VORNE)
  const hinten = einzelwoerter.filter((f) => f.length >= TEIL_HINTEN).map((f) => {
    const klein = f[0].toLocaleLowerCase('de') + f.slice(1)
    if (!formZuId.has(klein)) formZuId.set(klein, formZuId.get(f))
    return klein
  })
  const auswahl = (liste) => liste.map(regexSicher).join('|')
  const ganz = `(?<![\\p{L}\\p{N}])(${auswahl(formen)})${ENDUNGEN}(?![\\p{L}\\p{N}])`
  const teile = [ganz]
  if (vorne.length) teile.push(`(?<![\\p{L}\\p{N}])(${auswahl(vorne)})(?=\\p{Ll}{3})`)
  if (hinten.length) teile.push(`(?<=\\p{Lu}\\p{L}{2,})(${auswahl(hinten)})${ENDUNGEN}(?![\\p{L}\\p{N}])`)
  return { regex: new RegExp(teile.join('|'), 'gu'), formZuId }
}

// Die Form steht je nach Treffer-Art in einer anderen Gruppe.
function fundId(fund, muster) {
  return muster.formZuId.get(fund[1] ?? fund[2] ?? fund[3])
}

// Zerlegt einen Text in Stuecke [{ text }, { text, id }, ...]. Jeder
// Begriff wird je Text nur beim ersten Vorkommen verlinkt - sonst waere
// ein Absatz voller Unterstreichungen. ohne: Begriff-ID, die nicht
// verlinkt wird (der Eintrag selbst im Lexikon).
export function textZerlegen(text, muster, ohne = null) {
  if (typeof text !== 'string' || !text || !muster) return [{ text }]
  const stuecke = []
  const schon = new Set(ohne ? [ohne] : [])
  let rest = 0
  for (const fund of text.matchAll(muster.regex)) {
    const id = fundId(fund, muster)
    if (!id || schon.has(id)) continue
    // "Sockel|abdichtung": nicht zwei Links direkt hintereinander in einem Wort.
    if (fund.index === rest && stuecke.at(-1)?.id) continue
    schon.add(id)
    if (fund.index > rest) stuecke.push({ text: text.slice(rest, fund.index) })
    stuecke.push({ text: fund[0], id })
    rest = fund.index + fund[0].length
  }
  if (rest < text.length) stuecke.push({ text: text.slice(rest) })
  return stuecke
}

// Begriffe in Texten, die selbst nicht verlinkt werden koennen (Auswahl-
// optionen und Pruefpunkte stecken in Knopf bzw. Label): eindeutige IDs mit
// der Schreibweise des ersten Fundes, fuer die Lexikon-Knoepfe daneben.
export function begriffeIn(text, muster) {
  return textZerlegen(text, muster).filter((s) => s.id).map((s) => ({ id: s.id, text: s.text }))
}

// Begriff -> Karten, in denen er vorkommt (fuer "in n Karten" im Lexikon).
export function kartenJeBegriff(items, muster) {
  const karte = new Map()
  if (!muster) return karte
  for (const item of items) {
    const text = [item.frage, item.antwort, item.vertiefung].filter(Boolean).join('\n')
    const gefunden = new Set()
    for (const fund of text.matchAll(muster.regex)) {
      const id = fundId(fund, muster)
      if (id) gefunden.add(id)
    }
    for (const id of gefunden) {
      if (!karte.has(id)) karte.set(id, [])
      karte.get(id).push(item)
    }
  }
  return karte
}
