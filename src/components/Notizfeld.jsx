import { useEffect, useRef, useState } from 'react'

// Notiz zu einem Item. Haelt den Text selbst und speichert verzoegert
// (500 ms nach dem letzten Tastendruck, sofort beim Verlassen des Felds
// und beim Schliessen). Vorher zeigte das Feld direkt den gespeicherten
// Wert - der kam erst nach dem asynchronen Speichern zurueck, und die
// Schreibmarke sprang nach jedem Zeichen ans Ende. Nebenbei loest nicht
// mehr jeder Tastendruck einen Datenbank-Schreibvorgang samt Neuberechnung
// aller Kennzahlen aus.
export default function Notizfeld({ wert, onSpeichern, placeholder = 'Eigene Randbemerkung zu diesem Item …' }) {
  const [text, setText] = useState(wert ?? '')
  const offen = useRef(null) // noch nicht gespeicherter Text
  const timer = useRef(null)
  const speichernRef = useRef(onSpeichern)
  speichernRef.current = onSpeichern

  const jetztSpeichern = () => {
    clearTimeout(timer.current)
    if (offen.current === null) return
    const t = offen.current
    offen.current = null
    speichernRef.current(t)
  }

  // Beim Schliessen (Item-Wechsel, Feld zu) nichts verlieren.
  useEffect(() => jetztSpeichern, [])

  return (
    <textarea
      className="notizfeld"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value)
        offen.current = e.target.value
        clearTimeout(timer.current)
        timer.current = setTimeout(jetztSpeichern, 500)
      }}
      onBlur={jetztSpeichern}
    />
  )
}
