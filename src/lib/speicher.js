// Anhaengendes Ereignisprotokoll in IndexedDB.
//
// Grundregel: Es wird nie ein Zustand gespeichert, nur Ereignisse.
// Faelligkeiten und Statistik werden daraus berechnet. Zwei Geraete
// zusammenfuehren heisst darum: Ereignisse vereinigen, Duplikate
// anhand der ID verwerfen. Konflikte gibt es nicht - mit einer
// Ausnahme: Geloeschtes. Wer auf einem Geraet loescht (Rueckgaengig,
// Skizze loeschen, alles loeschen), hinterlaesst einen Loeschvermerk
// (siehe unten), der beim Abgleich mitreist. Sonst wuerde ein Geraet mit
// dem alten Stand das Geloeschte beim naechsten Vereinigen zurueckbringen.
//
// Jedes Nutzerprofil (siehe profile.js) bekommt eine eigene, komplett
// getrennte Datenbank "lernprogramm_<profilId>". So bleiben mehrere
// Personen auf demselben Geraet sauber getrennt, und ein Profil laesst
// sich einzeln exportieren, importieren oder loeschen, ohne die
// anderen zu beruehren.

import { erzeugeId } from './id.js'

const ALTE_DB_NAME = 'lernprogramm' // vor der Einfuehrung von Profilen
const DB_VERSION = 3
const STORE = 'ereignisse'
const SKIZZEN = 'skizzen'
const MARKEN = 'marken'
const PRUEFUNGEN = 'pruefungen'

let aktuellesProfil = null
let dbPromise = null

// Sperre fuer Arbeiten, die an EIN Profil gebunden sind (Abgleich:
// importieren/exportieren). Ein Profilwechsel wartet, bis sie fertig sind,
// und eine solche Arbeit bricht ab, wenn inzwischen ein anderes Profil
// aktiv ist - sonst landeten beim Wechsel waehrend des Dropbox-Abgleichs
// die Daten von Profil A in der Datenbank von B (und von dort in Dropbox).
let sperre = Promise.resolve()

function exklusiv(arbeit) {
  const lauf = sperre.then(arbeit, arbeit)
  sperre = lauf.catch(() => {})
  return lauf
}

export class ProfilGewechselt extends Error {
  constructor() {
    super('Das Profil wurde gewechselt – der Abgleich wurde abgebrochen.')
    this.name = 'ProfilGewechselt'
  }
}

export function aktivesProfil() {
  return aktuellesProfil
}

// Fuehrt arbeit() exklusiv aus, aber nur, wenn profilId noch das aktive
// Profil ist - sonst ProfilGewechselt.
export function mitProfil(profilId, arbeit) {
  return exklusiv(() => {
    if (profilId !== aktuellesProfil) throw new ProfilGewechselt()
    return arbeit()
  })
}

// Muss aufgerufen werden, bevor irgendeine andere Funktion dieser
// Datei benutzt wird - legt fest, welches Profil (und damit welche
// Datenbank) gerade aktiv ist. Ein Wechsel schliesst die alte
// Verbindung und oeffnet die naechste erst bei Bedarf neu. Laeuft gerade
// eine profilgebundene Arbeit (mitProfil), wird vorher ihr Ende abgewartet.
export function datenbankFuerProfilSetzen(profilId) {
  return exklusiv(async () => {
    if (profilId === aktuellesProfil) return
    await datenbankSchliessen()
    aktuellesProfil = profilId
  })
}

export async function datenbankSchliessen() {
  if (!dbPromise) return
  try {
    const db = await dbPromise
    db.close()
  } catch {
    /* Verbindung war ohnehin nicht brauchbar */
  }
  dbPromise = null
}

