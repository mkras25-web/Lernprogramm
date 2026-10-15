import { useRef, useState } from 'react'
import Skizzenfeld from './Skizzenfeld.jsx'
import { ausDemKopfMerken, pruefliste } from '../lib/ausDemKopf.js'

// "Aus dem Kopf" (L6, 2026-10-13): leeres Blatt je Thema. Erst alles
// aufschreiben oder skizzieren, was man weiss - ohne nachzusehen -, dann
// gegen die Lernziele (bzw. Kernaussagen) abhaken. Freiwillig, je Thema,
// ohne Einfluss auf die Planung.
export default function AusDemKopf({ thema, profilId, onZurueck, onErklaerung }) {
  const [text, setText] = useState('')
  const [zeichnen, setZeichnen] = useState(false)
  // Einmal geoeffnet, bleibt das Zeichenfeld eingehaengt (nur versteckt),
  // damit der Wechsel Schreiben <-> Skizzieren nichts verwirft.
  const [feldOffen, setFeldOffen] = useState(false)
  const [fertig, setFertig] = useState(false)
  const [gehakt, setGehakt] = useState([])
  const bildRef = useRef(null)
  const [skizze, setSkizze] = useState(null)
  const liste = pruefliste(thema)

  function vergleichen() {
    if (feldOffen) setSkizze(bildRef.current?.() ?? null)
    setFertig(true)
  }

  function abschliessen() {
    ausDemKopfMerken(profilId, thema.id, { k: gehakt.length, n: liste.punkte.length })
    onZurueck()
  }

  return (
    <div role="main" className="schirm ausDemKopf">
      <button className="textknopf" onClick={onZurueck} style={{ alignSelf: 'flex-start' }}>
        Zurück
      </button>
      <div>
        <p className="herkunft">Aus dem Kopf · {thema.modulTitel}</p>
        <h1 className="ueberschrift">{thema.titel}</h1>
        {!fertig && (
          <p className="nebentext">
            Schreib oder skizziere alles, was du zu diesem Thema weißt – ohne nachzusehen. Danach
            vergleichst du mit {liste.art === 'lernziele' ? 'den Lernzielen' : 'den Kernaussagen der Erklärung'}.
            Zählt nicht für die Planung.
          </p>
        )}
      </div>

      {!fertig ? (
        <>
          <div className="wahl">
            <button className={!zeichnen ? 'wahlKnopf aktiv' : 'wahlKnopf'} onClick={() => setZeichnen(false)}>
              Schreiben
            </button>
            <button className={zeichnen ? 'wahlKnopf aktiv' : 'wahlKnopf'} onClick={() => { setZeichnen(true); setFeldOffen(true) }}>
              Skizzieren
            </button>
          </div>
          {feldOffen && (
            <div hidden={!zeichnen}>
              <Skizzenfeld aufgedeckt={false} bildRef={bildRef} />
            </div>
          )}
          {!zeichnen && (
            <textarea
              className="notizfeld"
              style={{ minHeight: '14rem' }}
              value={text}
              autoFocus
              placeholder="Alles, was dir zum Thema einfällt: Begriffe, Zahlen, Schichtfolgen, Regeln, Fallstricke …"
              onChange={(e) => setText(e.target.value)}
            />
          )}
          <div className="steuerung">
            <button className="knopf haupt" onClick={vergleichen}>
              Fertig – jetzt vergleichen
            </button>
          </div>
        </>
      ) : (
        <>
          {(text.trim() || skizze) && (
            <section>
              <h2 className="abschnitt">Dein Blatt</h2>
              {text.trim() && <p className="eigeneAntwort">{text}</p>}
              {skizze && <img className="referenz" src={skizze} alt="Deine Skizze" />}
            </section>
          )}
          <section>
            <h2 className="abschnitt">
              {liste.art === 'lernziele' ? 'Lernziele' : 'Kernaussagen der Erklärung'} – was hattest du?
            </h2>
            <ul className="pruefpunkte">
              {liste.punkte.map((punkt, i) => (
                <li key={i}>
                  <input
                    type="checkbox"
                    id={`kopf-${i}`}
                    checked={gehakt.includes(i)}
                    onChange={() => setGehakt((g) => (g.includes(i) ? g.filter((x) => x !== i) : [...g, i]))}
                  />
                  <label htmlFor={`kopf-${i}`}>{punkt}</label>
                </li>
              ))}
            </ul>
            <p className="pruefstand">
              {gehakt.length} von {liste.punkte.length} getroffen
            </p>
          </section>
          <div className="steuerung">
            <div className="arten">
              <button className="knopf haupt" onClick={abschliessen}>
                Fertig
              </button>
              {onErklaerung && (
                <button className="artKnopf" onClick={onErklaerung}>
                  Erklärung nachlesen
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
