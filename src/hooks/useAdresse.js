import { useEffect, useRef } from 'react'
import { ZIELE } from '../components/Navigation.jsx'

// Bildschirmadresse im Hash-Teil (#/themen), Entscheidung 27A: Zurueck/Vor
// und Neuladen bleiben auf dem Bildschirm. Bewusst "#/..." statt "#themen":
// ein nackter Hash liesse den Browser zu einem gleichnamigen Element
// springen (und Scrollpositionen sollen sich nicht aendern).
export function ansichtAusAdresse() {
  const treffer = /^#\/([a-z]+)/.exec(window.location.hash)
  return treffer && ZIELE.has(treffer[1]) ? treffer[1] : null
}

// Adresse <-> Ansicht (27A), aus App.jsx herausgeloest (52B). beimZurueck
// laeuft bei Zurueck/Vor, bevor die Ansicht wechselt (offene Unterseiten
// schliessen, Lernsitzung verlassen).
export function useAdresse(ansicht, setAnsicht, ansichtRef, beimZurueck) {
  const beimZurueckRef = useRef(beimZurueck)
  beimZurueckRef.current = beimZurueck
  const ausVerlauf = useRef(false)
  useEffect(() => {
    const ziel = `#/${ansicht}`
    if (ausVerlauf.current) {
      ausVerlauf.current = false
      return
    }
    if (window.location.hash === ziel) return
    // Erster Eintrag ersetzt (kein leerer Schritt zurueck), danach neue Eintraege.
    if (!window.location.hash) window.history.replaceState(null, '', ziel)
    else window.history.pushState(null, '', ziel)
  }, [ansicht])
  useEffect(() => {
    function zurueck() {
      const ziel = ansichtAusAdresse() ?? 'heute'
      beimZurueckRef.current?.(ziel)
      ausVerlauf.current = true
      // Ohne laufende Sitzung fuehrt "#/lernen" (Vor-Taste) zu Heute.
      setAnsicht(ziel === 'lernen' && ansichtRef.current !== 'lernen' ? 'heute' : ziel)
    }
    window.addEventListener('popstate', zurueck)
    return () => window.removeEventListener('popstate', zurueck)
  }, [])
}
