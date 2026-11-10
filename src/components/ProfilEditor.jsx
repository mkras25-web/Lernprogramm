import PasswortBalken from './PasswortBalken.jsx'
import { useEffect, useState } from 'react'
import Schleier from './Schleier.jsx'
import {
  AVATARE, PASSWORT_MIN, adminLoeschen, adminMeta, anmelden, angemeldetBleiben, avatarUrl, metaSenden, passwortAendern,
  profilLoeschenServer, profileLaden,
} from '../lib/server.js'

// Profil auf dem Server bearbeiten: Name, Bild, Passwort, (optional) Loeschen.
// Auf dem Anmeldebildschirm ist man noch nicht angemeldet: Profile mit Passwort
// verlangen es zuerst, damit niemand fremde Profile aendern oder loeschen kann.
// Loeschen verlangt zusaetzlich das Passwort (falls gesetzt) und das Tippen
// von LÖSCHEN - der Server prueft das Passwort noch einmal selbst.
export default function ProfilEditor({ profil, adminId = null, loeschenErlaubt = false, onGeaendert, onGeloescht, onSchliessen }) {
  // adminId: Profil-Id des Admins, der auf diesem Geraet angemeldet ist (sonst null).
  const fremdAdmin = Boolean(adminId) && adminId !== profil.id
  const selbstAdmin = Boolean(adminId) && adminId === profil.id
  const [phase, setPhase] = useState(fremdAdmin ? 'offen' : 'pruefe') // pruefe | passwort | offen
  const [aktuell, setAktuell] = useState(profil)
  const [pw, setPw] = useState('')
  const [fehler, setFehler] = useState(null)
  const [info, setInfo] = useState(null)
  const [laeuft, setLaeuft] = useState(false)
  const [name, setName] = useState(profil.name)
  const [alt, setAlt] = useState('')
  const [neu, setNeu] = useState('')
  const [loeschen, setLoeschen] = useState(false)
  const [loeschPw, setLoeschPw] = useState('')
  const [bestaetigung, setBestaetigung] = useState('')

  useEffect(() => {
    if (fremdAdmin) return undefined
    let weg = false
    ;(async () => {
      try {
        if (await angemeldetBleiben(profil.id)) return !weg && setPhase('offen')
        if (!profil.passwort) {
          await anmelden({ id: profil.id, dauerhaft: false })
          return !weg && setPhase('offen')
        }
        if (!weg) setPhase('passwort')
      } catch (e) {
        if (!weg) { setFehler(e.message); setPhase('passwort') }
      }
    })()
    return () => { weg = true }
  }, [profil.id, fremdAdmin])

  // Name/Bild: als Admin fuer fremde Profile ueber adminMeta, sonst ueber das eigene Konto.
  const meta = (patch) => (fremdAdmin ? adminMeta(adminId, profil.id, patch) : metaSenden(profil.id, patch))
  // Offenes Profil ohne Passwort: nur der Admin darf Name, Bild aendern und loeschen.
  const offenesProfil = !aktuell.passwort && !fremdAdmin && !selbstAdmin
  const loeschenSichtbar = loeschenErlaubt && !selbstAdmin && (fremdAdmin || Boolean(aktuell.passwort))

  async function ausfuehren(arbeit, erfolg) {
    setLaeuft(true)
    setFehler(null)
    setInfo(null)
    try {
      await arbeit()
      if (erfolg) setInfo(erfolg)
      const frisch = (await profileLaden()).find((p) => p.id === profil.id)
      if (frisch) {
        setAktuell(frisch)
        onGeaendert?.(frisch)
      }
      return true
    } catch (e) {
      setFehler(e.message)
      return false
    } finally {
      setLaeuft(false)
    }
  }

  async function einloggen(e) {
    e.preventDefault()
    setLaeuft(true)
    setFehler(null)
    try {
      await anmelden({ id: profil.id, passwort: pw, dauerhaft: false })
      setPhase('offen')
    } catch (err) {
      setFehler(err.message)
    } finally {
      setLaeuft(false)
    }
  }

  const kopf = (
    <div className="serverKopf">
      <img className="serverAvatar" src={avatarUrl(aktuell.avatar)} alt="" width="56" height="56" />
      <div>
        <h2 className="ueberschrift">{aktuell.name}</h2>
        <p className="nebentext">Profil bearbeiten</p>
      </div>
    </div>
  )

  return (
    <Schleier onSchliessen={onSchliessen}>
      <article className="grosseKarte profilEditor" onClick={(e) => e.stopPropagation()}>
        {kopf}

        {phase === 'pruefe' && <p className="nebentext">Einen Moment …</p>}

        {phase === 'passwort' && (
          <form onSubmit={einloggen} className="serverFormular">
            <p className="nebentext">Zum Bearbeiten bitte das Passwort eingeben.</p>
            <input type="text" name="username" autoComplete="username" value={profil.name} readOnly hidden />
            <label className="feldname" htmlFor="pe-pw">Passwort</label>
            <input id="pe-pw" className="suchfeld" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            {fehler && <p className="serverFehler" role="alert">{fehler}</p>}
            <div className="wahl">
              <button className="knopf schmal" type="submit" disabled={laeuft || !pw}>Weiter</button>
              <button className="textknopf" type="button" onClick={onSchliessen}>Abbrechen</button>
            </div>
          </form>
        )}

        {phase === 'offen' && (
          <div className="serverFormular">
            {offenesProfil && (
              <p className="nebentext">
                Dieses Profil hat kein Passwort – dann kann jeder es öffnen. Name, Bild und Löschen kann nur der Admin ändern.
                Lege ein Passwort fest, dann kannst du alles selbst bearbeiten.
              </p>
            )}
            {!offenesProfil && (<>
            <form
              className="serverFormular"
              onSubmit={(e) => {
                e.preventDefault()
                ausfuehren(() => meta({ name: name.trim() }), 'Name gespeichert.')
              }}
            >
              <label className="feldname" htmlFor="pe-name">Name</label>
              <div className="profilNeu">
                <input id="pe-name" className="suchfeld" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                <button className="knopf schmal" type="submit" disabled={laeuft || !name.trim() || name.trim() === aktuell.name}>Speichern</button>
              </div>
            </form>

            <p className="feldname">Profilbild</p>
            <div className="avatarRaster" role="radiogroup" aria-label="Profilbild">
              {AVATARE.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={aktuell.avatar === a}
                  disabled={laeuft}
                  className={aktuell.avatar === a ? 'avatarWahl aktiv' : 'avatarWahl'}
                  onClick={() => ausfuehren(() => meta({ avatar: a }), 'Profilbild geändert.')}
                >
                  <img src={avatarUrl(a)} alt="" width="48" height="48" />
                </button>
              ))}
            </div>

            </>)}

            {fremdAdmin && <p className="nebentext">Du bearbeitest dieses Profil als Admin.</p>}
            {!fremdAdmin && <form
              className="serverFormular"
              onSubmit={async (e) => {
                e.preventDefault()
                if (await ausfuehren(() => passwortAendern(profil.id, { alt: alt || null, neu }), 'Passwort gespeichert.')) {
                  setAlt('')
                  setNeu('')
                }
              }}
            >
              <p className="feldname">Passwort {aktuell.passwort ? '(gesetzt)' : '(keines – dann kann jeder dieses Profil öffnen, ändern und löschen)'}</p>
              <input type="text" name="username" autoComplete="username" value={aktuell.name} readOnly hidden />
              {aktuell.passwort && (
                <input className="suchfeld" type="password" autoComplete="current-password" placeholder="Aktuelles Passwort" aria-label="Aktuelles Passwort" value={alt} onChange={(e) => setAlt(e.target.value)} />
              )}
              <input className="suchfeld" type="password" autoComplete="new-password" placeholder={`Neues Passwort (mindestens ${PASSWORT_MIN} Zeichen)`} aria-label="Neues Passwort" value={neu} onChange={(e) => setNeu(e.target.value)} />
              <PasswortBalken passwort={neu} />
              <div className="wahl">
                <button className="knopf schmal" type="submit" disabled={laeuft || neu.length < PASSWORT_MIN || (aktuell.passwort && !alt)}>
                  {aktuell.passwort ? 'Passwort ändern' : 'Passwort festlegen'}
                </button>
                {aktuell.passwort && (
                  <button
                    className="knopf schmal"
                    type="button"
                    disabled={laeuft || !alt}
                    onClick={async () => {
                      if (await ausfuehren(() => passwortAendern(profil.id, { alt, neu: null }), 'Passwort entfernt.')) setAlt('')
                    }}
                  >
                    Passwort entfernen
                  </button>
                )}
              </div>
            </form>}

            {info && <p className="nebentext" role="status">{info}</p>}
            {fehler && <p className="serverFehler" role="alert">{fehler}</p>}

            {loeschenSichtbar && !loeschen && (
              <button className="textknopf gefahrText" onClick={() => setLoeschen(true)}>Profil löschen …</button>
            )}
            {loeschenSichtbar && loeschen && (
              <div className="serverFormular loeschBox">
                <p className="nebentext">
                  Das Profil verschwindet sofort – auf dem Server und auf diesem Gerät: alle Antworten, Skizzen, Notizen und
                  Prüfungen. Der Server hält die Daten noch 14 Tage zur Sicherheit zurück und löscht sie danach endgültig.
                </p>
                <input className="suchfeld" type="password" autoComplete="current-password" placeholder={fremdAdmin ? 'Dein Admin-Passwort' : 'Passwort'} aria-label="Passwort zum Löschen" value={loeschPw} onChange={(e) => setLoeschPw(e.target.value)} />
                <p className="nebentext">Tippe <strong>LÖSCHEN</strong>, um es zu bestätigen.</p>
                <input className="suchfeld" placeholder="LÖSCHEN" aria-label="Bestätigung" value={bestaetigung} onChange={(e) => setBestaetigung(e.target.value)} />
                <div className="wahl">
                  <button
                    className="knopf schmal gefahr"
                    disabled={laeuft || bestaetigung.trim().toUpperCase() !== 'LÖSCHEN' || !loeschPw}
                    onClick={async () => {
                      setLaeuft(true)
                      setFehler(null)
                      try {
                        if (fremdAdmin) await adminLoeschen(adminId, profil.id, loeschPw)
                        else await profilLoeschenServer(profil.id, loeschPw)
                        await onGeloescht?.()
                      } catch (e) {
                        setFehler(e.message)
                        setLaeuft(false)
                      }
                    }}
                  >
                    Endgültig löschen
                  </button>
                  <button className="knopf schmal" onClick={() => { setLoeschen(false); setLoeschPw(''); setBestaetigung('') }}>Abbrechen</button>
                </div>
              </div>
            )}

            <div className="wahl">
              <button className="knopf schmal" onClick={onSchliessen}>Fertig</button>
            </div>
          </div>
        )}
      </article>
    </Schleier>
  )
}
