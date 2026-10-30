import { useState } from 'react'
import Schleier from './Schleier.jsx'

// Einfuehrung beim ersten Start (Onboarding, 2026-10-29): vier kurze
// Schritte, jederzeit ueberspringbar. Neue Profile ohne eine Antwort sehen
// auf Heute eine Willkommenskarte, die sie oeffnet; danach jederzeit ueber
// Einstellungen › Hilfe. Bewusst kein Fenster, das sich von selbst oeffnet.
// Nicht zu verwechseln mit dem Einfuehrungsschritt je Thema (D4, opt.eingefuehrt).
const SCHRITTE = [
  {
    titel: 'Heute',
    text: [
      'Hier beginnt jeder Lerntag. „Lernen“ startet dein Tagespensum: erst die fälligen Wiederholungen, dann ein paar neue Karten. Wie viele neue es pro Tag sind, stellst du in den Einstellungen ein.',
      'Weiter unten stehen Betriebsarten wie Marathon oder Schnellrunde – sie zählen als Übung und bringen den Plan nicht durcheinander.',
    ],
  },
  {
    titel: 'Aufdecken und bewerten',
    text: [
      'Überleg dir die Antwort zuerst selbst, dann deck auf (Knopf oder Leertaste).',
      'Danach bewertest du ehrlich, wie gut es saß – etwa Nochmal, Schwer, Gut oder Leicht. Daraus plant die App, wann die Karte wiederkommt: Was sitzt, kommt immer seltener.',
    ],
  },
  {
    titel: 'Themen, Fokus und Lexikon',
    text: [
      'Unter Themen stehen alle Module; jedes Thema hat eine eigene Seite mit Erklärung, Zeichnungen und Lernstand.',
      'Bereitest du etwas gezielt vor, leg das Thema oder ein ganzes Modul in den Fokus – dann bekommt es auf Heute einen eigenen Lernknopf. Unterstrichene Fachbegriffe öffnen das Lexikon.',
    ],
  },
  {
    titel: 'Sichern und Dropbox',
    text: [
      'Dein Fortschritt liegt nur in diesem Browser. Sichere ihn ab und zu in den Einstellungen, oder verbinde Dropbox – dann gleichen sich deine Geräte von selbst ab.',
      'Diese Einführung findest du jederzeit wieder unter Einstellungen › Hilfe.',
    ],
  },
]

export default function Einfuehrung({ onSchliessen }) {
  const [schritt, setSchritt] = useState(0)
  const s = SCHRITTE[schritt]
  const letzter = schritt === SCHRITTE.length - 1
  return (
    <Schleier onSchliessen={onSchliessen} beschriftung="Einführung" startFokus=".einfuehrungWeiter">
      <article className="grosseKarte einfuehrung" style={{ maxWidth: '32rem' }} onClick={(e) => e.stopPropagation()}>
        <p className="herkunft">Einführung · {schritt + 1} von {SCHRITTE.length}</p>
        <h2 className="ueberschrift">{s.titel}</h2>
        {s.text.map((absatz, i) => (
          <p key={i} className="erklaerungAbsatz">{absatz}</p>
        ))}
        <div className="einfuehrungPunkte" aria-hidden="true">
          {SCHRITTE.map((_, i) => (
            <span key={i} className={i === schritt ? 'aktiv' : undefined} />
          ))}
        </div>
        <div className="wahl">
          {schritt > 0 && (
            <button className="knopf schmal" onClick={() => setSchritt(schritt - 1)}>Zurück</button>
          )}
          <button
            className="knopf haupt schmal einfuehrungWeiter"
            onClick={() => (letzter ? onSchliessen() : setSchritt(schritt + 1))}
          >
            {letzter ? 'Los geht’s' : 'Weiter'}
          </button>
          {!letzter && (
            <button className="textknopf" onClick={onSchliessen}>Überspringen</button>
          )}
        </div>
      </article>
    </Schleier>
  )
}
