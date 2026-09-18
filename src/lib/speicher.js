// Anhaengendes Ereignisprotokoll in IndexedDB.
//
// Grundregel: Es wird nie ein Zustand gespeichert, nur Ereignisse.
// Faelligkeiten und Statistik werden daraus berechnet. Zwei Geraete
// zusammenfuehren heisst darum: Ereignisse vereinigen, Duplikate
// anhand der ID verwerfen. Konflikte gibt es nicht.

const DB_NAME = 'lernprogramm'
const DB_VERSION = 3
const STORE = 'ereignisse'
const SKIZZEN = 'skizzen'
const MARKEN = 'marken'
const PRUEFUNGEN = 'pruefungen'

let dbPromise = null

function oeffnen() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION)
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

export async function ereignisSpeichern({ itemId, paketId, bewertung, dauerMs }) {
  const ereignis = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    geraet: geraeteKennung(),
    itemId,
    paketId,
    bewertung,
    dauerMs,
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
// Geraeten ab. Der Import vereinigt, er ersetzt nicht.
export async function exportieren({ mitSkizzen = true } = {}) {
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
