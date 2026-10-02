import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  alleEreignisse,
  datenbankFuerProfilSetzen,
  datenbankSchliessen,
  ereignisLoeschen,
  ereignisSpeichern,
  exportieren,
  importieren,
} from './speicher.js'
import { abgleichen, dateiname, profilAusDateiname, profileInDropbox } from './abgleich.js'
import { rueckkehrVerarbeiten, verbindungStarten } from './dropbox.js'

// ---------------------------------------------------------------- Umgebung
// Ein "Geraet" ist ein eigener Browserspeicher: eigene IndexedDB und eigenes
// localStorage. geraetWaehlen() schaltet dazwischen um.

function fakeLocalStorage() {
  const daten = new Map()
  return {
    getItem: (k) => (daten.has(k) ? daten.get(k) : null),
    setItem: (k, v) => void daten.set(k, String(v)),
    removeItem: (k) => void daten.delete(k),
  }
}

const geraete = {}
async function geraetWaehlen(name) {
  await datenbankSchliessen()
  if (!geraete[name]) {
    geraete[name] = { idb: new IDBFactory(), ls: fakeLocalStorage() }
    // Echte Geraetekennungen sind 8 Hex-Zeichen (siehe speicher.js).
    geraete[name].ls.setItem('geraet', [...name].map((c) => c.charCodeAt(0).toString(16)).join('').padEnd(8, '0').slice(0, 8))
    geraete[name].ls.setItem(
      'dropbox_verbindung',
      JSON.stringify({ appKey: 'k', refreshToken: 'r', accessToken: 'a', ablauf: Date.now() + 3_600_000 })
    )
  }
  globalThis.indexedDB = geraete[name].idb
  globalThis.localStorage = geraete[name].ls
}

// Dropbox-Attrappe: ein Ordner im Speicher, dieselbe Schnittstelle wie
// api.dropboxapi.com / content.dropboxapi.com.
let ordner
let aufrufe
function dropboxAttrappe() {
  ordner = new Map()
  aufrufe = { upload: 0, download: 0, liste: 0 }
  let zaehler = 0
  globalThis.fetch = vi.fn(async (url, opt = {}) => {
    const antwort = (daten, status = 200) =>
      new Response(typeof daten === 'string' ? daten : JSON.stringify(daten), { status })
    if (url.endsWith('/files/list_folder')) {
      aufrufe.liste += 1
      return antwort({
        entries: [...ordner].map(([name, d]) => ({ '.tag': 'file', name, content_hash: d.hash, server_modified: d.zeit })),
        has_more: false,
      })
    }
    if (url.endsWith('/files/upload')) {
      aufrufe.upload += 1
      const name = JSON.parse(opt.headers['Dropbox-API-Arg']).path.slice(1)
      const eintrag = { text: opt.body, hash: `h${++zaehler}`, zeit: new Date(1_700_000_000_000 + zaehler * 1000).toISOString() }
      ordner.set(name, eintrag)
      return antwort({ name, content_hash: eintrag.hash })
    }
    if (url.endsWith('/files/download')) {
      aufrufe.download += 1
      const name = JSON.parse(opt.headers['Dropbox-API-Arg']).path.slice(1)
      return ordner.has(name) ? antwort(ordner.get(name).text) : antwort({ error_summary: 'path/not_found' }, 409)
    }
    return antwort({ error: 'unerwartet' }, 500)
  })
}

const PROFIL = 'aaaaaaaa-1111-4222-8333-444444444444'

async function antworten(itemId, bewertung = 3) {
  return ereignisSpeichern({ itemId, paketId: 'arch-de', bewertung, dauerMs: 1000 })
}

async function abgleich(name, profilId = PROFIL) {
  await geraetWaehlen(name)
  await datenbankFuerProfilSetzen(profilId)
  return abgleichen({ profilId, profilName: 'Max' })
}

beforeEach(async () => {
  for (const k of Object.keys(geraete)) delete geraete[k]
  await datenbankSchliessen()
  await geraetWaehlen('phone')
  await datenbankFuerProfilSetzen('wechsel')
  dropboxAttrappe()
})

// ------------------------------------------------------------------ Tests

