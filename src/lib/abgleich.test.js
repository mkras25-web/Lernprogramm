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
  kursplanEintragLoeschen,
  kursplanEintragSetzen,
  kursplanLesen,
  alleMarken,
  markeSetzen,
  allesLoeschen,
  wiederherstellen,
} from './speicher.js'
import { abgleichen, dateiname, dropboxKopien, dropboxKopieLaden, KOPIEN_TAGE, profilAusDateiname, profileInDropbox } from './abgleich.js'
import { kopieAnlegen, kopienListe, kopieText } from './kopien.js'
import { rueckkehrVerarbeiten, verbindungStarten } from './dropbox.js'
import { profilErstellen, profilLoeschen } from './profile.js'

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
      // Wie Dropbox: nur die Dateien direkt in diesem Ordner, Unterordner
      // (sicherungen/…) erscheinen in der Liste des App-Ordners nicht.
      const pfad = JSON.parse(opt.body).path.replace(/^\//, '')
      const praefix = pfad ? `${pfad}/` : ''
      const drin = [...ordner].filter(([name]) => name.startsWith(praefix) && !name.slice(praefix.length).includes('/'))
      if (pfad && drin.length === 0) return antwort({ error_summary: 'path/not_found/..' }, 409)
      return antwort({
        entries: drin.map(([name, d]) => ({ '.tag': 'file', name: name.slice(praefix.length), content_hash: d.hash, server_modified: d.zeit })),
        has_more: false,
      })
    }
    if (url.endsWith('/files/delete_v2')) {
      ordner.delete(JSON.parse(opt.body).path.slice(1))
      return antwort({ metadata: {} })
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
// Geraetestaende im App-Ordner, ohne die Sicherheitskopien im Unterordner.
const geraeteDateien = () => [...ordner.keys()].filter((n) => !n.includes('/'))

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

describe('Kursplan (Kurse und Klausurtermine)', () => {
  const titel = (art) => kursplanLesen()[art].map((e) => e.titel).sort()

  it('reist per Dropbox, neuere Aenderung gewinnt, Loeschen kommt nicht zurueck', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    kursplanEintragSetzen('kurse', { id: 'k1', titel: 'Baurecht', kennung: 'baurecht-ws26' })
    kursplanEintragSetzen('klausuren', { id: 'x1', titel: 'Baurecht I', datum: '2027-02-14', kursId: 'k1' })
    await abgleich('pc')

    const handy = await abgleich('phone')
    expect(handy.kursplan).toBe(2)
    expect(titel('kurse')).toEqual(['Baurecht'])
    expect(kursplanLesen().klausuren[0].kursId).toBe('k1')

    // Handy benennt um (neuerer ts) - der PC uebernimmt.
    await new Promise((r) => setTimeout(r, 5))
    kursplanEintragSetzen('kurse', { id: 'k1', titel: 'Baurecht I', kennung: 'baurecht-ws26' })
    await abgleich('phone')
    await abgleich('pc')
    expect(titel('kurse')).toEqual(['Baurecht I'])

    // PC loescht die Klausur; das Handy (dessen Datei sie noch hat) folgt.
    kursplanEintragLoeschen('klausuren', 'x1')
    await abgleich('pc')
    await abgleich('phone')
    expect(kursplanLesen().klausuren).toEqual([])
    await abgleich('pc')
    expect(kursplanLesen().klausuren).toEqual([])
  })

  it('Klausurergebnis und Archivierung (F9) reisen mit', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    kursplanEintragSetzen('kurse', { id: 'k1', titel: 'Baurecht', archiviert: true })
    kursplanEintragSetzen('klausuren', { id: 'x1', titel: 'Baurecht I', datum: '2026-02-14', kursId: 'k1', ergebnis: '2,3', reifeAmTag: 87 })
    await abgleich('pc')
    await abgleich('phone')
    expect(kursplanLesen().kurse[0].archiviert).toBe(true)
    expect(kursplanLesen().klausuren[0]).toMatchObject({ ergebnis: '2,3', reifeAmTag: 87 })
  })

  it('eine aeltere Sicherung ueberschreibt keinen neueren Kurs', async () => {
    await geraetWaehlen('a')
    await datenbankFuerProfilSetzen(PROFIL)
    kursplanEintragSetzen('kurse', { id: 'k1', titel: 'Alt' })
    const alt = await exportieren({ profilId: PROFIL, profilName: 'Max' })
    await new Promise((r) => setTimeout(r, 5))
    kursplanEintragSetzen('kurse', { id: 'k1', titel: 'Neu' })
    const bericht = await importieren(alt)
    expect(bericht.kursplan).toBe(0)
    expect(titel('kurse')).toEqual(['Neu'])
  })

  it('Profil loeschen entfernt auch den Kursplan', async () => {
    await geraetWaehlen('a')
    const { id } = profilErstellen('Test')
    await datenbankFuerProfilSetzen(id)
    kursplanEintragSetzen('kurse', { id: 'k1', titel: 'X' })
    expect(localStorage.getItem(`kursplan_${id}`)).not.toBeNull()
    await profilLoeschen(id)
    expect(localStorage.getItem(`kursplan_${id}`)).toBeNull()
  })
})

