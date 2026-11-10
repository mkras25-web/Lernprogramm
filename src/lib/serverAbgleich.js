// Fortschrittsabgleich ueber den Profil-Server (Zweig server-profile).
// Gleiches Prinzip wie abgleich.js (Dropbox): JEDES Geraet schreibt genau
// EINE eigene Datei und liest die der anderen; das Zusammenfuehren erledigt
// importieren(). Statt eines Dropbox-Hashes dient "geaendert:groesse" des
// Servers als Stempel.

import { exportieren, geraeteKennung, importieren, mitProfil, vermerkeWirkung } from './speicher.js'
import { MASSENLOESCHUNG, MASSENLOESCHUNG_GRUND, fingerabdruck, lesen, standSchluessel } from './abgleich.js'
import { kopieAnlegen, kopieEinmalAmTag } from './kopien.js'
import * as server from './server.js'

const gesehenSchluessel = (profilId) => `server_gesehen_${profilId}`
const uploadSchluessel = (profilId) => `server_upload_${profilId}`
const stempelVon = (d) => `${d.geaendert}:${d.groesse}`

const laufend = new Map()

export function abgleichenServer({ profilId, profilName, mitSkizzen = true }) {
  if (laufend.has(profilId)) return laufend.get(profilId)
  const lauf = (async () => {
    try {
      const bericht = await intern({ profilId, profilName, mitSkizzen })
      localStorage.setItem(standSchluessel(profilId), JSON.stringify({ zeit: Date.now(), fehler: null }))
      return bericht
    } catch (e) {
      if (e?.name === 'ProfilGewechselt') throw e
      const alt = lesen(standSchluessel(profilId), { zeit: null })
      localStorage.setItem(standSchluessel(profilId), JSON.stringify({ zeit: alt.zeit, fehler: e.message }))
      throw e
    } finally {
      laufend.delete(profilId)
    }
  })()
  laufend.set(profilId, lauf)
  return lauf
}

async function intern({ profilId, profilName, mitSkizzen }) {
  const eigen = geraeteKennung()
  const vorhanden = await server.dateienAuflisten(profilId)
  const gesehen = lesen(gesehenSchluessel(profilId), {})
  const bericht = { ereignisse: 0, skizzen: 0, marken: 0, pruefungen: 0, kursplan: 0, einstellungen: 0, geloescht: 0, dateien: 0 }

  // 1. Staende der anderen Geraete (und eine eigene, hier unbekannte Datei =
  //    Wiederherstellung) holen und vereinigen.
  // Vor dem Einlesen fremder Staende immer (einmal am Tag) lokal sichern: Dateien anderer Geraete
  // koennten bei offenen Profilen von Fremden stammen (Review 2026-11-10, H4).
  if (vorhanden.some((d) => d.geraet !== eigen && gesehen[d.geraet] !== stempelVon(d))) {
    await kopieEinmalAmTag({ profilId, profilName, grund: 'vor dem Abgleich mit dem Server' }).catch(() => null)
  }
  for (const d of vorhanden) {
    if (gesehen[d.geraet] === stempelVon(d)) continue
    const text = await server.dateiLaden(profilId, d.geraet)
    let teil
    try {
      const wirkung = await mitProfil(profilId, () => vermerkeWirkung(JSON.parse(text)?.geloescht))
      if (wirkung >= MASSENLOESCHUNG) await kopieAnlegen({ profilId, profilName, grund: MASSENLOESCHUNG_GRUND })
      teil = await mitProfil(profilId, () => importieren(text))
    } catch (e) {
      if (e?.name === 'ProfilGewechselt') throw e
      continue
    }
    for (const k of ['ereignisse', 'skizzen', 'marken', 'pruefungen', 'kursplan', 'einstellungen', 'geloescht']) bericht[k] += teil[k] ?? 0
    bericht.dateien += 1
    gesehen[d.geraet] = stempelVon(d)
  }

  // 2. Eigene Datei schreiben - nur bei Aenderung; nie ueberschreiben, solange
  //    der Serverstand der eigenen Datei nicht eingelesen wurde.
  const eigeneDatei = vorhanden.find((d) => d.geraet === eigen)
  if (eigeneDatei && gesehen[eigen] !== stempelVon(eigeneDatei)) {
    localStorage.setItem(gesehenSchluessel(profilId), JSON.stringify(gesehen))
    throw new Error('Die eigene Sicherung auf dem Server ließ sich nicht einlesen – sie wurde zum Schutz nicht überschrieben.')
  }
  const text = await mitProfil(profilId, () => exportieren({ mitSkizzen, profilId, profilName }))
  const stempel = await fingerabdruck(text)
  if (!eigeneDatei || stempel !== localStorage.getItem(uploadSchluessel(profilId))) {
    const meta = await server.dateiHochladen(profilId, eigen, text)
    gesehen[eigen] = stempelVon(meta)
    localStorage.setItem(uploadSchluessel(profilId), stempel)
  }
  localStorage.setItem(gesehenSchluessel(profilId), JSON.stringify(gesehen))
  return bericht
}
