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
