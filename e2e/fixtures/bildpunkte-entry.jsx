import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/styles.css'
import Bildpunkte from '../../src/components/Bildpunkte.jsx'

// Fixture fuer e2e/bildpunkte-overlap.spec.js: zwei absichtlich nah
// beieinanderliegende Punkte, damit der Regressionstest fuer den
// z-index-Stapelkontext-Bug (siehe .bildpunktHuelle.offen in styles.css)
// unabhaengig von echten Lerninhalten reproduzierbar bleibt.
const punkte = [
  { nr: 1, x: 50, y: 50, name: 'Alpha' },
  { nr: 2, x: 50, y: 67, name: 'Beta' },
]
const namen = punkte.map((p) => p.name)

function Test() {
  const [zuordnung, setZuordnung] = useState({})
  return (
    <Bildpunkte
      referenz="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23f0ead2'/%3E%3C/svg%3E"
      punkte={punkte}
      zuordnung={zuordnung}
      namen={namen}
      onWahl={(nr, i) => setZuordnung((z) => ({ ...z, [nr]: i }))}
    />
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Test />
  </StrictMode>
)
