import { describe, expect, it } from 'vitest'
import { quelleText, quelleWerke } from './quelle.js'
import { itemFehler } from './itemPruefung.js'

describe('quelleText', () => {
  it('laesst Freitext unveraendert', () => {
    expect(quelleText('Lehrbuch der Bauphysik, S. 471')).toBe('Lehrbuch der Bauphysik, S. 471')
  })

  it('setzt die strukturierte Form zusammen - wie als_text() in quellenregister.py', () => {
    expect(quelleText({ werk: 'Praktische Bauphysik', stelle: 'Tafel 3.9', seite: '303–304', pdf: '323–324' })).toBe(
      'Praktische Bauphysik, Tafel 3.9, S. 303–304 (PDF 323–324)'
    )
    expect(quelleText([{ werk: 'A', seite: '1' }, { werk: 'B', stelle: 'Rn. 5' }])).toBe('A, S. 1; B, Rn. 5')
  })

  it('liefert fuer fehlende Angaben einen leeren Text statt abzustuerzen', () => {
    expect(quelleText(undefined)).toBe('')
    expect(quelleText([])).toBe('')
  })
})

describe('quelleWerke', () => {
  it('nimmt bei Freitext den Teil vor dem ersten Komma jeder Angabe', () => {
    expect(quelleWerke('Lehrbuch der Bauphysik, S. 1; Baukonstruktionslehre 1, S. 2')).toEqual([
      'Lehrbuch der Bauphysik',
      'Baukonstruktionslehre 1',
    ])
  })

  it('nimmt bei strukturierter Form das Feld werk', () => {
    expect(quelleWerke([{ werk: 'A', seite: '1' }, { werk: 'B' }])).toEqual(['A', 'B'])
  })
})

describe('itemFehler (T4)', () => {
  const basis = { id: 'x-1', frage: 'F?', antwort: 'A' }

  it('laesst vollstaendige Karten durch', () => {
    expect(itemFehler({ ...basis, typ: 'karte' })).toBeNull()
    expect(itemFehler({ ...basis, typ: 'mehrfachauswahl', optionen: ['a', 'b'], richtig: [1] })).toBeNull()
  })

  it('meldet Karten, die die Anzeige nicht darstellen koennte', () => {
    expect(itemFehler({ ...basis, typ: 'mehrfachauswahl' })).toMatch(/optionen/)
    expect(itemFehler({ ...basis, typ: 'mehrfachauswahl', optionen: ['a'], richtig: [3] })).toMatch(/richtig/)
    expect(itemFehler({ ...basis, typ: 'zuordnung', paare: [['a']] })).toMatch(/paare/)
    expect(itemFehler({ ...basis, typ: 'gibtsnicht' })).toMatch(/unbekannter typ/)
    expect(itemFehler({ typ: 'karte', frage: 'F?' })).toMatch(/id/)
  })
})
