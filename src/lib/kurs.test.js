import { describe, it, expect } from 'vitest'
import {
  endspurt,
  istImKurs,
  kennungenImInhalt,
  klausurplan,
  klausurreife,
  kursAenderung,
  kursItems,
  naechsteKlausur,
  offenerRueckblick,
  strengSicher,
  tageBis,
  vorschlaege,
} from './kurs.js'
import { BEWERTUNG, zustaendeBerechnen } from './planer.js'

const TAG = 24 * 60 * 60 * 1000
const JETZT = new Date(2026, 9, 12, 12, 0).getTime()
const datum = (tage) => {
  const d = new Date(JETZT + tage * TAG)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const e = (itemId, tageZurueck, bewertung = BEWERTUNG.GUT) => ({ itemId, ts: JETZT - tageZurueck * TAG, bewertung })

describe('Kursmarken', () => {
  it('kursAenderung fuegt hinzu, entfernt und merkt die Abwahl', () => {
    const rein = kursAenderung({}, 'k1', true)
    expect(rein).toEqual({ kurse: ['k1'], kurseAbgewaehlt: null })
    const raus = kursAenderung({ kurse: ['k1', 'k2'] }, 'k1', false)
    expect(raus).toEqual({ kurse: ['k2'], kurseAbgewaehlt: ['k1'] })
    const wieder = kursAenderung({ kurse: ['k2'], kurseAbgewaehlt: ['k1'] }, 'k1', true)
    expect(wieder.kurse.sort()).toEqual(['k1', 'k2'])
    expect(wieder.kurseAbgewaehlt).toBeNull()
    expect(kursAenderung({ kurse: ['k1'] }, 'k1', false).kurse).toBeNull()
  })

  it('kursItems und istImKurs lesen marke.kurse', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const marken = new Map([['a', { kurse: ['k1'] }], ['b', { lesezeichen: true }]])
    expect(kursItems(items, marken, 'k1').map((i) => i.id)).toEqual(['a'])
    expect(istImKurs(undefined, 'k1')).toBe(false)
  })

  it('Vorschlaege: nur passende Kennung, nicht schon drin, nicht abgewaehlt', () => {
    const items = [
      { id: 'a', kurse: ['baurecht-ws26'] },
      { id: 'b', kurse: ['baurecht-ws26'] },
      { id: 'c', kurse: ['baurecht-ws26', 'anderes'] },
      { id: 'd' },
    ]
    const marken = new Map([['a', { kurse: ['k1'] }], ['b', { kurseAbgewaehlt: ['k1'] }]])
    const kurs = { id: 'k1', kennung: 'baurecht-ws26' }
    expect(vorschlaege(items, marken, kurs).map((i) => i.id)).toEqual(['c'])
    expect(vorschlaege(items, marken, { id: 'k1' })).toEqual([])
    expect([...kennungenImInhalt(items)]).toEqual([['baurecht-ws26', 3], ['anderes', 1]])
  })
})

describe('Klausurtermine', () => {
  it('naechste anstehende Klausur des Kurses, heute zaehlt noch', () => {
    const klausuren = [
      { id: '1', kursId: 'k1', datum: datum(-3) },
      { id: '2', kursId: 'k1', datum: datum(20) },
      { id: '3', kursId: 'k1', datum: datum(0) },
      { id: '4', kursId: 'k2', datum: datum(1) },
    ]
    expect(naechsteKlausur('k1', klausuren, JETZT).id).toBe('3')
    expect(naechsteKlausur('k9', klausuren, JETZT)).toBeNull()
    expect(tageBis({ datum: datum(20) }, JETZT)).toBe(20)
  })
})

