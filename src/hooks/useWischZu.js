import { useRef } from 'react'

// Blatt von unten (Mehr-Blatt, Auswahlblatt) per Wischen nach unten
// schliessen (kleine Mobil-Idee, 2026-10-15). Das Blatt folgt dem Finger;
// ab 80 px oder schnellem Wischen schliesst es, sonst federt es zurueck.
// Nur wenn das Blatt ganz oben steht - sonst scrollt man darin.
export function useWischZu(onSchliessen) {
  const start = useRef(null)
  const setzen = (el, y) => {
    el.style.transform = y > 0 ? `translateY(${y}px)` : ''
    el.style.transition = y > 0 ? 'none' : ''
  }
  return {
    onTouchStart(e) {
      const el = e.currentTarget
      start.current = el.scrollTop <= 0 ? { y: e.touches[0].clientY, zeit: Date.now() } : null
    },
    onTouchMove(e) {
      if (!start.current) return
      const dy = e.touches[0].clientY - start.current.y
      setzen(e.currentTarget, Math.max(0, dy))
    },
    onTouchEnd(e) {
      if (!start.current) return
      const dy = (e.changedTouches[0]?.clientY ?? start.current.y) - start.current.y
      const schnell = dy > 30 && Date.now() - start.current.zeit < 250
      start.current = null
      setzen(e.currentTarget, 0)
      if (dy > 80 || schnell) onSchliessen()
    },
    onTouchCancel(e) {
      start.current = null
      setzen(e.currentTarget, 0)
    },
  }
}
