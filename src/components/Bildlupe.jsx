import { useState } from 'react'

// Zeichnungen sind auf kleinen Schirmen unlesbar. Ein Klick oeffnet
// sie bildschirmfuellend.
export default function Bildlupe({ src, alt = '', className = 'referenz' }) {
  const [offen, setOffen] = useState(false)
  if (!src) return null

  return (
    <>
      <button className="lupenKnopf" onClick={() => setOffen(true)} title="Vergrößern">
        <img className={className} src={src} alt={alt} />
        <span className="lupenZeichen" aria-hidden="true">⤢</span>
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
