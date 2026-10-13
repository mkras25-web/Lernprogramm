import { describe, it, expect } from 'vitest'
import { BEWERTUNG, behaltensrate, gueltigeGewichte, wiederholungenBewerten, intervallKurz, intervallVorschau, zustaendeBerechnen, pensumBauen, statistik, istWiederholung, pensumNachNochmal, heuteNichtGewusst } from './planer.js'

const TAG = 24 * 60 * 60 * 1000

describe('zustaendeBerechnen (FSRS)', () => {
  const ts = new Date('2026-10-01T10:00:00').getTime()
  const ein = (bewertung, t = ts, art) => ({ itemId: 'a', bewertung, ts: t, art })

  it('plant nach der ersten richtigen Antwort mindestens einen Tag', () => {
    const z = zustaendeBerechnen([ein(BEWERTUNG.GUT)]).get('a')
    expect(z.intervall).toBeGreaterThanOrEqual(1)
    expect(z.faelligAb).toBeGreaterThan(ts)
    expect(z.gesamtAntworten).toBe(1)
    expect(z.fehler).toBe(0)
  })

  it('LEICHT plant weiter als GUT, GUT weiter als SCHWER', () => {
    const iv = (b) => zustaendeBerechnen([ein(BEWERTUNG.GUT), ein(b, ts + 3 * TAG)]).get('a').intervall
    expect(iv(BEWERTUNG.LEICHT)).toBeGreaterThan(iv(BEWERTUNG.GUT))
    expect(iv(BEWERTUNG.GUT)).toBeGreaterThan(iv(BEWERTUNG.SCHWER))
  })

  it('NOCHMAL verkuerzt das Intervall und zaehlt einen Fehler', () => {
    const gut = zustaendeBerechnen([ein(BEWERTUNG.GUT), ein(BEWERTUNG.GUT, ts + 3 * TAG)]).get('a')
    const nochmal = zustaendeBerechnen([ein(BEWERTUNG.GUT), ein(BEWERTUNG.NOCHMAL, ts + 3 * TAG)]).get('a')
    expect(nochmal.intervall).toBeLessThan(gut.intervall)
    expect(nochmal.fehler).toBe(1)
    expect(nochmal.gesamtAntworten).toBe(2)
  })

  it('Uebungsmodi zaehlen fuer die Planung hoechstens einmal pro Karte und Tag', () => {
    const einmal = zustaendeBerechnen([ein(BEWERTUNG.GUT, ts, 'marathon')]).get('a')
    const fuenfmal = zustaendeBerechnen(
      [0, 1, 2, 3, 4].map((k) => ein(BEWERTUNG.GUT, ts + k * 60_000, 'marathon'))
    ).get('a')
    expect(fuenfmal.intervall).toBe(einmal.intervall)
    expect(fuenfmal.faelligAb).toBe(einmal.faelligAb)
    expect(fuenfmal.gesamtAntworten).toBe(5) // Statistik zaehlt weiter alles
  })

  it('auch beim normalen Lernen zaehlt nur die erste Bewertung des Tages', () => {
    const nurNochmal = zustaendeBerechnen([ein(BEWERTUNG.NOCHMAL)]).get('a')
    const danachGut = zustaendeBerechnen([ein(BEWERTUNG.NOCHMAL), ein(BEWERTUNG.GUT, ts + 5 * 60_000)]).get('a')
    expect(danachGut.faelligAb).toBe(nurNochmal.faelligAb)
    expect(danachGut.schwierigkeit).toBe(nurNochmal.schwierigkeit)
    expect(danachGut.fehler).toBe(1)
    expect(danachGut.gesamtAntworten).toBe(2)
  })

  it('am naechsten Tag zaehlt eine Uebung wieder', () => {
    const z1 = zustaendeBerechnen([ein(BEWERTUNG.GUT, ts, 'marathon')]).get('a')
    const z2 = zustaendeBerechnen([ein(BEWERTUNG.GUT, ts, 'marathon'), ein(BEWERTUNG.GUT, ts + 2 * TAG, 'marathon')]).get('a')
    expect(z2.intervall).toBeGreaterThan(z1.intervall)
  })

  it('alte Ereignisse ohne Betriebsart gelten als normale Wiederholung', () => {
    const z = zustaendeBerechnen([ein(BEWERTUNG.GUT), ein(BEWERTUNG.GUT, ts + 3 * TAG)]).get('a')
    expect(z.wiederholungen).toBe(2)
  })
})

