import { useEffect, useRef, useState } from 'react'
import './skizze.css'
import LokalBild from './LokalBild.jsx'

// Zeichenfeld als Alternative zum Papier. Die Striche werden als
// Punktfolgen gehalten, nicht als Pixel - dadurch bleibt Rueckgaengig
// moeglich und die Zeichnung ueberlebt eine Groessenaenderung.
export default function Skizzenfeld({ referenz, aufgedeckt, bildRef }) {
  const canvasRef = useRef(null)
  const striche = useRef([])
  const aktuell = useRef(null)
  const [ueberlagert, setUeberlagert] = useState(false)
  const [leer, setLeer] = useState(true)

  function zeichnen() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    ctx.strokeStyle = '#1b2430'
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const strich of striche.current) {
      if (strich.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(strich[0].x, strich[0].y)
      for (const punkt of strich.slice(1)) ctx.lineTo(punkt.x, punkt.y)
      ctx.stroke()
    }
  }

  function groesseAnpassen() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const breite = canvas.clientWidth
    const hoehe = canvas.clientHeight
    canvas.width = breite * dpr
    canvas.height = hoehe * dpr
    zeichnen()
  }

  // Der Elternteil holt sich das Bild ueber diese Funktion, wenn die
  // Skizze gesichert werden soll.
  useEffect(() => {
    if (!bildRef) return
    // Verkleinert speichern: Eine Skizze braucht keine Druckaufloesung,
    // und hundert Zeichnungen in voller Groesse sprengen den Export.
    bildRef.current = () => {
      if (striche.current.length === 0) return null
      const quelle = canvasRef.current
      if (!quelle) return null
      const grenze = 700
      const faktor = Math.min(1, grenze / Math.max(quelle.width, quelle.height))
      if (faktor === 1) return quelle.toDataURL('image/png')

      const klein = document.createElement('canvas')
      klein.width = Math.round(quelle.width * faktor)
      klein.height = Math.round(quelle.height * faktor)
      const ctx = klein.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, klein.width, klein.height)
      ctx.drawImage(quelle, 0, 0, klein.width, klein.height)
      return klein.toDataURL('image/jpeg', 0.82)
    }
    return () => {
      if (bildRef) bildRef.current = null
    }
  }, [bildRef])

  useEffect(() => {
    groesseAnpassen()
    window.addEventListener('resize', groesseAnpassen)
    return () => window.removeEventListener('resize', groesseAnpassen)
  }, [])

  function position(e) {
    const kasten = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - kasten.left, y: e.clientY - kasten.top }
  }

  function beginnen(e) {
    if (aufgedeckt) return
    e.currentTarget.setPointerCapture(e.pointerId)
    aktuell.current = [position(e)]
    striche.current.push(aktuell.current)
    setLeer(false)
  }

  function fortsetzen(e) {
    if (!aktuell.current) return
    aktuell.current.push(position(e))
    zeichnen()
  }

  function beenden() {
    aktuell.current = null
  }

  function zurueck() {
    striche.current.pop()
    setLeer(striche.current.length === 0)
    zeichnen()
  }

  function leeren() {
    striche.current = []
    setLeer(true)
    zeichnen()
  }

  return (
    <div className="skizze">
      <div className="blatt">
        <canvas
          ref={canvasRef}
          className="flaeche"
          onPointerDown={beginnen}
          onPointerMove={fortsetzen}
          onPointerUp={beenden}
          onPointerLeave={beenden}
        />
        {ueberlagert && referenz && (
          <LokalBild className="ueberlagerung" src={referenz} alt="" aria-hidden="true" platzhalter={false} />
        )}
        {leer && !aufgedeckt && (
          <p className="blattHinweis">Hier zeichnen – oder auf Papier, wie du willst.</p>
        )}
      </div>

      <div className="werkzeuge">
        <button className="textknopf" onClick={zurueck} disabled={leer}>
          Zurück
        </button>
        <button className="textknopf" onClick={leeren} disabled={leer}>
          Blatt leeren
        </button>
        {aufgedeckt && referenz && (
          <button className="textknopf" onClick={() => setUeberlagert((u) => !u)}>
            {ueberlagert ? 'Referenz ausblenden' : 'Referenz überlagern'}
          </button>
        )}
      </div>
    </div>
  )
}
