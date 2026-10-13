import { describe, it, expect } from 'vitest'
import { erledigteMeldungen, freigabenSammeln, inhaltSeit, inhaltsStempel, istGemeldet, meldenAenderung, meldungenMarkdown, meldungenNachziehen, zurueckziehenAenderung } from './meldungen.js'
import { istLernbar } from './sichtung.js'

// Wie markeAendern in App.jsx: zusammenfuehren, null loescht.
const anwenden = (marke, aenderung) => {
  const neu = { ...marke, ...aenderung }
  for (const [k, v] of Object.entries(aenderung)) if (v === null) delete neu[k]
  return neu
}

describe('Melden', () => {
  it('gemeldete Karte steht auf Ueberarbeiten und ist nicht mehr lernbar', () => {
    const m = anwenden({ kategorie: 'relevant' }, meldenAenderung({ kategorie: 'relevant' }, { grund: 'falsch', text: '', ts: 1 }))
    expect(m.kategorie).toBe('ueberarbeiten')
    expect(m.einspruch).toBe(true)
    expect(m.meldung.grund).toBe('falsch')
    expect(istGemeldet(m)).toBe(true)
    expect(istLernbar(m)).toBe(false)
  })

  it('Zurueckziehen stellt die vorherige Sichtung wieder her', () => {
    let m = anwenden({ kategorie: 'relevant' }, meldenAenderung({ kategorie: 'relevant' }, { grund: 'unklar', ts: 1 }))
    m = anwenden(m, zurueckziehenAenderung(m))
    expect(m).toEqual({ kategorie: 'relevant' })
    // Ohne vorherige Sichtung: wieder ungesichtet.
    let n = anwenden({}, meldenAenderung({}, { grund: 'unklar', ts: 1 }))
    n = anwenden(n, zurueckziehenAenderung(n))
    expect(n).toEqual({})
  })

  it('Meldung aendern ueberschreibt die gemerkte Sichtung nicht', () => {
    let m = anwenden({ kategorie: 'relevant' }, meldenAenderung({ kategorie: 'relevant' }, { grund: 'unklar', ts: 1 }))
    m = anwenden(m, meldenAenderung(m, { grund: 'falsch', ts: 2 }))
    expect(m.kategorieVorMeldung).toBe('relevant')
    expect(m.meldung.grund).toBe('falsch')
  })

  it('von Hand umgestellte Sichtung bleibt beim Zurueckziehen', () => {
    let m = anwenden({}, meldenAenderung({}, { grund: 'unklar', ts: 1 }))
    m = { ...m, kategorie: 'streichen' }
    m = anwenden(m, zurueckziehenAenderung(m))
    expect(m.kategorie).toBe('streichen')
  })

  it('aeltere Meldungen werden nachgezogen, bewusste Entscheidungen nicht', () => {
    const marken = new Map([
      ['alt', { einspruch: true, meldung: { grund: 'falsch' }, kategorie: 'relevant' }],
      ['nurEinspruch', { einspruch: true }],
      ['gestrichen', { einspruch: true, kategorie: 'streichen' }],
      ['bewusst', { einspruch: true, kategorie: 'relevant', kategorieVorMeldung: 'keine' }],
      ['ohne', { lesezeichen: true }],
    ])
    expect(meldungenNachziehen(marken).map(([id]) => id)).toEqual(['alt', 'nurEinspruch'])
  })
})

