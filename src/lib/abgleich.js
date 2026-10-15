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

import { exportieren, geraeteKennung, importieren, mitProfil } from './speicher.js'
import * as dropbox from './dropbox.js'
import { kopieEinmalAmTag } from './kopien.js'

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

// Laufender Abgleich je Profil - ein Aufruf fuer Profil B darf nie das
// Ergebnis eines noch laufenden Abgleichs von Profil A bekommen.
const laufend = new Map()

// Holt neue Staende der anderen Geraete, vereinigt sie und schreibt bei
// Aenderung die eigene Datei. Nie zwei Laeufe gleichzeitig je Profil. Gibt
// zurueck, was uebernommen wurde (ereignisse/skizzen/marken/pruefungen/
// geloescht) und wie viele fremde Dateien gelesen wurden. Wird waehrenddessen
// das Profil gewechselt, bricht der Lauf ab (ProfilGewechselt), ohne in die
// Datenbank des neuen Profils oder in Dropbox zu schreiben.
export function abgleichen({ profilId, profilName, mitSkizzen = false }) {
  if (laufend.has(profilId)) return laufend.get(profilId)
  const lauf = (async () => {
    try {
      const bericht = await abgleichenIntern({ profilId, profilName, mitSkizzen })
      localStorage.setItem(standSchluessel(profilId), JSON.stringify({ zeit: Date.now(), fehler: null }))
      return bericht
    } catch (e) {
      // Abbruch durch Profilwechsel ist kein Fehler des Abgleichs - der
      // naechste Lauf holt alles nach.
      if (e?.name === 'ProfilGewechselt') throw e
      localStorage.setItem(
        standSchluessel(profilId),
        JSON.stringify({ zeit: abgleichStand(profilId).zeit, fehler: e.message })
      )
      throw e
    } finally {
      laufend.delete(profilId)
    }
  })()
  laufend.set(profilId, lauf)
  return lauf
}

// --- Sicherheitskopien in Dropbox (T1, 2026-10-13) -------------------------
//
// Einmal am Tag je Geraet, VOR dem Einlesen der anderen Geraete: kommt dabei
// ein "Fortschritt loeschen" herein, liegt der Stand davor noch in Dropbox.
// Unterordner sicherungen/<profilId>/<geraet>-<JJJJMMTT>.json - die normale
// Liste (dateienAuflisten) sieht nur Dateien im App-Ordner selbst, die Kopien
// werden also nie als Geraetestand eingelesen. Jedes Geraet raeumt nur seine
// eigenen Kopien (ein Schreiber je Datei, wie beim Abgleich).
export const KOPIEN_ORDNER = 'sicherungen'
export const KOPIEN_TAGE = 7
const kopieSchluessel = (profilId) => `dropbox_kopie_${profilId}` // JJJJMMTT der letzten Kopie

function tagesStempel(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

async function tagesKopie({ profilId, profilName, mitSkizzen }) {
  try {
    // Lokal: einmal am Tag vor dem Abgleich (kopien.js).
    await kopieEinmalAmTag({ profilId, profilName, grund: 'vor dem Abgleich' })
  } catch (e) {
    if (e?.name === 'ProfilGewechselt') throw e
  }
  const tag = tagesStempel(Date.now())
  if (localStorage.getItem(kopieSchluessel(profilId)) === tag) return
  try {
    const text = await mitProfil(profilId, () => exportieren({ mitSkizzen, profilId, profilName }))
    if (!JSON.parse(text).ereignisse?.length) return // leere Kopien verdraengten die guten
    const ordner = `${KOPIEN_ORDNER}/${profilId}`
    const geraet = geraeteKennung()
    await dropbox.hochladen(`${ordner}/${geraet}-${tag}.json`, text)
    localStorage.setItem(kopieSchluessel(profilId), tag)
    const eigene = (await dropbox.ordnerAuflisten(ordner))
      .map((d) => d.name)
      .filter((n) => n.startsWith(`${geraet}-`))
      .sort()
      .reverse()
    for (const name of eigene.slice(KOPIEN_TAGE)) await dropbox.loeschen(`${ordner}/${name}`)
  } catch (e) {
    if (e?.name === 'ProfilGewechselt') throw e
    // Kopie ist ein Zusatz - sie darf den Abgleich nie verhindern.
  }
}

// Kopien aller Geraete dieses Profils in Dropbox, neueste zuerst.
export async function dropboxKopien(profilId) {
  const ordner = `${KOPIEN_ORDNER}/${profilId}`
  const dateien = await dropbox.ordnerAuflisten(ordner)
  return dateien
    .map((d) => {
      const treffer = /^([0-9a-f]{8})-(\d{8})\.json$/.exec(d.name)
      return treffer ? { name: d.name, pfad: `${ordner}/${d.name}`, geraet: treffer[1], tag: treffer[2] } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.tag.localeCompare(a.tag) || a.geraet.localeCompare(b.geraet))
}

export function dropboxKopieLaden(pfad) {
  return dropbox.herunterladen(pfad)
}

async function abgleichenIntern({ profilId, profilName, mitSkizzen }) {
  await tagesKopie({ profilId, profilName, mitSkizzen })
  const eigen = dateiname(profilId)
  const vorhanden = await dropbox.dateienAuflisten()
  const gesehen = lesen(gesehenSchluessel(profilId), {})
  const bericht = { ereignisse: 0, skizzen: 0, marken: 0, pruefungen: 0, kursplan: 0, einstellungen: 0, geloescht: 0, dateien: 0 }

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
      teil = await mitProfil(profilId, () => importieren(text))
    } catch (e) {
      if (e?.name === 'ProfilGewechselt') throw e
      continue // beschaedigte oder fremde Datei - die anderen trotzdem lesen
    }
    for (const k of ['ereignisse', 'skizzen', 'marken', 'pruefungen', 'kursplan', 'einstellungen', 'geloescht']) bericht[k] += teil[k] ?? 0
    bericht.dateien += 1
    gesehen[eintrag.name] = eintrag.content_hash
  }

  // 2. Eigene Datei schreiben - nur, wenn sich seit dem letzten Mal etwas
  //    geaendert hat (oder sie in Dropbox fehlt).
  const eigeneDatei = vorhanden.find((e) => e.name === eigen)
  // Sicherheitsnetz: die eigene Datei nie ueberschreiben, solange ihr
  // aktueller Stand nicht erfolgreich eingelesen wurde (unlesbar, Import
  // fehlgeschlagen) - sonst koennte ein leerer oder unvollstaendiger
  // lokaler Stand die einzige Sicherung ersetzen.
  if (eigeneDatei && gesehen[eigen] !== eigeneDatei.content_hash) {
    localStorage.setItem(gesehenSchluessel(profilId), JSON.stringify(gesehen))
    throw new Error('Die eigene Sicherung in Dropbox ließ sich nicht einlesen – sie wurde zum Schutz nicht überschrieben.')
  }
  const text = await mitProfil(profilId, () => exportieren({ mitSkizzen, profilId, profilName }))
  const stempel = await fingerabdruck(text)
  const inDropbox = Boolean(eigeneDatei)
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
  for (const s of [gesehenSchluessel(profilId), uploadSchluessel(profilId), standSchluessel(profilId), kopieSchluessel(profilId)]) {
    localStorage.removeItem(s)
  }
}
