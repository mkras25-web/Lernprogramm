import { describe, it, expect } from 'vitest'
import { begriffeIn, begriffsMuster, kartenJeBegriff, lexikonAufbereiten, textZerlegen } from './lexikon.js'

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

  it('nimmt die laengste Form und beachtet die Schreibweise', () => {
    expect(links('Polystyrol-Extruderschaum statt Polystyrol')).toEqual([
      ['Polystyrol-Extruderschaum', 'xps'],
      ['Polystyrol', 'polystyrol'],
    ])
    expect(links('Schaumglas-Platten')).toEqual([['Schaumglas', 'schaumglas']])
    expect(links('kellersohle klein geschrieben')).toEqual([])
  })

  describe('Teilwoerter', () => {
    const teile = begriffsMuster(lexikonAufbereiten({
      eintraege: [
        { id: 'schaumglas', begriff: 'Schaumglas', definition: 'x' },
        { id: 'sockel', begriff: 'Sockel', definition: 'x' },
        { id: 'abdichtung', begriff: 'Abdichtung', definition: 'x' },
        { id: 'setzung', begriff: 'Setzung', definition: 'x' },
        { id: 'ton', begriff: 'Ton', definition: 'x' },
        { id: 'xps', begriff: 'XPS', definition: 'x' },
      ],
    }))
    const finde = (text) => textZerlegen(text, teile)

    it('unterstreicht nur den Wortteil, vorne und hinten', () => {
      expect(finde('Die Schaumglasplatte liegt.')).toEqual([
        { text: 'Die ' }, { text: 'Schaumglas', id: 'schaumglas' }, { text: 'platte liegt.' },
      ])
      expect(finde('Die Dachabdichtungen halten.')).toEqual([
        { text: 'Die Dach' }, { text: 'abdichtungen', id: 'abdichtung' }, { text: ' halten.' },
      ])
    })

    it('laesst kurze Begriffe und Scheintreffer aus', () => {
      for (const text of ['Die Voraussetzung und Festsetzungen', 'Eine Tonne', 'Die XPSplatte']) {
        expect(finde(text).filter((s) => s.id)).toEqual([])
      }
    })

    it('zieht das ganze Wort dem Wortteil vor', () => {
      expect(finde('Abdichtungsebene mit Abdichtung').filter((s) => s.id).map((s) => s.text)).toEqual(['Abdichtung'])
      const langes = begriffsMuster(lexikonAufbereiten({
        eintraege: [
          { id: 'kurz', begriff: 'Schaumglas', definition: 'x' },
          { id: 'lang', begriff: 'Schaumglasplatte', definition: 'x' },
        ],
      }))
      expect(textZerlegen('Schaumglasplatten', langes)).toEqual([{ text: 'Schaumglasplatten', id: 'lang' }])
    })

    it('setzt nie zwei Links direkt hintereinander in ein Wort', () => {
      expect(finde('Die Sockelabdichtung').filter((s) => s.id)).toEqual([{ text: 'Sockel', id: 'sockel' }])
      const text = 'Die Sockelabdichtung und die Schaumglasplatte.'
      expect(finde(text).map((s) => s.text).join('')).toBe(text)
    })

    it('liefert die Begriffe fuer die Lexikon-Knoepfe', () => {
      expect(begriffeIn('Sockel mit Schaumglasplatte, wieder Sockel', teile)).toEqual([
        { id: 'sockel', text: 'Sockel' },
        { id: 'schaumglas', text: 'Schaumglas' },
      ])
      expect(begriffeIn('nichts', teile)).toEqual([])
      expect(begriffeIn('Sockel', null)).toEqual([])
    })
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
