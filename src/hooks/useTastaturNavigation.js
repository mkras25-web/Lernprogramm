import { useEffect } from 'react'

// Tastatur-Navigation (29A/45A), aus App.jsx herausgeloest (52B).
// Alle Uebergaben sind Setter bzw. eine Ref - stabil, daher [] als
// Abhaengigkeit wie vorher.
export function useTastaturNavigation({ ansichtRef, setAnsicht, setSuchFokus, setTastenhilfeOffen }) {
  useEffect(() => {
    const ZIELTASTEN = {
      h: 'heute', t: 'themen', n: 'sichtung', o: 'glossar', m: 'heft', b: 'fehlerbuch',
      p: 'pruefung', s: 'skizzen', f: 'fortschritt', a: 'sammlung', e: 'einstellungen',
    }
    let gWartet = 0
    function taste(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return
      if (ev.target.matches?.('input, textarea, select, [contenteditable="true"]')) return
      if (ansichtRef.current === 'lernen' || document.querySelector('.schleier, .mehrSchleier')) return
      if (ev.key === '/') {
        ev.preventDefault()
        setAnsicht('sichtung')
        setSuchFokus((n) => n + 1)
        return
      }
      if (ev.key === '?') {
        ev.preventDefault()
        setTastenhilfeOffen(true)
        return
      }
      const k = ev.key.toLowerCase()
      if (gWartet && Date.now() - gWartet < 1500 && ZIELTASTEN[k]) {
        ev.preventDefault()
        gWartet = 0
        setAnsicht(ZIELTASTEN[k])
        return
      }
      gWartet = k === 'g' ? Date.now() : 0
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [])
}
