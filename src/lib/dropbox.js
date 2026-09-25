// Dropbox-Anbindung fuer den Fortschrittsabgleich (siehe abgleich.js).
//
// Laeuft komplett im Browser, ohne eigenen Server: OAuth 2 mit PKCE (kein
// Geheimnis in der App) gegen die Dropbox-HTTP-Schnittstelle. Die App ist in
// Dropbox als "App-Ordner"-App registriert - sie sieht und schreibt nur den
// Ordner Dropbox/Apps/<Name der App> und nichts sonst.
//
// Der App-Schluessel (Client-Id) ist kein Geheimnis. Er steht in
// public/sync-config.json (wird mit der Seite ausgeliefert) oder wird auf dem
// Geraet in den Einstellungen eingetragen (localStorage).

const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize'
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
const API_URL = 'https://api.dropboxapi.com/2'
const CONTENT_URL = 'https://content.dropboxapi.com/2'

const VERBINDUNG = 'dropbox_verbindung' // { refreshToken, accessToken, ablauf, kontoId }
const VORGANG = 'dropbox_vorgang' // { verifier, state } waehrend der Anmeldung
const SCHLUESSEL = 'dropbox_appKey' // von Hand eingetragener App-Schluessel
const MELDUNG = 'dropbox_meldung' // einmalige Rueckmeldung nach der Anmeldung

function lesen(schluessel) {
  try {
    return JSON.parse(localStorage.getItem(schluessel) ?? 'null')
  } catch {
    return null
  }
}

function schreiben(schluessel, wert) {
  if (wert == null) localStorage.removeItem(schluessel)
  else localStorage.setItem(schluessel, JSON.stringify(wert))
}

// PKCE und OAuth brauchen crypto.subtle - das gibt es nur in sicheren
// Kontexten (https oder localhost), nicht ueber die WLAN-Adresse des PCs.
export function dropboxMoeglich() {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle) && typeof fetch !== 'undefined'
}

export function istVerbunden() {
  return Boolean(lesen(VERBINDUNG)?.refreshToken)
}

// --- App-Schluessel -------------------------------------------------

export function appSchluesselSetzen(schluessel) {
  const sauber = (schluessel ?? '').trim()
  if (sauber) localStorage.setItem(SCHLUESSEL, sauber)
  else localStorage.removeItem(SCHLUESSEL)
}

export async function appSchluessel() {
  const lokal = localStorage.getItem(SCHLUESSEL)
  if (lokal) return lokal
  try {
    const antwort = await fetch(`${import.meta.env.BASE_URL}sync-config.json`, { cache: 'no-cache' })
    if (!antwort.ok) return ''
    const daten = await antwort.json()
    return typeof daten.dropboxAppKey === 'string' ? daten.dropboxAppKey.trim() : ''
  } catch {
    return ''
  }
}

// --- Anmeldung (OAuth 2 + PKCE) ------------------------------------------

// Genau diese Adresse muss in der Dropbox-Konsole als "Redirect URI"
// eingetragen sein.
export function rueckkehrAdresse() {
  return location.origin + location.pathname.replace(/index\.html$/, '')
}

function zufallText(laenge) {
  const zeichen = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(laenge))
  return [...bytes].map((b) => zeichen[b % zeichen.length]).join('')
}

function base64Url(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function verbindungStarten(appKey) {
  if (!dropboxMoeglich()) throw new Error('Dropbox braucht eine https-Adresse (oder localhost).')
  if (!appKey) throw new Error('Kein Dropbox-App-Schlüssel eingetragen.')
  const verifier = zufallText(64)
  const state = zufallText(24)
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  schreiben(VORGANG, { verifier, state, appKey })
  const parameter = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    redirect_uri: rueckkehrAdresse(),
    state,
  })
  location.assign(`${AUTH_URL}?${parameter}`)
}

async function tokenAnfrage(formular) {
  const antwort = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formular),
  })
  const daten = await antwort.json().catch(() => ({}))
  if (!antwort.ok) {
    const fehler = new Error(daten.error_description || daten.error || `Dropbox: Fehler ${antwort.status}`)
    fehler.code = daten.error
    throw fehler
  }
  return daten
}

