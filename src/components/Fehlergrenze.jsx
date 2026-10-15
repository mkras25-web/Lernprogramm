import { Component } from 'react'

// Fehlergrenze um EINE Karte (T4, 2026-10-13): Stuerzt die Anzeige einer
// einzelnen Karte ab (fehlerhafte Itemdatei), bleibt der Rest der App
// bedienbar - die Karte laesst sich ueberspringen und melden. Mit key={item.id}
// einsetzen, damit die naechste Karte frisch beginnt.
export class KartenGrenze extends Component {
  constructor(props) {
    super(props)
    this.state = { fehler: null }
  }

  static getDerivedStateFromError(fehler) {
    return { fehler }
  }

  componentDidCatch(fehler, info) {
    console.error(`Karte ${this.props.kennung} nicht darstellbar:`, fehler, info)
  }

  render() {
    if (!this.state.fehler) return this.props.children
    const { kennung, onWeiter, onZurueck } = this.props
    return (
      <div role="main" className="schirm">
        <h1 className="ueberschrift">Diese Karte lässt sich nicht anzeigen</h1>
        <p className="nebentext">
          Karte <code>{kennung}</code> enthält einen Fehler. Dein Fortschritt ist nicht betroffen. Melde die
          Kennung im Themen-Chat, damit sie überarbeitet wird.
        </p>
        <pre className="fehlertext">{String(this.state.fehler?.message ?? this.state.fehler)}</pre>
        <div className="wahl">
          {onWeiter && (
            <button className="knopf schmal" onClick={onWeiter}>
              Karte überspringen
            </button>
          )}
          {onZurueck && (
            <button className="knopf schmal" onClick={onZurueck}>
              Sitzung beenden
            </button>
          )}
        </div>
      </div>
    )
  }
}

// Faengt Programmfehler ab, damit ein einzelner Fehler nicht den
// ganzen Bildschirm weiss laesst. Zeigt stattdessen die Meldung -
// das ist der Unterschied zwischen "kaputt" und "behebbar".
export default class Fehlergrenze extends Component {
  constructor(props) {
    super(props)
    this.state = { fehler: null }
  }

  static getDerivedStateFromError(fehler) {
    return { fehler }
  }

  componentDidCatch(fehler, info) {
    console.error('Fehler in der Oberfläche:', fehler, info)
  }

  render() {
    if (!this.state.fehler) return this.props.children

    return (
      <div className="huelle einspaltig">
        <div role="main" className="schirm">
          <h1 className="ueberschrift">Da ist etwas schiefgegangen</h1>
          <p className="nebentext">
            Dein Fortschritt ist nicht betroffen – er liegt in der Datenbank, nicht in der
            Anzeige. Lade die Seite neu; kommt der Fehler wieder, schick mir die Meldung.
          </p>
          <pre className="fehlertext">{String(this.state.fehler?.message ?? this.state.fehler)}</pre>
          <div className="wahl">
            <button className="knopf schmal" onClick={() => window.location.reload()}>
              Neu laden
            </button>
            <button
              className="knopf schmal"
              onClick={() => {
                // Profilbezogen heisst der Schluessel offeneSitzung_<profilId>
                // (useLernsitzung.js) bzw. offenePruefung_<profilId> (App.jsx)
                // - alle Varianten entfernen, die Fehlergrenze kennt das
                // aktive Profil nicht. Ohne die Pruefung stuerzte eine
                // angefangene Pruefung mit kaputter Karte immer wieder ab (B4).
                for (const k of Object.keys(localStorage)) {
                  if (/^offene(Sitzung|Pruefung)(_|$)/.test(k)) localStorage.removeItem(k)
                }
                window.location.reload()
              }}
            >
              Angefangene Sitzung und Prüfung verwerfen, neu laden
            </button>
          </div>
        </div>
      </div>
    )
  }
}
