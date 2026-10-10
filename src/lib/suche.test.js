import { describe, expect, it } from 'vitest'
import { passt, trefferWert, vorbereiten } from './suche.js'

const felder = (frage, antwort = '') => [
  { feld: vorbereiten(frage), gewicht: 3 },
  { feld: vorbereiten(antwort), gewicht: 1 },
]

describe('trefferWert', () => {
  it('behandelt Begriffe mit Bindestrich als Ganzes', () => {
    expect(trefferWert('u-wert', felder('Wie berechnet man den U-Wert?'))).toBeGreaterThan(0)
    expect(trefferWert('u-wert', felder('Welcher Wert gilt für die Rohdichte?'))).toBe(0)
  })
  it('kurze Teile nur als ganzes Wort', () => {
    expect(trefferWert('u wert', felder('Rohdichte und Wert der Dämmung'))).toBe(0)
  })
  it('Frage zaehlt mehr als Antwort, Phrase mehr als verstreute Woerter', () => {
    const inFrage = trefferWert('taupunkt', felder('Wo liegt der Taupunkt?'))
    const inAntwort = trefferWert('taupunkt', felder('Feuchteschutz', 'Der Taupunkt liegt ...'))
    expect(inFrage).toBeGreaterThan(inAntwort)
  })
  it('verzeiht Tippfehler und Umlaute', () => {
    expect(trefferWert('Warmedammung', felder('Wärmedämmung im Sockel'))).toBeGreaterThan(0)
    expect(trefferWert('Perimeterdämung', felder('Perimeterdämmung außen'))).toBeGreaterThan(0)
  })
  it('passt() bleibt unveraendert verfuegbar', () => {
    expect(passt('warmedammung', 'Wärmedämmung')).toBe(true)
  })
})
