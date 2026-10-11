import { describe, expect, it } from 'vitest'
import { farbenblindSchalten, PALETTEN, STANDARD } from './einstellungen.js'

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