function oeffnen() {
  if (dbPromise) return dbPromise
  if (!aktuellesProfil) {
    return Promise.reject(new Error('Kein Profil aktiv - datenbankFuerProfilSetzen() zuerst aufrufen.'))
  }
  const name = `lernprogramm_${aktuellesProfil}`
  dbPromise = new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(name, DB_VERSION)
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('nach_zeit', 'ts')
        store.createIndex('nach_item', 'itemId')
      }
      // Eigene Skizzen als Miniatur, alle Versuche, nach Zeit sortierbar.
      if (!db.objectStoreNames.contains(SKIZZEN)) {
        const store = db.createObjectStore(SKIZZEN, { keyPath: 'id' })
        store.createIndex('nach_item', 'itemId')
      }
      // Lesezeichen, Notiz, Einspruch und Sichtung je Item.
      if (!db.objectStoreNames.contains(MARKEN)) {
        db.createObjectStore(MARKEN, { keyPath: 'itemId' })
      }
      // Abgelegte Pruefungen mit Ergebnis.
      if (!db.objectStoreNames.contains(PRUEFUNGEN)) {
        db.createObjectStore(PRUEFUNGEN, { keyPath: 'id' })
      }
    }
    anfrage.onsuccess = () => {
      const db = anfrage.result
      // Verbindung kann von aussen verloren gehen (WebKit nach Hintergrund:
      // "Connection to Indexed Database server lost", neue DB-Version in
      // einem zweiten Tab). Dann beim naechsten Zugriff neu oeffnen statt
      // bis zum Neuladen jeden Schreibvorgang scheitern zu lassen.
      const verwerfen = () => {
        if (dbPromise === eigenes) dbPromise = null
      }
      db.onclose = verwerfen
      db.onversionchange = () => {
        db.close()
        verwerfen()
      }
      resolve(db)
    }
    anfrage.onerror = () => reject(anfrage.error)
  })
  const eigenes = dbPromise
  // Ein gescheitertes Oeffnen nicht dauerhaft merken.
  eigenes.catch(() => {
    if (dbPromise === eigenes) dbPromise = null
  })
  return dbPromise
}

async function transaktion(modus, name = STORE) {
  try {
    const db = await oeffnen()
    return db.transaction(name, modus).objectStore(name)
  } catch (e) {
    // Einmal neu verbinden (geschlossene Verbindung -> InvalidStateError).
    if (e?.name !== 'InvalidStateError') throw e
    dbPromise = null
    const db = await oeffnen()
    return db.transaction(name, modus).objectStore(name)
  }
}

// Wartet, bis die Transaktion wirklich geschrieben ist (nicht nur die
// einzelne Anfrage angenommen) - erst dann gilt etwas als gespeichert.
function abgeschlossen(store) {
  const tx = store.transaction
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Speichern fehlgeschlagen.'))
    tx.onabort = () => reject(tx.error ?? new Error('Speichern abgebrochen (Speicher voll?).'))
  })
}

function alleAus(name) {
  return transaktion('readonly', name).then(
    (store) =>
      new Promise((resolve, reject) => {
        const anfrage = store.getAll()
        anfrage.onsuccess = () => resolve(anfrage.result)
        anfrage.onerror = () => reject(anfrage.error)
      })
  )
}

// --- Skizzen -------------------------------------------------------

export function alleSkizzen() {
  return alleAus(SKIZZEN)
}

export async function skizzeSpeichern(itemId, bild) {
  const store = await transaktion('readwrite', SKIZZEN)
  const eintrag = { id: erzeugeId(), itemId, ts: Date.now(), bild }
  await new Promise((resolve, reject) => {
    const anfrage = store.add(eintrag)
    anfrage.onsuccess = resolve
    anfrage.onerror = () => reject(anfrage.error)
  })
  return eintrag
}

// --- Pruefungen ----------------------------------------------------

export function allePruefungen() {
  return alleAus(PRUEFUNGEN)
}

export async function pruefungSpeichern(pruefung) {
  const store = await transaktion('readwrite', PRUEFUNGEN)
  const eintrag = { id: erzeugeId(), ts: Date.now(), ...pruefung }
  await new Promise((resolve, reject) => {
    const anfrage = store.add(eintrag)
    anfrage.onsuccess = resolve
    anfrage.onerror = () => reject(anfrage.error)
  })
  return eintrag
}

