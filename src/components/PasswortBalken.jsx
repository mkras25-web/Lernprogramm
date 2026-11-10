import { passwortStaerke } from '../lib/passwortStaerke.js'

// Dezenter Balken unter dem Passwortfeld: schwach / mittel / sicher mit
// Farbe UND Text (Farbe allein waere fuer Farbenblinde nicht lesbar).
export default function PasswortBalken({ passwort }) {
  const s = passwortStaerke(passwort)
  if (s.stufe === 'leer') return null
  return (
    <div className={`pwBalken ${s.stufe}`} role="status" aria-live="polite">
      <span className="pwSpur" aria-hidden="true"><span style={{ width: `${s.anteil * 100}%` }} /></span>
      <span className="pwText">{s.text}</span>
    </div>
  )
}
