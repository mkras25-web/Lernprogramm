import { describe, it, expect } from 'vitest'
import { BEWERTUNG, zustaendeBerechnen, pensumBauen, statistik } from './planer.js'

const TAG = 24 * 60 * 60 * 1000

describe('zustaendeBerechnen (SM-2)', () => {
  it('startet nach der ersten Bewertung mit Intervall 1 Tag', () => {
    const ts = Date.now()
    const z = zustaendeBerechnen([{ itemId: 'a', bewertung: BEWERTUNG.GUT, ts }]).get('a')
    expect(z.intervall).toBe(1)
    expect(z.wiederholungen).toBe(1)
    expect(z.faelligAb).toBe(ts + TAG)
  })

  it('NOCHMAL wirft das Intervall auf 0 zurueck und senkt die Leichtigkeit', () => {
    const ts = Date.now()
    const z = zustaendeBerechnen([
      { itemId: 'a', bewertung: BEWERTUNG.GUT, ts },
      { itemId: 'a', bewertung: BEWERTUNG.NOCHMAL, ts: ts + TAG },
    ]).get('a')
    expect(z.intervall).toBe(0)
    expect(z.wiederholungen).toBe(0)
    expect(z.leichtigkeit).toBeCloseTo(2.3) // 2.5 - 0.2
    expect(z.fehler).toBe(1)
    expect(z.gesamtAntworten).toBe(2)
  })

  it('LEICHT springt bei der zweiten Wiederholung auf 5 Tage, GUT auf 3', () => {
    const ts = Date.now()
    const mitLeicht = zustaendeBerechnen([
      { itemId: 'a', bewertung: BEWERTUNG.GUT, ts },
      { itemId: 'a', bewertung: BEWERTUNG.LEICHT, ts: ts + TAG },
    ]).get('a')
    expect(mitLeicht.intervall).toBe(5)

    const mitGut = zustaendeBerechnen([
      { itemId: 'b', bewertung: BEWERTUNG.GUT, ts },
      { itemId: 'b', bewertung: BEWERTUNG.GUT, ts: ts + TAG },
    ]).get('b')
    expect(mitGut.intervall).toBe(3)
  })

  it('SCHWER staucht das berechnete Intervall danach um 30 %', () => {
    const ts = Date.now()
    const z = zustaendeBerechnen([
      { itemId: 'a', bewertung: BEWERTUNG.GUT, ts }, // intervall 1, leichtigkeit 2.5
      { itemId: 'a', bewertung: BEWERTUNG.GUT, ts: ts + TAG }, // intervall 3, leichtigkeit 2.5
      { itemId: 'a', bewertung: BEWERTUNG.SCHWER, ts: ts + 4 * TAG },
    ]).get('a')
    // leichtigkeit: 2.5 - 0.15 = 2.35; roh: round(3 * 2.35) = 7; gestaucht: round(7 * 0.7) = 5
    expect(z.leichtigkeit).toBeCloseTo(2.35)
    expect(z.intervall).toBe(5)
    expect(z.wiederholungen).toBe(3)
  })

  it('leichtigkeit faellt nie unter das Minimum von 1.3', () => {
    const ts = Date.now()
    const ereignisse = Array.from({ length: 10 }, (_, i) => ({
      itemId: 'a',
      bewertung: BEWERTUNG.NOCHMAL,
      ts: ts + i * TAG,
    }))
    const z = zustaendeBerechnen(ereignisse).get('a')
    expect(z.leichtigkeit).toBeGreaterThanOrEqual(1.3)
  })
})

describe('pensumBauen', () => {
  it('nimmt faellige Items vor neuen und begrenzt neue auf neuProTag', () => {
    const jetzt = Date.now()
    const items = [
      { id: 'faellig1' }, { id: 'faellig2' },
      { id: 'neu1' }, { id: 'neu2' }, { id: 'neu3' },
    ]
    const zustaende = new Map([
      ['faellig1', { faelligAb: jetzt - TAG, intervall: 5 }],
      ['faellig2', { faelligAb: jetzt - TAG, intervall: 5 }],
    ])
    const { pensum, faelligGesamt, neuGesamt } = pensumBauen(items, zustaende, {
      neuProTag: 1, maxProTag: 10, auffrischungAnteil: 0,
    })
    expect(faelligGesamt).toBe(2)
    expect(neuGesamt).toBe(3)
    expect(pensum.filter((i) => i.id.startsWith('faellig'))).toHaveLength(2)
    expect(pensum.filter((i) => i.id.startsWith('neu'))).toHaveLength(1)
  })

  it('deckelt neue und Auffrischungs-Items durch maxProTag, nicht die faelligen', () => {
    // Faellige Wiederholungen sind Pflicht und duerfen nicht verschwinden,
    // nur weil zufaellig viele am selben Tag anstehen.
    const jetzt = Date.now()
    const faelligeItems = Array.from({ length: 15 }, (_, i) => ({ id: `f${i}` }))
    const neueItemsArr = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}` }))
    const items = [...faelligeItems, ...neueItemsArr]
    const zustaende = new Map(faelligeItems.map((it) => [it.id, { faelligAb: jetzt - TAG, intervall: 5 }]))
    const { pensum, faelligGesamt, neuGesamt } = pensumBauen(items, zustaende, {
      neuProTag: 6, maxProTag: 10, auffrischungAnteil: 0,
    })
    expect(faelligGesamt).toBe(15)
    expect(neuGesamt).toBe(10)
    expect(pensum.filter((i) => i.id.startsWith('f'))).toHaveLength(15)
    expect(pensum.filter((i) => i.id.startsWith('n'))).toHaveLength(0)
  })
})

describe('statistik', () => {
  it('zaehlt Ereignisse von heute und berechnet die Trefferquote', () => {
    const heute = new Date()
    heute.setHours(12, 0, 0, 0)
    const ereignisse = [
      { ts: heute.getTime(), bewertung: BEWERTUNG.GUT, dauerMs: 90_000 },
      { ts: heute.getTime(), bewertung: BEWERTUNG.NOCHMAL, dauerMs: 30_000 },
    ]
    const werte = statistik(ereignisse, new Map())
    expect(werte.antwortenHeute).toBe(2)
    expect(werte.trefferquote).toBe(50)
    expect(werte.lernzeitHeuteMin).toBe(2)
  })

  it('liefert null als Trefferquote ohne Ereignisse', () => {
    expect(statistik([], new Map()).trefferquote).toBeNull()
  })
})