// --- Marken --------------------------------------------------------

export function alleMarken() {
  return alleAus(MARKEN)
}

// Marken tragen einen Zeitstempel. Ohne ihn wuerde ein alter Import
// neuere Sichtungen und Notizen stillschweigend ueberschreiben.
export async function markeSetzen(marke) {
  const eintrag = { ...marke, ts: marke.ts ?? Date.now() }
  const store = await transaktion('readwrite', MARKEN)
  await new Promise((resolve, reject) => {
    const anfrage = store.put(eintrag)
    anfrage.onsuccess = resolve
    anfrage.onerror = () => reject(anfrage.error)
  })
  return eintrag
}

export function geraeteKennung() {
  let id = localStorage.getItem('geraet')
  if (!id) {
    id = erzeugeId().slice(0, 8)
    localStorage.setItem('geraet', id)
  }
  return id
}

export async function alleEreignisse() {
  const store = await transaktion('readonly')
  return new Promise((resolve, reject) => {
    const anfrage = store.getAll()
    anfrage.onsuccess = () => resolve(anfrage.result.sort((a, b) => a.ts - b.ts))
    anfrage.onerror = () => reject(anfrage.error)
  })
}

export async function ereignisSpeichern({ itemId, paketId, bewertung, dauerMs, hilfe, quelle, art }) {
  const ereignis = {
    id: erzeugeId(),
    ts: Date.now(),
    geraet: geraeteKennung(),
    itemId,
    paketId,
    bewertung,
    dauerMs,
    hilfe,
    quelle,
    art,
  }
  const store = await transaktion('readwrite')
  const fertig = abgeschlossen(store)
  store.add(ereignis)
  await fertig
  return ereignis
}

// Entfernt ein einzelnes Ereignis - fuer "Rueckgaengig".
// Vermerk zuerst (T8): bricht das Loeschen ab (Tab zu, Absturz), kommt
// der Eintrag beim naechsten Abgleich trotzdem nicht zurueck.
export async function ereignisLoeschen(id) {
  vermerken('ereignisse', [id])
  const store = await transaktion('readwrite')
  await new Promise((resolve, reject) => {
    const anfrage = store.delete(id)
    anfrage.onsuccess = resolve
    anfrage.onerror = () => reject(anfrage.error)
  })
}

// Loescht eine gespeicherte Skizze.
// Vermerk zuerst (T8): bricht das Loeschen ab (Tab zu, Absturz), kommt
// der Eintrag beim naechsten Abgleich trotzdem nicht zurueck.
export async function skizzeLoeschen(id) {
  vermerken('skizzen', [id])
  const store = await transaktion('readwrite', SKIZZEN)
  await new Promise((resolve, reject) => {
    const anfrage = store.delete(id)
    anfrage.onsuccess = resolve
    anfrage.onerror = () => reject(anfrage.error)
  })
}

// --- Loeschvermerke -----------------------------------------------
//
// Je Profil in localStorage: { ereignisse: {id: ts}, skizzen: {...},
// pruefungen: {...}, marken: {itemId: ts} }. Ids werden nie
// wiederverwendet, ein Vermerk ist deshalb endgueltig; nur Marken
// (Schluessel itemId) koennen spaeter neu gesetzt werden - dort zaehlt
// der Zeitstempel.

const VERMERK_ARTEN = ['ereignisse', 'skizzen', 'pruefungen', 'marken', 'kurse', 'klausuren']

function vermerkSchluessel() {
  return `geloescht_${aktuellesProfil}`
}

export function loeschvermerke() {
  const leer = Object.fromEntries(VERMERK_ARTEN.map((a) => [a, {}]))
  try {
    const roh = JSON.parse(localStorage.getItem(vermerkSchluessel()) ?? 'null')
    for (const art of VERMERK_ARTEN) {
      if (roh?.[art] && typeof roh[art] === 'object') leer[art] = { ...roh[art] }
    }
  } catch {
    /* kaputter Eintrag zaehlt wie keiner */
  }
  return leer
}