describe('intervallVorschau', () => {
  it('ordnet die vier Bewertungen aufsteigend', () => {
    const v = intervallVorschau(undefined, { jetzt: new Date('2026-10-01T10:00:00').getTime() })
    expect(v[BEWERTUNG.NOCHMAL]).toBeLessThanOrEqual(v[BEWERTUNG.SCHWER])
    expect(v[BEWERTUNG.SCHWER]).toBeLessThanOrEqual(v[BEWERTUNG.GUT])
    expect(v[BEWERTUNG.GUT]).toBeLessThan(v[BEWERTUNG.LEICHT])
  })
  it('stimmt mit der tatsaechlichen Planung ueberein', () => {
    const t = new Date('2026-10-01T10:00:00').getTime()
    const v = intervallVorschau(undefined, { jetzt: t })
    const z = zustaendeBerechnen([{ itemId: 'a', bewertung: BEWERTUNG.GUT, ts: t }]).get('a')
    expect(z.intervall).toBe(v[BEWERTUNG.GUT])
  })
  it('kurze Schreibweise', () => {
    expect(intervallKurz(4)).toBe('4 T.')
    expect(intervallKurz(91)).toBe('3 Mon.')
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

  it('deckelt auch die faelligen auf maxProTag, die aeltesten zuerst, und pausiert neue', () => {
    // Nutzerentscheidung 2026-10-10: nach einer Pause hoechstens maxProTag,
    // der Rest wartet ("aufgeschoben"). Neue kommen erst ohne Rueckstand.
    const jetzt = Date.now()
    const faelligeItems = Array.from({ length: 15 }, (_, i) => ({ id: `f${i}` }))
    const neueItemsArr = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}` }))
    const items = [...faelligeItems, ...neueItemsArr]
    const zustaende = new Map(faelligeItems.map((it, i) => [it.id, { faelligAb: jetzt - (i + 1) * TAG, intervall: 5 }]))
    const { pensum, faelligGesamt, aufgeschoben, neuImPensum } = pensumBauen(items, zustaende, {
      neuProTag: 6, maxProTag: 10, auffrischungAnteil: 0,
    })
    expect(faelligGesamt).toBe(15)
    expect(pensum).toHaveLength(10)
    expect(aufgeschoben).toBe(5)
    expect(neuImPensum).toBe(0)
    // die am laengsten ueberfaelligen (f14 ... f5) sind dabei
    expect(pensum.map((i) => i.id)).toContain('f14')
    expect(pensum.map((i) => i.id)).not.toContain('f0')
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

describe('Nochmal in der Sitzung (hoechstens eine Wiederholung)', () => {
  const a = { id: 'a' }, b = { id: 'b' }
  it('haengt die Karte beim ersten Nochmal ans Ende', () => {
    expect(pensumNachNochmal([a, b], 0)).toEqual([a, b, a])
    expect(istWiederholung([a, b, a], 0)).toBe(false)
  })
  it('beim zweiten Nochmal bleibt das Pensum unveraendert', () => {
    const pensum = [a, b, a]
    expect(istWiederholung(pensum, 2)).toBe(true)
    expect(pensumNachNochmal(pensum, 2)).toBe(pensum)
  })
})

describe('heuteNichtGewusst', () => {
  const jetzt = new Date('2026-10-12T18:00:00').getTime()
  const e = (itemId, bewertung, stundenZurueck) => ({ itemId, bewertung, ts: jetzt - stundenZurueck * 3600_000 })
  it('nennt Karten, deren letzte Bewertung heute Nochmal war, neueste zuerst', () => {
    const liste = heuteNichtGewusst([
      e('alt', BEWERTUNG.NOCHMAL, 30), // gestern
      e('a', BEWERTUNG.NOCHMAL, 3),
      e('a', BEWERTUNG.GUT, 2), // spaeter doch gewusst
      e('b', BEWERTUNG.NOCHMAL, 2),
      e('c', BEWERTUNG.GUT, 4),
      e('c', BEWERTUNG.NOCHMAL, 1),
    ], jetzt)
    expect(liste).toEqual(['c', 'b'])
  })
})

describe('Kalibrierung und eigene Gewichte (F6/L7)', () => {
  const TAG = 24 * 60 * 60 * 1000
  const start = new Date('2026-09-01T10:00').getTime()
  const ereignis = (itemId, tage, bewertung) => ({ id: `${itemId}-${tage}`, itemId, ts: start + tage * TAG, bewertung })

  it('zaehlt nur Wiederholungen bekannter Karten, je Tag die erste Bewertung', () => {
    const liste = wiederholungenBewerten([
      ereignis('a', 0, BEWERTUNG.GUT), // erstes Lernen - keine Wiederholung
      ereignis('a', 0, BEWERTUNG.NOCHMAL), // zweite Bewertung am selben Tag - zaehlt nicht
      ereignis('a', 3, BEWERTUNG.GUT),
      ereignis('a', 10, BEWERTUNG.NOCHMAL),
    ])
    expect(liste).toHaveLength(2)
    expect(liste.map((w) => w.gewusst)).toEqual([true, false])
    expect(liste.every((w) => w.p > 0 && w.p <= 1)).toBe(true)
    const r = behaltensrate(liste)
    expect(r.anzahl).toBe(2)
    expect(r.tatsaechlich).toBe(0.5)
  })

  it('nimmt nur vollstaendige Gewichtslisten an', () => {
    expect(gueltigeGewichte([1, 2, 3])).toBeNull()
    const w = Array.from({ length: 21 }, (_, i) => 0.1 + i / 100)
    expect(gueltigeGewichte(w)).toBe(w)
    // Andere Gewichte ergeben eine andere Planung
    const ev = [ereignis('a', 0, BEWERTUNG.GUT), ereignis('a', 2, BEWERTUNG.GUT)]
    const standard = zustaendeBerechnen(ev).get('a').intervall
    const eigen = zustaendeBerechnen(ev, { gewichte: w }).get('a').intervall
    expect(eigen).not.toBe(standard)
  })
})
