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

// Offene Themenseite (Erklaerstueck) als Unteradresse: #/themen/thema/<id>.
// So ueberlebt sie das Neuladen, und Zurueck schliesst sie.
export function themaAusAdresse() {
  const treffer = /^#\/[a-z]+\/thema\/([^/?#]+)/.exec(window.location.hash)
  return treffer ? decodeURIComponent(treffer[1]) : null
}

// Themenseite schliessen: war sie ein eigener Verlaufsschritt, diesen
// zuruecknehmen (popstate schliesst sie dann), sonst direkt schliessen.
export function themaSchliessen(thema, setErklaerthema) {
  if (window.history.state?.thema === thema) window.history.back()
  else setErklaerthema(null)
}

// Adresse <-> Ansicht (27A), aus App.jsx herausgeloest (52B). beimZurueck
// laeuft bei Zurueck/Vor, bevor die Ansicht wechselt (offene Unterseiten
// schliessen, Lernsitzung verlassen).
export function useAdresse(ansicht, setAnsicht, ansichtRef, beimZurueck, thema = null) {
  const beimZurueckRef = useRef(beimZurueck)
  beimZurueckRef.current = beimZurueck
  const ausVerlauf = useRef(false)
  useEffect(() => {
    const ziel = `#/${ansicht}${thema ? `/thema/${encodeURIComponent(thema)}` : ''}`
    if (window.location.hash === ziel) {
      ausVerlauf.current = false
      return
    }
    if (ausVerlauf.current) {
      ausVerlauf.current = false
      return
    }
    // Erster Eintrag ersetzt (kein leerer Schritt zurueck), danach neue
    // Eintraege. Themenseiten merken sich das, damit ihr "Zurueck" einen
    // Verlaufsschritt zuruecknimmt statt einen neuen anzulegen.
    const zustand = thema ? { thema } : null
    if (!window.location.hash) window.history.replaceState(zustand, '', ziel)
    else window.history.pushState(zustand, '', ziel)
  }, [ansicht, thema])
  useEffect(() => {
    function zurueck() {
      const ziel = ansichtAusAdresse() ?? 'heute'
      beimZurueckRef.current?.(ziel, themaAusAdresse())
      ausVerlauf.current = true
      // Ohne laufende Sitzung fuehrt "#/lernen" (Vor-Taste) zu Heute.
      setAnsicht(ziel === 'lernen' && ansichtRef.current !== 'lernen' ? 'heute' : ziel)
    }
    window.addEventListener('popstate', zurueck)
    return () => window.removeEventListener('popstate', zurueck)
  }, [])
}
