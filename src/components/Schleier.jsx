import { useEffect, useRef } from 'react'

// Gemeinsamer Rahmen fuer alle Dialoge/Ueberlagerungen (Entscheidung 51A,
// 2026-10-10). Vorher hatte jede Stelle ihr eigenes Verhalten: der Fokus
// blieb hinter dem Dialog, Tab lief in die Seite dahinter, Escape schloss
// nur manche. Jetzt einheitlich:
//   * Fokus beim Oeffnen in den Dialog (erstes Eingabefeld, sonst erster
//     Knopf),
//   * Tab bleibt im Dialog (Fokusfalle),
//   * Escape oder Klick auf den Hintergrund schliesst,
//   * danach kehrt der Fokus dorthin zurueck, wo er vorher war.
const FOKUSSIERBAR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Schleier({ onSchliessen, klasse = 'schleier', beschriftung, children }) {
  const ref = useRef(null)
  const schliessenRef = useRef(onSchliessen)
  schliessenRef.current = onSchliessen

  useEffect(() => {
    const vorher = document.activeElement
    const el = ref.current
    const ziel =
      el?.querySelector('input:not([type="hidden"]):not([disabled]):not([type="file"]), textarea:not([disabled])') ??
      el?.querySelector(FOKUSSIERBAR)
    ziel?.focus({ preventScroll: true })

    function taste(e) {
      if (!el) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        schliessenRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const liste = [...el.querySelectorAll(FOKUSSIERBAR)].filter((x) => x.offsetParent !== null)
      if (liste.length === 0) {
        e.preventDefault()
        return
      }
      const erstes = liste[0]
      const letztes = liste[liste.length - 1]
      if (!el.contains(document.activeElement)) {
        e.preventDefault()
        erstes.focus()
      } else if (e.shiftKey && document.activeElement === erstes) {
        e.preventDefault()
        letztes.focus()
      } else if (!e.shiftKey && document.activeElement === letztes) {
        e.preventDefault()
        erstes.focus()
      }
    }
    document.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('keydown', taste)
      if (vorher && document.contains(vorher) && typeof vorher.focus === 'function') {
        vorher.focus({ preventScroll: true })
      }
    }
  }, [])

  return (
    <div
      ref={ref}
      className={klasse}
      role="dialog"
      aria-modal="true"
      aria-label={beschriftung}
      onClick={(e) => {
        if (e.target === e.currentTarget) schliessenRef.current?.()
      }}
    >
      {children}
    </div>
  )
}
