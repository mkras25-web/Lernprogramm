import Bildlupe from './Bildlupe.jsx'
import LokalBild from './LokalBild.jsx'
import Bildpunkte from './Bildpunkte.jsx'
import Normen from './Normen.jsx'
import { rechnen, textFuellen, werteZiehen } from '../lib/rechnen.js'
import { punkteFuer } from '../lib/punkte.js'

// Zeigt ein Item vollständig aufgedeckt - so, wie es im Lernmodus nach
// dem Aufdecken aussieht, aber ohne Bewertung und ohne Folgen für den
// Fortschritt. Wird zum Nachschlagen und beim Sichten verwendet.
export default function Itemansicht({ item, glossar, zustand, verlauf }) {
  return (
    <article className="itemansicht">
      <p className="herkunft">
        {item.modulTitel} · {item.themaTitel}
        <span className="punkteMarke">{punkteFuer(item)} P</span>
        {item.geprueft === false && <span className="ungeprueft">ungeprüft</span>}
        {item.bearbeitet && <span className="bearbeitetMarke">bearbeitet</span>}
      </p>

      <h1 className="frage">
        {item.typ === 'rechnen'
          ? textFuellen(item.frage, werteZiehen(item.variablen, 7), item.variablen)
          : item.frage}
      </h1>

      <Aufgabenteil item={item} />

      <div className="antwort">
        {item.pruefpunkte && (
          <>
            <h2 className="abschnitt">Prüfpunkte</h2>
            <ul className="pruefpunkte">
              {item.pruefpunkte.map((text, i) => (
                <li key={i}>
                  <span className="pruefZeichen" aria-hidden="true">·</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="antworttext">{item.antwort}</p>
        {item.vertiefung && <p className="vertiefung">{item.vertiefung}</p>}
        {item.bild && (
          <figure style={{ margin: 0 }}>
            <Bildlupe src={item.bild} alt={item.bildunterschrift ?? ''} />
            {item.bildunterschrift && (
              <figcaption className="quelle" style={{ paddingTop: '0.5rem' }}>
                {item.bildunterschrift}
              </figcaption>
            )}
          </figure>
        )}
        <p className="quelle">{item.quelle}</p>
        {item.pruefhinweis && <p className="pruefhinweis">{item.pruefhinweis}</p>}
        <Normen item={item} glossar={glossar} />
      </div>

      <div className="itemFuss">
        <p className="quelle">{faelligkeitText(zustand)}</p>
        {verlauf?.length > 0 && <Verlauf ereignisse={verlauf} />}
      </div>
    </article>
  )
}

// Der typspezifische Teil - immer in der aufgedeckten Fassung.
function Aufgabenteil({ item }) {
  switch (item.typ) {
    case 'mehrfachauswahl':
      return (
        <ul className="optionen">
          {item.optionen.map((text, i) => (
            <li key={i}>
              <span className={item.richtig.includes(i) ? 'option richtig' : 'option'}>
                {item.richtig.includes(i) ? '✓ ' : '· '}
                {text}
              </span>
            </li>
          ))}
        </ul>
      )

    case 'numerisch':
      return (
        <p className="loesungswert">
          {item.wert} {item.einheit}
          {item.toleranz ? <span className="nebentext"> · Toleranz ±{item.toleranz}</span> : null}
        </p>
      )

    case 'zuordnung':
      return (
        <ul className="paare">
          {item.paare.map(([links, rechts], i) => (
            <li key={i} className="paarRichtig">
              <span className="paarLinks">{links}</span>
              <span className="paarRechts">{rechts}</span>
            </li>
          ))}
        </ul>
      )

    case 'reihenfolge':
      return (
        <ol className="reihenfolge">
          {item.schritte.map((text, i) => (
            <li key={i} className="richtig">
              <span className="reihenNr">{i + 1}</span>
              <span className="reihenText">{text}</span>
            </li>
          ))}
        </ol>
      )

    case 'skizze':
      return item.referenz ? <Bildlupe src={item.referenz} alt="Referenzzeichnung" /> : null

    case 'bildbeschriftung': {
      const loesung = {}
      item.punkte.forEach((p, i) => { loesung[p.nr] = i })
      return (
        <div className="beschriftung">
          <Bildpunkte
            referenz={item.referenz}
            punkte={item.punkte}
            zuordnung={loesung}
            namen={item.punkte.map((p) => p.name)}
            aufgedeckt
          />
          <ul className="zuordnungsliste">
            {item.punkte.map((p) => (
              <li key={p.nr} className="richtig">
                <span className="zuordnungNr">{p.nr}</span>
                <span className="zuordnungText">{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }

    case 'fehlersuche':
      return (
        <div className="beschriftung">
          <Bildpunkte
            referenz={item.referenz}
            punkte={item.bereiche}
            gewaehlt={item.fehlerNr}
            loesung={item.fehlerNr}
          />
          <p className="merksatz">
            Fehler in Bereich {item.fehlerNr}: {item.folge}
          </p>
        </div>
      )

    case 'vergleich':
      return (
        <div className="vergleich">
          {item.seiten.map((seite, i) => (
            <div key={i} className={i === item.richtig ? 'vergleichSeite richtig' : 'vergleichSeite'}>
              <span className="vergleichTitel">
                {i === item.richtig ? '✓ ' : ''}
                {seite.titel}
              </span>
              {seite.bild && <LokalBild src={seite.bild} alt="" />}
              <span className="vergleichText">{seite.beschreibung}</span>
            </div>
          ))}
        </div>
      )

    case 'rechnen': {
      const werte = werteZiehen(item.variablen, 7)
      let ergebnis = null
      try {
        ergebnis = rechnen(item.formel, werte)
      } catch {
        ergebnis = null
      }
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
          {ergebnis !== null && (
            <p className="loesungswert">
              {Number(ergebnis.toFixed(item.stellen ?? 3))} {item.einheit}
              <span className="nebentext"> · ein Beispielsatz von Zahlen</span>
            </p>
          )}
          {item.loesungsweg && (
            <p className="merksatz">{textFuellen(item.loesungsweg, werte, item.variablen)}</p>
          )}
        </div>
      )
    }

    default:
      return null
  }
}

function faelligkeitText(zustand) {
  if (!zustand) return 'Noch nicht gelernt'
  const tage = Math.round((zustand.faelligAb - Date.now()) / 86400000)
  if (tage < 0) return `Seit ${Math.abs(tage)} Tagen fällig · Intervall ${zustand.intervall} Tage`
  if (tage === 0) return `Heute fällig · Intervall ${zustand.intervall} Tage`
  return `Wieder fällig in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} · Intervall ${zustand.intervall} Tage`
}

const BEWERTUNGSNAMEN = { 1: 'Nochmal', 2: 'Schwer', 3: 'Gut', 4: 'Leicht' }

function Verlauf({ ereignisse }) {
  return (
    <>
      <h2 className="abschnitt">Verlauf</h2>
      <ol className="verlauf">
        {[...ereignisse].reverse().slice(0, 12).map((e) => (
          <li key={e.id}>
            <span>{new Date(e.ts).toLocaleDateString('de-DE')}</span>
            <span className={e.bewertung === 1 ? 'verlaufFalsch' : 'verlaufRichtig'}>
              {BEWERTUNGSNAMEN[e.bewertung]}
            </span>
            <span className="nebentext">{e.dauerMs ? `${Math.round(e.dauerMs / 1000)} s` : ''}</span>
          </li>
        ))}
      </ol>
    </>
  )
}
