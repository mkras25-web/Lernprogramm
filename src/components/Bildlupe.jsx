import { useState } from 'react'
import LokalBild, { BildPlatzhalter } from './LokalBild.jsx'

// Zeichnungen sind auf kleinen Schirmen unlesbar. Ein Klick oeffnet
// sie bildschirmfuellend.
export default function Bildlupe({ src, alt = '', className = 'referenz' }) {
  const [offen, setOffen] = useState(false)
  const [fehlt, setFehlt] = useState(false)
  if (!src) return null
  if (fehlt) return <BildPlatzhalter src={src} />

  return (
    <>
      <button className="lupenKnopf" onClick={() => setOffen(true)} title="Vergrößern">
        <LokalBild className={className} src={src} alt={alt} platzhalter={false} onFehler={() => setFehlt(true)} />
        <span className="lupenZeichen" aria-hidden="true">⤢︎</span>
      </button>

      {offen && (
        <div className="schleier" onClick={() => setOffen(false)}>
          <div className="lupenBuehne" onClick={(e) => e.stopPropagation()}>
            <img src={src} alt={alt} />
            <button className="knopf schmal" onClick={() => setOffen(false)}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </>
  )
}