describe('Erledigte Meldungen (P10)', () => {
  const item = { id: 'x-001', frage: 'F?', antwort: 'alt', stand: '2026-09' }

  it('eine gemeldete Karte gilt als erledigt, sobald sich ihr Inhalt aendert, und geht auf ungesichtet', () => {
    const marke = anwenden({}, meldenAenderung({}, { grund: 'falsch', text: 'Wert?', ts: 1, inhalt: inhaltsStempel(item) }))
    expect(erledigteMeldungen(new Map([['x-001', marke]]), [item])).toEqual([])
    const [[id, aenderung]] = erledigteMeldungen(new Map([['x-001', marke]]), [{ ...item, antwort: 'neu' }])
    const danach = anwenden(marke, aenderung)
    expect(id).toBe('x-001')
    expect(istGemeldet(danach)).toBe(false)
    expect(danach.kategorie).toBeUndefined() // ungesichtet
    expect(istLernbar(danach)).toBe(true)
    expect(danach.erledigt.text).toBe('Wert?')
  })

  it('lokale und Online-App (anderer Paketpfad) halten dieselbe Karte nicht fuer ueberarbeitet', () => {
    const lokal = { ...item, bild: '/pakete/arch-de/bilder/a.svg' }
    const online = { ...item, bild: './pakete/arch-de/bilder/a.svg' }
    const marke = anwenden({}, meldenAenderung({}, { grund: 'falsch', text: '', ts: 1, inhalt: inhaltsStempel(lokal) }))
    expect(erledigteMeldungen(new Map([['x-001', marke]]), [online])).toEqual([])
    expect(erledigteMeldungen(new Map([['x-001', marke]]), [{ ...online, bild: './pakete/arch-de/bilder/b.svg' }])).toHaveLength(1)
  })

  it('Stempel aus der Zeit vor der Pfad-Bereinigung passen weiter', () => {
    const lokal = { ...item, bild: '/pakete/arch-de/bilder/a.svg' }
    // Alte Stempel wurden ueber die Pfade mit Praefix gebildet: dieselbe
    // Karte - lokal oder online geladen - darf nicht als erledigt gelten.
    const rohStempel = (it) => {
      const text = JSON.stringify(['frage', 'antwort', 'vertiefung', 'quelle', 'stand', 'geprueft', 'pruefhinweis',
        'optionen', 'richtig', 'warum', 'paare', 'schritte', 'wert', 'toleranz', 'einheit', 'pruefpunkte',
        'punkte', 'bereiche', 'fehlerNr', 'seiten', 'teile', 'referenz', 'bild'].map((f) => it?.[f] ?? null))
      let h = 2166136261
      for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
      return (h >>> 0).toString(36)
    }
    const marke = anwenden({}, meldenAenderung({}, { grund: 'falsch', text: '', ts: 1, inhalt: rohStempel(lokal) }))
    expect(erledigteMeldungen(new Map([['x-001', marke]]), [{ ...item, bild: './pakete/arch-de/bilder/a.svg' }])).toEqual([])
  })

  it('ein Geraet, das den abweichenden Inhalt schon vor der Meldung kannte, hakt nicht ab', () => {
    const marke = anwenden({}, meldenAenderung({}, { grund: 'falsch', text: '', ts: 1000, inhalt: inhaltsStempel({ ...item, antwort: 'neu' }) }))
    const ids = new Map([['x-001', marke]])
    expect(erledigteMeldungen(ids, [item], new Map([['x-001', 500]]))).toEqual([]) // alter Cache
    expect(erledigteMeldungen(ids, [item], new Map([['x-001', 2000]]))).toHaveLength(1) // spaeter geliefert
  })

  it('inhaltSeit: erster Lauf alles alt, geaenderter Inhalt bekommt den jetzigen Zeitpunkt', () => {
    const vorher = globalThis.localStorage
    const daten = new Map()
    globalThis.localStorage = { getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => daten.set(k, String(v)) }
    try {
      expect(inhaltSeit('t', [item], 100).get('x-001')).toBe(0)
      expect(inhaltSeit('t', [item], 200).get('x-001')).toBe(0)
      expect(inhaltSeit('t', [{ ...item, antwort: 'neu' }], 300).get('x-001')).toBe(300)
      expect(inhaltSeit('t', [{ ...item, antwort: 'neu' }], 400).get('x-001')).toBe(300)
    } finally {
      globalThis.localStorage = vorher
    }
  })

  it('alte Meldungen ohne Fingerabdruck gelten ueber einen neueren stand als erledigt', () => {
    const marke = anwenden({}, meldenAenderung({}, { grund: 'unklar', text: '', ts: Date.UTC(2026, 8, 20) }))
    expect(erledigteMeldungen(new Map([['x-001', marke]]), [item])).toHaveLength(0)
    expect(erledigteMeldungen(new Map([['x-001', marke]]), [{ ...item, stand: '2026-10' }])).toHaveLength(1)
  })
})

describe('Freigaben (P8)', () => {
  it('erscheinen im Export unter eigener Ueberschrift', () => {
    const item = { id: 'bp-1', geprueft: false, frage: 'F', antwort: 'A', themaTitel: 'T', pruefhinweis: 'gegen DIN X' }
    const marken = new Map([['bp-1', { freigabe: { text: 'DIN X:2018 geprüft', ts: 1 } }]])
    const freigaben = freigabenSammeln({ items: [item], marken })
    expect(freigaben).toHaveLength(1)
    const md = meldungenMarkdown({ eintraege: [], freigaben, paket: { id: 'arch-de' } })
    expect(md).toContain('## Freigaben')
    expect(md).toContain('DIN X:2018 geprüft')
  })
})
