import { Component, Suspense } from 'react'

// Code-Splitting (T7, 2026-10-13): Bildschirme ausser Heute und Lernen
// werden erst beim ersten Aufruf geladen (React.lazy in App.jsx). Offline
// liegen sie trotzdem bereit - der Service Worker hat alle Teile im Precache.
//
// Ein alter Tab nach einem Update findet den Teil mit dem alten Namen nicht
// mehr: dann einmal neu laden (Merker in sessionStorage verhindert eine
// Endlosschleife), statt einen leeren Bildschirm zu zeigen.
const MERKER = 'nachladen_neu_geladen'

function istLadefehler(fehler) {
  return /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError/i.test(
    String(fehler?.message ?? fehler)
  )
}

class Ladegrenze extends Component {
  constructor(props) {
    super(props)
    this.state = { fehler: null }
  }

  static getDerivedStateFromError(fehler) {
    return { fehler }
  }

  componentDidCatch(fehler) {
    if (!istLadefehler(fehler)) return
    let schon = false
    try {
      schon = sessionStorage.getItem(MERKER) === '1'
      sessionStorage.setItem(MERKER, '1')
    } catch {
      /* ohne sessionStorage lieber nicht automatisch neu laden */
      schon = true
    }
    if (!schon) window.location.reload()
  }

  render() {
    if (!this.state.fehler) return this.props.children
    return (
      <div className="schirm">
        <h1 className="ueberschrift">Dieser Bereich lässt sich nicht laden</h1>
        <p className="nebentext">
          {istLadefehler(this.state.fehler)
            ? 'Vermutlich wurde die App inzwischen aktualisiert. Einmal neu laden behebt das.'
            : String(this.state.fehler?.message ?? this.state.fehler)}
        </p>
        <div className="wahl">
          <button className="knopf schmal haupt" onClick={() => window.location.reload()}>
            Neu laden
          </button>
        </div>
      </div>
    )
  }
}

export default function Nachladen({ children }) {
  return (
    <Ladegrenze>
      <Suspense fallback={<div className="schirm" aria-busy="true" />}>{children}</Suspense>
    </Ladegrenze>
  )
}

// Nach erfolgreichem Start den Merker loesen, damit ein spaeteres Update
// wieder einmal automatisch neu laden darf.
export function nachladenMerkerLoesen() {
  try {
    sessionStorage.removeItem(MERKER)
  } catch {
    /* egal */
  }
}
