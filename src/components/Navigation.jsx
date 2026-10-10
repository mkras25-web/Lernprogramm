import { Fragment, useEffect, useState } from 'react'
import Schleier from './Schleier.jsx'
import Bauabschnitt from './Bauabschnitt.jsx'

// Seitenleiste (Desktop), untere Leiste und Mehr-Blatt (mobil) - aus
// App.jsx herausgeloest (52B, 2026-10-10). Gibt ein Fragment zurueck: die
// Elemente muessen direkte Kinder von .huelle bleiben (Grid/CSS).

// ︎ (Text-Darstellungs-Selektor) hinter jedem Symbol - ohne das
// rendert Safari z. B. das Zahnrad farbig als Emoji, obwohl alle
// anderen Symbole hier einfache einfarbige Linienzeichen bleiben.
// gruppe: Ueberschrift in der Desktop-Seitenleiste (44A) - Lernen,
// Nachschlagen, Auswertung; Einstellungen unten abgesetzt.
const NAVIGATION = [
  { id: 'heute', titel: 'Heute', symbol: '◴︎', gruppe: 'Lernen' },
  { id: 'themen', titel: 'Themen', symbol: '▤︎', gruppe: 'Lernen' },
  { id: 'pruefung', titel: 'Prüfungen', symbol: '✓︎', gruppe: 'Lernen' },
  { id: 'sichtung', titel: 'Nachschlagen', symbol: '⌕︎', gruppe: 'Nachschlagen' },
  { id: 'glossar', titel: 'Normen', symbol: '§︎', gruppe: 'Nachschlagen' },
  { id: 'heft', titel: 'Mein Heft', symbol: '❐︎', gruppe: 'Nachschlagen' },
  { id: 'fehlerbuch', titel: 'Fehlerbuch', symbol: '✕︎', gruppe: 'Nachschlagen' },
  { id: 'skizzen', titel: 'Skizzen', symbol: '✎︎', gruppe: 'Nachschlagen' },
  { id: 'fortschritt', titel: 'Fortschritt', symbol: '◑︎', gruppe: 'Auswertung' },
  { id: 'einstellungen', titel: 'Einstellungen', symbol: '⛭︎', gruppe: 'unten' },
]

// Mobil (< 60rem): untere Leiste mit vier Hauptzielen plus "Mehr", das
// die uebrigen Ziele als Blatt von unten oeffnet. Ab 60rem bleibt es bei
// der Seitenleiste (.navigation), die Leiste ist dort per CSS aus.
const HAUPTZIELE = ['heute', 'themen', 'pruefung', 'fortschritt']
const MEHR_UNTERTITEL = {
  sichtung: 'Volltextsuche, Lesezeichen, Sichtung',
  glossar: 'Glossar der Regelwerke',
  heft: 'Alle Notizen und Lesezeichen',
  fehlerbuch: 'Jede Karte, die je falsch war',
  skizzen: 'Gespeicherte Zeichnungen',
  einstellungen: 'Palette, Schrift, Sichern, Dropbox',
}

// Sammlung ist seit 2026-10-10 ein Reiter unter Fortschritt (25A) - eigene
// Adresse (#/sammlung), aber kein eigener Navigationseintrag.
export const ZIELE = new Set([...NAVIGATION.map((n) => n.id), 'sammlung', 'lernen'])
const navAktiv = (id, ansicht) => ansicht === id || (id === 'fortschritt' && ansicht === 'sammlung')

