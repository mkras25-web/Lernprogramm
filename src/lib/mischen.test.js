import { describe, expect, it } from 'vitest'
import { mischen, seedAus } from './mischen.js'

describe('mischen', () => {
  it('liefert eine vollstaendige Permutation', () => {
    const r = mischen(7, 12345)
    expect([...r].sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
  it('ist bei gleichem Seed stabil, bei anderem Seed meist anders', () => {
    expect(mischen(6, 42)).toEqual(mischen(6, 42))
    const verschieden = [1, 2, 3, 4, 5].some((s) => mischen(6, s).join() !== mischen(6, s + 100).join())
    expect(verschieden).toBe(true)
  })
  it('legt die Loesung nicht immer auf die Diagonale (Pruefungs-Regressionstest)', () => {
    const diagonal = [...Array(20)].filter((_, k) => mischen(4, seedAus('item' + k)).every((v, i) => v === i)).length
    expect(diagonal).toBeLessThan(5)
  })
})