describe('Marken mit gleichem Zeitstempel (Fehler bis 2026-10-12)', () => {
  it('eine haengengebliebene Meldung kommt beim Abgleich doch noch an, und zwar auf beiden Geraeten', async () => {
    // Beide Geraete haben dieselbe Marke mit ts 1000; das Handy hat danach
    // gemeldet, aber den alten ts behalten.
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('item-1')
    await markeSetzen({ itemId: 'item-1', kategorie: 'relevant', lesezeichen: true, ts: 1000 })
    await abgleich('pc')
    await geraetWaehlen('phone')
    await datenbankFuerProfilSetzen(PROFIL)
    await markeSetzen({ itemId: 'item-1', kategorie: 'relevant', einspruch: true, meldung: { grund: 'falsch' }, ts: 1000 })
    await abgleich('phone')

    await abgleich('pc')
    const pc = (await alleMarken()).find((m) => m.itemId === 'item-1')
    expect(pc.meldung).toEqual({ grund: 'falsch' })
    expect(pc.lesezeichen).toBe(true)
    expect(pc.ts).toBeGreaterThan(1000)

    await abgleich('phone')
    const handy = (await alleMarken()).find((m) => m.itemId === 'item-1')
    expect(handy.lesezeichen).toBe(true)
    expect(handy.meldung).toEqual({ grund: 'falsch' })
  })
})

