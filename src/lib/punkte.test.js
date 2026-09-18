import { describe, it, expect } from 'vitest'
import { punkteFuer, anteilRichtig, selbstBewertbar, note } from './punkte.js'

describe('punkteFuer', () => {
  it('liefert die hinterlegten Punkte je Aufgabentyp', () => {
    expect(punkteFuer({ typ: 'karte' })).toBe(1)
    expect(punkteFuer({ typ: 'rechnen' })).toBe(4)
  })

  it('faellt auf den Standardwert zurueck, wenn der Typ unbekannt ist', () => {
    expect(punkteFuer({ typ: 'unbekannt' })).toBe(1)
    expect(punkteFuer(undefined)).toBe(1)
  })
})

describe('anteilRichtig', () => {
  it('gibt 0 zurueck, wenn keine Eingabe vorliegt', () => {
    expect(anteilRichtig({ typ: 'numerisch', wert: 1 }, null)).toBe(0)
    expect(anteilRichtig({ typ: 'numerisch', wert: 1 }, undefined)).toBe(0)
  })

  it('mehrfachauswahl: zieht falsch gewaehlte Optionen von den Treffern ab', () => {
    const item = { typ: 'mehrfachauswahl', richtig: [0, 1] }
    expect(anteilRichtig(item, [0, 1])).toBe(1)
    expect(anteilRichtig(item, [0])).toBe(0.5)
    // 1 Treffer, 1 Fehlgriff -> (1 - 1) / 2 = 0, nie negativ
    expect(anteilRichtig(item, [0, 2])).toBe(0)
  })

  it('zuordnung: Anteil richtig zugeordneter Paare', () => {
    const item = { typ: 'zuordnung', paare: [['a', '1'], ['b', '2'], ['c', '3']] }
    expect(anteilRichtig(item, { 0: 0, 1: 1, 2: 2 })).toBe(1)
    expect(anteilRichtig(item, { 0: 0, 1: 2, 2: 1 })).toBeCloseTo(1 / 3)
  })

  it('numerisch: deutsches Komma wird verstanden, Toleranz greift', () => {
    const item = { typ: 'numerisch', wert: 10, toleranz: 0.5 }
    expect(anteilRichtig(item, '10,3')).toBe(1)
    expect(anteilRichtig(item, '12')).toBe(0)
  })

  it('unbekannte Typen gelten als nicht automatisch bewertbar -> 0', () => {
    expect(anteilRichtig({ typ: 'skizze' }, 'irgendwas')).toBe(0)
  })
})

describe('selbstBewertbar', () => {
  it('erkennt automatisch bewertbare Typen', () => {
    expect(selbstBewertbar('mehrfachauswahl')).toBe(true)
    expect(selbstBewertbar('vergleich')).toBe(true)
    expect(selbstBewertbar('skizze')).toBe(false)
    expect(selbstBewertbar('freitext')).toBe(false)
  })
})

describe('note', () => {
  it('ordnet Prozentwerte den Notenstufen an den Schwellen korrekt zu', () => {
    expect(note(95).name).toBe('sehr gut')
    expect(note(92).name).toBe('sehr gut')
    expect(note(91).name).toBe('gut')
    expect(note(50).bestanden).toBe(true)
    expect(note(49).bestanden).toBe(false)
    expect(note(0).name).toBe('nicht bestanden')
  })
})
