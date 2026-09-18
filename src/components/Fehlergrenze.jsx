import { Component } from 'react'

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
        <div className="schirm">
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
                localStorage.removeItem('offeneSitzung')
                window.location.reload()
              }}
            >
              Angefangene Sitzung verwerfen und neu laden
            </button>
          </div>
        </div>
      </div>
    )
  }
}
