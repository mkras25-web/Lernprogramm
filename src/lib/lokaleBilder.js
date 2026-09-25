// Lokale Bilder (Buchausschnitte) auf dem Handy.
//
// Diese Bilder sind urheberrechtlich geschuetzt und liegen deshalb nicht
// im Git und nicht auf dem oeffentlichen Server. Am PC stehen sie einfach
// im Ordner bilder-lokal. Aufs Handy kommen sie so: der PC packt sie in
// eine ZIP (Einspielen/bilder_packen.py), die ueber Dropbox zum Handy
// wandert und hier eingelesen wird. Die Bilder landen im Cache des
// Geraets - unter genau den URLs, unter denen die App sie anfragt. Der
// Service Worker (vite.config.js, Cache "lokale-bilder") liefert sie von
// dort aus; die Bilder verlassen das Geraet nie.

export const CACHE_NAME = 'lokale-bilder'

const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

function endung(name) {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase()
}

const u16 = (v, o) => v.getUint16(o, true)
const u32 = (v, o) => v.getUint32(o, true)

async function entpacken(bytes, methode) {
  if (methode === 0) return bytes
  if (methode !== 8) throw new Error(`Nicht unterstuetzte ZIP-Kompression (${methode}).`)
  const strom = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(strom).arrayBuffer())
}

// Liest ein ZIP ueber sein Inhaltsverzeichnis (Standardformat, wie es
// Python/Windows/macOS schreiben; ohne ZIP64 - Bilderpakete sind klein).
export async function zipEintraege(buffer) {
  const bytes = new Uint8Array(buffer)
  const ansicht = new DataView(buffer)

  let ende = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(ansicht, i) === 0x06054b50) {
      ende = i
      break
    }
  }
  if (ende < 0) throw new Error('Das ist keine ZIP-Datei.')

  const anzahl = u16(ansicht, ende + 10)
  let zeiger = u32(ansicht, ende + 16)
  const dekoder = new TextDecoder('utf-8')
  const eintraege = []

  for (let n = 0; n < anzahl; n++) {
    if (u32(ansicht, zeiger) !== 0x02014b50) throw new Error('Beschaedigte ZIP-Datei.')
    const methode = u16(ansicht, zeiger + 10)
    const groesse = u32(ansicht, zeiger + 20)
    const namenLaenge = u16(ansicht, zeiger + 28)
    const extraLaenge = u16(ansicht, zeiger + 30)
    const kommentarLaenge = u16(ansicht, zeiger + 32)
    const kopfPos = u32(ansicht, zeiger + 42)
    const name = dekoder.decode(bytes.subarray(zeiger + 46, zeiger + 46 + namenLaenge))
    zeiger += 46 + namenLaenge + extraLaenge + kommentarLaenge

    if (name.endsWith('/')) continue

    const lokalNamen = u16(ansicht, kopfPos + 26)
    const lokalExtra = u16(ansicht, kopfPos + 28)
    const start = kopfPos + 30 + lokalNamen + lokalExtra
    eintraege.push({ name, daten: await entpacken(bytes.subarray(start, start + groesse), methode) })
  }
  return eintraege
}

// "arch-de/bk-x.png" oder "arch-de/bilder-lokal/bk-x.png" -> Paket und
// Dateiname. Alles andere (fremde Endung, "..", ohne Paketordner) wird
// ausgelassen.
export function zielAusZipPfad(zipName) {
  const teile = zipName.replace(/\\/g, '/').split('/').filter(Boolean)
  if (teile.includes('..') || teile.length < 2) return null
  const i = teile.indexOf('bilder-lokal')
  const paket = i > 0 ? teile[i - 1] : teile[0]
  const datei = i >= 0 ? teile.slice(i + 1).join('/') : teile.slice(1).join('/')
  if (!datei || !MIME[endung(datei)]) return null
  return { paket, datei }
}

export function bildUrl(paket, datei, basis = document.baseURI) {
  const pfad = `${import.meta.env.BASE_URL}pakete/${encodeURIComponent(paket)}/bilder-lokal/${datei
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  return new URL(pfad, basis).href
}

export function lokaleBilderMoeglich() {
  return typeof caches !== 'undefined' && typeof DecompressionStream !== 'undefined'
}

export async function lokaleBilderImportieren(datei, { cacheSpeicher = caches, basis } = {}) {
  const eintraege = await zipEintraege(await datei.arrayBuffer())
  const cache = await cacheSpeicher.open(CACHE_NAME)
  const jePaket = {}
  let uebersprungen = 0

  for (const e of eintraege) {
    const ziel = zielAusZipPfad(e.name)
    if (!ziel) {
      uebersprungen += 1
      continue
    }
    const url = bildUrl(ziel.paket, ziel.datei, basis)
    await cache.put(
      url,
      new Response(e.daten, { headers: { 'Content-Type': MIME[endung(ziel.datei)] } })
    )
    jePaket[ziel.paket] = (jePaket[ziel.paket] ?? 0) + 1
  }

  const anzahl = Object.values(jePaket).reduce((s, n) => s + n, 0)
  if (anzahl === 0) throw new Error('Die ZIP enthält keine passenden Bilder (Ordner je Paket, PNG/JPG/WebP).')
  return { anzahl, jePaket, uebersprungen }
}

// Wie viele Bilder liegen je Paket im Geraete-Cache?
export async function lokaleBilderZaehlen({ cacheSpeicher = caches } = {}) {
  if (!(await cacheSpeicher.has(CACHE_NAME))) return {}
  const cache = await cacheSpeicher.open(CACHE_NAME)
  const jePaket = {}
  for (const anfrage of await cache.keys()) {
    const treffer = new URL(anfrage.url).pathname.match(/\/pakete\/([^/]+)\/bilder-lokal\//)
    if (treffer) {
      const paket = decodeURIComponent(treffer[1])
      jePaket[paket] = (jePaket[paket] ?? 0) + 1
    }
  }
  return jePaket
}

export async function lokaleBilderLoeschen({ cacheSpeicher = caches } = {}) {
  return cacheSpeicher.delete(CACHE_NAME)
}
