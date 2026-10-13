// Sicherheitskopien (T1, Nutzerentscheidung 2026-10-13: lokal UND in Dropbox).
//
// "Fortschritt loeschen" verteilt Loeschvermerke per Dropbox auf alle
// Geraete - danach rettet keine aeltere Dropbox-Datei mehr etwas. Deshalb
// legt die App vor jedem Loeschen und Einlesen eine Kopie an (und einmal am
// Tag vor dem Abgleich), hier lokal in einer eigenen Datenbank je Geraet.
// Zurueck kommt eine Kopie ueber wiederherstellen() (speicher.js), nicht
// ueber den normalen Import - der wuerde die Loeschvermerke beachten.
//
// Eine eigene Datenbank statt eines Stores in der Profil-Datenbank: kein
// DB_VERSION-Sprung, und "Profil loeschen" raeumt die Kopien gezielt weg.

import { exportieren, mitProfil } from './speicher.js'

const DB_NAME = 'lernprogramm_kopien'
const STORE = 'kopien'
export const KOPIEN_MAX = 10

function oeffnen() {
  return new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DB_NAME, 1)
    anfrage.onupgradeneeded = () => {
      const store = anfrage.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('profil', 'profilId')
    }
    anfrage.onsuccess = () => resolve(anfrage.result)
    anfrage.onerror = () => reject(anfrage.error)
  })
}

async function mitStore(modus, arbeit) {
  const db = await oeffnen()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, modus)
      let ergebnis
      Promise.resolve(arbeit(tx.objectStore(STORE))).then((e) => {
        ergebnis = e
      }, reject)
      tx.oncomplete = () => resolve(ergebnis)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

function anfrage(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function alleDesProfils(profilId) {
  return mitStore('readonly', (store) => anfrage(store.index('profil').getAll(profilId)))
}

// Legt eine Kopie des aktiven Profils an. Ohne Ereignisse gibt es nichts zu
// retten - dann keine Kopie (sonst verdraengten leere Kopien die guten).
export async function kopieAnlegen({ profilId, profilName, grund, jetzt = Date.now() }) {
  const text = await mitProfil(profilId, () => exportieren({ mitSkizzen: true, profilId, profilName }))
  const daten = JSON.parse(text)
  const anzahl = daten.ereignisse?.length ?? 0
  if (anzahl === 0) return null
  const kopie = { id: `${profilId}-${jetzt}`, profilId, ts: jetzt, grund, anzahl, text }
  await mitStore('readwrite', (store) => store.put(kopie))
  // Nur die neuesten KOPIEN_MAX behalten.
  const alle = (await alleDesProfils(profilId)).sort((a, b) => b.ts - a.ts)
  const weg = alle.slice(KOPIEN_MAX)
  if (weg.length) await mitStore('readwrite', (store) => weg.forEach((k) => store.delete(k.id)))
  return { id: kopie.id, ts: kopie.ts, grund, anzahl }
}

// Kopie nur, wenn heute noch keine mit diesem Grund angelegt wurde.
export async function kopieEinmalAmTag({ profilId, profilName, grund, jetzt = Date.now() }) {
  const tag = new Date(jetzt).toDateString()
  const schon = (await alleDesProfils(profilId)).some((k) => k.grund === grund && new Date(k.ts).toDateString() === tag)
  if (schon) return null
  return kopieAnlegen({ profilId, profilName, grund, jetzt })
}

// Liste ohne Inhalt, neueste zuerst.
export async function kopienListe(profilId) {
  const alle = await alleDesProfils(profilId)
  return alle
    .sort((a, b) => b.ts - a.ts)
    .map(({ id, ts, grund, anzahl }) => ({ id, ts, grund, anzahl }))
}

export async function kopieText(id) {
  const kopie = await mitStore('readonly', (store) => anfrage(store.get(id)))
  return kopie?.text ?? null
}

export async function kopienLoeschen(profilId) {
  const alle = await alleDesProfils(profilId)
  if (alle.length) await mitStore('readwrite', (store) => alle.forEach((k) => store.delete(k.id)))
}