describe('Dateinamen', () => {
  it('erkennt Profil und Geraet und lehnt fremde Namen ab', () => {
    const name = dateiname(PROFIL, 'ab12cd34')
    expect(profilAusDateiname(name)).toEqual({ profilId: PROFIL, geraet: 'ab12cd34' })
    expect(profilAusDateiname('notizen.json')).toBeNull()
  })
})

describe('Loeschvermerke', () => {
  it('ein rueckgaengig gemachtes Ereignis kommt aus einer aelteren Sicherung nicht zurueck', async () => {
    await geraetWaehlen('a')
    await datenbankFuerProfilSetzen(PROFIL)
    const e1 = await antworten('item-1')
    const e2 = await antworten('item-2')
    const vorher = await exportieren({ profilId: PROFIL, profilName: 'Max' }) // enthaelt e2
    await ereignisLoeschen(e2.id)
    const nachher = await exportieren({ profilId: PROFIL, profilName: 'Max' })
    expect(JSON.parse(nachher).geloescht.ereignisse[e2.id]).toBeTypeOf('number')

    // Anderes Geraet liest zuerst die alte Sicherung, dann die neue.
    await geraetWaehlen('b')
    await datenbankFuerProfilSetzen(PROFIL)
    await importieren(vorher)
    expect((await alleEreignisse()).map((e) => e.id).sort()).toEqual([e1.id, e2.id].sort())
    const bericht = await importieren(nachher)
    expect(bericht.geloescht).toBe(1)
    expect((await alleEreignisse()).map((e) => e.id)).toEqual([e1.id])

    // Und die alte Sicherung danach noch einmal: bleibt geloescht.
    await importieren(vorher)
    expect((await alleEreignisse()).map((e) => e.id)).toEqual([e1.id])
  })
})

describe('Abgleich ueber Dropbox', () => {
  it('bringt den Fortschritt von einem Geraet aufs andere und zurueck', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('item-1')
    await antworten('item-2')
    await antworten('item-3')
    const ersterLauf = await abgleich('pc')
    expect(ersterLauf.dateien).toBe(0)
    expect(ordner.size).toBe(1)

    // Neues Geraet: holt alles.
    const handy = await abgleich('phone')
    expect(handy.ereignisse).toBe(3)
    expect((await alleEreignisse()).length).toBe(3)

    // Handy lernt weiter, gleicht ab.
    await antworten('item-4')
    await antworten('item-5')
    await abgleich('phone')
    expect(ordner.size).toBe(2)

    // PC holt die zwei neuen.
    const zurueck = await abgleich('pc')
    expect(zurueck.ereignisse).toBe(2)
    expect((await alleEreignisse()).length).toBe(5)
  })

  it('laedt nichts hoch und nichts herunter, wenn sich nichts geaendert hat', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('item-1')
    await abgleich('pc')
    const hoch = aufrufe.upload
    const runter = aufrufe.download
    const wieder = await abgleich('pc')
    expect(aufrufe.upload).toBe(hoch)
    expect(aufrufe.download).toBe(runter)
    expect(wieder.dateien).toBe(0)
  })

  it('Loeschen auf einem Geraet wirkt auf das andere und kommt nicht zurueck', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('item-1')
    const versehen = await antworten('item-2')
    await abgleich('pc')
    await abgleich('phone')
    expect((await alleEreignisse()).length).toBe(2)

    // Handy macht Antwort rueckgaengig.
    await ereignisLoeschen(versehen.id)
    await abgleich('phone')

    // PC (dessen Datei die Antwort noch enthaelt) holt den Vermerk ...
    const pc = await abgleich('pc')
    expect(pc.geloescht).toBe(1)
    expect((await alleEreignisse()).map((e) => e.itemId)).toEqual(['item-1'])

    // ... und das Handy holt sie nicht wieder zurueck.
    await abgleich('phone')
    expect((await alleEreignisse()).map((e) => e.itemId)).toEqual(['item-1'])
  })

  it('stellt nach geraeumten Browserdaten aus der eigenen Datei in Dropbox wieder her', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('item-1')
    await antworten('item-2')
    await abgleich('pc')

    // Gleiches Geraet, aber leerer Speicher (gleiche Geraete-Kennung).
    delete geraete.pc
    const wieder = await abgleich('pc')
    expect(wieder.ereignisse).toBe(2)
  })

  it('liest nur Dateien des eigenen Profils', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('item-1')
    await abgleich('pc')

    const anderes = 'bbbbbbbb-1111-4222-8333-444444444444'
    await geraetWaehlen('phone')
    await datenbankFuerProfilSetzen(anderes)
    await antworten('fremd-1')
    await abgleichen({ profilId: anderes, profilName: 'Anna' })

    const ergebnis = await abgleich('phone', anderes)
    expect((await alleEreignisse()).map((e) => e.itemId)).toEqual(['fremd-1'])
    expect(ergebnis.ereignisse).toBe(0)
  })

  it('profileInDropbox nennt die Profile mit Namen', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('item-1')
    await abgleich('pc')
    const profile = await profileInDropbox()
    expect(profile).toEqual([{ id: PROFIL, name: 'Max', geraete: 1, ereignisse: 1 }])
  })

  it('meldet Dropbox-Fehler mit lesbarem Text und merkt ihn im Stand', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error_summary: 'too_many_requests/' }), { status: 429 }))
    await expect(abgleichen({ profilId: PROFIL, profilName: 'Max' })).rejects.toThrow('too_many_requests')
    expect(JSON.parse(localStorage.getItem(`dropbox_stand_${PROFIL}`)).fehler).toContain('too_many_requests')
  })
})

