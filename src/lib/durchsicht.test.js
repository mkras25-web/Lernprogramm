import { describe, expect, it } from 'vitest'
import {
  aenderungsFelder, bildSchluessel, durchsichtAnwenden, durchsichtJeThema, durchsichtZaehlen, entscheidungAenderung, nebenzielStand, standVon,
  wartendeNebenziele, wortDiff,
} from './durchsicht.js'

const geaendert = {
  stand: 'geaendert', hash: 'h1', datum: '2026-10-17',
  aenderung: { grund: 'Wert falsch', beleg: 'Buch S. 3', vorher: { antwort: 'alt', pruefhinweis: null } },
}

describe('standVon', () => {
  it('ohne Eintrag offen', () => {
    expect(standVon(undefined).stand).toBe('offen')
  })
  it('geprueft mit angenommener Aenderung', () => {
    const s = standVon({ stand: 'geprueft', datum: '2026-10-18', geaendert_am: '2026-10-17', geaendert_grund: 'x' })
    expect(s).toMatchObject({ stand: 'geprueft', geaendertAm: '2026-10-17', grund: 'x' })
  })
  it('geaendert wartet, bis entschieden ist', () => {
    expect(standVon(geaendert, {}).stand).toBe('wartet')
    expect(standVon(geaendert, { durchsicht: { entscheidung: 'angenommen', hash: 'h1' } }).stand).toBe('geprueft')
    expect(standVon(geaendert, { durchsicht: { entscheidung: 'abgelehnt', hash: 'h1' } }).stand).toBe('abgelehnt')
  })
  it('Entscheidung zu einer anderen Fassung zaehlt nicht', () => {
    expect(standVon(geaendert, { durchsicht: { entscheidung: 'angenommen', hash: 'alt' } }).stand).toBe('wartet')
  })
})

describe('Erklaerstueck- und Bildmarken', () => {
  it('Bildpfad wird zum Durchsicht-Schluessel, Buchausschnitte nicht', () => {
    expect(bildSchluessel('/pakete/arch-de/bilder/x.svg')).toBe('bild:bilder/x.svg')
    expect(bildSchluessel('bilder/x.svg')).toBe('bild:bilder/x.svg')
    expect(bildSchluessel('/pakete/arch-de/bilder-lokal/x.png')).toBe(null)
    expect(bildSchluessel(undefined)).toBe(null)
  })
  it('Stand ueber den Schluessel, ohne Schluessel nichts', () => {
    const eintraege = { 'erklaerung:t1': { stand: 'geprueft', datum: '2026-10-18' }, 'bild:bilder/x.svg': geaendert }
    const marken = new Map([['bild:bilder/x.svg', { durchsicht: { entscheidung: 'abgelehnt', hash: 'h1' } }]])
    expect(nebenzielStand(eintraege, marken, 'erklaerung:t1').stand).toBe('geprueft')
    expect(nebenzielStand(eintraege, marken, 'bild:bilder/x.svg').stand).toBe('abgelehnt')
    expect(nebenzielStand(eintraege, marken, 'erklaerung:t2').stand).toBe('offen')
    expect(nebenzielStand(eintraege, marken, null)).toBe(null)
  })
})