describe('Profilwechsel waehrend des Abgleichs (B1, 2026-10-13)', () => {
  const ANDERES = 'bbbbbbbb-1111-4222-8333-444444444444'

  it('schreibt die Daten von Profil A nie in Profil B und laedt nichts von B als A hoch', async () => {
    // PC hat drei Antworten in Profil A und gleicht ab.
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('a-1')
    await antworten('a-2')
    await antworten('a-3')
    await abgleich('pc')

    // Handy: Profil B hat eine eigene Antwort.
    await geraetWaehlen('phone')
    await datenbankFuerProfilSetzen(ANDERES)
    await antworten('b-1')
    // Profil A aktiv, Abgleich startet - und noch waehrend er laeuft wird
    // auf B gewechselt (Tipp auf "Profil wechseln").
    await datenbankFuerProfilSetzen(PROFIL)
    const lauf = abgleichen({ profilId: PROFIL, profilName: 'Max' })
    const wechsel = datenbankFuerProfilSetzen(ANDERES)
    await expect(lauf).rejects.toThrow(/Profil wurde gewechselt/)
    await wechsel

    // B enthaelt nur seine eigene Antwort, und in Dropbox liegt keine
    // Datei des Handys fuer Profil A mit Bs Daten.
    const inB = await alleEreignisse()
    expect(inB.map((e) => e.itemId)).toEqual(['b-1'])
    for (const [name, d] of ordner) {
      if (name.startsWith(`p-${PROFIL}-`)) expect(d.text).not.toContain('b-1')
    }
  })

  it('Profil loeschen waehrend seines Abgleichs legt die Datenbank nicht wieder an', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('a-1')
    await antworten('a-2')
    await abgleich('pc')

    await geraetWaehlen('phone')
    await datenbankFuerProfilSetzen(PROFIL)
    const lauf = abgleichen({ profilId: PROFIL, profilName: 'Max' }).catch((e) => e)
    await profilLoeschen(PROFIL)
    expect(await lauf).toBeInstanceOf(Error)
    const namen = (await indexedDB.databases()).map((d) => d.name)
    expect(namen).not.toContain(`lernprogramm_${PROFIL}`)
  })

  it('ein Abgleich von Profil B bekommt nie das Ergebnis eines laufenden Abgleichs von A', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('a-1')
    const laufA = abgleichen({ profilId: PROFIL, profilName: 'Max' })
    const laufB = abgleichen({ profilId: ANDERES, profilName: 'Eva' })
    // B ist nicht aktiv - darf scheitern, aber nie As Bericht liefern.
    const ergebnisB = laufB.catch((e) => e)
    expect(laufB).not.toBe(laufA)
    await laufA
    expect(await ergebnisB).toBeInstanceOf(Error)
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
    expect(geraeteDateien().length).toBe(1)

    // Neues Geraet: holt alles.
    const handy = await abgleich('phone')
    expect(handy.ereignisse).toBe(3)
    expect((await alleEreignisse()).length).toBe(3)

    // Handy lernt weiter, gleicht ab.
    await antworten('item-4')
    await antworten('item-5')
    await abgleich('phone')
    expect(geraeteDateien().length).toBe(2)

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

  // Regressionstest Datenverlust (2026-10-10): Profil lokal loeschen und
  // ueber "Profile in Dropbox" neu laden ueberschrieb die eigene Datei mit
  // einem leeren Stand, weil die Dropbox-Merker das Loeschen ueberlebten.
  it('Profil loeschen und aus Dropbox neu laden stellt wieder her statt zu ueberschreiben', async () => {
    await geraetWaehlen('handy')
    await datenbankFuerProfilSetzen(PROFIL)
    for (let i = 0; i < 5; i++) await antworten('item-' + i)
    await abgleichen({ profilId: PROFIL, profilName: 'Max' })
    const name = dateiname(PROFIL)
    expect(JSON.parse(ordner.get(name).text).ereignisse).toHaveLength(5)

    profilErstellen('Max', PROFIL)
    await profilLoeschen(PROFIL)
    profilErstellen('Max', PROFIL)
    await datenbankFuerProfilSetzen(PROFIL)
    await abgleichen({ profilId: PROFIL, profilName: 'Max' })

    expect(await alleEreignisse()).toHaveLength(5)
    expect(JSON.parse(ordner.get(name).text).ereignisse).toHaveLength(5)
  })

  it('ueberschreibt die eigene Datei nicht, wenn sie sich nicht einlesen laesst', async () => {
    await geraetWaehlen('handy')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('item-1')
    await abgleichen({ profilId: PROFIL, profilName: 'Max' })
    const name = dateiname(PROFIL)
    // Datei in Dropbox beschaedigt (neuer Hash, kein JSON)
    ordner.set(name, { text: 'kaputt', hash: 'h-kaputt', zeit: new Date().toISOString() })
    await antworten('item-2')
    await expect(abgleichen({ profilId: PROFIL, profilName: 'Max' })).rejects.toThrow(/nicht überschrieben/)
    expect(ordner.get(name).text).toBe('kaputt')
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

describe('Sicherheitskopien (T1, 2026-10-13)', () => {
  const ids = async () => (await alleEreignisse()).map((e) => e.itemId).sort()

  it('Loeschen per Dropbox verteilt - Wiederherstellen aus der lokalen Kopie bringt alles zurueck, ohne Dubletten', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('a-1')
    await antworten('a-2')
    await markeSetzen({ itemId: 'a-1', lesezeichen: true })
    await abgleich('pc')
    await abgleich('phone')
    expect(await ids()).toEqual(['a-1', 'a-2'])

    // PC: Kopie vor dem Loeschen, dann alles loeschen und verteilen.
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    const kopie = await kopieAnlegen({ profilId: PROFIL, profilName: 'Max', grund: 'vor dem Löschen' })
    await allesLoeschen()
    await abgleich('pc')
    await abgleich('phone')
    expect(await ids()).toEqual([])

    // Ein normaler Import der Kopie bringt wegen der Loeschvermerke nichts.
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    const text = await kopieText(kopie.id)
    expect((await importieren(text)).ereignisse).toBe(0)

    // Wiederherstellen schon.
    const bericht = await wiederherstellen(text)
    expect(bericht).toMatchObject({ ereignisse: 2, marken: 1 })
    expect(await ids()).toEqual(['a-1', 'a-2'])
    expect((await alleMarken()).find((m) => m.itemId === 'a-1')?.lesezeichen).toBe(true)
    await abgleich('pc')
    await abgleich('phone')
    expect(await ids()).toEqual(['a-1', 'a-2'])
    expect((await alleMarken()).find((m) => m.itemId === 'a-1')?.lesezeichen).toBe(true)

    // Das Handy stellt dieselbe Kopie auch noch her: nichts doppelt.
    expect((await wiederherstellen(text)).ereignisse).toBe(0)
    await abgleich('phone')
    await abgleich('pc')
    expect(await ids()).toEqual(['a-1', 'a-2'])
    await abgleich('phone')
    expect(await ids()).toEqual(['a-1', 'a-2'])
  })

  it('legt vor dem Abgleich einmal am Tag eine lokale und eine Dropbox-Kopie an und behaelt in Dropbox 7 Tage', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-10-01T09:00'))
      await geraetWaehlen('pc')
      // Zugang ueber die ganzen gespielten Tage gueltig halten.
      const v = JSON.parse(localStorage.getItem('dropbox_verbindung'))
      localStorage.setItem('dropbox_verbindung', JSON.stringify({ ...v, ablauf: Date.now() + 30 * 86_400_000 }))
      await datenbankFuerProfilSetzen(PROFIL)
      await antworten('a-1')
      await abgleich('pc')
      await abgleich('pc') // am selben Tag keine zweite Kopie
      expect(await kopienListe(PROFIL)).toHaveLength(1)
      expect(await dropboxKopien(PROFIL)).toHaveLength(1)
      for (let tag = 2; tag <= 10; tag++) {
        vi.setSystemTime(new Date(`2026-10-${String(tag).padStart(2, '0')}T09:00`))
        await abgleich('pc')
      }
      const inDropbox = await dropboxKopien(PROFIL)
      expect(inDropbox).toHaveLength(KOPIEN_TAGE)
      expect(inDropbox[0].tag).toBe('20261010')
      // Die Kopie ist eine gueltige Sicherung und wird nie als Geraetestand gelesen.
      expect(JSON.parse(await dropboxKopieLaden(inDropbox[0].pfad)).ereignisse).toHaveLength(1)
      expect(geraeteDateien()).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ein leeres Profil erzeugt keine Kopien', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await abgleich('pc')
    expect(await kopienListe(PROFIL)).toHaveLength(0)
    expect(await dropboxKopien(PROFIL)).toHaveLength(0)
  })

  it('Profil loeschen raeumt auch die lokalen Kopien', async () => {
    await geraetWaehlen('pc')
    await datenbankFuerProfilSetzen(PROFIL)
    await antworten('a-1')
    await kopieAnlegen({ profilId: PROFIL, profilName: 'Max', grund: 'Test' })
    await profilLoeschen(PROFIL)
    expect(await kopienListe(PROFIL)).toHaveLength(0)
  })
})
