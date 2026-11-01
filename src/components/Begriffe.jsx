import { createContext, useContext, useMemo } from 'react'
import { begriffeIn, textZerlegen } from '../lib/lexikon.js'

// Anklickbare Fachbegriffe (Lexikon, 2026-10-29). App.jsx stellt das
// Suchmuster und "oeffnen" bereit; ohne Lexikon im Paket bleibt der Text
// unveraendert. Ein Klick oeffnet das Lexikon als Ebene ueber dem
// aktuellen Bildschirm - eine laufende Frage bleibt dabei genau so
// stehen (aufgedeckt, abgehakt, Eingaben), "Zurueck zur Frage" schliesst
// nur die Ebene.
export const LexikonKontext = createContext(null)

// Lexikon-Zeile unter Listen, deren Texte selbst nicht verlinkt werden
// koennen: Auswahloptionen sind Knoepfe, Pruefpunkte Labels (kein Knopf im
// Knopf, und ein Fehltipp soll nicht das Haekchen setzen). Jeder Begriff
// steht nur einmal da, auch wenn er in mehreren Zeilen der Liste vorkommt.
export function BegriffKnoepfe({ text }) {
  const lexikon = useContext(LexikonKontext)
  const gefunden = useMemo(() => begriffeIn(text, lexikon?.muster), [text, lexikon?.muster])
  if (gefunden.length === 0) return null
  return (
    <p className="begriffKnoepfe">
      <span className="begriffKnoepfeTitel">Im Lexikon:</span>
      {gefunden.map((b) => (
        <button
          key={b.id}
          type="button"
          className="begriffKnopf"
          title={`„${b.text}“ im Lexikon nachschlagen`}
          onClick={() => lexikon.oeffnen(b.id)}
        >
          {b.text}
        </button>
      ))}
    </p>
  )
}

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
