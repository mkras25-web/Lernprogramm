import { useState } from 'react'
import LokalBild from './LokalBild.jsx'

// Zeichnung mit nummerierten Punkten. Die Zuordnung geschieht direkt
// am Punkt: anklicken, auswaehlen, fertig. Die Liste darunter zeigt
// dasselbe in Textform - beides arbeitet auf demselben Zustand.
//
// `reihenfolge` bestimmt nur die Anzeigereihenfolge der Namen im
// Auswahlfenster (z. B. gemischt, damit eine feste Liste nicht
// auswendig gelernt wird) - die Indizes selbst bleiben die aus `namen`,
// darauf verlassen sich Korrektur und Auswertung hier und in Lernen.jsx.
// Ohne Angabe wird die natuerliche Reihenfolge von `namen` verwendet.
export default function Bildpunkte({
  referenz,
  punkte,
  zuordnung,
  namen,
  aufgedeckt,
  gewaehlt,
  onWahl,
  loesung,
  reihenfolge,
}) {
  const [offen, setOffen] = useState(null)
  // Fehlt das Bild (Buchausschnitt nicht auf diesem Geraet), stuenden die
  // Punkte sonst ohne Zeichnung ueber dem Platzhalter.
  const [bildFehlt, setBildFehlt] = useState(false)

  const anzeigefolge = reihenfolge ?? namen?.map((_, i) => i) ?? []

  const beschriftet = (nr) => {
    if (!zuordnung) return null
    const index = zuordnung[nr]
    return index === undefined ? null : namen?.[index]
  }

  function klick(nr) {
    if (aufgedeckt) return
    if (onWahl && !zuordnung) {
      onWahl(nr)
      return
    }
    setOffen(offen === nr ? null : nr)
  }

  return (
    <div className="bildflaeche">
      <LokalBild src={referenz} alt="" onFehler={() => setBildFehlt(true)} />

      {!bildFehlt && punkte.map((p) => {
        const zugewiesen = beschriftet(p.nr)
        const istGewaehlt = gewaehlt === p.nr || offen === p.nr
        const richtig = aufgedeckt && zuordnung && zuordnung[p.nr] === punkte.indexOf(p)
        const istLoesung = loesung === p.nr
        const klasse = [
          'bildpunkt',
          istGewaehlt ? 'gewaehlt' : '',
          zugewiesen ? 'belegt' : '',
          aufgedeckt && zuordnung ? (richtig ? 'loesung' : 'daneben') : '',
          loesung != null && istLoesung ? 'loesung' : '',
          loesung != null && gewaehlt === p.nr && !istLoesung ? 'daneben' : '',
        ].join(' ')

        const huelleKlasse = offen === p.nr ? 'bildpunktHuelle offen' : 'bildpunktHuelle'

        return (
          <div key={p.nr} className={huelleKlasse} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <button
              className={klasse}
              title={aufgedeckt ? p.name : `Punkt ${p.nr}`}
              onClick={() => klick(p.nr)}
            >
              {p.nr}
            </button>

            {aufgedeckt && zuordnung && <span className="punktName">{p.name}</span>}

            {offen === p.nr && !aufgedeckt && zuordnung && (
              <div className="punktwahl">
                <p className="punktwahlKopf">Punkt {p.nr} benennen</p>
                {anzeigefolge.map((i) => {
                  const name = namen[i]
                  const schonVergeben = Object.entries(zuordnung).some(
                    ([nr, wert]) => wert === i && Number(nr) !== p.nr
                  )
                  return (
                    <button
                      key={i}
                      className={zuordnung[p.nr] === i ? 'punktwahlEintrag aktiv' : 'punktwahlEintrag'}
                      onClick={() => {
                        onWahl(p.nr, i)
                        setOffen(null)
                      }}
                    >
                      {name}
                      {schonVergeben && <span className="punktwahlHinweis">schon vergeben</span>}
                    </button>
                  )
                })}
                <button className="textknopf" onClick={() => setOffen(null)}>
                  Schließen
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
