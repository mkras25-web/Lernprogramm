import { describe, expect, it } from 'vitest'
import { csvAusEreignissen } from './fortschritt.js'

describe('CSV-Export (Formelschutz, Sicherheitsaudit 2026-11-04)', () => {
  const zeile = (csv) => csv.replace(/^﻿/, '').split('\r\n')[1].split(';')

  it('entschaerft Texte, die Excel als Formel lesen wuerde', () => {
    const items = [{ id: '=cmd', frage: '=HYPERLINK("https://x";"klick")', themaTitel: '+Thema', modulTitel: '@Modul' }]
    const csv = csvAusEreignissen([{ ts: 0, itemId: '=cmd', bewertung: 3, dauerMs: 4000 }], items)
    const felder = csv.replace(/^﻿/, '').split('\r\n')[1]
    expect(felder).toContain(`;'@Modul;'+Thema;'=cmd;`)
    expect(felder).toContain(`"'=HYPERLINK(""https://x"";""klick"")"`)
  })

  it('laesst echte Zahlen und normale Texte unveraendert', () => {
    const items = [{ id: 'bk-1', frage: 'Was ist ein U-Wert?', themaTitel: 'Bauphysik', modulTitel: 'Grundlagen' }]
    const felder = zeile(csvAusEreignissen([{ ts: 0, itemId: 'bk-1', bewertung: 4, dauerMs: 12000 }], items))
    expect(felder.slice(2)).toEqual(['Grundlagen', 'Bauphysik', 'bk-1', 'Was ist ein U-Wert?', 'Leicht', '12', ''])
  })

  it('setzt Felder mit Zeilenumbruch oder Wagenruecklauf in Anfuehrungszeichen', () => {
    const items = [{ id: 'a', frage: 'eins\rzwei', themaTitel: '', modulTitel: '' }]
    const csv = csvAusEreignissen([{ ts: 0, itemId: 'a', bewertung: 1 }], items)
    expect(csv).toContain('"eins\rzwei"')
  })
})
