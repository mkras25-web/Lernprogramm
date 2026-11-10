import { useEffect, useState } from 'react'
import { AVATARE, anmelden, angemeldetBleiben, avatarUrl, profilAnlegen, profileLaden } from '../lib/server.js'

// Anmeldebildschirm mit Server-Profilen (Zweig server-profile, hinter dem
// Schalter VITE_SERVER_PROFILE). Karten zeigen Bild, Name und Level; ein
// Schloss kennzeichnet Profile mit Passwort. Wer auf diesem Geraet
// angemeldet bleiben wollte, kommt ohne Eingabe hinein. Die Felder tragen
// username/current-password/new-password, damit der Browser Passwoerter
// speichern und einsetzen kann.
export default function ServerProfilWahl({ onFertig, onLokal, hinweis }) {
  const [liste, setListe] = useState(null)
  const [fehler, setFehler] = useState(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [gewaehlt, setGewaehlt] = useState(null)
  const [neu, setNeu] = useState(false)

  useEffect(() => {
    let weg = false
    profileLaden()
      .then((p) => !weg && setListe(p))
      .catch((e) => !weg && setFehler(e.message))
    return () => {
      weg = true
    }
  }, [])

  async function waehlen(p) {
    setFehler(null)
    setBeschaeftigt(true)
    try {
      if (await angemeldetBleiben(p.id)) return onFertig(p)
      if (!p.passwort) {
        await anmelden({ id: p.id })
        return onFertig(p)
      }
      setGewaehlt(p)
    } catch (e) {
      setFehler(e.message)
    } finally {
      setBeschaeftigt(false)
    }
  }

  if (gewaehlt) {
    return (
      <Huelle>
        <PasswortFormular
          profil={gewaehlt}
          onAbbrechen={() => setGewaehlt(null)}
          onFertig={() => onFertig(gewaehlt)}
        />
      </Huelle>
    )
  }

  if (neu) {
    return (
      <Huelle>
        <NeuFormular
          vergeben={(liste ?? []).map((p) => p.name.toLocaleLowerCase('de-DE'))}
          onAbbrechen={() => setNeu(false)}
          onFertig={onFertig}
        />
      </Huelle>
    )
  }

  return (
    <Huelle>
      <h1 className="ueberschrift">Wer lernt gerade?</h1>
      {hinweis && <p className="nebentext">{hinweis}</p>}
      {fehler && <p className="serverFehler" role="alert">{fehler}</p>}
      {liste === null && !fehler && <p className="nebentext">Profile werden geladen …</p>}
      {liste && liste.length === 0 && <p className="nebentext">Noch kein Profil vorhanden – leg das erste an.</p>}
      {liste && liste.length > 0 && (
        <ul className="profilListe">
          {liste.map((p) => (
            <li key={p.id}>
              <button className="profilKnopf serverKarte" disabled={beschaeftigt} onClick={() => waehlen(p)}>
                <img className="serverAvatar" src={avatarUrl(p.avatar)} alt="" width="48" height="48" />
                <span className="profilTexte">
                  <span className="profilName">{p.name}</span>
                  <span className="profilZuletzt">Stufe {p.stufe}</span>
                </span>
                {p.passwort && <span className="serverSchloss" title="Mit Passwort geschützt" aria-label="Mit Passwort geschützt">🔒︎</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="wahl serverAktionen">
        <button className="knopf" onClick={() => setNeu(true)} disabled={liste === null}>Neues Profil</button>
        {onLokal && (
          <button className="textknopf" onClick={onLokal}>Lokale Profile dieses Geräts</button>
        )}
      </div>
    </Huelle>
  )
}

function Huelle({ children }) {
  return (
    <div className="huelle einspaltig">
      <div role="main" className="schirm profilSchirm">{children}</div>
    </div>
  )
}

function PasswortFormular({ profil, onAbbrechen, onFertig }) {
  const [passwort, setPasswort] = useState('')
  const [bleiben, setBleiben] = useState(true)
  const [fehler, setFehler] = useState(null)
  const [laeuft, setLaeuft] = useState(false)

  async function senden(e) {
    e.preventDefault()
    setFehler(null)
    setLaeuft(true)
    try {
      await anmelden({ id: profil.id, passwort, dauerhaft: bleiben })
      onFertig()
    } catch (err) {
      setFehler(err.message)
      setLaeuft(false)
    }
  }

  return (
    <form onSubmit={senden} className="serverFormular">
      <div className="serverKopf">
        <img className="serverAvatar" src={avatarUrl(profil.avatar)} alt="" width="64" height="64" />
        <div>
          <h1 className="ueberschrift">{profil.name}</h1>
          <p className="nebentext">Stufe {profil.stufe}</p>
        </div>
      </div>
      {/* Benutzername fuer den Passwortmanager des Browsers */}
      <input type="text" name="username" autoComplete="username" value={profil.name} readOnly hidden />
      <label className="feldname" htmlFor="sp-pw">Passwort</label>
      <input
        id="sp-pw"
        className="suchfeld"
        type="password"
        name="password"
        autoComplete="current-password"
        value={passwort}
        onChange={(e) => setPasswort(e.target.value)}
        autoFocus
      />
      <label className="serverHaken">
        <input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
        Auf diesem Gerät angemeldet bleiben
      </label>
      {fehler && <p className="serverFehler" role="alert">{fehler}</p>}
      <div className="wahl">
        <button className="knopf" type="submit" disabled={laeuft || !passwort}>Anmelden</button>
        <button className="textknopf" type="button" onClick={onAbbrechen}>Zurück</button>
      </div>
    </form>
  )
}

function NeuFormular({ vergeben, onAbbrechen, onFertig }) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARE[0])
  const [mitPasswort, setMitPasswort] = useState(false)
  const [passwort, setPasswort] = useState('')
  const [bleiben, setBleiben] = useState(true)
  const [fehler, setFehler] = useState(null)
  const [laeuft, setLaeuft] = useState(false)

  const nameBelegt = vergeben.includes(name.trim().toLocaleLowerCase('de-DE'))
  const gueltig = name.trim() && !nameBelegt && (!mitPasswort || passwort.length >= 6)

  async function senden(e) {
    e.preventDefault()
    setFehler(null)
    setLaeuft(true)
    try {
      const id = await profilAnlegen({
        name: name.trim(), avatar, passwort: mitPasswort ? passwort : null, dauerhaft: bleiben,
      })
      onFertig({ id, name: name.trim(), avatar, stufe: 1, passwort: mitPasswort })
    } catch (err) {
      setFehler(err.message)
      setLaeuft(false)
    }
  }

  return (
    <form onSubmit={senden} className="serverFormular">
      <h1 className="ueberschrift">Neues Profil</h1>
      <label className="feldname" htmlFor="sp-name">Name</label>
      <input
        id="sp-name"
        className="suchfeld"
        name="username"
        autoComplete="username"
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      {nameBelegt && <p className="serverFehler">Diesen Namen gibt es schon.</p>}

      <p className="feldname">Profilbild</p>
      <div className="avatarRaster" role="radiogroup" aria-label="Profilbild">
        {AVATARE.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={avatar === a}
            className={avatar === a ? 'avatarWahl aktiv' : 'avatarWahl'}
            onClick={() => setAvatar(a)}
          >
            <img src={avatarUrl(a)} alt="" width="48" height="48" />
          </button>
        ))}
      </div>

      <label className="serverHaken">
        <input type="checkbox" checked={mitPasswort} onChange={(e) => setMitPasswort(e.target.checked)} />
        Mit Passwort schützen (sonst kann jeder dieses Profil öffnen)
      </label>
      {mitPasswort && (
        <>
          <label className="feldname" htmlFor="sp-npw">Passwort (mindestens 6 Zeichen)</label>
          <input
            id="sp-npw"
            className="suchfeld"
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
          />
        </>
      )}
      <label className="serverHaken">
        <input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
        Auf diesem Gerät angemeldet bleiben
      </label>
      {fehler && <p className="serverFehler" role="alert">{fehler}</p>}
      <div className="wahl">
        <button className="knopf" type="submit" disabled={laeuft || !gueltig}>Profil anlegen</button>
        <button className="textknopf" type="button" onClick={onAbbrechen}>Abbrechen</button>
      </div>
    </form>
  )
}
