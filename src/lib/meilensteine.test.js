import { describe, it, expect } from 'vitest'
import {
  MEILENSTEIN_STUFEN,
  MEILENSTEINE,
  meilensteineAuswerten,
  meilensteinWerte,
  zieleFuer,
  xpFuerMeilenstein,
  xpFuerMeilensteine,
  wochenverlauf,
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
      expect(m.stufe).toBe(m.ziele.length)
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

describe('eigene Stufenziele und Deckel', () => {
  const finde = (liste, id) => liste.find((m) => m.id === id)

  it('jeder Meilenstein hat 1-7 streng steigende Ziele', () => {
    for (const m of MEILENSTEINE) {
      const ziele = zieleFuer(m, { items: 337, themen: 13, module: 3, typen: 11 })
      expect(ziele.length).toBeGreaterThanOrEqual(1)
      expect(ziele.length).toBeLessThanOrEqual(7)
      for (let i = 1; i < ziele.length; i++) expect(ziele[i]).toBeGreaterThan(ziele[i - 1])
    }
  })

  it('ids sind eindeutig und jede Gruppe hat ein Symbol', async () => {
    const { MEILENSTEIN_SYMBOLE, MEILENSTEIN_GRUPPEN } = await import('./fortschritt.js')
    expect(new Set(MEILENSTEINE.map((m) => m.id)).size).toBe(MEILENSTEINE.length)
    for (const m of MEILENSTEINE) {
      expect(MEILENSTEIN_SYMBOLE[m.gruppe]).toBeTruthy()
      expect(MEILENSTEIN_GRUPPEN[m.gruppe]).toBeTruthy()
    }
  })

  it('einstufiger Meilenstein: Bronze ist zugleich die hoechste Stufe', () => {
    const m = finde(meilensteineAuswerten({ stufe: 10 }), 'ms-stufe-10')
    expect(m.ziele).toEqual([10])
    expect(m.stufe).toBe(1)
    expect(m.maxStufe).toBe(true)
    expect(finde(meilensteineAuswerten({ stufe: 9 }), 'ms-stufe-10').frei).toBe(false)
  })

  it('Pruefungs-Prozente zaehlen als Anzahl, Silber braucht keine 162 %', () => {
    const m = finde(meilensteineAuswerten({ pruefungenGut: 2 }), 'ms-pruefung-gut')
    expect(m.stufe).toBe(2)
    expect(m.einheit).toBeUndefined()
  })

  it('Deckel kappt Stufen am Paketumfang, die letzte Stufe ist "alles"', () => {
    const m = MEILENSTEINE.find((x) => x.id === 'ms-sicher-200')
    expect(zieleFuer(m, { items: 337 })).toEqual([200, 337])
    expect(zieleFuer(m, { items: 150 })).toEqual([150])
    expect(zieleFuer(m)).toHaveLength(7)
    const voll = finde(meilensteineAuswerten({ sicher: 337 }, 'arch', { items: 337 }), 'ms-sicher-200')
    expect(voll.maxStufe).toBe(true)
    expect(voll.stufe).toBe(2)
  })

  it('Pharma-Titel fuer die Wochenend-Karte', () => {
    expect(finde(meilensteineAuswerten({}, 'pharma'), 'ms-wochenende').titel).toBe('Wochenendschicht')
    expect(finde(meilensteineAuswerten({}), 'ms-wochenende').titel).toBe('Wochenendbaustelle')
  })
})

describe('meilensteinWerte', () => {
  const MIN = 60000
  const um = (jahr, monat, tag, std, min = 0) => new Date(jahr, monat, tag, std, min).getTime()
  const e = (ts, bewertung = 3, extra = {}) => ({ itemId: 'a', ts, bewertung, dauerMs: 10000, ...extra })

  it('Fruehaufsteher und Nachteule je Tag einmal', () => {
    const w = meilensteinWerte([
      e(um(2026, 9, 5, 6)), e(um(2026, 9, 5, 7)), e(um(2026, 9, 6, 23)), e(um(2026, 9, 7, 2)), e(um(2026, 9, 7, 12)),
    ], [], new Map())
    expect(w.fruehTage).toBe(1)
    expect(w.nachtTage).toBe(2)
  })

  it('Wochenende nur mit Samstag und Sonntag, Rueckkehr nach mehr als sieben Tagen', () => {
    // 10.10.2026 ist ein Samstag.
    const w = meilensteinWerte([
      e(um(2026, 9, 10, 12)), e(um(2026, 9, 11, 12)), e(um(2026, 9, 17, 12)), e(um(2026, 9, 26, 12)),
    ], [], new Map())
    expect(w.wochenenden).toBe(1)
    expect(w.rueckkehren).toBe(1)
  })

  it('Trefferserie, Fehler-dann-richtig, fehlerfreier Tag', () => {
    const start = um(2026, 9, 1, 10)
    const liste = [e(start, 1, { itemId: 'x' })]
    for (let i = 1; i <= 20; i++) liste.push(e(start + i * MIN, 3, { itemId: i === 5 ? 'x' : 'a' }))
    liste.push(e(um(2026, 9, 2, 10), 3))
    for (let i = 1; i <= 19; i++) liste.push(e(um(2026, 9, 2, 10) + i * MIN, 4))
    const w = meilensteinWerte(liste, [], new Map())
    expect(w.trefferserie).toBe(40)
    expect(w.ausFehlern).toBe(1)
    expect(w.fehlerfreieTage).toBe(1)
    expect(w.besterTag).toBe(21)
  })

  it('Langer Atem: Block ab 30 min mit Luecken bis 5 min', () => {
    const start = um(2026, 9, 1, 10)
    const block = Array.from({ length: 11 }, (_, i) => e(start + i * 4 * MIN))
    const kurz = [e(um(2026, 9, 1, 15)), e(um(2026, 9, 1, 15, 10))]
    expect(meilensteinWerte([...block, ...kurz], [], new Map()).langeBloecke).toBe(1)
  })

  it('Betriebsarten, Skizzen ohne Hilfe, Themen und Typen', () => {
    const items = [
      { id: 's', typ: 'skizze', themaId: 't1' },
      { id: 'k', typ: 'karte', themaId: 't1' },
      { id: 'm', typ: 'karte', themaId: 't2' },
    ]
    const zustaende = new Map([
      ['s', { intervall: 200, fehler: 6 }],
      ['k', { intervall: 1, fehler: 0 }],
    ])
    const w = meilensteinWerte([
      e(1, 3, { itemId: 's' }), e(2, 3, { itemId: 's', hilfe: true }), e(3, 1, { itemId: 's' }),
      e(4, 3, { itemId: 'k', art: 'marathon' }), e(5, 3, { itemId: 'k', art: 'schnell' }),
    ], items, zustaende, [
      { bestanden: true, art: 'thema', themaId: 't1', prozent: 100 },
      { bestanden: true, art: 'thema', themaId: 't1', prozent: 85 },
      { bestanden: false, art: 'monat', prozent: 40 },
    ])
    expect(w.skizzenOhneHilfe).toBe(1)
    expect(w.marathonAntworten).toBe(1)
    expect(w.schnellAntworten).toBe(1)
    expect(w.themenBesucht).toBe(1)
    expect(w.themenKomplett).toBe(1)
    expect(w.typen).toBe(2)
    expect(w.problemeGeloest).toBe(1)
    expect(w.langzeit).toBe(1)
    expect(w.themenGeprueft).toBe(1)
    expect(w.pruefungenGut).toBe(2)
    expect(w.pruefungenSehrGut).toBe(1)
    expect(w.pruefungenVoll).toBe(1)
  })
})

describe('wochenverlauf (Fortschritt, 2026-10-15)', () => {
  // Donnerstag 29.10.2026; die Zeitumstellung war am So 25.10.
  const jetzt = new Date(2026, 9, 29, 15).getTime()
  const e = (j, m, t, h = 10, bewertung = 3) => ({ ts: new Date(j, m, t, h).getTime(), bewertung, dauerMs: 60000 })

  it('richtet nach Montag aus, neueste Woche zuerst, ab der ersten Antwort', () => {
    const { wochen, wochenGesamt } = wochenverlauf([e(2026, 9, 14), e(2026, 9, 25, 23, 1), e(2026, 9, 26)], { jetzt })
    expect(wochenGesamt).toBe(3)
    expect(wochen.map((w) => w.montag.getDate())).toEqual([26, 19, 12])
    expect(wochen[0].tage.map((t) => t.datum.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0])
    // So 25.10. (Zeitumstellung) bleibt ein eigener Tag mit seiner Antwort
    const sonntag = wochen[1].tage[6]
    expect(sonntag.datum.getDate()).toBe(25)
    expect(sonntag).toMatchObject({ anzahl: 1, richtig: 0 })
    expect(wochen[0].tage[0]).toMatchObject({ anzahl: 1, richtig: 1, minuten: 1 })
    expect(wochen[0].tage[3].heute).toBe(true)
    expect(wochen[0].tage[4].zukunft).toBe(true)
    expect(wochen[2].tage[0].vorBeginn).toBe(true) // Mo 12.10. vor der ersten Antwort (14.10.)
    expect(wochen[2].tage[2].vorBeginn).toBe(false)
    expect(wochen[2].summe).toBe(1)
  })

  it('begrenzt auf maxWochen und zeigt ohne Antworten nur die laufende Woche', () => {
    expect(wochenverlauf([e(2025, 0, 6)], { jetzt, maxWochen: 20 }).wochen).toHaveLength(20)
    const leer = wochenverlauf([], { jetzt })
    expect(leer.wochen).toHaveLength(1)
    expect(leer.wochen[0].tage.some((t) => t.vorBeginn)).toBe(false)
  })
})
