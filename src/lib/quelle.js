// Quellenangaben (Itemfeld "quelle", Erklaerstueck, Kennwerte).
//
// Seit 2026-10-13 gibt es zwei Formen (ANLEITUNG-THEMA-CHAT.md 3.2):
//   * Freitext wie bisher: "Lehrbuch der Bauphysik, S. 471–473; ..."
//   * strukturiert - Objekt oder Liste von Objekten:
//       { werk, seite?, pdf?, stelle? }
// Ueberall, wo die App eine Quelle zeigt, druckt oder exportiert, geht sie
// durch quelleText() - ein Objekt direkt als React-Kind wuerde die Anzeige
// abstuerzen lassen. Gleiche Logik wie als_text() in
// Detailindex/quellenregister.py.

export function quelleText(quelle) {
  if (!quelle) return ''
  if (typeof quelle === 'string') return quelle
  if (Array.isArray(quelle)) return quelle.map(quelleText).filter(Boolean).join('; ')
  if (typeof quelle !== 'object') return String(quelle)
  const teile = [quelle.werk, quelle.stelle, quelle.seite ? `S. ${quelle.seite}` : null].filter(Boolean)
  let text = teile.join(', ')
  if (quelle.pdf) text += ` (PDF ${quelle.pdf})`
  return text
}

// Die Werke einer Quellenangabe (fuer Gruppierungen): bei strukturierter
// Form das Feld "werk", bei Freitext der Teil vor dem ersten Komma jeder
// mit ";" getrennten Angabe.
export function quelleWerke(quelle) {
  if (!quelle) return []
  if (typeof quelle === 'string') {
    return quelle
      .split(/;\s*/)
      .map((teil) => teil.split(',')[0].trim())
      .filter(Boolean)
  }
  const liste = Array.isArray(quelle) ? quelle : [quelle]
  return liste.map((q) => (typeof q === 'object' && q ? q.werk : null)).filter(Boolean)
}
