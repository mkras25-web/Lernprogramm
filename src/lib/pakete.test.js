// Vertragstest fuer die echten Inhaltspakete (T5, 2026-10-13): dieselben
// Grundregeln wie paketpruefung.py, aber bei jedem "npm test" - also auch
// nach Handaenderungen und in der Online-Pipeline. Buchausschnitte
// (bilder-lokal) fehlen online absichtlich und werden nicht verlangt.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { itemFehler } from './itemPruefung.js'
import { quelleText } from './quelle.js'

// fileURLToPath statt import.meta.dirname: laeuft auch unter Node < 20.11.
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'pakete')
const json = (pfad) => JSON.parse(readFileSync(pfad, 'utf8'))

const verzeichnis = json(join(WURZEL, 'pakete.json'))
const pakete = verzeichnis.pakete.map((eintrag) => {
  const ordner = join(WURZEL, eintrag.id)
  const paket = json(join(ordner, 'paket.json'))
  const themen = paket.module.flatMap((m) => m.themen ?? [])
  const dateien = themen
    .filter((t) => t.datei)
    .map((t) => ({ thema: t, daten: json(join(ordner, t.datei)) }))
  return { id: eintrag.id, ordner, paket, themen, dateien }
})

function bildDa(ordner, rel) {
  if (!rel || rel.startsWith('bilder-lokal/')) return true
  return existsSync(join(ordner, rel))
}

describe.each(pakete)('Paket $id', ({ id, ordner, paket, themen, dateien }) => {
  it('paket.json passt zum Ordner und hat jedes Thema genau einmal', () => {
    expect(paket.id).toBe(id)
    const ids = themen.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('jede Itemdatei gehoert zu ihrem Thema und jede Karte ist darstellbar', () => {
    const fehler = []
    for (const { thema, daten } of dateien) {
      if (daten.thema !== thema.id) fehler.push(`${thema.datei}: thema "${daten.thema}" statt "${thema.id}"`)
      for (const item of daten.items ?? []) {
        const grund = itemFehler(item)
        if (grund) fehler.push(`${item.id}: ${grund}`)
      }
    }
    expect(fehler).toEqual([])
  })

  it('Item-IDs sind ueber alle Themen eindeutig', () => {
    const gesehen = new Map()
    const doppelt = []
    for (const { thema, daten } of dateien) {
      for (const item of daten.items ?? []) {
        if (gesehen.has(item.id)) doppelt.push(`${item.id} in ${gesehen.get(item.id)} und ${thema.id}`)
        gesehen.set(item.id, thema.id)
      }
    }
    expect(doppelt).toEqual([])
  })

  it('alle eigenen Bilder (bilder/) liegen im Paket', () => {
    const fehlend = []
    for (const t of themen) if (!bildDa(ordner, t.bild)) fehlend.push(`Thema ${t.id}: ${t.bild}`)
    for (const { daten } of dateien) {
      if (!bildDa(ordner, daten.erklaerung?.bild)) fehlend.push(`Erklaerung ${daten.thema}: ${daten.erklaerung.bild}`)
      for (const item of daten.items ?? []) {
        for (const rel of [item.referenz, item.bild, item.fallbild, ...(item.seiten ?? []).map((s) => s.bild)]) {
          if (!bildDa(ordner, rel)) fehlend.push(`${item.id}: ${rel}`)
        }
      }
    }
    expect(fehlend).toEqual([])
  })

  it('siehe zeigt nur auf Themen, die es gibt', () => {
    const vorhanden = new Set(themen.map((t) => t.id))
    const falsch = []
    for (const { daten } of dateien) {
      for (const ziel of daten.siehe ?? []) if (!vorhanden.has(ziel)) falsch.push(`${daten.thema} -> ${ziel}`)
      for (const item of daten.items ?? []) {
        for (const ziel of item.siehe ?? []) if (!vorhanden.has(ziel)) falsch.push(`${item.id} -> ${ziel}`)
      }
    }
    expect(falsch).toEqual([])
  })

  it('jede Karte hat eine lesbare Quellenangabe (Prinzip 1)', () => {
    const ohne = []
    for (const { daten } of dateien) {
      for (const item of daten.items ?? []) if (!quelleText(item.quelle).trim()) ohne.push(item.id)
    }
    expect(ohne).toEqual([])
  })

  it('kennwerte.json hat, falls vorhanden, die erwartete Form', () => {
    const pfad = join(ordner, 'kennwerte.json')
    if (!existsSync(pfad)) return
    const daten = json(pfad)
    expect(Array.isArray(daten.gruppen)).toBe(true)
    const vorhanden = new Set(themen.map((t) => t.id))
    for (const g of daten.gruppen) {
      expect(g.id && g.titel).toBeTruthy()
      for (const e of g.eintraege ?? []) {
        expect(String(e.name ?? '').trim() && String(e.wert ?? '').trim()).toBeTruthy()
        expect(quelleText(e.quelle).trim()).not.toBe('')
        for (const t of e.themen ?? []) expect(vorhanden.has(t)).toBe(true)
      }
    }
  })
})

it('jeder Paketordner steht in pakete.json', () => {
  const ordner = readdirSync(WURZEL, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(WURZEL, d.name, 'paket.json')))
    .map((d) => d.name)
  expect(ordner.sort()).toEqual(verzeichnis.pakete.map((p) => p.id).sort())
})