describe('Anmeldung (OAuth mit PKCE)', () => {
  beforeEach(async () => {
    await geraetWaehlen('phone')
    globalThis.location = {
      origin: 'https://name.github.io',
      pathname: '/lernprogramm/',
      search: '',
      assign: vi.fn(),
    }
    globalThis.document = { baseURI: 'https://name.github.io/lernprogramm/' }
    globalThis.history = { replaceState: vi.fn() }
  })

  it('loest die Rueckkehradresse ueber document.baseURI auf, nicht ueber location.pathname', async () => {
    // Genau der Fehler vom 2026-10-02: ein Aufruf von .../sync-config.json
    // im selben Tab laesst den Service Worker die App-Huelle liefern, die
    // Adresszeile bleibt aber bei der Datei stehen. document.baseURI ist in
    // diesem Fall ebenfalls die Datei-Adresse - rueckkehrAdresse() muss das
    // trotzdem auf das Verzeichnis zurueckfuehren.
    globalThis.document = { baseURI: 'https://name.github.io/lernprogramm/sync-config.json' }
    await verbindungStarten('mein-schluessel')
    const ziel = new URL(location.assign.mock.calls[0][0])
    expect(ziel.searchParams.get('redirect_uri')).toBe('https://name.github.io/lernprogramm/')
  })

  it('leitet mit PKCE-Pruefwert und genau der eingetragenen Rueckkehradresse zu Dropbox', async () => {
    await verbindungStarten('mein-schluessel')
    const ziel = new URL(location.assign.mock.calls[0][0])
    expect(ziel.origin + ziel.pathname).toBe('https://www.dropbox.com/oauth2/authorize')
    expect(ziel.searchParams.get('client_id')).toBe('mein-schluessel')
    expect(ziel.searchParams.get('code_challenge_method')).toBe('S256')
    expect(ziel.searchParams.get('token_access_type')).toBe('offline')
    expect(ziel.searchParams.get('redirect_uri')).toBe('https://name.github.io/lernprogramm/')
    expect(ziel.searchParams.get('code_challenge').length).toBe(43)
  })

  it('tauscht den Code nur bei passendem state gegen Zugangsdaten', async () => {
    await verbindungStarten('mein-schluessel')
    const vorgang = JSON.parse(localStorage.getItem('dropbox_vorgang'))

    // Fremder state: wird ignoriert.
    location.search = '?code=abc&state=falsch'
    expect(await rueckkehrVerarbeiten()).toBeNull()

    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 14400, account_id: 'dbid:1' }), { status: 200 })
    )
    location.search = `?code=abc&state=${vorgang.state}`
    const ergebnis = await rueckkehrVerarbeiten()
    expect(ergebnis.art).toBe('erfolg')
    const gesendet = fetch.mock.calls[0][1].body.toString()
    expect(new URLSearchParams(gesendet).get('code_verifier')).toBe(vorgang.verifier)
    expect(gesendet).toContain('grant_type=authorization_code')
    expect(JSON.parse(localStorage.getItem('dropbox_verbindung')).refreshToken).toBe('RT')
    expect(localStorage.getItem('dropbox_vorgang')).toBeNull()
  })
})
