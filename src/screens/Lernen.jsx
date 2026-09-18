import { useEffect, useMemo, useRef, useState } from 'react'
import Skizzenfeld from '../components/Skizzenfeld.jsx'
import Bildlupe from '../components/Bildlupe.jsx'
import Normen from '../components/Normen.jsx'
import Bildpunkte from '../components/Bildpunkte.jsx'
import Bauabschnitt from '../components/Bauabschnitt.jsx'
import { rechnen, textFuellen, werteZiehen } from '../lib/rechnen.js'
import { BEWERTUNG } from '../lib/planer.js'
import { KATEGORIEN, kategorieAus } from '../lib/sichtung.js'

// Feste Reihenfolge waere auswendig lernbar - deshalb wird bei jedem
// Erscheinen neu gemischt. Der Seed haengt an Item und Position, damit
// die Reihenfolge innerhalb einer Frage stabil bleibt.
function mischen(laenge, seed) {
  const reihe = Array.from({ length: laenge }, (_, i) => i)
  let zufall = seed
  for (let i = reihe.length - 1; i > 0; i--) {
    zufall = (zufall * 1103515245 + 12345) & 0x7fffffff
    const j = zufall % (i + 1)
    ;[reihe[i], reihe[j]] = [reihe[j], reihe[i]]
  }
  return reihe
}

