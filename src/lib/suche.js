// Tolerante Suche: Umlaute, Gross- und Kleinschreibung und kleine
// Tippfehler sollen kein Hindernis sein. "Warmedammung" findet
// "Wärmedämmung".

export function normalisieren(text) {
  return (text ?? '')
    .toLowerCase()
    .replaceAll('ä', 'a').replaceAll('ö', 'o').replaceAll('ü', 'u')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Abstand nach Levenshtein, abgebrochen sobald die Schranke reisst.
function abstand(a, b, schranke) {
  if (Math.abs(a.length - b.length) > schranke) return schranke + 1
  let vorherige = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const aktuelle = [i]
    let bestes = i
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1
      aktuelle[j] = Math.min(
        vorherige[j] + 1,
        aktuelle[j - 1] + 1,
        vorherige[j - 1] + kosten
      )
      bestes = Math.min(bestes, aktuelle[j])
    }
    if (bestes > schranke) return schranke + 1
    vorherige = aktuelle
  }
  return vorherige[b.length]
}

// Ab acht Zeichen sind zwei Fehler erlaubt, ab vier einer.
function schrankeFuer(wort) {
  if (wort.length >= 8) return 2
  if (wort.length >= 4) return 1
  return 0
}

export function passt(begriff, text) {
  const suche = normalisieren(begriff)
  if (!suche) return true
  const inhalt = normalisieren(text)
  if (inhalt.includes(suche)) return true

  const woerter = inhalt.split(' ')
  return suche.split(' ').every((teil) => {
    if (inhalt.includes(teil)) return true
    const schranke = schrankeFuer(teil)
    if (schranke === 0) return false
    return woerter.some((wort) => abstand(teil, wort, schranke) <= schranke)
  })
}

// --- Gewichtete Suche fuer Nachschlagen (2026-10-10, Entscheidung 29A) ----
//
// Vorher lieferte "u-wert" 139 von 301 Treffern: "u" steckt in fast jedem
// Text, "wert" passte unscharf auf viele Woerter, und die Reihenfolge war
// die Paketreihenfolge. Jetzt:
//   * Begriffe mit Bindestrich oder Schraegstrich ("u-wert", "VOB/B")
//     zaehlen als Ganzes - nur die zusammenhaengende Wortfolge trifft.
//   * Teile mit hoechstens zwei Zeichen muessen ein ganzes Wort sein.
//   * Treffer werden gewichtet: Phrase in der Frage vor Schlagwort/Thema vor
//     Antwort; exakte Woerter vor unscharfen (Tippfehler).
// Die Felder werden einmal vorbereitet (normalisiert), nicht bei jedem
// Tastendruck neu (Messung 2026-10-10: ~200 ms je Taste auf langsamen Handys).

export function vorbereiten(text) {
  const t = normalisieren(text)
  return { text: ` ${t} `, woerter: t ? t.split(' ') : [] }
}

function teilPasst(teil, feld, unscharf) {
  if (teil.length <= 2) return feld.woerter.includes(teil)
  if (feld.text.includes(teil)) return true
  if (!unscharf) return false
  const schranke = schrankeFuer(teil)
  if (schranke === 0) return false
  return feld.woerter.some((wort) => abstand(teil, wort, schranke) <= schranke)
}

// felder: [{ feld: vorbereiten(...), gewicht }] - Rueckgabe 0 = kein Treffer,
// sonst je hoeher desto besser.
export function trefferWert(begriff, felder) {
  const roh = (begriff ?? '').trim()
  const suche = normalisieren(roh)
  if (!suche) return 1
  const teile = suche.split(' ')
  const verbunden = /[-/]/.test(roh) && teile.length > 1
  let wert = 0
  for (const { feld, gewicht } of felder) {
    if (feld.text.includes(` ${suche} `)) wert = Math.max(wert, 4 * gewicht)
    else if (feld.text.includes(suche)) wert = Math.max(wert, 3 * gewicht)
    else if (!verbunden) {
      if (teile.every((t) => teilPasst(t, feld, false))) wert = Math.max(wert, 2 * gewicht)
      else if (teile.every((t) => teilPasst(t, feld, true))) wert = Math.max(wert, gewicht)
    }
  }
  return wert
}
