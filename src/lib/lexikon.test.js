import { describe, it, expect } from 'vitest'
import { begriffsMuster, kartenJeBegriff, lexikonAufbereiten, textZerlegen } from './lexikon.js'

const eintraege = lexikonAufbereiten({
  eintraege: [
    { id: 'kellersohle', begriff: 'Kellersohle', definition: 'x' },
    { id: 'u-wert', begriff: 'U-Wert', definition: 'x' },
    { id: 'xps', begriff: 'Polystyrol-Extruderschaum', varianten: ['XPS'], definition: 'x' },
    { id: 'polystyrol', begriff: 'Polystyrol', definition: 'x' },
    { id: 'schaumglas', begriff: 'Schaumglas', definition: 'x' },
    { id: 'gesims', begriff: 'Gesims', definition: 'x' },
    { id: 'kaputt', begriff: 'Ohne Definition' },
  ],
})
const muster = begriffsMuster(eintraege)
const links = (text, ohne) => textZerlegen(text, muster, ohne).filter((s) => s.id).map((s) => [s.text, s.id])

describe('Lexikon', () => {
  it('laesst Eintraege ohne Definition weg und sortiert nach Begriff', () => {
    expect(eintraege.map((e) => e.id)).toEqual(['gesims', 'kellersohle', 'polystyrol', 'xps', 'schaumglas', 'u-wert'])
  })

  it('findet Begriffe mit gaengigen Endungen und Varianten', () => {
    expect(links('Die Kellersohlen und der U-Wert, dazu XPS.')).toEqual([
      ['Kellersohlen', 'kellersohle'],
      ['U-Wert', 'u-wert'],
      ['XPS', 'xps'],
    ])
    expect(links('Unter dem Gesimses Kante')).toEqual([['Gesimses', 'gesims']])
  })

  it('nimmt die laengste Form und nur ganze Woerter', () => {
    expect(links('Polystyrol-Extruderschaum statt Polystyrol')).toEqual([
      ['Polystyrol-Extruderschaum', 'xps'],
      ['Polystyrol', 'polystyrol'],
    ])
    expect(links('Schaumglasplatten und Schaumglas-Platten')).toEqual([['Schaumglas', 'schaumglas']])
    expect(links('kellersohle klein geschrieben')).toEqual([])
  })

  it('verlinkt jeden Begriff nur einmal und nie sich selbst', () => {
    expect(links('U-Wert hier, U-Wert dort')).toHaveLength(1)
    expect(links('Der U-Wert der Kellersohle', 'u-wert')).toEqual([['Kellersohle', 'kellersohle']])
  })

  it('setzt den Text verlustfrei wieder zusammen', () => {
    const text = 'Schaumglas unter der Kellersohle, U-Wert klein.'
    expect(textZerlegen(text, muster).map((s) => s.text).join('')).toBe(text)
    expect(textZerlegen('nichts', null)).toEqual([{ text: 'nichts' }])
  })

  it('zaehlt Karten je Begriff', () => {
    const karten = kartenJeBegriff([{ id: 'a', frage: 'U-Wert?', antwort: 'U-Wert' }, { id: 'b', antwort: 'Gesims' }], muster)
    expect(karten.get('u-wert').map((i) => i.id)).toEqual(['a'])
    expect(karten.get('gesims').map((i) => i.id)).toEqual(['b'])
  })
})
