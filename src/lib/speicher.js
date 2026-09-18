// Anhaengendes Ereignisprotokoll in IndexedDB.
//
// Grundregel: Es wird nie ein Zustand gespeichert, nur Ereignisse.
// Faelligkeiten und Statistik werden daraus berechnet. Zwei Geraete
// zusammenfuehren heisst darum: Ereignisse vereinigen, Duplikate
// anhand der ID verwerfen. Konflikte gibt es nicht.
//
// Jedes Nutzerprofil (siehe profile.js) bekommt eine eigene, komplett
// getrennte Datenbank "lernprogramm_<profilId>". So bleiben mehrere
// Personen auf demselben Geraet sauber getrennt, und ein Profil laesst
// sich einzeln exportieren, importieren oder loeschen, ohne die
// anderen zu beruehren.

const ALTE_DB_NAME = 'lernprogramm' // vor der Einfuehrung von Profilen
const DB_VERSION = 3
const STORE = 'ereignisse'
const SKIZZEN = 'skizzen'
const MARKEN = 'marken'
const PRUEFUNGEN = 'pruefungen'

let aktuellesProfil = null
let dbPromise = null

// Muss aufgerufen werden, bevor irgendeine andere Funktion dieser
// Datei benutzt wird - legt fest, welches Profil (und damit welche
// Datenbank) gerade aktiv ist. Ein Wechsel schliesst die alte
// Verbindung und oeffnet die naechste erst bei Bedarf neu.
export async function datenbankFuerProfilSetzen(profilId) {
  if (profilId === aktuellesProfil) return
  await datenbankSchliessen()
  aktuellesProfil = profilId
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
    anfrage.onsuccess = () => resolve(anfrage.result)
    anfrage.onerror = () => reject(anfrage.error)
  })
  return dbPromise
}

function transaktion(modus, name = STORE) {
  return oeffnen().then((db) => db.transaction(name, modus).objectStore(name))
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
  const eintrag = { id: crypto.randomUUID(), itemId, ts: Date.now(), bild }
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
  const eintrag = { id: crypto.randomUUID(), ts: Date.now(), ...pruefung }
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
    id = crypto.randomUUID().slice(0, 8)
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

export async function ereignisSpeichern({ itemId, paketId, bewertung, dauerMs, hilfe, quelle }) {
  const ereignis = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    geraet: geraeteKennung(),
    itemId,
    paketId,
    bewertung,
    dauerMs,
    hilfe,
    quelle,
  }
  const store = await transaktion('readwrite')
  await new Promise((resolve, reject) => {
    const anfrage = store.add(ereignis)
    anfrage.onsuccess = resolve
    anfrage.onerror = () => reject(anfrage.error)
  })
  return ereignis
}

// Entfernt ein einzelnes Ereignis - fuer "Rueckgaengig".
export async function ereignisLoeschen(id) {
  const store = await transaktion('readwrite')
  await new Promise((resolve, reject) => {
    const anfrage = store.delete(id)
    anfrage.onsuccess = resolve
    anfrage.onerror = () => reject(anfrage.error)
  })
}

// Loescht eine gespeicherte Skizze.
export async function skizzeLoeschen(id) {
  const store = await transaktion('readwrite', SKIZZEN)
  await new Promise((resolve, reject) => {
    const anfrage = store.delete(id)
    anfrage.onsuccess = resolve
    anfrage.onerror = () => reject(anfrage.error)
  })
}

// Loescht die Datenbank eines Profils vollstaendig - fuer "Profil
// loeschen". Eine noch offene Verbindung wuerde das Loeschen blockieren,
// darum vorher grundsaetzlich schliessen.
export async function datenbankLoeschen(profilId) {
  await datenbankSchliessen()
  await new Promise((resolve) => {
    const anfrage = indexedDB.deleteDatabase(`lernprogramm_${profilId}`)
    anfrage.onsuccess = () => resolve()
    anfrage.onerror = () => resolve()
    anfrage.onblocked = () => resolve()
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
    },
    null,
    2
  )
}

async function vereinigen(name, eintraege, schluessel) {
  if (!Array.isArray(eintraege) || eintraege.length === 0) return 0
  const vorhandene = new Set((await alleAus(name)).map((e) => e[schluessel]))
  const neue = eintraege.filter((e) => e && e[schluessel] && !vorhandene.has(e[schluessel]))

  const store = await transaktion('readwrite', name)
  await Promise.all(
    neue.map(
      (e) =>
        new Promise((resolve) => {
          const anfrage = store.put(e)
          anfrage.onsuccess = resolve
          anfrage.onerror = resolve
        })
    )
  )
  return neue.length
}

// Importiert Ereignisse, Skizzen und Marken. Vereinigt, ersetzt nicht.
// Marken werden bewusst ueberschrieben, weil dort der neuere Stand
// gelten soll - ein Ereignis dagegen ist unveraenderlich.
export async function importieren(text) {
  const daten = JSON.parse(text)
  if (!Array.isArray(daten.ereignisse)) {
    throw new Error('Die Datei enthält kein Ereignisprotokoll.')
  }

  const anzahlEreignisse = await vereinigen(STORE, daten.ereignisse, 'id')
  const anzahlSkizzen = await vereinigen(SKIZZEN, daten.skizzen ?? [], 'id')
  const anzahlPruefungen = await vereinigen(PRUEFUNGEN, daten.pruefungen ?? [], 'id')

  // Marken werden nur uebernommen, wenn sie neuer sind als das, was
  // lokal liegt. Sonst zerstoert eine alte Sicherung neuere Arbeit.
  const lokal = new Map((await alleMarken()).map((m) => [m.itemId, m]))
  let anzahlMarken = 0
  for (const marke of daten.marken ?? []) {
    if (!marke?.itemId) continue
    const vorhanden = lokal.get(marke.itemId)
    if (vorhanden && (vorhanden.ts ?? 0) >= (marke.ts ?? 0)) continue
    await markeSetzen(marke)
    anzahlMarken += 1
  }

  return {
    ereignisse: anzahlEreignisse,
    skizzen: anzahlSkizzen,
    marken: anzahlMarken,
    pruefungen: anzahlPruefungen,
  }
}
