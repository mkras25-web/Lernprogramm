import { useState } from 'react'

// Zeichnung mit nummerierten Punkten. Die Zuordnung geschieht direkt
// am Punkt: anklicken, auswaehlen, fertig. Die Liste darunter zeigt
// dasselbe in Textform - beides arbeitet auf demselben Zustand.
export default function Bildpunkte({
  referenz,
  punkte,
  zuordnung,
  namen,
  aufgedeckt,
  gewaehlt,
  onWahl,
  loesung,
}) {
  const [offen, setOffen] = useState(null)

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
      <img src={referenz} alt="" />

      {punkte.map((p) => {
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

        return (
          <div key={p.nr} className="bildpunktHuelle" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
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
                {namen.map((name, i) => {
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
