import { describe, expect, it } from 'vitest'
import { lastvorschau, nachWochen } from './kalender.js'

describe('Semesterkalender (F8)', () => {
  const jetzt = new Date('2026-10-13T10:00').getTime() // Dienstag
  const TAG = 24 * 60 * 60 * 1000

  it('verteilt Faellige, neue Karten und Klausuren auf die Tage und markiert Ueberlast', () => {
    const zustaende = new Map([
      ['a', { faelligAb: jetzt - 3 * TAG }], // ueberfaellig -> heute
      ['b', { faelligAb: jetzt + 2 * TAG }],
      ['c', { faelligAb: jetzt + 2 * TAG }],
    ])
    const felder = lastvorschau({
      zustaende, neueAnzahl: 8, neuProTag: 6, maxProTag: 7, tage: 5, jetzt,
      klausuren: [{ id: 'k', titel: 'Baurecht', datum: '2026-10-15' }],
    })
    expect(felder.map((f) => f.faellig)).toEqual([1, 0, 2, 0, 0])
    expect(felder.map((f) => f.neu)).toEqual([6, 2, 0, 0, 0])
    expect(felder[0].ueberlast).toBe(false)
    expect(felder[2].klausuren[0].titel).toBe('Baurecht')
    expect(lastvorschau({ zustaende, neueAnzahl: 20, neuProTag: 10, maxProTag: 7, tage: 1, jetzt })[0].ueberlast).toBe(true)
  })

  it('beginnt die Wochen am Montag', () => {
    const felder = lastvorschau({ zustaende: new Map(), tage: 7, jetzt })
    const wochen = nachWochen(felder)
    expect(wochen[0][0]).toBeNull() // Montag vor dem Dienstag
    expect(wochen[0][1].datum).toBe(felder[0].datum)
    expect(wochen.every((w) => w.length === 7)).toBe(true)
  })

  it('zaehlt ueber die Zeitumstellung Kalendertage, keinen Tag doppelt', () => {
    const vorher = new Date('2026-10-24T10:00').getTime()
    const felder = lastvorschau({ zustaende: new Map(), tage: 4, jetzt: vorher })
    const tage = felder.map((f) => new Date(f.datum).getDate())
    expect(tage).toEqual([24, 25, 26, 27])
  })
})
