// Fortschrittsabgleich ueber Dropbox (Anbindung: dropbox.js).
//
// Prinzip: JEDES Geraet schreibt genau EINE eigene Datei
//     p-<profilId>-<geraetId>.json
// in den App-Ordner (dieselbe Sicherungsstruktur wie "Sichern", siehe
// speicher.js exportieren()) und liest die Dateien der anderen Geraete.
// Weil jede Datei nur von einem Geraet beschrieben wird, koennen zwei
// Geraete einander nie ueberschreiben - Konflikte sind ausgeschlossen. Das
// Zusammenfuehren erledigt importieren() (vereinigt Ereignisse nach Id,
// beachtet Loeschvermerke, neuere Marken gewinnen).
//
// Die Profil-Id ist die geraeteuebergreifende Identitaet (siehe profile.js).

import { exportieren, geraeteKennung, importieren } from './speicher.js'
import * as dropbox from './dropbox.js'

const DATEINAME = /^p-(.+)-([0-9a-f]{8})\.json$/

export function dateiname(profilId, geraet = geraeteKennung()) {
  return `p-${profilId}-${geraet}.json`
}

export function profilAusDateiname(name) {
  const treffer = DATEINAME.exec(name)
  return treffer ? { profilId: treffer[1], geraet: treffer[2] } : null
}

function lesen(schluessel, vorgabe) {
  try {
    return JSON.parse(localStorage.getItem(schluessel) ?? 'null') ?? vorgabe
  } catch {
    return vorgabe
  }
}

const gesehenSchluessel = (profilId) => `dropbox_gesehen_${profilId}` // { dateiname: content_hash }
const uploadSchluessel = (profilId) => `dropbox_upload_${profilId}` // Fingerabdruck des zuletzt Hochgeladenen
const standSchluessel = (profilId) => `dropbox_stand_${profilId}` // { zeit, fehler }

export function abgleichStand(profilId) {
  return lesen(standSchluessel(profilId), { zeit: null, fehler: null })
}

// Sicherungstext ohne den Zeitstempel "exportiertAm" - der aendert sich bei
// jedem Export und wuerde ein Hochladen ohne echte Aenderung ausloesen.
async function fingerabdruck(text) {
  const daten = JSON.parse(text)
  delete daten.exportiertAm
  const bytes = new TextEncoder().encode(JSON.stringify(daten))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('')
}

let laufend = null

// Holt neue Staende der anderen Geraete, vereinigt sie und schreibt bei
// Aenderung die eigene Datei. Nie zwei Laeufe gleichzeitig. Gibt zurueck, was
// uebernommen wurde (ereignisse/skizzen/marken/pruefungen/geloescht) und wie
// viele fremde Dateien gelesen wurden.
export function abgleichen({ profilId, profilName, mitSkizzen = false }) {
  if (laufend) return laufend
  laufend = (async () => {
    try {
      const bericht = await abgleichenIntern({ profilId, profilName, mitSkizzen })
      localStorage.setItem(standSchluessel(profilId), JSON.stringify({ zeit: Date.now(), fehler: null }))
      return bericht
    } catch (e) {
      localStorage.setItem(
        standSchluessel(profilId),
        JSON.stringify({ zeit: abgleichStand(profilId).zeit, fehler: e.message })
      )
      throw e
    } finally {
      laufend = null
    }
  })()
  return laufend
}

async function abgleichenIntern({ profilId, profilName, mitSkizzen }) {
  const eigen = dateiname(profilId)
  const vorhanden = await dropbox.dateienAuflisten()
  const gesehen = lesen(gesehenSchluessel(profilId), {})
  const bericht = { ereignisse: 0, skizzen: 0, marken: 0, pruefungen: 0, geloescht: 0, dateien: 0 }

  // 1. Andere Staende holen - und die eigene Datei, falls sie in Dropbox
  //    liegt, lokal aber unbekannt ist (frisch installiert, Browserdaten
  //    geraeumt): dann ist sie die Wiederherstellung.
  for (const eintrag of vorhanden) {
    const treffer = profilAusDateiname(eintrag.name)
    if (!treffer || treffer.profilId !== profilId) continue
    if (gesehen[eintrag.name] === eintrag.content_hash) continue
    const text = await dropbox.herunterladen(eintrag.name)
    let teil
    try {
      teil = await importieren(text)
    } catch {
      continue // beschaedigte oder fremde Datei - die anderen trotzdem lesen
    }
    for (const k of ['ereignisse', 'skizzen', 'marken', 'pruefungen', 'geloescht']) bericht[k] += teil[k] ?? 0
    bericht.dateien += 1
    gesehen[eintrag.name] = eintrag.content_hash
  }

  // 2. Eigene Datei schreiben - nur, wenn sich seit dem letzten Mal etwas
  //    geaendert hat (oder sie in Dropbox fehlt).
  const text = await exportieren({ mitSkizzen, profilId, profilName })
  const stempel = await fingerabdruck(text)
  const inDropbox = vorhanden.some((e) => e.name === eigen)
  if (!inDropbox || stempel !== localStorage.getItem(uploadSchluessel(profilId))) {
    const meta = await dropbox.hochladen(eigen, text)
    gesehen[eigen] = meta.content_hash
    localStorage.setItem(uploadSchluessel(profilId), stempel)
  }

  localStorage.setItem(gesehenSchluessel(profilId), JSON.stringify(gesehen))
  return bericht
}

// Profile, die in Dropbox liegen: [{ id, name, geraete, ereignisse }].
// Fuer "Profil aus Dropbox laden" auf einem neuen Geraet. Der Name steht
// nur im Inhalt der Dateien, deshalb wird je Profil die neueste gelesen.
export async function profileInDropbox() {
  const dateien = await dropbox.dateienAuflisten()
  const jeProfil = new Map()
  for (const d of dateien) {
    const treffer = profilAusDateiname(d.name)
    if (!treffer) continue
    if (!jeProfil.has(treffer.profilId)) jeProfil.set(treffer.profilId, [])
    jeProfil.get(treffer.profilId).push(d)
  }
  const ergebnis = []
  for (const [id, liste] of jeProfil) {
    const neueste = liste.sort((a, b) => String(b.server_modified).localeCompare(String(a.server_modified)))[0]
    let daten = null
    try {
      daten = JSON.parse(await dropbox.herunterladen(neueste.name))
    } catch {
      /* Datei nicht lesbar - Profil trotzdem anbieten, Name unbekannt */
    }
    ergebnis.push({
      id,
      name: daten?.profil?.name?.trim() || 'Profil aus Dropbox',
      geraete: liste.length,
      ereignisse: Array.isArray(daten?.ereignisse) ? daten.ereignisse.length : 0,
    })
  }
  return ergebnis
}

export function verbindungZuruecksetzen(profilId) {
  for (const s of [gesehenSchluessel(profilId), uploadSchluessel(profilId), standSchluessel(profilId)]) {
    localStorage.removeItem(s)
  }
}
