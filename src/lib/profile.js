// Nutzerprofile: mehrere Personen koennen sich auf demselben Geraet
// getrennten Fortschritt merken und zwischen sich wechseln.
//
// Das Profilverzeichnis selbst liegt in localStorage, nicht in
// IndexedDB - es muss lesbar sein, bevor ueberhaupt klar ist, welche
// profilgebundene Datenbank (siehe speicher.js) geoeffnet werden soll.
// Jedes Profil bekommt dort eine eigene, vollstaendig getrennte
// Datenbank "lernprogramm_<profilId>" sowie eigene, mit der Profil-Id
// versehene localStorage-Schluessel fuer Einstellungen und die
// angefangene Sitzung.
//
// Fuer spaeteres geraeteuebergreifendes Arbeiten (z. B. iPhone und
// Android) bekommt jedes Profil eine stabile Id, die mit exportiert
// wird (siehe speicher.js exportieren()) - eine kuenftige Cloud-
// Synchronisation koennte darauf aufsetzen, ohne dieses Datenmodell
// nochmal aendern zu muessen. Bis dahin ist Export/Import je Profil
// der Weg, Fortschritt auf ein zweites Geraet zu bringen.

import {
  datenbankFuerProfilSetzen,
  datenbankLoeschen,
  altbestandPruefen,
  altbestandUebernehmen,
} from './speicher.js'
import { ALTER_SCHLUESSEL as ALTE_EINSTELLUNGEN_SCHLUESSEL } from './einstellungen.js'
import { ALTER_SITZUNG_SCHLUESSEL } from '../hooks/useLernsitzung.js'

const VERZEICHNIS_SCHLUESSEL = 'lernprogramm_profile'
const AKTIV_SCHLUESSEL = 'lernprogramm_aktivesProfil'

export function profilListe() {
  try {
    const roh = localStorage.getItem(VERZEICHNIS_SCHLUESSEL)
    const liste = roh ? JSON.parse(roh) : []
    return Array.isArray(liste) ? liste : []
  } catch {
    return []
  }
}

function schreiben(liste) {
  localStorage.setItem(VERZEICHNIS_SCHLUESSEL, JSON.stringify(liste))
}

export function aktivesProfilId() {
  return localStorage.getItem(AKTIV_SCHLUESSEL)
}

export function aktivesProfilSetzen(id) {
  localStorage.setItem(AKTIV_SCHLUESSEL, id)
}

export function profilErstellen(name) {
  const profil = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Ohne Namen',
    erstelltAm: Date.now(),
    letzterZugriff: Date.now(),
  }
  const liste = profilListe()
  liste.push(profil)
  schreiben(liste)
  return profil
}

export function profilUmbenennen(id, name) {
  const liste = profilListe()
  const eintrag = liste.find((p) => p.id === id)
  if (!eintrag || !name.trim()) return
  eintrag.name = name.trim()
  schreiben(liste)
}

export function profilZuletztAktiv(id) {
  const liste = profilListe()
  const eintrag = liste.find((p) => p.id === id)
  if (!eintrag) return
  eintrag.letzterZugriff = Date.now()
  schreiben(liste)
}

// Loescht ein Profil unwiderruflich: Datenbank, Einstellungen und eine
// eventuell angefangene Sitzung. Der Aufrufer muss vorher zurueckfragen.
export async function profilLoeschen(id) {
  const liste = profilListe().filter((p) => p.id !== id)
  schreiben(liste)
  localStorage.removeItem(`einstellungen_${id}`)
  localStorage.removeItem(`offeneSitzung_${id}`)
  if (aktivesProfilId() === id) localStorage.removeItem(AKTIV_SCHLUESSEL)
  await datenbankLoeschen(id)
}

// Wird genau einmal gebraucht: beim ersten Start nach Einfuehrung der
// Nutzerprofile, wenn noch gar kein Profil existiert. Prueft, ob unter
// den alten, profillosen Speicherorten noch etwas liegt, und legt in
// diesem Fall ein erstes Profil an, das den Altbestand unveraendert
// uebernimmt - niemand soll durch dieses Update Fortschritt verlieren.
// Ohne Altbestand entsteht kein Profil; die Auswahl zeigt dann nur
// "Neues Profil anlegen".
// Waehlt das neue Profil bewusst NICHT gleich aktiv - die Person soll
// die Uebernahme auf dem Auswahlbildschirm sehen und bestaetigen
// (durch den einen Klick, der es auch sonst braucht), statt direkt
// und ohne jede Rueckmeldung mitten in der App zu landen.
export async function altbestandAlsProfilUebernehmen(name = 'Ich') {
  const alteEinstellungen = localStorage.getItem(ALTE_EINSTELLUNGEN_SCHLUESSEL)
  const alteSitzung = localStorage.getItem(ALTER_SITZUNG_SCHLUESSEL)
  const hatAltbestand = await altbestandPruefen()

  if (!hatAltbestand && !alteEinstellungen) return null

  const profil = profilErstellen(name)
  await datenbankFuerProfilSetzen(profil.id)

  if (alteEinstellungen) localStorage.setItem(`einstellungen_${profil.id}`, alteEinstellungen)
  if (alteSitzung) localStorage.setItem(`offeneSitzung_${profil.id}`, alteSitzung)
  if (hatAltbestand) await altbestandUebernehmen()

  return profil
}