// Beim Start aufrufen: kommt der Browser von der Dropbox-Anmeldeseite zurueck
// (?code=...&state=...), wird der Code gegen Zugangsdaten getauscht und die
// Adresse aufgeraeumt. Das Ergebnis liegt einmalig in dropbox_meldung
// (siehe meldungAbholen), weil hier noch keine Oberflaeche steht.
export async function rueckkehrVerarbeiten() {
  const parameter = new URLSearchParams(location.search)
  const code = parameter.get('code')
  const fehler = parameter.get('error')
  const state = parameter.get('state')
  if (!code && !fehler) return null
  if (!state) return null

  const vorgang = lesen(VORGANG)
  if (!vorgang || vorgang.state !== state) return null // gehoert nicht zu uns
  schreiben(VORGANG, null)
  history.replaceState(null, '', rueckkehrAdresse())

  if (fehler) {
    const text = `Dropbox-Anmeldung abgebrochen (${parameter.get('error_description') || fehler}).`
    schreiben(MELDUNG, { art: 'fehler', text })
    return { art: 'fehler', text }
  }
  try {
    const daten = await tokenAnfrage({
      grant_type: 'authorization_code',
      code,
      client_id: vorgang.appKey,
      redirect_uri: rueckkehrAdresse(),
      code_verifier: vorgang.verifier,
    })
    schreiben(VERBINDUNG, {
      appKey: vorgang.appKey,
      refreshToken: daten.refresh_token,
      accessToken: daten.access_token,
      ablauf: Date.now() + (daten.expires_in ?? 14400) * 1000,
      kontoId: daten.account_id,
    })
    const ergebnis = { art: 'erfolg', text: 'Mit Dropbox verbunden.' }
    schreiben(MELDUNG, ergebnis)
    return ergebnis
  } catch (e) {
    const ergebnis = { art: 'fehler', text: `Dropbox-Anmeldung fehlgeschlagen: ${e.message}` }
    schreiben(MELDUNG, ergebnis)
    return ergebnis
  }
}

export function meldungAbholen() {
  const meldung = lesen(MELDUNG)
  schreiben(MELDUNG, null)
  return meldung
}

export async function trennen() {
  try {
    const token = await zugriffstoken()
    await fetch(`${API_URL}/auth/token/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  } catch {
    /* auch ohne Netz oder mit abgelaufenem Zugang: lokal trennen */
  }
  schreiben(VERBINDUNG, null)
}

// Liefert ein gueltiges Zugangstoken (kurzlebig, ca. 4 Stunden) und holt bei
// Bedarf mit dem Refresh-Token ein neues.
export async function zugriffstoken() {
  const verbindung = lesen(VERBINDUNG)
  if (!verbindung?.refreshToken) throw new Error('Nicht mit Dropbox verbunden.')
  if (verbindung.accessToken && verbindung.ablauf > Date.now() + 60_000) return verbindung.accessToken
  try {
    const daten = await tokenAnfrage({
      grant_type: 'refresh_token',
      refresh_token: verbindung.refreshToken,
      client_id: verbindung.appKey,
    })
    schreiben(VERBINDUNG, {
      ...verbindung,
      accessToken: daten.access_token,
      ablauf: Date.now() + (daten.expires_in ?? 14400) * 1000,
    })
    return daten.access_token
  } catch (e) {
    if (e.code === 'invalid_grant') {
      schreiben(VERBINDUNG, null)
      throw new Error('Die Dropbox-Verbindung ist abgelaufen oder wurde widerrufen. Bitte neu verbinden.')
    }
    throw e
  }
}

// --- Dateien im App-Ordner -----------------------------------------------

async function pruefen(antwort) {
  if (antwort.ok) return antwort
  let text = ''
  try {
    const daten = await antwort.clone().json()
    text = daten.error_summary || daten.error_description || ''
  } catch {
    text = await antwort.text().catch(() => '')
  }
  throw new Error(`Dropbox: ${text || `Fehler ${antwort.status}`}`)
}

async function rpc(pfad, body) {
  const token = await zugriffstoken()
  const antwort = await pruefen(
    await fetch(`${API_URL}${pfad}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
  return antwort.json()
}

// Alle Dateien im App-Ordner: [{ name, content_hash, server_modified }]
export async function dateienAuflisten() {
  let seite = await rpc('/files/list_folder', { path: '', limit: 500 })
  const dateien = [...seite.entries]
  while (seite.has_more) {
    seite = await rpc('/files/list_folder/continue', { cursor: seite.cursor })
    dateien.push(...seite.entries)
  }
  return dateien.filter((e) => e['.tag'] === 'file')
}

export async function herunterladen(name) {
  const token = await zugriffstoken()
  const antwort = await pruefen(
    await fetch(`${CONTENT_URL}/files/download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: `/${name}` }) },
    })
  )
  return antwort.text()
}

// Dateinamen sind reines ASCII (siehe abgleich.js) - der Kopf
// Dropbox-API-Arg darf nur ASCII enthalten.
export async function hochladen(name, text) {
  const token = await zugriffstoken()
  const antwort = await pruefen(
    await fetch(`${CONTENT_URL}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: `/${name}`, mode: 'overwrite', mute: true }),
      },
      body: text,
    })
  )
  return antwort.json()
}