function vermerkeSchreiben(vermerke) {
  localStorage.setItem(vermerkSchluessel(), JSON.stringify(vermerke))
}

function vermerken(art, schluessel, ts = Date.now()) {
  if (schluessel.length === 0) return
  const vermerke = loeschvermerke()
  for (const k of schluessel) vermerke[art][k] = Math.max(vermerke[art][k] ?? 0, ts)
  vermerkeSchreiben(vermerke)
}

// --- Kursplan: Kurse und Klausurtermine (2026-10-12) ----------------
//
// Je Profil in localStorage: { kurse: [...], klausuren: [...] }, jeder
// Eintrag mit id und ts. Anders als die Einstellungen reist der Kursplan
// mit Sicherung und Dropbox-Abgleich - sonst zeigten die Kursmarken der
// Fragen (marke.kurse) auf dem anderen Geraet auf unbekannte Kurse. Beim
// Einlesen gewinnt je id der neuere Eintrag; Geloeschtes hinterlaesst
// einen Loeschvermerk (Arten "kurse"/"klausuren").
//   Kurs:    { id, titel, kennung?, ts }   kennung = Kurs-Kennung im Inhalt
//                                           (Itemfeld "kurse", Vorschlaege)
//   Klausur: { id, titel, datum: 'JJJJ-MM-TT', kursId?, ts }
export const KURSPLAN_ARTEN = ['kurse', 'klausuren']

function kursplanSchluessel(profilId = aktuellesProfil) {
  return `kursplan_${profilId}`
}

export function kursplanLesen(profilId = aktuellesProfil) {
  const leer = { kurse: [], klausuren: [], vorhanden: false }
  try {
    const roh = JSON.parse(localStorage.getItem(kursplanSchluessel(profilId)) ?? 'null')
    if (!roh || typeof roh !== 'object') return leer
    const plan = { vorhanden: true }
    for (const art of KURSPLAN_ARTEN) {
      plan[art] = Array.isArray(roh[art]) ? roh[art].filter((e) => e && e.id) : []
    }
    return plan
  } catch {
    return leer
  }
}

export function kursplanSchreiben(plan, profilId = aktuellesProfil) {
  const daten = Object.fromEntries(KURSPLAN_ARTEN.map((a) => [a, plan[a] ?? []]))
  localStorage.setItem(kursplanSchluessel(profilId), JSON.stringify(daten))
  return { ...daten, vorhanden: true }
}

// Anlegen oder Aendern (gleiche id) - setzt immer einen frischen ts.
export function kursplanEintragSetzen(art, eintrag, profilId = aktuellesProfil) {
  const plan = kursplanLesen(profilId)
  const neu = { ...eintrag, ts: Date.now() }
  const liste = plan[art].filter((e) => e.id !== neu.id)
  return kursplanSchreiben({ ...plan, [art]: [...liste, neu] }, profilId)
}

export function kursplanEintragLoeschen(art, id, profilId = aktuellesProfil) {
  const plan = kursplanLesen(profilId)
  // Loeschvermerk, damit der Abgleich den Eintrag nicht zurueckbringt.
  if (profilId === aktuellesProfil) vermerken(art, [id])
  return kursplanSchreiben({ ...plan, [art]: plan[art].filter((e) => e.id !== id) }, profilId)
}

