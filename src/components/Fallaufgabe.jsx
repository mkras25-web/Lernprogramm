import { useState } from 'react'
import LokalBild from './LokalBild.jsx'

// Aufgabentyp "fall" (2026-10-10, Entscheidung 21E): eine Ausgangslage
// (frage, optional bild) und mehrere aufeinander aufbauende Teilfragen in
// "teile": [{ frage, antwort }]. Die Teile werden einzeln aufgedeckt - erst
// selbst ueberlegen, dann vergleichen, dann der naechste Schritt. Mit dem
// normalen "Antwort zeigen" (gesperrt) liegt alles offen; die Gesamtbewertung
// bleibt Selbsteinschaetzung wie bei der Karteikarte.
export default function Fallaufgabe({ item, gesperrt }) {
  const [offen, setOffen] = useState(0)
  const teile = item.teile ?? []
  const sichtbar = gesperrt ? teile.length : offen

  return (
    <div className="fall">
      {item.fallbild && <LokalBild className="referenz" src={item.fallbild} alt="" />}
      <ol className="fallTeile">
        {teile.map((teil, i) => (
          <li key={i} className={i < sichtbar ? 'fallTeil offen' : 'fallTeil'}>
            <p className="fallFrage">
              <span className="fallNr">Teil {i + 1}</span> {teil.frage}
            </p>
            {i < sichtbar ? (
              <p className="fallAntwort">{teil.antwort}</p>
            ) : (
              i === sichtbar && (
                <button className="artKnopf" onClick={() => setOffen(i + 1)}>
                  Teil {i + 1} aufdecken
                </button>
              )
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
