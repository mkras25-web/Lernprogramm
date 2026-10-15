import { useEffect, useState } from 'react'
import Schleier from './Schleier.jsx'
import { useWischZu } from '../hooks/useWischZu.js'

// Auswahlfeld fuer Zuordnungen (2026-10-15, kleine Mobil-Idee): am Desktop
// das gewohnte <select>, unter 60rem ein Knopf, der ein Blatt von unten mit
// grossen Zeilen oeffnet - das native Auswahlrad am iPhone zeigt lange
// Fachbegriffe abgeschnitten und ist mit dem Daumen fummelig.
// optionen: [{ wert, text }], wert: aktueller Wert oder '' (nichts gewaehlt).
const SCHMAL = '(max-width: 59.99rem)'

function useSchmal() {
  const [schmal, setSchmal] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(SCHMAL).matches)
  useEffect(() => {
    const abfrage = window.matchMedia?.(SCHMAL)
    if (!abfrage) return
    const pruefen = () => setSchmal(abfrage.matches)
    abfrage.addEventListener('change', pruefen)
    return () => abfrage.removeEventListener('change', pruefen)
  }, [])
  return schmal
}

export default function Auswahl({ wert, optionen, leer, onWahl, titel }) {
  const schmal = useSchmal()
  const [offen, setOffen] = useState(false)
  const wischen = useWischZu(() => setOffen(false))

  if (!schmal) {
    return (
      <select className="paarWahl" value={wert} onChange={(e) => e.target.value !== '' && onWahl(Number(e.target.value))}>
        <option value="">{leer}</option>
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>{o.text}</option>
        ))}
      </select>
    )
  }

  const gewaehlt = optionen.find((o) => String(o.wert) === String(wert))
  return (
    <>
      <button
        type="button"
        className={gewaehlt ? 'paarWahl auswahlKnopf' : 'paarWahl auswahlKnopf leer'}
        aria-haspopup="dialog"
        onClick={() => setOffen(true)}
      >
        <span className="auswahlText">{gewaehlt ? gewaehlt.text : leer}</span>
        <span className="auswahlPfeil" aria-hidden="true">▾︎</span>
      </button>
      {offen && (
        <Schleier onSchliessen={() => setOffen(false)} klasse="mehrSchleier" beschriftung={titel ?? leer}>
          <div className="mehrBlatt" onClick={(e) => e.stopPropagation()} {...wischen}>
            <div className="mehrGriff" aria-hidden="true" />
            {titel && <h2 className="mehrTitel auswahlTitel">{titel}</h2>}
            {optionen.map((o) => (
              <button
                key={o.wert}
                type="button"
                className={String(o.wert) === String(wert) ? 'mehrZeile aktiv' : 'mehrZeile'}
                aria-pressed={String(o.wert) === String(wert)}
                onClick={() => {
                  onWahl(o.wert)
                  setOffen(false)
                }}
              >
                <span className="mehrText"><span className="mehrName">{o.text}</span></span>
                {String(o.wert) === String(wert) && <span className="mehrPfeil" aria-hidden="true">✓︎</span>}
              </button>
            ))}
          </div>
        </Schleier>
      )}
    </>
  )
}
