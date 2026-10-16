import { describe, expect, it } from 'vitest'
import { farbenblindNachziehen, farbenblindSchalten, PALETTEN, speichern, STANDARD } from './einstellungen.js'

describe('farbenblindSchalten', () => {
  it('wechselt beim Einschalten auf Farbsicher und merkt die alte Palette', () => {
    const an = farbenblindSchalten({ ...STANDARD, palette: 'marine' }, true)
    expect(an).toMatchObject({ farbenblind: true, palette: 'farbsicher', paletteVorFarbenblind: 'marine' })
  })

  it('nimmt fuer dunkle Paletten die dunkle farbsichere', () => {
    expect(farbenblindSchalten({ ...STANDARD, palette: 'graphit' }, true).palette).toBe('farbsicher-dunkel')
  })

  it('stellt beim Ausschalten die vorherige Palette wieder her', () => {
    const an = farbenblindSchalten({ ...STANDARD, palette: 'lehm' }, true)
    const aus = farbenblindSchalten(an, false)
    expect(aus.palette).toBe('lehm')
    expect(aus.farbenblind).toBe(false)
    expect(aus).not.toHaveProperty('paletteVorFarbenblind')
  })

  it('laesst eine im Modus selbst gewaehlte Palette beim Ausschalten stehen', () => {
    const an = farbenblindSchalten({ ...STANDARD, palette: 'lehm' }, true)
    const aus = farbenblindSchalten({ ...an, palette: 'kupfer' }, false)
    expect(aus.palette).toBe('kupfer')
  })

  it('beide farbsicheren Paletten sind in der Auswahl', () => {
    expect(PALETTEN.filter((p) => p.farbsicher).map((p) => p.id)).toEqual(['farbsicher', 'farbsicher-dunkel'])
  })
})

describe('farbenblindNachziehen (alte Profile mit eingeschaltetem Modus)', () => {
  it('schaltet ein altes Profil einmalig auf Farbsicher um', () => {
    const neu = farbenblindNachziehen({ ...STANDARD, farbenblind: true, palette: 'lehm' })
    expect(neu).toMatchObject({ palette: 'farbsicher', paletteVorFarbenblind: 'lehm', farbenblind: true })
  })

  it('dunkle alte Palette wird dunkel-farbsicher', () => {
    expect(farbenblindNachziehen({ ...STANDARD, farbenblind: true, palette: 'dunkel' }).palette).toBe('farbsicher-dunkel')
  })

  it('ueberschreibt keine spaeter selbst gewaehlte Palette', () => {
    const umgestellt = farbenblindNachziehen({ ...STANDARD, farbenblind: true, palette: 'lehm' })
    const selbst = { ...umgestellt, palette: 'kupfer' }
    expect(farbenblindNachziehen(selbst).palette).toBe('kupfer')
  })

  it('laesst Profile ohne Modus in Ruhe', () => {
    const w = { ...STANDARD, palette: 'marine' }
    expect(farbenblindNachziehen(w)).toBe(w)
  })
})

describe('speichern: nur eigene Aenderungen (Fehler bis 2026-10-16)', () => {
  const ls = () => {
    const d = new Map()
    globalThis.localStorage = { getItem: (k) => (d.has(k) ? d.get(k) : null), setItem: (k, v) => void d.set(k, String(v)), removeItem: (k) => void d.delete(k) }
  }
  const gelesen = () => JSON.parse(localStorage.getItem('einstellungen_p1'))
  const stand = () => JSON.parse(localStorage.getItem('einstellungen_stand_p1') ?? '{}')

  it('ein zweites Fenster mit altem Stand setzt Zeichenaufgaben nicht zurueck', () => {
    ls()
    const start = { ...STANDARD }
    speichern('p1', start) // erster Stand
    // Fenster 1 stellt Zeichenaufgaben auf Aus
    speichern('p1', { ...start, zeichenAusblenden: true }, start)
    expect(gelesen().zeichenAusblenden).toBe(true)
    const zeitZeichen = stand().zeichenAusblenden
    expect(zeitZeichen).toBeGreaterThan(0)
    // Fenster 2 kennt noch den alten Stand und aendert nur die Animationen
    speichern('p1', { ...start, animationen: false }, start)
    expect(gelesen()).toMatchObject({ zeichenAusblenden: true, animationen: false })
    expect(stand().zeichenAusblenden).toBe(zeitZeichen)
    expect(stand().animationen).toBeGreaterThan(0)
  })

  it('erster Stand stempelt nichts, eingelesene Werte werden nicht neu gestempelt', () => {
    ls()
    speichern('p1', { ...STANDARD })
    expect(stand()).toEqual({})
    // Abgleich hat zeichenAusblenden=true eingetragen; die App uebernimmt es
    localStorage.setItem('einstellungen_p1', JSON.stringify({ ...STANDARD, zeichenAusblenden: true }))
    speichern('p1', { ...STANDARD, zeichenAusblenden: true }, { ...STANDARD })
    expect(stand()).toEqual({})
  })
})
