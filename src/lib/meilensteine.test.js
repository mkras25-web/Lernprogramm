import { describe, it, expect } from 'vitest'
import {
  MEILENSTEIN_STUFEN,
  MEILENSTEINE,
  meilensteineAuswerten,
  xpFuerMeilenstein,
  xpFuerMeilensteine,
} from './fortschritt.js'

// Ein Meilenstein mit ziel:3 (wie 'ms-serie-3') ergibt mit den
// Vervielfachern [1,2,5,10,25,50,100] die Ziele 3,6,15,30,75,150,300.
const ZIEL_MS = MEILENSTEINE.find((m) => m.id === 'ms-serie-3')

describe('MEILENSTEIN_STUFEN', () => {
  it('hat genau sieben aufsteigend schwerere Stufen', () => {
    expect(MEILENSTEIN_STUFEN).toHaveLength(7)
    for (let i = 1; i < MEILENSTEIN_STUFEN.length; i++) {
      expect(MEILENSTEIN_STUFEN[i].multiplikator).toBeGreaterThan(MEILENSTEIN_STUFEN[i - 1].multiplikator)
    }
  })
})

describe('meilensteineAuswerten', () => {
  it('stufe 0, wenn nicht einmal Bronze (Stufe 1) erreicht ist', () => {
    const [m] = meilensteineAuswerten({ serie: ZIEL_MS.ziel - 1 }).filter((x) => x.id === ZIEL_MS.id)
    expect(m.stufe).toBe(0)
    expect(m.frei).toBe(false)
    expect(m.maxStufe).toBe(false)
  })

  it('stufe 1 (Bronze) genau beim urspruenglichen Ziel', () => {
    const [m] = meilensteineAuswerten({ serie: ZIEL_MS.ziel }).filter((x) => x.id === ZIEL_MS.id)
    expect(m.stufe).toBe(1)
    expect(m.frei).toBe(true)
    expect(m.ziele[0]).toBe(ZIEL_MS.ziel)
  })

  it('steigt Stufe fuer Stufe entsprechend der Vervielfacher', () => {
    const ziele = MEILENSTEIN_STUFEN.map((s) => Math.round(ZIEL_MS.ziel * s.multiplikator))
    for (let stufe = 1; stufe <= 7; stufe++) {
      const [m] = meilensteineAuswerten({ serie: ziele[stufe - 1] }).filter((x) => x.id === ZIEL_MS.id)
      expect(m.stufe).toBe(stufe)
    }
  })

  it('maxStufe erst bei Diamant (Stufe 7), danach kein naechstes Ziel mehr', () => {
    const zielDiamant = Math.round(ZIEL_MS.ziel * MEILENSTEIN_STUFEN[6].multiplikator)
    const [unterDiamant] = meilensteineAuswerten({ serie: zielDiamant - 1 }).filter((x) => x.id === ZIEL_MS.id)
    expect(unterDiamant.maxStufe).toBe(false)
    expect(unterDiamant.stufe).toBe(6)

    const [amDiamant] = meilensteineAuswerten({ serie: zielDiamant }).filter((x) => x.id === ZIEL_MS.id)
    expect(amDiamant.maxStufe).toBe(true)
    expect(amDiamant.stufe).toBe(7)
    expect(amDiamant.anteil).toBe(1)
  })

  it('anteil misst den Fortschritt zur naechsten, nicht zur letzten Stufe', () => {
    const ziele = MEILENSTEIN_STUFEN.map((s) => Math.round(ZIEL_MS.ziel * s.multiplikator))
    const zwischenwert = ziele[0] + Math.round((ziele[1] - ziele[0]) / 2)
    const erwarteterAnteil = (zwischenwert - ziele[0]) / (ziele[1] - ziele[0])
    const [m] = meilensteineAuswerten({ serie: zwischenwert }).filter((x) => x.id === ZIEL_MS.id)
    expect(m.stufe).toBe(1)
    expect(m.anteil).toBeCloseTo(erwarteterAnteil, 5)
  })

  it('mehr Fortschritt schadet nie - Stufe faellt nie zurueck', () => {
    const alle = MEILENSTEINE.map((m) => m.feld)
    const daten = Object.fromEntries(alle.map((feld) => [feld, 1_000_000]))
    const ausgewertet = meilensteineAuswerten(daten)
    for (const m of ausgewertet) {
      expect(m.maxStufe).toBe(true)
      expect(m.stufe).toBe(7)
    }
  })
})

describe('xpFuerMeilenstein / xpFuerMeilensteine', () => {
  it('gibt 0 XP, wenn noch keine Stufe erreicht ist', () => {
    const [m] = meilensteineAuswerten({ serie: 0 }).filter((x) => x.id === ZIEL_MS.id)
    expect(xpFuerMeilenstein(m)).toBe(0)
  })

  it('zaehlt jede erreichte Stufe einzeln, nicht nur die hoechste', () => {
    const ziele = MEILENSTEIN_STUFEN.map((s) => Math.round(ZIEL_MS.ziel * s.multiplikator))
    const [beiStufe1] = meilensteineAuswerten({ serie: ziele[0] }).filter((x) => x.id === ZIEL_MS.id)
    const [beiStufe2] = meilensteineAuswerten({ serie: ziele[1] }).filter((x) => x.id === ZIEL_MS.id)
    // Stufe 2 hat ein groesseres Ziel als Stufe 1 -> mehr XP fuer die
    // zweite Stufe allein, und die Summe beider Stufen ist groesser als
    // eine einzelne.
    expect(xpFuerMeilenstein(beiStufe2)).toBeGreaterThan(xpFuerMeilenstein(beiStufe1))
  })

  it('xpFuerMeilensteine summiert nur ueber freigeschaltete (stufe > 0)', () => {
    const daten = { serie: 0 } // ZIEL_MS bleibt auf Stufe 0
    const ausgewertet = meilensteineAuswerten(daten)
    const nurZielMs = ausgewertet.filter((m) => m.id === ZIEL_MS.id)
    expect(xpFuerMeilensteine(nurZielMs)).toBe(0)
  })
})
