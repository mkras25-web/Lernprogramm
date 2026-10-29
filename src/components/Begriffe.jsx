import { createContext, useContext, useMemo } from 'react'
import { textZerlegen } from '../lib/lexikon.js'

// Anklickbare Fachbegriffe (Lexikon, 2026-10-29). App.jsx stellt das
// Suchmuster und "oeffnen" bereit; ohne Lexikon im Paket bleibt der Text
// unveraendert. Ein Klick oeffnet das Lexikon als Ebene ueber dem
// aktuellen Bildschirm - eine laufende Frage bleibt dabei genau so
// stehen (aufgedeckt, abgehakt, Eingaben), "Zurueck zur Frage" schliesst
// nur die Ebene.
export const LexikonKontext = createContext(null)

export default function Begriffe({ text, ohne = null }) {
  const lexikon = useContext(LexikonKontext)
  const stuecke = useMemo(() => textZerlegen(text, lexikon?.muster, ohne), [text, lexikon?.muster, ohne])
  if (!lexikon?.muster) return text ?? null
  return stuecke.map((s, i) =>
    s.id ? (
      <button
        key={i}
        type="button"
        className="begriff"
        title="Im Lexikon nachschlagen"
        onClick={(e) => {
          // Nicht bis zu Karten-/Aufklappknoepfen durchreichen.
          e.stopPropagation()
          lexikon.oeffnen(s.id)
        }}
      >
        {s.text}
      </button>
    ) : (
      s.text
    )
  )
}
