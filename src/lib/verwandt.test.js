import { describe, expect, it } from 'vitest'
import { verwandteNebeneinander, verwandteThemen } from './verwandt.js'

const k = (id, themaId, extra = {}) => ({ id, themaId, ...extra })

describe('verwandteThemen', () => {
  it('verbindet Themen ueber siehe in beide Richtungen', () => {
    const karte = verwandteThemen([{ id: 'warm', siehe: ['kalt'] }, { id: 'kalt' }], [k('x', 'b30', { siehe: ['b34'] })])
    expect(karte.get('kalt').has('warm')).toBe(true)
    expect(karte.get('b34').has('b30')).toBe(true)
  })
})

describe('verwandteNebeneinander (L4)', () => {
  it('holt eine verwandte Karte direkt hinter ihr Gegenstueck', () => {
    const karte = verwandteThemen([{ id: 'warm', siehe: ['kalt'] }])
    const pensum = [k('w1', 'warm'), k('a', 'anders'), k('b', 'anders2'), k('k1', 'kalt')]
    const neu = verwandteNebeneinander(pensum, karte)
    expect(neu.map((x) => x.id)).toEqual(['w1', 'k1', 'a', 'b'])
  })

  it('paart auch ueber gemeinsame Tags, aber nie innerhalb desselben Themas', () => {
    const pensum = [k('a1', 'A', { tags: ['Dampfbremse'] }), k('a2', 'A', { tags: ['dampfbremse'] }), k('b1', 'B', { tags: ['dampfbremse'] })]
    expect(verwandteNebeneinander(pensum, new Map()).map((x) => x.id)).toEqual(['a1', 'b1', 'a2'])
  })

  it('verliert keine Karte und klebt keine langen Ketten zusammen', () => {
    const karte = verwandteThemen([{ id: 'A', siehe: ['B'] }])
    const pensum = ['A', 'A', 'A', 'B', 'B', 'B'].map((t, i) => k(`${t}${i}`, t))
    const neu = verwandteNebeneinander(pensum, karte)
    expect(neu).toHaveLength(6)
    expect(new Set(neu.map((x) => x.id)).size).toBe(6)
    // Paar A0 B3, dann eine freie Karte (A1), dann Paar A2 B4, Rest B5
    expect(neu.map((x) => x.themaId).join('')).toBe('ABAABB')
  })
})
