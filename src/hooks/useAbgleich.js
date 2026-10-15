import { useEffect, useRef, useState } from 'react'
import { abgleichen, abgleichStand } from '../lib/abgleich.js'
import { dropboxMoeglich, istVerbunden, meldungAbholen } from '../lib/dropbox.js'

// Aus App.jsx herausgeloest (52B, 2026-10-10), Inhalt unveraendert.
export function useAbgleich({ profilId, profilName, opt, laedt, ansicht, zustandNeuLesen, setMeldung }) {
  // still = im Hintergrund (Start, nach dem Lernen, App wird verlassen):
  // nur bei uebernommenen Staenden eine Meldung, Fehler nur im Stand.
  const [abgleichZustand, setAbgleichZustand] = useState(() => ({ laeuft: false, ...abgleichStand(profilId) }))
  const abgleichRef = useRef(null)
  abgleichRef.current = async function jetztAbgleichen(still = true) {
    if (!dropboxMoeglich() || !istVerbunden()) return
    setAbgleichZustand((z) => ({ ...z, laeuft: true }))
    try {
      const b = await abgleichen({ profilId, profilName, mitSkizzen: opt.dropboxSkizzen === true })
      const neu = b.ereignisse + b.skizzen + b.marken + b.pruefungen + (b.kursplan ?? 0) + (b.einstellungen ?? 0) + b.geloescht
      if (neu > 0) await zustandNeuLesen()
      if (!still) {
        setMeldung({
          art: 'erfolg',
          text: neu > 0 ? `Abgeglichen: ${b.ereignisse} neue Antworten von anderen Geräten übernommen.` : 'Abgeglichen – nichts Neues.',
        })
      } else if (neu > 0) {
        setMeldung({ art: 'erfolg', text: `Fortschritt von einem anderen Gerät übernommen (${b.ereignisse} Antworten).` })
      }
    } catch (e) {
      if (!still) setMeldung({ art: 'fehler', text: `Abgleich nicht möglich: ${e.message}` })
    } finally {
      setAbgleichZustand({ laeuft: false, ...abgleichStand(profilId) })
    }
  }
  // Ueber eine Ref statt direkt aus opt: die Effekte unten (Sichtbarkeit,
  // Start) halten sonst die Funktion vom ersten Render fest, und das
  // Ausschalten von "automatisch abgleichen" wirkte beim Verlassen nicht.
  const autoAbgleichRef = useRef(opt.dropboxAuto)
  autoAbgleichRef.current = opt.dropboxAuto
  const automatischAbgleichen = () => {
    if (autoAbgleichRef.current !== false) abgleichRef.current?.(true)
  }

  // Nach einer Lernsitzung (Wechsel weg vom Lernbildschirm).
  const vorherigeAnsicht = useRef(null)
  useEffect(() => {
    if (vorherigeAnsicht.current === 'lernen' && ansicht !== 'lernen') automatischAbgleichen()
    vorherigeAnsicht.current = ansicht
  }, [ansicht])

  // Rueckmeldung der Dropbox-Anmeldung (ausgefuehrt in main.jsx, vor dem Start).
  useEffect(() => {
    const m = meldungAbholen()
    if (m) setMeldung(m)
  }, [])

  // Beim Start des Profils, sobald die Inhalte geladen sind.
  useEffect(() => {
    if (!laedt) automatischAbgleichen()
  }, [laedt])

  // Beim Verlassen der App (Push) bzw. Zurueckkehren nach laengerer Pause (Pull).
  useEffect(() => {
    let zuletzt = Date.now()
    function sichtbarkeit() {
      if (document.visibilityState === 'hidden') {
        zuletzt = Date.now()
        automatischAbgleichen()
      } else if (Date.now() - zuletzt > 120_000) {
        zuletzt = Date.now()
        automatischAbgleichen()
      }
    }
    document.addEventListener('visibilitychange', sichtbarkeit)
    return () => document.removeEventListener('visibilitychange', sichtbarkeit)
  }, [])

  return { abgleichZustand, jetztAbgleichen: () => abgleichRef.current?.(false) }
}
