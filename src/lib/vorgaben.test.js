import { describe, expect, it } from 'vitest'
import { entfernenAlsEntscheidung, ohneVorgabe, vorgabenAnwenden, vorgabenErzeugen, vorgabenPruefen } from './vorgaben.js'
import { diffKompakt, standVon, wortDiff } from './durchsicht.js'

const vorgaben = {
  kategorien: { a: 'streichen', b: 'ueberarbeiten' },
  durchsicht: { c: { entscheidung: 'angenommen', hash: 'h1' } },
}

describe('Vorgaben', () => {
  it('blendet Startwerte ein, eigene Entscheidung gewinnt', () => {
    const m = vorgabenAnwenden(new Map([['b', { itemId: 'b', kategorie: 'ungesichtet' }]]), vorgaben)
    expect(m.get('a').kategorie).toBe('streichen')
    expect(m.get('b').kategorie).toBe('ungesichtet')
    expect(m.get('c').durchsicht.entscheidung).toBe('angenommen')
  })
  it('ohneVorgabe entfernt nur Geerbtes', () => {
    const m = vorgabenAnwenden(new Map([['a', { itemId: 'a', lesezeichen: true }]]), vorgaben)
    expect(ohneVorgabe(m.get('a'))).toEqual({ itemId: 'a', lesezeichen: true })
  })
  it('Entfernen wird zur eigenen Entscheidung', () => {
    expect(entfernenAlsEntscheidung({ kategorie: null }, 'a', vorgaben).kategorie).toBe('ungesichtet')
    expect(entfernenAlsEntscheidung({ kategorie: null }, 'zz', vorgaben).kategorie).toBeNull()
    expect(entfernenAlsEntscheidung({ durchsicht: null }, 'c', vorgaben).durchsicht.entscheidung).toBe('offen')
  })
  it('Export nimmt nur Ueberarbeiten/Streichen und Entscheidungen', () => {
    const v = vorgabenErzeugen(new Map([
      ['a', { kategorie: 'relevant' }], ['b', { kategorie: 'streichen' }],
      ['c', { durchsicht: { entscheidung: 'abgelehnt', hash: 'x', ts: 1 } }],
    ]), 'p')
    expect(v.kategorien).toEqual({ b: 'streichen' })
    expect(v.durchsicht).toEqual({ c: { entscheidung: 'abgelehnt', hash: 'x' } })
  })
  it('prueft fremde Daten', () => {
    expect(vorgabenPruefen({ kategorien: { a: 'relevant', b: 'streichen' } }).kategorien).toEqual({ b: 'streichen' })
    expect(vorgabenPruefen(null)).toBeNull()
  })
})

describe('Darstellungsaenderung und Kompaktdiff', () => {
  it('reine Darstellung gilt automatisch als angenommen, ablehnen geht', () => {
    const e = { stand: 'geaendert', hash: 'h', ebenen: ['darstellung'], aenderung: { grund: 'Schrift' } }
    expect(standVon(e, undefined)).toMatchObject({ stand: 'geprueft', auto: true })
    expect(standVon(e, { durchsicht: { entscheidung: 'abgelehnt', hash: 'h' } }).stand).toBe('abgelehnt')
    expect(standVon({ ...e, ebenen: ['darstellung', 'fach'] }, undefined).stand).toBe('wartet')
  })
  it('kuerzt lange unveraenderte Strecken', () => {
    const lang = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ')
    const t = diffKompakt(wortDiff(`${lang} alt ${lang}`, `${lang} neu ${lang}`), 3)
    expect(t.some((x) => x.art === 'kuerzung')).toBe(true)
    expect(t.map((x) => x.text).join('').length).toBeLessThan(lang.length)
  })
})