describe('Klausurreife', () => {
  it('streng: letzte zwei mindestens Gut und an verschiedenen Tagen', () => {
    expect(strengSicher([e('a', 3), e('a', 1)])).toBe(true)
    expect(strengSicher([e('a', 1), { ...e('a', 1), ts: JETZT - TAG + 1000 }])).toBe(false)
    expect(strengSicher([e('a', 3, BEWERTUNG.SCHWER), e('a', 1)])).toBe(false)
    expect(strengSicher([e('a', 1)])).toBe(false)
  })

  it('neue Frage ist nicht reif, gut gelernte kurz danach schon', () => {
    const ereignisse = [e('a', 40), e('a', 30), e('a', 10), e('a', 1)]
    const zustaende = zustaendeBerechnen(ereignisse)
    const items = [{ id: 'a' }, { id: 'neu' }]
    const reife = klausurreife(items, zustaende, ereignisse, { zeitpunkt: JETZT + TAG, ziel: 0.9 })
    const a = reife.eintraege.find((x) => x.item.id === 'a')
    const n = reife.eintraege.find((x) => x.item.id === 'neu')
    expect(a.r).toBeGreaterThan(0.9)
    expect(a.sicher).toBe(true)
    expect(n.r).toBe(0)
    expect(n.sicher).toBe(false)
    expect(reife.sicher).toBe(1)
    expect(reife.anteil).toBe(0.5)
    // Viel spaeter sinkt die Vorhersage.
    const spaet = klausurreife(items, zustaende, ereignisse, { zeitpunkt: JETZT + 400 * TAG })
    expect(spaet.eintraege[0].r).toBeLessThan(a.r)
  })

  it('Endspurt nimmt nur nicht Reife, wackligste zuerst', () => {
    const reife = {
      eintraege: [
        { item: { id: 'a' }, r: 0.5, sicher: false },
        { item: { id: 'b' }, r: 0.99, sicher: true },
        { item: { id: 'c' }, r: 0.1, sicher: false },
      ],
    }
    expect(endspurt(reife).map((i) => i.id)).toEqual(['c', 'a'])
  })
})

describe('Klausurplan', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}` }))

  it('ohne Klausur: neue nach neuProTag', () => {
    const plan = klausurplan(items, new Map(), { jetzt: JETZT, neuProTag: 4 })
    expect(plan.neu).toBe(4)
    expect(plan.pensum).toHaveLength(4)
  })

  it('mit Klausur: neue gleichmaessig bis kurz vor dem Termin', () => {
    // 20 neue, 13 Tage bis Klausur, Puffer 3 -> ceil(20/10) = 2 pro Tag
    const plan = klausurplan(items, new Map(), { jetzt: JETZT, klausur: { datum: datum(13) } })
    expect(plan.neu).toBe(2)
    // Zwei Tage vor der Klausur: alle restlichen neuen auf einmal
    const knapp = klausurplan(items, new Map(), { jetzt: JETZT, klausur: { datum: datum(2) } })
    expect(knapp.neu).toBe(20)
  })

  it('faellige zuerst; vorziehen nur im Fenster vor der Klausur', () => {
    // 'f' ist faellig, 'g' gut gelernt (naechste Faelligkeit weit weg)
    const ereignisse = [e('f', 30), e('g', 60), e('g', 50), e('g', 20)]
    const zustaende = zustaendeBerechnen(ereignisse)
    const liste = [{ id: 'g' }, { id: 'f' }]
    const weit = klausurplan(liste, zustaende, { jetzt: JETZT, klausur: { datum: datum(30) }, ziel: 0.999 })
    expect(weit.pensum.map((i) => i.id)).toEqual(['f'])
    expect(weit.vorgezogen).toBe(0)
    const nah = klausurplan(liste, zustaende, { jetzt: JETZT, klausur: { datum: datum(5) }, ziel: 0.999 })
    expect(nah.pensum.map((i) => i.id)).toEqual(['f', 'g'])
    expect(nah.vorgezogen).toBe(1)
  })
})

describe('offenerRueckblick (F9)', () => {
  const jetzt = new Date('2026-10-13T12:00').getTime()
  it('nennt die juengste vergangene Klausur ohne Ergebnis', () => {
    const klausuren = [
      { id: 'a', kursId: 'k', datum: '2026-09-01' },
      { id: 'b', kursId: 'k', datum: '2026-10-10' },
      { id: 'c', kursId: 'k', datum: '2026-11-01' },
    ]
    expect(offenerRueckblick('k', klausuren, jetzt).id).toBe('b')
    expect(offenerRueckblick('k', [{ ...klausuren[1], ergebnis: '1,7' }], jetzt)).toBeNull()
    expect(offenerRueckblick('k', [{ ...klausuren[1], rueckblickAus: true }], jetzt)).toBeNull()
  })
  it('sammelt aeltere offene Klausuren, statt sie nacheinander abzufragen', () => {
    const klausuren = [
      { id: 'a', kursId: 'k', datum: '2026-09-01' },
      { id: 'b', kursId: 'k', datum: '2026-10-10' },
      { id: 'x', kursId: 'anders', datum: '2026-09-02' },
    ]
    const r = offenerRueckblick('k', klausuren, jetzt)
    expect(r.id).toBe('b')
    expect(r.aeltere.map((k) => k.id)).toEqual(['a'])
    expect(r.aeltere[0].zeit).toBeUndefined()
  })
})
