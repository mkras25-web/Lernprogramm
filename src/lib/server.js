// Anbindung an den Profil-Server (public/api/index.php, Zweig server-profile).
//
// Schalter: nur wenn die App mit VITE_SERVER_PROFILE=1 gebaut/gestartet wird,
// ist die Server-Anmeldung aktiv. Ohne den Schalter bleibt alles wie bisher
// (lokale Profile, Dropbox) - so kann der Zweig nie versehentlich live gehen.
//
// Anmeldung: der Server gibt einen Token aus. "Angemeldet bleiben" legt ihn je
// Profil in localStorage ab, sonst nur in sessionStorage (bis das Fenster
// zu ist). Passwoerter werden nie gespeichert.

import { geraeteKennung } from './speicher.js'

export const serverAktiv = () => import.meta.env?.VITE_SERVER_PROFILE === '1'

export const PASSWORT_MIN = 8
const BASIS = './api/index.php'
const TOKEN_PRAEFIX = 'lp_token_'

export const AVATARE = [
  '01-haus', '02-kran', '03-bauhelm', '04-zeichendreieck', '05-zollstock',
  '06-hammer', '07-mauer', '08-hochhaus', '09-bruecke', '10-dom',
  '11-leuchtturm', '12-burg', '13-muehle', '14-pyramide', '15-tipi',
  '16-fachwerk', '17-bleistift', '18-wasserwaage', '19-baumhaus', '20-grundriss',
]
export const avatarUrl = (name) => `./avatare/${AVATARE.includes(name) ? name : AVATARE[0]}.svg`

// --- Token ------------------------------------------------------------------

export function tokenLesen(profilId) {
  try {
    return localStorage.getItem(TOKEN_PRAEFIX + profilId) || sessionStorage.getItem(TOKEN_PRAEFIX + profilId) || null
  } catch {
    return null
  }
}

export function tokenMerken(profilId, token, dauerhaft) {
  try {
    tokenVergessen(profilId)
    ;(dauerhaft ? localStorage : sessionStorage).setItem(TOKEN_PRAEFIX + profilId, token)
  } catch {
    /* Speicher gesperrt - dann gilt die Anmeldung nur bis zum Neuladen */
  }
}

export function tokenVergessen(profilId) {
  try {
    localStorage.removeItem(TOKEN_PRAEFIX + profilId)
    sessionStorage.removeItem(TOKEN_PRAEFIX + profilId)
  } catch {
    /* egal */
  }
}

// --- Aufruf -------------------------------------------------------------------

export class ServerFehler extends Error {
  constructor(status, text) {
    super(text)
    this.status = status
  }
}

async function aufruf(aktion, { koerper, token, abfrage } = {}) {
  const url = `${BASIS}?${new URLSearchParams({ a: aktion, ...abfrage })}`
  const optionen = { headers: {}, cache: 'no-store' }
  if (token) optionen.headers['X-Token'] = token
  if (koerper !== undefined) {
    optionen.method = 'POST'
    optionen.headers['Content-Type'] = 'application/json'
    optionen.headers['X-Lernprogramm'] = '1'
    optionen.body = JSON.stringify(koerper)
  }
  let antwort
  try {
    antwort = await fetch(url, optionen)
  } catch {
    throw new ServerFehler(0, 'Der Server ist nicht erreichbar. Internetverbindung prüfen.')
  }
  let daten = null
  try {
    daten = await antwort.json()
  } catch {
    /* keine JSON-Antwort, z. B. PHP nicht vorhanden */
  }
  if (!antwort.ok || !daten) {
    throw new ServerFehler(antwort.status, daten?.fehler ?? `Server-Antwort unbrauchbar (${antwort.status}).`)
  }
  return daten
}

// --- Oeffentlich: Anmeldebildschirm ---------------------------------------------

export async function profileLaden() {
  return (await aufruf('profile')).profile
}

// Legt ein Profil an (id optional: ein vorhandenes lokales Profil behaelt so
// seine Identitaet) und merkt sich den Token.
export async function profilAnlegen({ id, name, avatar, passwort = null, dauerhaft = true }) {
  const antwort = await aufruf('anlegen', { koerper: { id, name, avatar, passwort, geraet: geraeteKennung() } })
  tokenMerken(antwort.id, antwort.token, dauerhaft)
  return antwort.id
}

// Meldet an. Ohne Passwort-Profil genuegt die Id; bei vorhandenem Token wird
// gar nicht erst gefragt (siehe angemeldetBleiben).
export async function anmelden({ id, passwort = null, dauerhaft = true }) {
  const antwort = await aufruf('anmelden', { koerper: { id, passwort, geraet: geraeteKennung() } })
  tokenMerken(id, antwort.token, dauerhaft)
}

// Prueft, ob der gemerkte Token noch gilt (ohne Passwort).
export async function angemeldetBleiben(id) {
  const token = tokenLesen(id)
  if (!token) return false
  try {
    await aufruf('dateien', { token })
    return true
  } catch (e) {
    if (e.status === 401) tokenVergessen(id)
    return false
  }
}

export async function abmelden(id) {
  const token = tokenLesen(id)
  tokenVergessen(id)
  if (token) await aufruf('abmelden', { koerper: {}, token }).catch(() => null)
}

// --- Angemeldet --------------------------------------------------------------------

const mitToken = (id) => {
  const token = tokenLesen(id)
  if (!token) throw new ServerFehler(401, 'Nicht angemeldet.')
  return token
}

// Name, Bild und Level an den Server melden (Level erscheint im Anmeldebildschirm).
export const metaSenden = (id, meta) => aufruf('meta', { koerper: meta, token: mitToken(id) })

// alt: bisheriges Passwort (falls vorhanden), neu: neues Passwort oder null zum Entfernen.
export const passwortAendern = (id, { alt = null, neu }) =>
  aufruf('passwort', { koerper: { alt, neu }, token: mitToken(id) })

export const profilLoeschenServer = async (id, passwort = null) => {
  await aufruf('profilLoeschen', { koerper: { passwort }, token: mitToken(id) })
  tokenVergessen(id)
}

// Abgleich-Transport (gleiche Form wie dropbox.js: je Geraet eine Datei).
export const dateienAuflisten = async (id) => (await aufruf('dateien', { token: mitToken(id) })).dateien
export const dateiLaden = async (id, geraet) => (await aufruf('datei', { token: mitToken(id), abfrage: { geraet } })).text
export const dateiHochladen = (id, geraet, text) => aufruf('hochladen', { koerper: { geraet, text }, token: mitToken(id) })
export const dateiLoeschenServer = (id, geraet) => aufruf('dateiLoeschen', { koerper: { geraet }, token: mitToken(id) })

// Tageskopien auf dem Server (14 Tage je Geraet), siehe api/index.php.
export const kopienAuflisten = async (id) => (await aufruf('kopien', { token: mitToken(id) })).kopien
export const kopieLaden = async (id, geraet, tag) => (await aufruf('kopie', { token: mitToken(id), abfrage: { geraet, tag } })).text
