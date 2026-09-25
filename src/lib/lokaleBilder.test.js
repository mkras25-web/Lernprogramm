import { beforeAll, describe, it, expect, vi } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import {
  CACHE_NAME,
  bildUrl,
  lokaleBilderImportieren,
  lokaleBilderLoeschen,
  lokaleBilderZaehlen,
  zielAusZipPfad,
  zipEintraege,
} from './lokaleBilder.js'

// Minimaler ZIP-Schreiber (Standardformat, wie Python/Windows es erzeugen):
// je Eintrag Lokalheader + Daten, danach Inhaltsverzeichnis und Endsatz.
function zipBauen(eintraege) {
  const teile = []
  const verzeichnis = []
  let pos = 0
  for (const { name, daten, gepackt } of eintraege) {
    const namenBytes = Buffer.from(name, 'utf-8')
    const inhalt = gepackt ? deflateRawSync(daten) : daten
    const kopf = Buffer.alloc(30)
    kopf.writeUInt32LE(0x04034b50, 0)
    kopf.writeUInt16LE(20, 4)
    kopf.writeUInt16LE(0x0800, 6)
    kopf.writeUInt16LE(gepackt ? 8 : 0, 8)
    kopf.writeUInt32LE(inhalt.length, 18)
    kopf.writeUInt32LE(daten.length, 22)
    kopf.writeUInt16LE(namenBytes.length, 26)
    teile.push(kopf, namenBytes, inhalt)

    const zentral = Buffer.alloc(46)
    zentral.writeUInt32LE(0x02014b50, 0)
    zentral.writeUInt16LE(20, 4)
    zentral.writeUInt16LE(20, 6)
    zentral.writeUInt16LE(0x0800, 8)
    zentral.writeUInt16LE(gepackt ? 8 : 0, 10)
    zentral.writeUInt32LE(inhalt.length, 20)
    zentral.writeUInt32LE(daten.length, 24)
    zentral.writeUInt16LE(namenBytes.length, 28)
    zentral.writeUInt32LE(pos, 42)
    verzeichnis.push(zentral, namenBytes)
    pos += 30 + namenBytes.length + inhalt.length
  }
  const zentralGroesse = verzeichnis.reduce((s, b) => s + b.length, 0)
  const ende = Buffer.alloc(22)
  ende.writeUInt32LE(0x06054b50, 0)
  ende.writeUInt16LE(eintraege.length, 8)
  ende.writeUInt16LE(eintraege.length, 10)
  ende.writeUInt32LE(zentralGroesse, 12)
  ende.writeUInt32LE(pos, 16)
  const alles = Buffer.concat([...teile, ...verzeichnis, ende])
  return alles.buffer.slice(alles.byteOffset, alles.byteOffset + alles.length)
}

function dateiAus(buffer) {
  return { arrayBuffer: async () => buffer }
}

// Kleiner Ersatz fuer die Cache Storage API.
function fakeCaches() {
  const speicher = new Map()
  return {
    async open(name) {
      if (!speicher.has(name)) speicher.set(name, new Map())
      const inhalt = speicher.get(name)
      return {
        async put(url, antwort) {
          inhalt.set(url, antwort)
        },
        async keys() {
          return [...inhalt.keys()].map((url) => ({ url }))
        },
      }
    },
    async has(name) {
      return speicher.has(name)
    },
    async delete(name) {
      return speicher.delete(name)
    },
    speicher,
  }
}

// Im Build steht base './' (relative Pfade) - genau so testen.
beforeAll(() => vi.stubEnv('BASE_URL', './'))

const BILD = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

describe('zipEintraege', () => {
  it('liest gespeicherte und deflate-gepackte Eintraege', async () => {
    const zip = zipBauen([
      { name: 'arch-de/a.png', daten: BILD },
      { name: 'arch-de/b.png', daten: new Uint8Array(500).fill(7), gepackt: true },
    ])
    const eintraege = await zipEintraege(zip)
    expect(eintraege.map((e) => e.name)).toEqual(['arch-de/a.png', 'arch-de/b.png'])
    expect([...eintraege[0].daten]).toEqual([...BILD])
    expect(eintraege[1].daten.length).toBe(500)
    expect(eintraege[1].daten.every((b) => b === 7)).toBe(true)
  })

  it('lehnt Nicht-ZIP-Dateien mit klarer Meldung ab', async () => {
    await expect(zipEintraege(new Uint8Array(100).buffer)).rejects.toThrow('keine ZIP')
  })
})

describe('zielAusZipPfad', () => {
  it('erkennt Paketordner mit und ohne bilder-lokal', () => {
    expect(zielAusZipPfad('arch-de/x.png')).toEqual({ paket: 'arch-de', datei: 'x.png' })
    expect(zielAusZipPfad('pharma-de/bilder-lokal/y.JPG')).toEqual({ paket: 'pharma-de', datei: 'y.JPG' })
  })

  it('lässt Ungeeignetes aus: fremde Endung, Pfadsprung, kein Paketordner', () => {
    expect(zielAusZipPfad('arch-de/notiz.txt')).toBeNull()
    expect(zielAusZipPfad('arch-de/../x.png')).toBeNull()
    expect(zielAusZipPfad('x.png')).toBeNull()
  })
})

describe('bildUrl', () => {
  it('trifft die URL, unter der die App das Bild anfragt (auch unter Unterpfad)', () => {
    expect(bildUrl('arch-de', 'bk-x.png', 'https://name.github.io/lernprogramm/')).toBe(
      'https://name.github.io/lernprogramm/pakete/arch-de/bilder-lokal/bk-x.png'
    )
  })
})

describe('lokaleBilderImportieren / Zaehlen / Loeschen', () => {
  it('legt Bilder je Paket unter ihrer URL in den Cache und zaehlt sie', async () => {
    const cacheSpeicher = fakeCaches()
    const zip = zipBauen([
      { name: 'arch-de/a.png', daten: BILD },
      { name: 'arch-de/b.png', daten: BILD },
      { name: 'pharma-de/c.webp', daten: BILD },
      { name: 'arch-de/lies-mich.txt', daten: BILD },
    ])
    const basis = 'https://x.github.io/repo/'
    const bericht = await lokaleBilderImportieren(dateiAus(zip), { cacheSpeicher, basis })
    expect(bericht).toEqual({ anzahl: 3, jePaket: { 'arch-de': 2, 'pharma-de': 1 }, uebersprungen: 1 })

    const gespeichert = cacheSpeicher.speicher.get(CACHE_NAME)
    const antwort = gespeichert.get('https://x.github.io/repo/pakete/arch-de/bilder-lokal/a.png')
    expect(antwort.headers.get('Content-Type')).toBe('image/png')
    expect(new Uint8Array(await antwort.arrayBuffer())).toEqual(BILD)

    expect(await lokaleBilderZaehlen({ cacheSpeicher })).toEqual({ 'arch-de': 2, 'pharma-de': 1 })
    expect(await lokaleBilderLoeschen({ cacheSpeicher })).toBe(true)
    expect(await lokaleBilderZaehlen({ cacheSpeicher })).toEqual({})
  })

  it('meldet, wenn die ZIP kein einziges passendes Bild enthaelt', async () => {
    const zip = zipBauen([{ name: 'arch-de/lies-mich.txt', daten: BILD }])
    await expect(
      lokaleBilderImportieren(dateiAus(zip), { cacheSpeicher: fakeCaches(), basis: 'https://x/' })
    ).rejects.toThrow('keine passenden Bilder')
  })
})