export default function Lernen({
  item,
  level,
  art,
  position,
  gesamt,
  faellig,
  neu,
  letzteXp,
  stufen,
  vertiefungZeigen,
  ueberspringenErlauben,
  marke,
  thema,
  istNeu,
  glossar,
  fruehereSkizzen,
  kannZurueck,
  onMarke,
  onBewerten,
  onUeberspringen,
  onZurueckblaettern,
  onRueckgaengig,
  onZurueck,
}) {
  const [aufgedeckt, setAufgedeckt] = useState(false)
  const [eingabe, setEingabe] = useState(null)
  const [notizOffen, setNotizOffen] = useState(false)
  const [erklaerungOffen, setErklaerungOffen] = useState(false)
  const [hilfeGenutzt, setHilfeGenutzt] = useState(false)
  const bildRef = useRef(null)
  const seed = useMemo(() => (item.id + position).split('').reduce((s, z) => s + z.charCodeAt(0), 0), [item.id, position])

  useEffect(() => {
    setAufgedeckt(false)
    setEingabe(null)
    setNotizOffen(false)
    setErklaerungOffen(false)
    setHilfeGenutzt(false)
  }, [item.id, position])

  // Automatische Bewertung, wo die App die Antwort kennt.
  const urteil = useMemo(() => {
    if (item.typ === 'mehrfachauswahl') {
      const gewaehlt = new Set(eingabe ?? [])
      const richtig = new Set(item.richtig)
      if (gewaehlt.size === 0) return null
      const gleich =
        gewaehlt.size === richtig.size && [...richtig].every((r) => gewaehlt.has(r))
      return gleich ? 'richtig' : 'falsch'
    }
    if (item.typ === 'numerisch') {
      const zahl = parseFloat(String(eingabe ?? '').replace(',', '.'))
      if (Number.isNaN(zahl)) return null
      return Math.abs(zahl - item.wert) <= (item.toleranz ?? 0) ? 'richtig' : 'falsch'
    }
    if (item.typ === 'zuordnung') {
      const zuordnung = eingabe ?? {}
      if (Object.keys(zuordnung).length < item.paare.length) return null
      return item.paare.every((_, i) => zuordnung[i] === i) ? 'richtig' : 'falsch'
    }
    if (item.typ === 'freitext') {
    return (
      <div className="beschriftung">
        <textarea
          className="notizfeld"
          style={{ minHeight: '8rem' }}
          value={wert ?? ''}
          disabled={gesperrt}
          placeholder="In eigenen Worten erklären …"
          onChange={(e) => setWert(e.target.value)}
        />
        {!gesperrt && <p className="feldhinweis">Strg + Enter bestätigt, dann Leertaste</p>}
        {gesperrt && (wert ?? '').trim() && (
          <div>
            <h2 className="abschnitt">Deine Erklärung</h2>
            <p className="eigeneAntwort">{wert}</p>
          </div>
        )}
      </div>
    )
  }

  if (item.typ === 'vergleich') {
    return (
      <div className="vergleich">
        {item.seiten.map((seite, i) => {
          const gewaehlt = wert === i
          const richtig = gesperrt && i === item.richtig
          const klasse = [
            'vergleichSeite',
            gewaehlt ? 'aktiv' : '',
            richtig ? 'richtig' : '',
            gesperrt && gewaehlt && !richtig ? 'falsch' : '',
          ].join(' ')
          return (
            <button key={i} className={klasse} disabled={gesperrt} onClick={() => setWert(i)}>
              <span className="vergleichTitel">{seite.titel}</span>
              {seite.bild && <img src={seite.bild} alt="" />}
              <span className="vergleichText">{seite.beschreibung}</span>
            </button>
          )
        })}
      </div>
    )
  }

  if (item.typ === 'rechnen') {
    const werte = werteZiehen(item.variablen, seed)
    let soll = null
    try {
      soll = rechnen(item.formel, werte)
    } catch {
      soll = null
    }
    const zahl = parseFloat(String(wert ?? '').replace(',', '.'))
    const toleranz = item.toleranz ?? (soll !== null ? Math.abs(soll) * 0.02 : 0)
    return (
      <div className="beschriftung">
        <ul className="gegebene">
          {item.variablen.map((v) => (
            <li key={v.name}>
              <span className="paarLinks">{v.titel ?? v.name}</span>
              <span className="paarRechts">
                {Number(werte[v.name].toFixed(v.stellen ?? 3))} {v.einheit ?? ''}
              </span>
            </li>
          ))}
        </ul>
        <div className="zahlzeile">
          <input
            className="zahl"
            inputMode="decimal"
            value={wert ?? ''}
            disabled={gesperrt}
            onChange={(e) => setWert(e.target.value)}
            placeholder="Ergebnis"
          />
          <span className="einheit">{item.einheit}</span>
          {!gesperrt && <span className="feldhinweis">Enter bestätigt, dann Leertaste</span>}
          {gesperrt && soll !== null && (
            <span className={Math.abs(zahl - soll) <= toleranz ? 'urteil richtig' : 'urteil falsch'}>
              Soll: {Number(soll.toFixed(item.stellen ?? 3))} {item.einheit}
            </span>
          )}
        </div>
        {gesperrt && item.loesungsweg && (
          <p className="merksatz">{textFuellen(item.loesungsweg, werte, item.variablen)}</p>
        )}
      </div>
    )
  }

  if (item.typ === 'reihenfolge') {
      const reihe = eingabe ?? null
      if (!reihe) return null
      return reihe.every((wert, i) => wert === i) ? 'richtig' : 'falsch'
    }
    if (item.typ === 'bildbeschriftung') {
      const zuordnung = eingabe ?? {}
      if (Object.keys(zuordnung).length < item.punkte.length) return null
      return item.punkte.every((p, i) => zuordnung[p.nr] === i) ? 'richtig' : 'falsch'
    }
    if (item.typ === 'fehlersuche') {
      if (eingabe == null) return null
      return eingabe === item.fehlerNr ? 'richtig' : 'falsch'
    }
    if (item.typ === 'vergleich') {
      if (eingabe == null) return null
      return eingabe === item.richtig ? 'richtig' : 'falsch'
    }
    if (item.typ === 'rechnen') {
      const zahl = parseFloat(String(eingabe ?? '').replace(',', '.'))
      if (Number.isNaN(zahl)) return null
      try {
        const werte = werteZiehen(item.variablen, seed)
        const soll = rechnen(item.formel, werte)
        const toleranz = item.toleranz ?? Math.abs(soll) * 0.02
        return Math.abs(zahl - soll) <= toleranz ? 'richtig' : 'falsch'
      } catch {
        return null
      }
    }
    return null
  }, [item, eingabe, seed])

  function bewerten(bewertung) {
    const bild = bildRef.current?.() ?? null
    onBewerten(bewertung, bild, hilfeGenutzt)
  }

  // Tastenkuerzel. Leertaste deckt auf, Ziffern bewerten.
  useEffect(() => {
    function taste(e) {
      const imFeld = e.target.matches('input, textarea, select')
      if (imFeld) {
        // In einem Eingabefeld gehoert die Leertaste dem Text.
        // Enter bestaetigt die Eingabe und gibt den Fokus frei -
        // danach funktionieren die Kuerzel wie gewohnt.
        const mitStrg = e.ctrlKey || e.metaKey
        const istTextfeld = e.target.tagName === 'TEXTAREA'
        if (e.key === 'Enter' && (!istTextfeld || mitStrg)) {
          e.preventDefault()
          e.target.blur()
        }
        return
      }
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        if (!aufgedeckt) setAufgedeckt(true)
        else if (art === 'blaettern') bewerten(BEWERTUNG.GUT)
        return
      }
      if (e.key === 'Backspace' && kannZurueck) {
        e.preventDefault()
        onRueckgaengig()
        return
      }
      if (e.key === 'ArrowLeft' && position > 0) {
        e.preventDefault()
        onZurueckblaettern()
        return
      }
      if (!aufgedeckt || art === 'blaettern') {
        if (e.key.toLowerCase() === 'u' && ueberspringenErlauben) onUeberspringen()
        return
      }
      const zuordnung = stufen === 4
        ? { 1: BEWERTUNG.NOCHMAL, 2: BEWERTUNG.SCHWER, 3: BEWERTUNG.GUT, 4: BEWERTUNG.LEICHT }
        : { 1: BEWERTUNG.NOCHMAL, 2: BEWERTUNG.GUT }
      if (zuordnung[e.key]) {
        e.preventDefault()
        bewerten(zuordnung[e.key])
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  })

  const schichten = Array.from({ length: Math.min(Math.max(gesamt, 1), 60) })

  // Die Spaltigkeit haengt am Aufgabentyp, nicht am Aufdeckzustand.
  // Sonst springt das Raster mitten in der Frage.
  const MIT_ARBEITSFLAECHE = ['skizze', 'bildbeschriftung', 'fehlersuche', 'vergleich', 'rechnen']
  const zweispaltig = MIT_ARBEITSFLAECHE.includes(item.typ)

  // Bildaufgaben: Zeichnung rechts, Zuordnung links unter der Frage -
  // so sieht man beides gleichzeitig, ohne zu scrollen.
  const BILDAUFGABEN = ['bildbeschriftung', 'fehlersuche']
  const istBildaufgabe = BILDAUFGABEN.includes(item.typ)
  const namen = istBildaufgabe && item.punkte ? item.punkte.map((p) => p.name) : []
  const kategorie = kategorieAus(marke)

  return (
    <div className="schirm lernschirm">
      <header className="lernkopf">
        <button className="textknopf" onClick={onZurueck}>Zurück</button>
        <div className="schnitt" role="img" aria-label={`${position} von ${gesamt}`}>
          {schichten.map((_, i) => (
            <span key={i} className={i < position ? 'schicht voll' : 'schicht'} />
          ))}
        </div>
        {level && (
          <span className="lernkopfBau" title={`Stufe ${level.stufe}`}>
            <Bauabschnitt stufe={level.stufe} groesse={30} titel={false} marke={false} />
          </span>
        )}
        <span className="pensumZahl">
          {art === 'marathon' ? `${position} · Marathon` : `${position}/${gesamt}`}
          {(faellig > 0 || neu > 0) && (
            <span className="nebentext"> · {faellig} W · {neu} neu</span>
          )}
        </span>
        {letzteXp > 0 && art !== 'blaettern' && <span className="xpFlug">+{letzteXp} XP</span>}
      </header>

      <div className={zweispaltig ? 'lernRaster' : 'lernRaster einspurig'}>
        <article className="karteninhalt">
          <p className="herkunft">
            {istNeu && <span className="neuMarke">Neu</span>}
            {item.modulTitel} · {item.themaTitel}
            {item.geprueft === false && <span className="ungeprueft">ungeprüft</span>}
            {item.bearbeitet && <span className="bearbeitetMarke">bearbeitet</span>}
          </p>

          <h1 className="frage">
            {item.typ === 'rechnen'
              ? textFuellen(item.frage, werteZiehen(item.variablen, seed), item.variablen)
              : item.frage}
          </h1>

          {istNeu && thema?.erklaerung && (
            <div className="erklaerkasten">
              <button className="textknopf" onClick={() => setErklaerungOffen((o) => !o)}>
                {erklaerungOffen ? 'Erklärung ausblenden' : 'Erklärung zum Thema zeigen'}
              </button>
              {erklaerungOffen && (
                <div className="erklaerungText" style={{ marginTop: '0.75rem' }}>
                  {(thema.erklaerung.absaetze ?? []).map((a, i) => (
                    <p key={i} className="erklaerungAbsatz">{a}</p>
                  ))}
                  {thema.erklaerung.merksatz && (
                    <p className="merksatz">{thema.erklaerung.merksatz}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {istBildaufgabe && (
            <BildListe
              item={item}
              wert={eingabe}
              setWert={setEingabe}
              gesperrt={aufgedeckt}
              namen={namen}
            />
          )}

          {aufgedeckt && (
            <div className="antwort">
              {item.pruefpunkte && <Pruefliste key={item.id} punkte={item.pruefpunkte} />}
              <p className="antworttext">{item.antwort}</p>
              {item.vertiefung && vertiefungZeigen && (
                <p className="vertiefung">{item.vertiefung}</p>
              )}
              <p className="quelle">{item.quelle}</p>
              {item.pruefhinweis && <p className="pruefhinweis">{item.pruefhinweis}</p>}
              <Normen item={item} glossar={glossar} />
            </div>
          )}

          <div className="marken">
            <button
              className={marke?.lesezeichen ? 'markenKnopf aktiv' : 'markenKnopf'}
              onClick={() => onMarke(item.id, { lesezeichen: !marke?.lesezeichen })}
            >
              Lesezeichen
            </button>
            <button
              className={marke?.notiz ? 'markenKnopf aktiv' : 'markenKnopf'}
              onClick={() => setNotizOffen((n) => !n)}
            >
              Notiz
            </button>
            <span className="markenTrenner" />
            <span className="zeileHinweis">Sichtung:</span>
            {KATEGORIEN.map((k) => (
              <button
                key={k.id}
                className={kategorie.id === k.id ? 'markenKnopf aktiv' : 'markenKnopf'}
                title={`Als "${k.name}" einordnen`}
                onClick={() =>
                  onMarke(item.id, { kategorie: kategorie.id === k.id ? null : k.id })
                }
              >
                {k.symbol} {k.name}
              </button>
            ))}
          </div>

          {notizOffen && (
            <textarea
              className="notizfeld"
              value={marke?.notiz ?? ''}
              placeholder="Eigene Randbemerkung zu diesem Item …"
              onChange={(e) => onMarke(item.id, { notiz: e.target.value })}
            />
          )}
        </article>

        <div className="arbeitsflaeche">
          {art === 'training' && hilfeGenutzt && !aufgedeckt && item.referenz && (
            <div style={{ marginBottom: '1rem' }}>
              <p className="zeileHinweis">Hilfe genutzt – dieses Item zählt mit halber XP.</p>
              <Bildlupe src={item.referenz} alt="Referenz" />
            </div>
          )}
          <Eingabefeld
            item={item}
            wert={eingabe}
            setWert={setEingabe}
            gesperrt={aufgedeckt}
            bildRef={bildRef}
            seed={seed}
          />

          {aufgedeckt && item.typ === 'skizze' && item.referenz && (
            <div style={{ marginTop: '1rem' }}>
              <Bildlupe src={item.referenz} alt="Referenzzeichnung" />
            </div>
          )}

          {aufgedeckt && fruehereSkizzen?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h2 className="abschnitt">Deine früheren Versuche</h2>
              <div className="skizzenband">
                {fruehereSkizzen.slice(-6).map((s) => (
                  <img key={s.id} src={s.bild} alt=""
                       title={new Date(s.ts).toLocaleDateString('de-DE')} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="steuerung">
        {!aufgedeckt ? (
          <div className="arten">
            <button className="knopf haupt" onClick={() => setAufgedeckt(true)}>
              {item.typ === 'skizze' ? 'Referenz zeigen' : 'Antwort zeigen'}
              <span className="taste">Leertaste</span>
            </button>
            {art === 'training' && item.referenz && !hilfeGenutzt && (
              <button className="artKnopf" onClick={() => setHilfeGenutzt(true)}>
                Referenz kurz zeigen <span className="taste">halbe XP</span>
              </button>
            )}
            {position > 0 && (
              <button className="artKnopf" onClick={onZurueckblaettern}>
                Zurück <span className="taste">←</span>
              </button>
            )}
            {ueberspringenErlauben && art !== 'blaettern' && (
              <button className="artKnopf" onClick={onUeberspringen}>
                Überspringen <span className="taste">U</span>
              </button>
            )}
            {kannZurueck && (
              <button className="artKnopf" onClick={onRueckgaengig}>
                Rückgängig <span className="taste">⌫</span>
              </button>
            )}
          </div>
        ) : art === 'blaettern' ? (
          <button className="knopf haupt" onClick={() => bewerten(BEWERTUNG.GUT)}>
            Weiter <span className="taste">Leertaste</span>
          </button>
        ) : (
          <>
            {urteil && (
              <p className={urteil === 'richtig' ? 'urteilZeile richtig' : 'urteilZeile falsch'}>
                {urteil === 'richtig'
                  ? 'Automatisch als richtig erkannt – Bewertung vorgeschlagen.'
                  : 'Automatisch als falsch erkannt – bei einem Vertipper bitte korrigieren.'}
              </p>
            )}
            <div className="bewertung">
              <button
                className={urteil === 'falsch' ? 'knopf vorschlag' : 'knopf'}
                onClick={() => bewerten(BEWERTUNG.NOCHMAL)}
              >
                Nochmal <span className="taste">1</span>
              </button>
              {stufen === 4 && (
                <button className="knopf" onClick={() => bewerten(BEWERTUNG.SCHWER)}>
                  Schwer <span className="taste">2</span>
                </button>
              )}
              <button
                className={urteil === 'richtig' ? 'knopf vorschlag' : 'knopf'}
                onClick={() => bewerten(BEWERTUNG.GUT)}
              >
                Gut <span className="taste">{stufen === 4 ? '3' : '2'}</span>
              </button>
              {stufen === 4 && (
                <button className="knopf" onClick={() => bewerten(BEWERTUNG.LEICHT)}>
                  Leicht <span className="taste">4</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Zuordnungsliste zur Bildaufgabe. Zeigt denselben Zustand wie die
// Punkte im Bild - anklickbar ist beides.
function BildListe({ item, wert, setWert, gesperrt, namen }) {
  if (item.typ === 'fehlersuche') {
    return (
      <div className="bildListe">
        {!gesperrt ? (
          <p className="zeileHinweis">
            Klicke im Bild den Bereich an, in dem der Fehler steckt.
            {wert ? ` Gewählt: Bereich ${wert}.` : ''}
          </p>
        ) : (
          <p className="merksatz">Fehler in Bereich {item.fehlerNr}: {item.folge}</p>
        )}
      </div>
    )
  }

  const zuordnung = wert ?? {}
  const offen = item.punkte.filter((p) => zuordnung[p.nr] === undefined).length

  return (
    <div className="bildListe">
      {!gesperrt && (
        <p className="zeileHinweis">
          Klicke eine Zahl im Bild an und wähle die Bezeichnung. Noch {offen} offen.
        </p>
      )}
      <ul className="zuordnungsliste">
        {item.punkte.map((p, i) => {
          const gewaehltIndex = zuordnung[p.nr]
          const richtig = gesperrt && gewaehltIndex === i
          return (
            <li key={p.nr} className={gesperrt ? (richtig ? 'richtig' : 'falsch') : ''}>
              <span className="zuordnungNr">{p.nr}</span>
              {gesperrt ? (
                <span className="zuordnungText">
                  {p.name}
                  {!richtig && gewaehltIndex !== undefined && (
                    <span className="zuordnungDaneben"> statt {namen[gewaehltIndex]}</span>
                  )}
                </span>
              ) : (
                <select
                  className="paarWahl"
                  value={gewaehltIndex ?? ''}
                  onChange={(e) => setWert({ ...zuordnung, [p.nr]: Number(e.target.value) })}
                >
                  <option value="">bitte benennen …</option>
                  {namen.map((name, j) => (
                    <option key={j} value={j}>{name}</option>
                  ))}
                </select>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Pruefliste({ punkte }) {
  const [gehakt, setGehakt] = useState([])
  return (
    <>
      <ul className="pruefpunkte">
        {punkte.map((text, i) => (
          <li key={i}>
            <input
              type="checkbox"
              id={`pp-${i}`}
              checked={gehakt.includes(i)}
              onChange={() =>
                setGehakt((g) => (g.includes(i) ? g.filter((x) => x !== i) : [...g, i]))
              }
            />
            <label htmlFor={`pp-${i}`}>{text}</label>
          </li>
        ))}
      </ul>
      <p className="pruefstand">{gehakt.length} von {punkte.length} getroffen</p>
    </>
  )
}

function Eingabefeld({ item, wert, setWert, gesperrt, bildRef, seed }) {
  // Bildaufgaben: die Zeichnung gehoert in die Arbeitsflaeche. Ohne diese
  // beiden Zweige fiel Eingabefeld bis hierher durch bis zum return null -
  // die Fehlersuche zeigte gar nichts, die Bildbeschriftung nur die Liste.
  if (item.typ === 'bildbeschriftung') {
    const zuordnung = wert ?? {}
    return (
      <Bildpunkte
        referenz={item.referenz}
        punkte={item.punkte}
        zuordnung={zuordnung}
        namen={item.punkte.map((p) => p.name)}
        aufgedeckt={gesperrt}
        onWahl={(nr, index) => setWert({ ...zuordnung, [nr]: index })}
      />
    )
  }

  if (item.typ === 'fehlersuche') {
    return (
      <Bildpunkte
        referenz={item.referenz}
        punkte={item.bereiche}
        aufgedeckt={gesperrt}
        gewaehlt={wert ?? null}
        onWahl={(nr) => setWert(nr)}
        loesung={gesperrt ? item.fehlerNr : null}
      />
    )
  }

  if (item.typ === 'skizze') {
    return <Skizzenfeld referenz={item.referenz} aufgedeckt={gesperrt} bildRef={bildRef} />
  }

  if (item.typ === 'mehrfachauswahl') {
    const reihe = mischen(item.optionen.length, seed)
    const gewaehlt = wert ?? []
    return (
      <ul className="optionen">
        {reihe.map((i) => {
          const aktiv = gewaehlt.includes(i)
          const richtig = item.richtig.includes(i)
          const klasse = [
            'option',
            aktiv ? 'aktiv' : '',
            gesperrt && richtig ? 'richtig' : '',
            gesperrt && aktiv && !richtig ? 'falsch' : '',
          ].join(' ')
          return (
            <li key={i}>
              <button
                className={klasse}
                disabled={gesperrt}
                onClick={() => setWert(aktiv ? gewaehlt.filter((g) => g !== i) : [...gewaehlt, i])}
              >
                {item.optionen[i]}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  if (item.typ === 'numerisch') {
    const zahl = parseFloat(String(wert ?? '').replace(',', '.'))
    const trifft = Math.abs(zahl - item.wert) <= (item.toleranz ?? 0)
    return (
      <div className="zahlzeile">
        <input
          className="zahl"
          inputMode="decimal"
          value={wert ?? ''}
          disabled={gesperrt}
          onChange={(e) => setWert(e.target.value)}
          placeholder="Wert"
        />
        <span className="einheit">{item.einheit}</span>
        {gesperrt && !Number.isNaN(zahl) && (
          <span className={trifft ? 'urteil richtig' : 'urteil falsch'}>
            {trifft ? 'im Rahmen' : `Soll: ${item.wert}`}
          </span>
        )}
        {!gesperrt && <span className="feldhinweis">Enter bestätigt, dann Leertaste</span>}
      </div>
    )
  }

  // Zuordnung wird jetzt tatsaechlich abgefragt: Die rechte Spalte ist
  // gemischt, die Zuweisung erfolgt ueber Auswahlfelder.
  if (item.typ === 'freitext') {
    return (
      <div className="beschriftung">
        <textarea
          className="notizfeld"
          style={{ minHeight: '8rem' }}
          value={wert ?? ''}
          disabled={gesperrt}
          placeholder="In eigenen Worten erklären …"
          onChange={(e) => setWert(e.target.value)}
        />
        {!gesperrt && <p className="feldhinweis">Strg + Enter bestätigt, dann Leertaste</p>}
        {gesperrt && (wert ?? '').trim() && (
          <div>
            <h2 className="abschnitt">Deine Erklärung</h2>
            <p className="eigeneAntwort">{wert}</p>
          </div>
        )}
      </div>
    )
  }

  if (item.typ === 'vergleich') {
    return (
      <div className="vergleich">
        {item.seiten.map((seite, i) => {
          const gewaehlt = wert === i
          const richtig = gesperrt && i === item.richtig
          const klasse = [
            'vergleichSeite',
            gewaehlt ? 'aktiv' : '',
            richtig ? 'richtig' : '',
            gesperrt && gewaehlt && !richtig ? 'falsch' : '',
          ].join(' ')
          return (
            <button key={i} className={klasse} disabled={gesperrt} onClick={() => setWert(i)}>
              <span className="vergleichTitel">{seite.titel}</span>
              {seite.bild && <img src={seite.bild} alt="" />}
              <span className="vergleichText">{seite.beschreibung}</span>
            </button>
          )
        })}
      </div>
    )
  }

  if (item.typ === 'rechnen') {
    const werte = werteZiehen(item.variablen, seed)
    let soll = null
    try {
      soll = rechnen(item.formel, werte)
    } catch {
      soll = null
    }
    const zahl = parseFloat(String(wert ?? '').replace(',', '.'))
    const toleranz = item.toleranz ?? (soll !== null ? Math.abs(soll) * 0.02 : 0)
    return (
      <div className="beschriftung">
        <ul className="gegebene">
          {item.variablen.map((v) => (
            <li key={v.name}>
              <span className="paarLinks">{v.titel ?? v.name}</span>
              <span className="paarRechts">
                {Number(werte[v.name].toFixed(v.stellen ?? 3))} {v.einheit ?? ''}
              </span>
            </li>
          ))}
        </ul>
        <div className="zahlzeile">
          <input
            className="zahl"
            inputMode="decimal"
            value={wert ?? ''}
            disabled={gesperrt}
            onChange={(e) => setWert(e.target.value)}
            placeholder="Ergebnis"
          />
          <span className="einheit">{item.einheit}</span>
          {!gesperrt && <span className="feldhinweis">Enter bestätigt, dann Leertaste</span>}
          {gesperrt && soll !== null && (
            <span className={Math.abs(zahl - soll) <= toleranz ? 'urteil richtig' : 'urteil falsch'}>
              Soll: {Number(soll.toFixed(item.stellen ?? 3))} {item.einheit}
            </span>
          )}
        </div>
        {gesperrt && item.loesungsweg && (
          <p className="merksatz">{textFuellen(item.loesungsweg, werte, item.variablen)}</p>
        )}
      </div>
    )
  }

  if (item.typ === 'reihenfolge') {
    const reihe = wert ?? mischen(item.schritte.length, seed + 3)
    function schieben(von, nach) {
      if (nach < 0 || nach >= reihe.length) return
      const neu = [...reihe]
      ;[neu[von], neu[nach]] = [neu[nach], neu[von]]
      setWert(neu)
    }
    return (
      <ol className="reihenfolge">
        {reihe.map((index, platz) => {
          const richtig = gesperrt && index === platz
          return (
            <li key={index} className={gesperrt ? (richtig ? 'richtig' : 'falsch') : ''}>
              <span className="reihenNr">{platz + 1}</span>
              <span className="reihenText">{item.schritte[index]}</span>
              {!gesperrt && (
                <span className="reihenPfeile">
                  <button className="artKnopf" onClick={() => schieben(platz, platz - 1)}>↑</button>
                  <button className="artKnopf" onClick={() => schieben(platz, platz + 1)}>↓</button>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    )
  }

  if (item.typ === 'zuordnung') {
    const reihe = mischen(item.paare.length, seed + 7)
    const zuordnung = wert ?? {}
    return (
      <ul className="paare">
        {item.paare.map(([links], i) => {
          const gewaehlt = zuordnung[i]
          const richtig = gesperrt && gewaehlt === i
          return (
            <li key={i} className={gesperrt ? (richtig ? 'paarRichtig' : 'paarFalsch') : ''}>
              <span className="paarLinks">{links}</span>
              {gesperrt ? (
                <span className="paarRechts">{item.paare[i][1]}</span>
              ) : (
                <select
                  className="paarWahl"
                  value={gewaehlt ?? ''}
                  onChange={(e) => setWert({ ...zuordnung, [i]: Number(e.target.value) })}
                >
                  <option value="">bitte zuordnen …</option>
                  {reihe.map((j) => (
                    <option key={j} value={j}>{item.paare[j][1]}</option>
                  ))}
                </select>
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return null
}