// Fremden Kursplan (aus Sicherung/Abgleich) einarbeiten: je id der
// neuere, vermerkte Loeschungen bleiben geloescht. Liefert die Zahl der
// uebernommenen Eintraege.
function kursplanVereinigen(fremd, vermerke) {
  const plan = kursplanLesen()
  let anzahl = 0
  for (const art of KURSPLAN_ARTEN) {
    const nachId = new Map(plan[art].map((e) => [e.id, e]))
    for (const e of Array.isArray(fremd?.[art]) ? fremd[art] : []) {
      if (!e?.id) continue
      if ((vermerke[art]?.[e.id] ?? -1) >= (e.ts ?? 0)) continue
      const lokal = nachId.get(e.id)
      if (lokal && (lokal.ts ?? 0) >= (e.ts ?? 0)) continue
      nachId.set(e.id, e)
      anzahl += 1
    }
    // Vermerkte (auch frisch von fremd uebernommene) Loeschungen anwenden.
    for (const [id, e] of nachId) {
      if ((vermerke[art]?.[id] ?? -1) >= (e.ts ?? 0)) nachId.delete(id)
    }
    plan[art] = [...nachId.values()]
  }
  kursplanSchreiben(plan)
  return anzahl
}

// Loescht die Datenbank eines Profils vollstaendig - fuer "Profil
// loeschen". Eine noch offene Verbindung wuerde das Loeschen blockieren,
// darum vorher grundsaetzlich schliessen. Laeuft unter der Sperre und
// gibt das Profil frei, falls es das aktive ist: ein gerade laufender
// Abgleich bricht dann beim naechsten Schritt ab (ProfilGewechselt), statt
// die geloeschte Datenbank neu anzulegen und wieder zu fuellen.
export function datenbankLoeschen(profilId) {
  return exklusiv(async () => {
    if (profilId === aktuellesProfil) aktuellesProfil = null
    await datenbankSchliessen()
    await new Promise((resolve) => {
      const anfrage = indexedDB.deleteDatabase(`lernprogramm_${profilId}`)
      anfrage.onsuccess = () => resolve()
      anfrage.onerror = () => resolve()
      anfrage.onblocked = () => resolve()
    })
  })
}

// --- Uebernahme des Altbestands (vor Profilen) ----------------------
//
// Wer die App schon vor den Nutzerprofilen benutzt hat, hatte eine
// einzige Datenbank ohne Profilbezug. Diese Funktionen lesen sie ohne
// Seiteneffekt aus (kein neues, leeres "lernprogramm" wird angelegt,
// falls es sie nie gab) und spielen ihren Inhalt einmalig ins gerade
// aktive Profil ein. Die alte Datenbank bleibt danach unangetastet
// liegen - es wird nichts geloescht, nur nicht mehr benutzt.

function alleAusFremderDb(dbName, storeName) {
  return new Promise((resolve) => {
    const anfrage = indexedDB.open(dbName)
    anfrage.onupgradeneeded = () => {
      // Ohne Version angegeben legt open() eine fehlende Datenbank neu
      // an - das wollen wir hier nur zum Pruefen nicht.
      anfrage.transaction.abort()
    }
    anfrage.onsuccess = () => {
      const db = anfrage.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.close()
        resolve([])
        return
      }
      const anfrage2 = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
      anfrage2.onsuccess = () => {
        db.close()
        resolve(anfrage2.result)
      }
      anfrage2.onerror = () => {
        db.close()
        resolve([])
      }
    }
    anfrage.onerror = () => resolve([])
    anfrage.onblocked = () => resolve([])
  })
}

export async function altbestandPruefen(dbName = ALTE_DB_NAME) {
  const ereignisse = await alleAusFremderDb(dbName, STORE)
  return ereignisse.length > 0
}

// Muss erst NACH datenbankFuerProfilSetzen() fuer das Zielprofil
// aufgerufen werden - vereinigen() schreibt in die gerade aktive
// Datenbank.
export async function altbestandUebernehmen(dbName = ALTE_DB_NAME) {
  const [ereignisse, skizzen, marken, pruefungen] = await Promise.all([
    alleAusFremderDb(dbName, STORE),
    alleAusFremderDb(dbName, SKIZZEN),
    alleAusFremderDb(dbName, MARKEN),
    alleAusFremderDb(dbName, PRUEFUNGEN),
  ])
  const [nEreignisse, nSkizzen, nMarken, nPruefungen] = await Promise.all([
    vereinigen(STORE, ereignisse, 'id'),
    vereinigen(SKIZZEN, skizzen, 'id'),
    vereinigen(MARKEN, marken, 'itemId'),
    vereinigen(PRUEFUNGEN, pruefungen, 'id'),
  ])
  return { ereignisse: nEreignisse, skizzen: nSkizzen, marken: nMarken, pruefungen: nPruefungen }
}

