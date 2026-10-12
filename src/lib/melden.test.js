import { describe, it, expect } from 'vitest'
import { istGemeldet, meldenAenderung, meldungenNachziehen, zurueckziehenAenderung } from './meldungen.js'
import { istLernbar } from './sichtung.js'

// Wie markeAendern in App.jsx: zusammenfuehren, null loescht.
const anwenden = (marke, aenderung) => {
  const neu = { ...marke, ...aenderung }
  for (const [k, v] of Object.entries(aenderung)) if (v === null) delete neu[k]
  return neu
}

describe('Melden', () => {
  it('gemeldete Karte steht auf Ueberarbeiten und ist nicht mehr lernbar', () => {
    const m = anwenden({ kategorie: 'relevant' }, meldenAenderung({ kategorie: 'relevant' }, { grund: 'falsch', text: '', ts: 1 }))
    expect(m.kategorie).toBe('ueberarbeiten')
    expect(m.einspruch).toBe(true)
    expect(m.meldung.grund).toBe('falsch')
    expect(istGemeldet(m)).toBe(true)
    expect(istLernbar(m)).toBe(false)
  })

  it('Zurueckziehen stellt die vorherige Sichtung wieder her', () => {
    let m = anwenden({ kategorie: 'relevant' }, meldenAenderung({ kategorie: 'relevant' }, { grund: 'unklar', ts: 1 }))
    m = anwenden(m, zurueckziehenAenderung(m))
    expect(m).toEqual({ kategorie: 'relevant' })
    // Ohne vorherige Sichtung: wieder ungesichtet.
    let n = anwenden({}, meldenAenderung({}, { grund: 'unklar', ts: 1 }))
    n = anwenden(n, zurueckziehenAenderung(n))
    expect(n).toEqual({})
  })

  it('Meldung aendern ueberschreibt die gemerkte Sichtung nicht', () => {
    let m = anwenden({ kategorie: 'relevant' }, meldenAenderung({ kategorie: 'relevant' }, { grund: 'unklar', ts: 1 }))
    m = anwenden(m, meldenAenderung(m, { grund: 'falsch', ts: 2 }))
    expect(m.kategorieVorMeldung).toBe('relevant')
    expect(m.meldung.grund).toBe('falsch')
  })

  it('von Hand umgestellte Sichtung bleibt beim Zurueckziehen', () => {
    let m = anwenden({}, meldenAenderung({}, { grund: 'unklar', ts: 1 }))
    m = { ...m, kategorie: 'streichen' }
    m = anwenden(m, zurueckziehenAenderung(m))
    expect(m.kategorie).toBe('streichen')
  })

  it('aeltere Meldungen werden nachgezogen, bewusste Entscheidungen nicht', () => {
    const marken = new Map([
      ['alt', { einspruch: true, meldung: { grund: 'falsch' }, kategorie: 'relevant' }],
      ['nurEinspruch', { einspruch: true }],
      ['gestrichen', { einspruch: true, kategorie: 'streichen' }],
      ['bewusst', { einspruch: true, kategorie: 'relevant', kategorieVorMeldung: 'keine' }],
      ['ohne', { lesezeichen: true }],
    ])
    expect(meldungenNachziehen(marken).map(([id]) => id)).toEqual(['alt', 'nurEinspruch'])
  })
})
