import { useEffect, useRef, useState } from 'react'
import Schleier from './Schleier.jsx'
import LokalBild, { BildPlatzhalter } from './LokalBild.jsx'

// Zeichnungen sind auf kleinen Schirmen unlesbar. Ein Klick oeffnet
// sie bildschirmfuellend - seit 2026-10-13 (D1) mit Zoom und Verschieben:
// die SVGs sind etwa 820 px breit mit 12-13 px Schrift, auf 360 px Breite
// bleiben davon 5-6 px, und die blosse Vollbildansicht half im Hochformat kaum.
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
      {offen && <Lupe src={src} alt={alt} onSchliessen={() => setOffen(false)} />}
    </>
  )
}

// Nur der Knopf "vergroessern" - fuer Bilder, die selbst schon in einem
// Knopf stecken (Gegenueberstellung), wo eine zweite Schaltflaeche im Bild
// nicht geht.
export function LupenLink({ src, alt = '', text = 'Bild vergrößern' }) {
  const [offen, setOffen] = useState(false)
  // Buchausschnitte (bilder-lokal) fehlen online - dann keinen Link auf ein
  // kaputtes Bild anbieten.
  const [fehlt, setFehlt] = useState(false)
  useEffect(() => {
    setFehlt(false)
    if (!src) return undefined
    let aktiv = true
    const probe = new Image()
    probe.onerror = () => aktiv && setFehlt(true)
    probe.src = src
    return () => {
      aktiv = false
    }
  }, [src])
  if (!src || fehlt) return null
  return (
    <>
      <button className="textknopf lupenLink" onClick={() => setOffen(true)}>
        ⤢︎ {text}
      </button>
      {offen && <Lupe src={src} alt={alt} onSchliessen={() => setOffen(false)} />}
    </>
  )
}

const MIN = 1
const MAX = 6

function begrenzt(z) {
  return Math.min(MAX, Math.max(MIN, z))
}

export function Lupe({ src, alt, onSchliessen }) {
  const [ansicht, setAnsicht] = useState({ z: 1, x: 0, y: 0 })
  const zeiger = useRef(new Map()) // pointerId -> {x, y}
  const start = useRef(null) // Ausgangslage einer Geste
  const letzterTipp = useRef(0)
  const flaeche = useRef(null)

  // Zoom um einen Punkt (Bildschirmkoordinaten relativ zur Flaechenmitte),
  // so dass der Punkt unter dem Finger/Mauszeiger stehen bleibt.
  function zoomUm(neuZ, px, py, basis = ansicht) {
    const z = begrenzt(neuZ)
    const faktor = z / basis.z
    const x = z === 1 ? 0 : px - (px - basis.x) * faktor
    const y = z === 1 ? 0 : py - (py - basis.y) * faktor
    return { z, x, y }
  }

  function relativ(e) {
    const r = flaeche.current.getBoundingClientRect()
    return { px: e.clientX - r.left - r.width / 2, py: e.clientY - r.top - r.height / 2 }
  }

  // Mausrad: nicht passiv angemeldet, sonst scrollt die Seite dahinter mit
  // (Reacts onWheel ist passiv, preventDefault wirkt dort nicht).
  useEffect(() => {
    const el = flaeche.current
    if (!el) return
    function rad(e) {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left - r.width / 2
      const py = e.clientY - r.top - r.height / 2
      setAnsicht((a) => zoomUm(a.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), px, py, a))
    }
    el.addEventListener('wheel', rad, { passive: false })
    return () => el.removeEventListener('wheel', rad)
  }, [])

  function runter(e) {
    flaeche.current.setPointerCapture?.(e.pointerId)
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const punkte = [...zeiger.current.values()]
    if (punkte.length === 1) {
      // Doppeltipp/Doppelklick: zwischen 1x und 2,5x umschalten
      const jetzt = Date.now()
      if (jetzt - letzterTipp.current < 300) {
        const { px, py } = relativ(e)
        setAnsicht((a) => (a.z > 1 ? { z: 1, x: 0, y: 0 } : zoomUm(2.5, px, py, a)))
        letzterTipp.current = 0
        start.current = null
        return
      }
      letzterTipp.current = jetzt
      start.current = { art: 'ziehen', x: e.clientX, y: e.clientY, ansicht }
    } else if (punkte.length === 2) {
      const [a, b] = punkte
      const r = flaeche.current.getBoundingClientRect()
      start.current = {
        art: 'kneifen',
        abstand: Math.hypot(a.x - b.x, a.y - b.y),
        mitte: { px: (a.x + b.x) / 2 - r.left - r.width / 2, py: (a.y + b.y) / 2 - r.top - r.height / 2 },
        ansicht,
      }
    }
  }

  function bewegen(e) {
    if (!zeiger.current.has(e.pointerId)) return
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const s = start.current
    if (!s) return
    if (s.art === 'ziehen' && zeiger.current.size === 1 && s.ansicht.z > 1) {
      setAnsicht({ ...s.ansicht, x: s.ansicht.x + e.clientX - s.x, y: s.ansicht.y + e.clientY - s.y })
    } else if (s.art === 'kneifen' && zeiger.current.size === 2) {
      const [a, b] = [...zeiger.current.values()]
      const abstand = Math.hypot(a.x - b.x, a.y - b.y)
      setAnsicht(zoomUm(s.ansicht.z * (abstand / s.abstand), s.mitte.px, s.mitte.py, s.ansicht))
    }
  }

  function hoch(e) {
    zeiger.current.delete(e.pointerId)
    // Nach dem Kneifen mit einem verbliebenen Finger weiterziehen
    if (zeiger.current.size === 1) {
      const [p] = [...zeiger.current.values()]
      start.current = { art: 'ziehen', x: p.x, y: p.y, ansicht }
    } else if (zeiger.current.size === 0) {
      start.current = null
    }
  }

  return (
    <Schleier onSchliessen={onSchliessen} klasse="schleier lupenSchleier">
      <div className="lupenBuehne" onClick={(e) => e.stopPropagation()}>
        <div
          ref={flaeche}
          className={ansicht.z > 1 ? 'lupenFlaeche gezoomt' : 'lupenFlaeche'}
          onPointerDown={runter}
          onPointerMove={bewegen}
          onPointerUp={hoch}
          onPointerCancel={hoch}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{ transform: `translate(${ansicht.x}px, ${ansicht.y}px) scale(${ansicht.z})` }}
          />
        </div>
        <div className="lupenLeiste">
          <button className="artKnopf" onClick={() => setAnsicht((a) => zoomUm(a.z / 1.5, 0, 0, a))} aria-label="Verkleinern">
            −
          </button>
          <span className="lupenStufe">{Math.round(ansicht.z * 100)} %</span>
          <button className="artKnopf" onClick={() => setAnsicht((a) => zoomUm(a.z * 1.5, 0, 0, a))} aria-label="Vergrößern">
            +
          </button>
          {ansicht.z > 1 && (
            <button className="artKnopf" onClick={() => setAnsicht({ z: 1, x: 0, y: 0 })}>
              Ganz
            </button>
          )}
          <button className="knopf schmal" onClick={onSchliessen}>
            Schließen
          </button>
        </div>
        <p className="lupenHinweis">Zwei Finger oder Mausrad zoomen, Doppeltipp 2,5×, ziehen verschiebt.</p>
      </div>
    </Schleier>
  )
}
