import { describe, it, expect } from 'vitest'
import { rechnen, werteZiehen, textFuellen } from './rechnen.js'

describe('rechnen', () => {
  it('rechnet Grundrechenarten mit Punkt-vor-Strich', () => {
    expect(rechnen('2 + 3 * 4')).toBe(14)
    expect(rechnen('(2 + 3) * 4')).toBe(20)
    expect(rechnen('10 / 2 - 1')).toBe(4)
  })

  it('setzt Variablen ein', () => {
    expect(rechnen('U * dT', { U: 0.35, dT: 22 })).toBeCloseTo(7.7)
  })

  it('kennt Potenz und die erlaubten Funktionen', () => {
    expect(rechnen('2^3')).toBe(8)
    expect(rechnen('wurzel(9)')).toBe(3)
    expect(rechnen('max(3, 7, 2)')).toBe(7)
    expect(rechnen('min(3, 7, 2)')).toBe(2)
    expect(rechnen('abs(-5)')).toBe(5)
  })

  it('wirft bei unbekannter Groesse statt still falsch zu rechnen', () => {
    expect(() => rechnen('a + 1', {})).toThrow('Unbekannte Größe')
  })

  it('wirft bei unbekannten Funktionen und unerlaubten Zeichen (kein eval-Ausbruch)', () => {
    expect(() => rechnen('alert(1)')).toThrow('Unbekannte Funktion')
    expect(() => rechnen('1; 2')).toThrow()
  })

  it('greift nicht auf Objekt-Prototyp-Eigenschaften zu (__proto__, toString, ...)', () => {
    // "in" wuerde ueber die Prototypenkette auflösen - hasOwnProperty nicht.
    expect(() => rechnen('__proto__')).toThrow('Unbekannte Größe')
    expect(() => rechnen('toString')).toThrow('Unbekannte Größe')
    expect(() => rechnen('constructor')).toThrow('Unbekannte Größe')
  })

  it('meldet nicht geschlossene Klammern', () => {
    expect(() => rechnen('(1 + 2')).toThrow('Klammer nicht geschlossen')
  })
})

describe('werteZiehen', () => {
  it('liefert fuer denselben Seed immer dieselben Werte', () => {
    const variablen = [{ name: 'U', von: 0.1, bis: 1, schritt: 0.01 }]
    expect(werteZiehen(variablen, 42)).toEqual(werteZiehen(variablen, 42))
  })

  it('bleibt innerhalb von von/bis', () => {
    const variablen = [{ name: 'x', von: 5, bis: 10, schritt: 1 }]
    for (let seed = 1; seed < 50; seed++) {
      const { x } = werteZiehen(variablen, seed)
      expect(x).toBeGreaterThanOrEqual(5)
      expect(x).toBeLessThanOrEqual(10)
    }
  })

  it('zieht aus einer festen Auswahl, wenn "auswahl" gesetzt ist', () => {
    const variablen = [{ name: 'material', auswahl: ['Beton', 'Holz', 'Stahl'] }]
    const { material } = werteZiehen(variablen, 7)
    expect(['Beton', 'Holz', 'Stahl']).toContain(material)
  })
})

describe('textFuellen', () => {
  it('ersetzt Platzhalter mit deutscher Zahlschreibweise', () => {
    const variablen = [{ name: 'U', einheit: 'W/(m²·K)', stellen: 2 }]
    expect(textFuellen('U = {U}', { U: 0.353 }, variablen)).toBe('U = 0,35 W/(m²·K)')
  })

  it('laesst unbekannte Platzhalter unveraendert', () => {
    expect(textFuellen('{unbekannt}', {}, [])).toBe('{unbekannt}')
  })
})