export default function Navigation({
  ansicht,
  setAnsicht,
  paketliste,
  aktivesPaket,
  onPaketWahl,
  level,
  gestaltung,
  profilName,
  onProfilWechseln,
  pruefungHinweis,
}) {
  // Nur auf Schmal-/Handy-Breiten relevant (siehe styles.css): das
  // "Mehr"-Blatt der unteren Leiste. Ab 60rem gibt es weder Leiste noch
  // Blatt, die Seitenleiste zeigt alle Ziele.
  const [mehrOffen, setMehrOffen] = useState(false)

  // Bleibt das Blatt offen, waehrend das Fenster (oder eine
  // Bildschirmdrehung) ueber die Desktop-Breite waechst, soll es nicht
  // haengen bleiben, bis wieder verkleinert wird.
  useEffect(() => {
    const abfrage = window.matchMedia('(min-width: 60rem)')
    const schliessenFallsDesktop = () => {
      if (abfrage.matches) setMehrOffen(false)
    }
    abfrage.addEventListener('change', schliessenFallsDesktop)
    return () => abfrage.removeEventListener('change', schliessenFallsDesktop)
  }, [])

  return (
    <>
      <nav className="navigation">
        {paketliste.length > 1 && (
          <PaketSchalter paketliste={paketliste} aktiv={aktivesPaket} onWahl={onPaketWahl} />
        )}
        {NAVIGATION.map((n, i) => (
          <Fragment key={n.id}>
            {n.gruppe !== 'unten' && n.gruppe !== NAVIGATION[i - 1]?.gruppe && (
              <span className="navGruppe">{n.gruppe}</span>
            )}
            {n.gruppe === 'unten' && <span className="navTrenner" aria-hidden="true" />}
            <button
              className={navAktiv(n.id, ansicht) ? 'navKnopf aktiv' : 'navKnopf'}
              aria-current={navAktiv(n.id, ansicht) ? 'page' : undefined}
              onClick={() => setAnsicht(n.id)}
            >
              <span aria-hidden="true">{n.symbol}</span>
              {n.titel}
            </button>
          </Fragment>
        ))}
        <button className="navFuss" onClick={onProfilWechseln} title="Profil wechseln">
          <Bauabschnitt stufe={level.stufe} gestaltung={gestaltung} groesse={34} titel={false} marke={false} />
          <span className="navFussText">
            <span className="navFussName">{profilName}</span>
            <span className="navFussStufe">Stufe {level.stufe} · Profil wechseln</span>
          </span>
        </button>
      </nav>

      <nav className="tabLeiste" aria-label="Hauptnavigation">
        {HAUPTZIELE.map((id) => {
          const n = NAVIGATION.find((z) => z.id === id)
          const aktiv = navAktiv(id, ansicht) && !mehrOffen
          return (
            <button
              key={id}
              className={aktiv ? 'tabKnopf aktiv' : 'tabKnopf'}
              aria-current={aktiv ? 'page' : undefined}
              onClick={() => {
                setAnsicht(id)
                setMehrOffen(false)
              }}
            >
              <span className="tabSymbol" aria-hidden="true">{n.symbol}</span>
              <span className="tabName">{n.titel}</span>
              {id === 'pruefung' && pruefungHinweis && (
                <span className="tabPunkt" title={pruefungHinweis.text} />
              )}
            </button>
          )
        })}
        <button
          className={mehrOffen || !HAUPTZIELE.some((id) => navAktiv(id, ansicht)) ? 'tabKnopf aktiv' : 'tabKnopf'}
          aria-expanded={mehrOffen}
          onClick={() => setMehrOffen((o) => !o)}
        >
          <span className="tabSymbol" aria-hidden="true">⋯︎</span>
          <span className="tabName">Mehr</span>
        </button>
      </nav>

      {mehrOffen && (
        // Escape, Fokus und Hintergrund-Klick regelt der Schleier.
        <Schleier onSchliessen={() => setMehrOffen(false)} klasse="mehrSchleier" beschriftung="Weitere Bereiche">
          <div className="mehrBlatt" onClick={(e) => e.stopPropagation()}>
            <div className="mehrGriff" aria-hidden="true" />
            <h2 className="mehrTitel">Mehr</h2>
            {paketliste.length > 1 && (
              <PaketSchalter paketliste={paketliste} aktiv={aktivesPaket} onWahl={onPaketWahl} />
            )}
            {NAVIGATION.filter((n) => !HAUPTZIELE.includes(n.id)).map((n) => (
              <button
                key={n.id}
                className={ansicht === n.id ? 'mehrZeile aktiv' : 'mehrZeile'}
                onClick={() => {
                  setAnsicht(n.id)
                  setMehrOffen(false)
                }}
              >
                <span className="mehrSymbol" aria-hidden="true">{n.symbol}</span>
                <span className="mehrText">
                  <span className="mehrName">{n.titel}</span>
                  <span className="mehrUntertitel">{MEHR_UNTERTITEL[n.id]}</span>
                </span>
                <span className="mehrPfeil" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </Schleier>
      )}
    </>
  )
}

// Reiter oben in Fortschritt und Sammlung (25A): beide Teile der Auswertung.
export function AuswertungReiter({ ansicht, setAnsicht }) {
  return (
    <div className="reiter auswertungReiter">
      <button
        className={ansicht === 'fortschritt' ? 'reiterKnopf aktiv' : 'reiterKnopf'}
        onClick={() => setAnsicht('fortschritt')}
      >
        Übersicht
      </button>
      <button
        className={ansicht === 'sammlung' ? 'reiterKnopf aktiv' : 'reiterKnopf'}
        onClick={() => setAnsicht('sammlung')}
      >
        Sammlung
      </button>
    </div>
  )
}

// Paketschalter (32A): oben in der Seitenleiste bzw. im Mehr-Blatt.
function PaketSchalter({ paketliste, aktiv, onWahl }) {
  return (
    <div className="paketSchalter" role="group" aria-label="Inhaltspaket">
      {paketliste.map((pa) => (
        <button
          key={pa.id}
          className={pa.id === aktiv ? 'wahlKnopf aktiv' : 'wahlKnopf'}
          aria-pressed={pa.id === aktiv}
          onClick={() => onWahl(pa.id)}
        >
          {pa.kurz ?? pa.titel.split(' ')[0]}
        </button>
      ))}
    </div>
  )
}
