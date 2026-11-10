import { useEffect, useState } from 'react'
import { AVATARE, anmelden, angemeldetBleiben, avatarUrl, profilAnlegen, profileLaden } from '../lib/server.js'

// Anmeldebildschirm mit Server-Profilen (Zweig server-profile, hinter dem
// Schalter VITE_SERVER_PROFILE). Karten zeigen Bild, Name und Level; ein
// Schloss kennzeichnet Profile mit Passwort. Wer auf diesem Geraet
// angemeldet bleiben wollte, kommt ohne Eingabe hinein. Die Felder tragen
// username/current-password/new-password, damit der Browser Passwoerter
// speichern und einsetzen kann.
export default function ServerProfilWahl({ onFertig, onLokal, hinweis, lokaleProfile = [] }) {
  const [liste, setListe] = useState(null)
  const [fehler, setFehler] = useState(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [gewaehlt, setGewaehlt] = useState(null)
  const [neu, setNeu] = useState(false)
  const [umzug, setUmzug] = useState(null) // lokales Profil, das auf den Server soll

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

  // Lokale Profile, die der Server noch nicht kennt (gleiche Id = schon uebertragen).
  const nurLokal = liste ? lokaleProfile.filter((l) => !liste.some((p) => p.id === l.id)) : []

  if (neu || umzug) {
    return (
      <Huelle>
        <NeuFormular
          vorgabe={umzug}
          vergeben={(liste ?? []).map((p) => p.name.toLocaleLowerCase('de-DE'))}
          onAbbrechen={() => { setNeu(false); setUmzug(null) }}
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
      {nurLokal.length > 0 && (
        <div className="serverUmzug">
          <h2 className="abschnitt">Auf diesem Gerät, noch nicht auf dem Server</h2>
          <p className="nebentext">
            Übertrage ein Profil mit seinem gesamten Fortschritt auf den Server – dann ist es auf allen deinen Geräten da.
            Lokal bleibt alles unverändert.
          </p>
          <ul className="profilListe">
            {nurLokal.map((l) => (
              <li key={l.id}>
                <button className="profilKnopf serverKarte" onClick={() => setUmzug(l)}>
                  <span className="profilTexte">
                    <span className="profilName">{l.name}</span>
                    <span className="profilZuletzt">Auf den Server übertragen …</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
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
      <div role="main" className="schirm profilSchirm">
        {children}
        <p className="zeileHinweis datenschutz">
          Dein Lernfortschritt wird auf dem Server dieser Seite gespeichert, Passwörter nur verschlüsselt (als Hash).
        </p>
      </div>
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

function NeuFormular({ vorgabe = null, vergeben, onAbbrechen, onFertig }) {
  const [name, setName] = useState(vorgabe?.name ?? '')
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
        id: vorgabe?.id,
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
      <h1 className="ueberschrift">{vorgabe ? `„${vorgabe.name}“ auf den Server übertragen` : 'Neues Profil'}</h1>
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
        <button className="knopf" type="submit" disabled={laeuft || !gueltig}>{vorgabe ? 'Übertragen' : 'Profil anlegen'}</button>
        <button className="textknopf" type="button" onClick={onAbbrechen}>Abbrechen</button>
      </div>
    </form>
  )
}