// Bittet den Browser, die Daten dauerhaft zu behalten. Ohne das
// duerfen Browser IndexedDB bei Speicherdruck verwerfen.
export async function speicherSichern() {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

// Loescht das gesamte Ereignisprotokoll. Unwiderruflich - der Aufrufer
// muss vorher zurueckfragen.
export async function allesLoeschen() {
  // Erst vermerken, was verschwindet - sonst holt der naechste Abgleich
  // alles vom anderen Geraet zurueck und "Loeschen" bliebe wirkungslos.
  vermerken('ereignisse', (await alleAus(STORE)).map((e) => e.id))
  vermerken('skizzen', (await alleAus(SKIZZEN)).map((e) => e.id))
  vermerken('pruefungen', (await alleAus(PRUEFUNGEN)).map((e) => e.id))
  vermerken('marken', (await alleAus(MARKEN)).map((e) => e.itemId))
  for (const name of [STORE, SKIZZEN, MARKEN, PRUEFUNGEN]) {
    const store = await transaktion('readwrite', name)
    await new Promise((resolve, reject) => {
      const anfrage = store.clear()
      anfrage.onsuccess = resolve
      anfrage.onerror = () => reject(anfrage.error)
    })
  }
}

// Export und Import bilden vorerst die Synchronisation zwischen
// Geraeten ab - auch zwischen verschiedenen Betriebssystemen (z. B.
// iPhone und Android), weil es nur eine Textdatei ist. Der Import
// vereinigt, er ersetzt nicht. Profil-Id und -Name reisen mit, damit
// eine Importstelle spaeter automatisch das passende Profil anbieten
// kann statt nur "irgendein" Ereignisprotokoll zu bekommen.
export async function exportieren({ mitSkizzen = true, profilId, profilName } = {}) {
  const [ereignisse, skizzen, marken, pruefungen] = await Promise.all([
    alleEreignisse(),
    alleSkizzen(),
    alleMarken(),
    allePruefungen(),
  ])
  return JSON.stringify(
    {
      version: 3,
      exportiertAm: Date.now(),
      profil: profilId ? { id: profilId, name: profilName } : undefined,
      ereignisse,
      skizzen: mitSkizzen ? skizzen : [],
      marken,
      pruefungen,
      kursplan: Object.fromEntries(KURSPLAN_ARTEN.map((a) => [a, kursplanLesen()[a]])),
      geloescht: loeschvermerke(),
    },
    null,
    2
  )
}

async function vereinigen(name, eintraege, schluessel, geloescht = {}) {
  if (!Array.isArray(eintraege) || eintraege.length === 0) return 0
  const vorhandene = new Set((await alleAus(name)).map((e) => e[schluessel]))
  const neue = eintraege.filter(
    (e) => e && e[schluessel] && !vorhandene.has(e[schluessel]) && !(e[schluessel] in geloescht)
  )

  if (neue.length === 0) return 0
  // Eine Transaktion fuer alles; ein Fehler (Speicher voll, Abbruch) wird
  // weitergereicht statt verschluckt - sonst merkte sich der Abgleich die
  // Datei als "gelesen" und der Rest kaeme nie mehr an.
  const store = await transaktion('readwrite', name)
  const fertig = abgeschlossen(store)
  for (const e of neue) store.put(e)
  await fertig
  return neue.length
}

// Fremde Loeschvermerke uebernehmen und anwenden: vermerkte Zeilen hier
// entfernen, die Vermerke selbst behalten (damit sie weiterreisen).
async function vermerkeAnwenden(fremd) {
  const lokal = loeschvermerke()
  for (const art of VERMERK_ARTEN) {
    const quelle = fremd?.[art]
    if (!quelle || typeof quelle !== 'object') continue
    for (const [k, ts] of Object.entries(quelle)) {
      if (typeof ts === 'number' && (lokal[art][k] ?? 0) < ts) lokal[art][k] = ts
    }
  }
  vermerkeSchreiben(lokal)

  let entfernt = 0
  const streichen = async (name, vermerkte, istMarke) => {
    if (Object.keys(vermerkte).length === 0) return
    const vorhanden = await alleAus(name)
    const zuLoeschen = vorhanden.filter((z) => {
      const k = istMarke ? z.itemId : z.id
      return k in vermerkte && (!istMarke || (z.ts ?? 0) <= vermerkte[k])
    })
    if (zuLoeschen.length === 0) return
    const store = await transaktion('readwrite', name)
    await Promise.all(
      zuLoeschen.map(
        (z) =>
          new Promise((resolve) => {
            const anfrage = store.delete(istMarke ? z.itemId : z.id)
            anfrage.onsuccess = resolve
            anfrage.onerror = resolve
          })
      )
    )
    entfernt += zuLoeschen.length
  }
  await streichen(STORE, lokal.ereignisse, false)
  await streichen(SKIZZEN, lokal.skizzen, false)
  await streichen(PRUEFUNGEN, lokal.pruefungen, false)
  await streichen(MARKEN, lokal.marken, true)
  return { vermerke: lokal, entfernt }
}

function markenGleich(a, b) {
  const ohneTs = (m) => JSON.stringify(Object.keys(m).filter((k) => k !== 'ts').sort().map((k) => [k, m[k]]))
  return ohneTs(a) === ohneTs(b)
}

// Importiert Ereignisse, Skizzen und Marken. Vereinigt, ersetzt nicht.
// Marken werden bewusst ueberschrieben, weil dort der neuere Stand
// gelten soll - ein Ereignis dagegen ist unveraenderlich. Was auf einem
// der Geraete geloescht wurde (Loeschvermerk), kommt nicht zurueck.
export async function importieren(text) {
  const daten = JSON.parse(text)
  if (!Array.isArray(daten.ereignisse)) {
    throw new Error('Die Datei enthält kein Ereignisprotokoll.')
  }

  const { vermerke, entfernt } = await vermerkeAnwenden(daten.geloescht)

  const anzahlEreignisse = await vereinigen(STORE, daten.ereignisse, 'id', vermerke.ereignisse)
  const anzahlSkizzen = await vereinigen(SKIZZEN, daten.skizzen ?? [], 'id', vermerke.skizzen)
  const anzahlPruefungen = await vereinigen(PRUEFUNGEN, daten.pruefungen ?? [], 'id', vermerke.pruefungen)

  // Marken werden nur uebernommen, wenn sie neuer sind als das, was
  // lokal liegt. Sonst zerstoert eine alte Sicherung neuere Arbeit.
  const lokal = new Map((await alleMarken()).map((m) => [m.itemId, m]))
  let anzahlMarken = 0
  for (const marke of daten.marken ?? []) {
    if (!marke?.itemId) continue
    if ((vermerke.marken[marke.itemId] ?? -1) >= (marke.ts ?? 0)) continue
    const vorhanden = lokal.get(marke.itemId)
    if (vorhanden && (vorhanden.ts ?? 0) === (marke.ts ?? 0) && !markenGleich(vorhanden, marke)) {
      // Gleicher Zeitstempel, anderer Inhalt: Spur des Fehlers bis
      // 2026-10-12 (Aenderungen behielten den alten ts, z. B. eine Meldung
      // kam nie aufs andere Geraet). Beide Fassungen vereinigen - die
      // lokale gewinnt je Feld - und mit frischem ts weiterreichen.
      await markeSetzen({ ...marke, ...vorhanden, ts: Date.now() })
      anzahlMarken += 1
      continue
    }
    if (vorhanden && (vorhanden.ts ?? 0) >= (marke.ts ?? 0)) continue
    await markeSetzen(marke)
    anzahlMarken += 1
  }

  const anzahlKursplan = kursplanVereinigen(daten.kursplan, vermerke)

  return {
    ereignisse: anzahlEreignisse,
    skizzen: anzahlSkizzen,
    marken: anzahlMarken,
    pruefungen: anzahlPruefungen,
    kursplan: anzahlKursplan,
    geloescht: entfernt,
  }
}

// --- Wiederherstellen aus einer Sicherheitskopie (T1, 2026-10-13) --------
//
// Anders als importieren(): Loeschvermerke sind endgueltig und reisen per
// Dropbox auf alle Geraete - ein normaler Import einer Kopie von vor dem
// Loeschen braechte deshalb nichts zurueck. Hier gilt:
//   - was lokal noch da ist, bleibt unberuehrt (keine Dubletten)
//   - Ereignisse/Skizzen/Pruefungen ohne Vermerk kommen mit ihrer Id zurueck
//   - vermerkte bekommen eine abgeleitete, FESTE Id (<id>~w, <id>~w2, ...):
//     stellt ein zweites Geraet dieselbe Kopie wieder her, trifft es auf
//     dieselbe Id, die per Abgleich schon da ist - nichts zaehlt doppelt
//   - Marken und Kursplan-Eintraege, die lokal fehlen, kommen mit frischem
//     Zeitstempel zurueck (neuer als ihr Loeschvermerk)
export function wiederherstellungsId(id, vermerkt) {
  let kandidat = id
  for (let n = 1; vermerkt && kandidat in vermerkt; n++) {
    kandidat = n === 1 ? `${id}~w` : `${id}~w${n}`
  }
  return kandidat
}

export async function wiederherstellen(text) {
  const daten = JSON.parse(text)
  if (!Array.isArray(daten.ereignisse)) {
    throw new Error('Die Kopie enthält kein Ereignisprotokoll.')
  }
  const vermerke = loeschvermerke()

  const einfuegen = async (name, eintraege, art) => {
    if (!Array.isArray(eintraege) || eintraege.length === 0) return 0
    const vorhanden = new Set((await alleAus(name)).map((e) => e.id))
    const neue = []
    for (const e of eintraege) {
      if (!e?.id) continue
      const id = wiederherstellungsId(e.id, vermerke[art])
      if (vorhanden.has(id)) continue
      vorhanden.add(id)
      neue.push(id === e.id ? e : { ...e, id })
    }
    if (neue.length === 0) return 0
    const store = await transaktion('readwrite', name)
    const fertig = abgeschlossen(store)
    for (const e of neue) store.put(e)
    await fertig
    return neue.length
  }

  const ereignisse = await einfuegen(STORE, daten.ereignisse, 'ereignisse')
  const skizzen = await einfuegen(SKIZZEN, daten.skizzen, 'skizzen')
  const pruefungen = await einfuegen(PRUEFUNGEN, daten.pruefungen, 'pruefungen')

  const lokal = new Set((await alleMarken()).map((m) => m.itemId))
  let marken = 0
  for (const m of daten.marken ?? []) {
    if (!m?.itemId || lokal.has(m.itemId)) continue
    await markeSetzen({ ...m, ts: Date.now() })
    marken += 1
  }

  let kursplan = 0
  const plan = kursplanLesen()
  for (const art of KURSPLAN_ARTEN) {
    const da = new Set(plan[art].map((e) => e.id))
    for (const e of Array.isArray(daten.kursplan?.[art]) ? daten.kursplan[art] : []) {
      if (!e?.id || da.has(e.id)) continue
      plan[art].push({ ...e, ts: Date.now() })
      kursplan += 1
    }
  }
  if (kursplan) kursplanSchreiben(plan)

  return { ereignisse, skizzen, marken, pruefungen, kursplan }
}