describe('durchsichtAnwenden', () => {
  const items = [
    { id: 'a', antwort: 'neu', bild: '/p/bilder/x.svg' },
    { id: 'b', antwort: 'b' },
  ]
  it('haengt den Stand an und laesst ohne Akte alles unveraendert', () => {
    expect(durchsichtAnwenden(items, null, new Map())).toBe(items)
    const r = durchsichtAnwenden(items, { a: geaendert }, new Map())
    expect(r[0].durchsicht.stand).toBe('wartet')
    expect(r[1].durchsicht.stand).toBe('offen')
  })
  it('zeigt bei Ablehnung die alte Fassung und das alte Bild', () => {
    const marken = new Map([
      ['a', { durchsicht: { entscheidung: 'abgelehnt', hash: 'h1' } }],
      ['bild:bilder/x.svg', { durchsicht: { entscheidung: 'abgelehnt', hash: 'hb' } }],
    ])
    const akte = {
      a: { ...geaendert, aenderung: { ...geaendert.aenderung, vorher: { antwort: 'alt', pruefhinweis: 'P' } } },
      'bild:bilder/x.svg': { stand: 'geaendert', hash: 'hb', aenderung: { vorher_datei: 'durchsicht-vorher/x.svg' } },
    }
    const [a] = durchsichtAnwenden(items, akte, marken)
    expect(a.antwort).toBe('alt')
    expect(a.pruefhinweis).toBe('P')
    expect(a.bild).toBe('/p/durchsicht-vorher/x.svg')
  })
  it('entfernt bei Ablehnung Felder, die es vorher nicht gab', () => {
    const marken = new Map([['a', { durchsicht: { entscheidung: 'abgelehnt', hash: 'h1' } }]])
    const akte = { a: { ...geaendert, aenderung: { vorher: { warum: null } } } }
    const [a] = durchsichtAnwenden([{ id: 'a', warum: 'neu dazu' }], akte, marken)
    expect('warum' in a).toBe(false)
  })
})

describe('durchsichtJeThema', () => {
  it('zaehlt je Thema, offen zaehlt nicht als durchgesehen', () => {
    const items = [{ id: 'a', themaId: 't1' }, { id: 'b', themaId: 't1' }, { id: 'c', themaId: 't1' }, { id: 'd', themaId: 't2' }]
    const eintraege = { a: { stand: 'geprueft' }, b: { stand: 'geaendert', hash: 'h' } }
    const karte = durchsichtJeThema(items, eintraege, new Map())
    expect(karte.get('t1')).toEqual({ gesamt: 3, durchgesehen: 2, wartet: 1 })
    expect(karte.get('t2')).toEqual({ gesamt: 1, durchgesehen: 0, wartet: 0 })
    const entschieden = new Map([['b', { durchsicht: { entscheidung: 'angenommen', hash: 'h' } }]])
    expect(durchsichtJeThema(items, eintraege, entschieden).get('t1').wartet).toBe(0)
  })
})

describe('Hilfen', () => {
  it('Entscheidung setzt und loescht die Marke', () => {
    expect(entscheidungAenderung(geaendert, 'angenommen').durchsicht).toMatchObject({ entscheidung: 'angenommen', hash: 'h1' })
    expect(entscheidungAenderung(geaendert, null)).toEqual({ durchsicht: null })
  })
  it('zaehlt und findet Erklaerstuecke/Bilder', () => {
    const akte = { a: geaendert, 'erklaerung:t': { ...geaendert, thema: 't' }, 'bild:bilder/y.svg': { stand: 'geprueft' } }
    const z = durchsichtZaehlen(akte, new Map(), ['a', 'b', 'erklaerung:t'])
    expect(z).toMatchObject({ wartet: 2, offen: 1 })
    expect(wartendeNebenziele(akte, new Map()).map((n) => n.schluessel)).toEqual(['erklaerung:t'])
  })
  it('vergleicht Felder und Erklaerstuecke eine Ebene tiefer', () => {
    expect(aenderungsFelder({ antwort: 'alt' }, { antwort: 'neu' })).toEqual([
      { feld: 'antwort', name: 'Antwort', vorher: 'alt', nachher: 'neu' },
    ])
    const f = aenderungsFelder(
      { erklaerung: { absaetze: ['a', 'b'], merksatz: 'm' } },
      { erklaerung: { absaetze: ['a', 'c'], merksatz: 'm' } }
    )
    expect(f.map((x) => x.feld)).toEqual(['absaetze'])
    expect(aenderungsFelder({ antwort: 'gleich' }, { antwort: 'gleich' })).toEqual([])
  })
  it('wortDiff markiert nur die geaenderten Woerter', () => {
    const d = wortDiff('Der Wert ist 12 m.', 'Der Wert ist 10 m.')
    expect(d.filter((t) => t.art === 'weg').map((t) => t.text.trim())).toEqual(['12'])
    expect(d.filter((t) => t.art === 'neu').map((t) => t.text.trim())).toEqual(['10'])
    expect(d.filter((t) => t.art !== 'neu').map((t) => t.text).join('')).toBe('Der Wert ist 12 m.')
  })
})
