import { useState } from 'react'
import { MELDEGRUENDE } from '../lib/meldungen.js'

// Karte melden (Entscheidung 19A): Grund + optionaler Kommentar. Gespeichert
// in der Marke des Items ({ einspruch: true, meldung: { grund, text, ts } }),
// reist damit beim Sichern und beim Dropbox-Abgleich mit. Der vorhandene
// Filter "Einspruch" in Nachschlagen findet gemeldete Karten weiterhin.
export default function MeldenFeld({ meldung, onMelden, onZurueckziehen, onSchliessen }) {
  const [grund, setGrund] = useState(meldung?.grund ?? null)
  const [text, setText] = useState(meldung?.text ?? '')

  return (
    <div className="meldenFeld">
      <p className="zeileTitel">Was stimmt mit dieser Karte nicht?</p>
      <div className="wahl">
        {MELDEGRUENDE.map(([id, name]) => (
          <button
            key={id}
            className={grund === id ? 'wahlKnopf aktiv' : 'wahlKnopf'}
            onClick={() => setGrund(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <textarea
        className="notizfeld"
        value={text}
        placeholder="Was genau? (optional – hilft beim Überarbeiten im Web-Chat)"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="wahl">
        <button
          className="knopf schmal"
          disabled={!grund}
          onClick={() => onMelden({ grund, text: text.trim(), ts: Date.now() })}
        >
          {meldung ? 'Meldung ändern' : 'Melden'}
        </button>
        {meldung && (
          <button className="knopf schmal" onClick={onZurueckziehen}>
            Meldung zurückziehen
          </button>
        )}
        <button className="textknopf" onClick={onSchliessen}>Abbrechen</button>
      </div>
    </div>
  )
}
