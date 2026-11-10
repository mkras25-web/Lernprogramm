import PasswortBalken from '../components/PasswortBalken.jsx'
import { useEffect, useState } from 'react'
import ProfilEditor from '../components/ProfilEditor.jsx'
import DropboxBereich from '../components/DropboxBereich.jsx'
import { istVerbunden, meldungAbholen } from '../lib/dropbox.js'
import { AVATARE, PASSWORT_MIN, ich, tokenLesen, anmelden, angemeldetBleiben, avatarUrl, profilAnlegen, profileLaden } from '../lib/server.js'

// Anmeldebildschirm mit Server-Profilen (Zweig server-profile, hinter dem
// Schalter VITE_SERVER_PROFILE). Karten zeigen Bild, Name und Level; ein
// Schloss kennzeichnet Profile mit Passwort. Wer auf diesem Geraet
// angemeldet bleiben wollte, kommt ohne Eingabe hinein. Die Felder tragen
// username/current-password/new-password, damit der Browser Passwoerter
// speichern und einsetzen kann.
export default function ServerProfilWahl({ onFertig, onLokal, onUmbenannt, onGeloescht, onAusDropboxLaden, onOhneProfil, hinweis, lokaleProfile = [] }) {
  const [liste, setListe] = useState(null)
  const [fehler, setFehler] = useState(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [gewaehlt, setGewaehlt] = useState(null)
  const [neu, setNeu] = useState(false)
  const [bearbeiten, setBearbeiten] = useState(null) // Profil im Editor
  // Dropbox-Import: aufgeklappt, wenn Dropbox schon verbunden ist oder gerade von dort zurueckkommt.
  const [dropboxOffen, setDropboxOffen] = useState(() => istVerbunden())
  const [meldung, setMeldung] = useState(null)
  const [adminId, setAdminId] = useState(null) // Admin, der auf diesem Geraet angemeldet ist
  const [umzug, setUmzug] = useState(null) // lokales Profil, das auf den Server soll

  // Rueckmeldung der Dropbox-Anmeldung (siehe main.jsx).
  useEffect(() => {
    const m = meldungAbholen()
    if (m) { setMeldung(m); setDropboxOffen(true) }
  }, [])
  useEffect(() => {
    if (!meldung) return undefined
    const t = setTimeout(() => setMeldung(null), 7000)
    return () => clearTimeout(t)
  }, [meldung])

  async function ausDropbox(eintrag) {
    try {
      const { profil, bericht, neuAngelegt } = await onAusDropboxLaden(eintrag)
      setMeldung({
        art: 'erfolg',
        text: `Profil „${profil.name}“ ${neuAngelegt ? 'aus Dropbox geladen' : 'abgeglichen'}: ${bericht.ereignisse} Antworten – nur auf diesem Gerät, nicht auf dem Server. ` +
          'Zum Übertragen: unten bei „Auf diesem Gerät, noch nicht auf dem Server“.',
      })
    } catch (e) {
      setMeldung({ art: 'fehler', text: `Laden aus Dropbox nicht möglich: ${e.message}` })
    }
  }

  useEffect(() => {
    let weg = false
    profileLaden()
      .then(async (p) => {
        if (weg) return
        setListe(p)
        // Ist auf diesem Geraet ein Admin angemeldet? (nur Profile mit gemerktem Token fragen)
        for (const x of p) {
          if (!tokenLesen(x.id)) continue
          try {
            if ((await ich(x.id)).admin) { if (!weg) setAdminId(x.id); break }
          } catch { /* Token ungueltig - ignorieren */ }
        }
      })
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
      <h1 className="ueberschrift profilTitel">Wer lernt gerade?</h1>
      {hinweis && <p className="nebentext profilTitel">{hinweis}</p>}
      {fehler && <p className="serverFehler" role="alert">{fehler}</p>}
      {liste === null && !fehler && <p className="nebentext profilTitel">Profile werden geladen …</p>}
      {liste && (
        <ul className="profilRaster">
          {liste.map((p) => (
            <li key={p.id} className="profilKarte">
              <button className="profilKarteKnopf" disabled={beschaeftigt} onClick={() => waehlen(p)}>
                <span className="profilKarteBild">
                  <img src={avatarUrl(p.avatar)} alt="" width="88" height="88" />
                  {p.passwort && <span className="serverSchloss" title="Mit Passwort geschützt" aria-label="Mit Passwort geschützt">🔒︎</span>}
                </span>
                <span className="profilName">{p.name}</span>
                <span className="profilZuletzt">Stufe {p.stufe}</span>
              </button>
              <button className="textknopf profilBearbeiten" onClick={() => setBearbeiten(p)}>Bearbeiten</button>
            </li>
          ))}
          <li className="profilKarte neu">
            <button className="profilKarteKnopf" onClick={() => setNeu(true)}>
              <span className="profilKarteBild plus" aria-hidden="true">+</span>
              <span className="profilName">Neues Profil</span>
            </button>
          </li>
        </ul>
      )}
      {liste && liste.length === 0 && <p className="nebentext profilTitel">Noch kein Profil vorhanden – leg das erste an.</p>}

      {nurLokal.length > 0 && (
        <div className="serverUmzug">
          <h2 className="abschnitt profilTitel">Auf diesem Gerät, noch nicht auf dem Server</h2>
          <p className="nebentext profilTitel">
            Übertrage ein Profil mit seinem gesamten Fortschritt auf den Server – dann ist es auf allen deinen Geräten da.
            Lokal bleibt alles unverändert.
          </p>
          <ul className="profilRaster">
            {nurLokal.map((l) => (
              <li key={l.id} className="profilKarte">
                <button className="profilKarteKnopf" onClick={() => setUmzug(l)}>
                  <span className="profilKarteBild plus" aria-hidden="true">{(l.name || '?').slice(0, 1).toUpperCase()}</span>
                  <span className="profilName">{l.name}</span>
                  <span className="profilZuletzt">Auf den Server übertragen</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {onOhneProfil && (
        <div className="ohneProfil">
          <button className="knopf schmal" onClick={onOhneProfil}>Ohne Profil lernen</button>
          <p className="nebentext">Nur auf diesem Gerät – der Fortschritt wird nicht auf dem Server gespeichert. Später lässt er sich als Profil übertragen.</p>
        </div>
      )}
      {onAusDropboxLaden && (
        <div className="dropboxImport">
          <button className="textknopf" aria-expanded={dropboxOffen} onClick={() => setDropboxOffen(!dropboxOffen)}>
            {dropboxOffen ? 'Dropbox-Import schließen' : 'Aus Dropbox importieren …'}
          </button>
          {dropboxOffen && (
            <>
              <p className="nebentext">
                Hinweis: Aus Dropbox importierte Daten werden <strong>nicht auf dem Server gespeichert</strong>, sondern nur auf diesem Gerät.
                Du kannst ein importiertes Profil danach über „Auf diesem Gerät, noch nicht auf dem Server“ übertragen.
              </p>
              <DropboxBereich profilWahl onMeldung={setMeldung} onProfilLaden={ausDropbox} />
            </>
          )}
        </div>
      )}
      {meldung && (
        <div className={meldung.art === 'fehler' ? 'meldung fehler' : 'meldung'} role="status" aria-live="polite">
          <p>{meldung.text}</p>
          <button onClick={() => setMeldung(null)} aria-label="Meldung schließen">✕︎</button>
        </div>
      )}
      {onLokal && (
        <div className="serverAktionen">
          <button className="textknopf" onClick={onLokal}>Lokale Profile dieses Geräts</button>
        </div>
      )}
      {bearbeiten && (
        <ProfilEditor
          profil={bearbeiten}
          adminId={adminId}
          loeschenErlaubt
          onGeaendert={(p) => {
            setListe((l) => (l ?? []).map((x) => (x.id === p.id ? p : x)))
            if (p.name !== bearbeiten.name) onUmbenannt?.(p.id, p.name)
            setBearbeiten(p)
          }}
          onGeloescht={async () => {
            await onGeloescht?.(bearbeiten.id)
            setListe((l) => (l ?? []).filter((x) => x.id !== bearbeiten.id))
            setBearbeiten(null)
          }}
          onSchliessen={() => setBearbeiten(null)}
        />
      )}
    </Huelle>
  )
}

function Huelle({ children }) {
  return (
    <div className="profilBuehne">
      <div role="main" className="profilInhalt">
        {children}
        <p className="zeileHinweis datenschutz">
          Dein Lernfortschritt wird auf dem Server dieser Seite gespeichert, Passwörter nur verschlüsselt (als Hash). Eine Kopie bleibt im Browser dieses Geräts – auf geteilten Geräten bitte nicht „angemeldet bleiben“ wählen.
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
        Auf diesem Gerät angemeldet bleiben (nicht auf fremden oder geteilten Geräten)
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
  const gueltig = name.trim() && !nameBelegt && (!mitPasswort || passwort.length >= PASSWORT_MIN)

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
          <label className="feldname" htmlFor="sp-npw">Passwort (mindestens {PASSWORT_MIN} Zeichen)</label>
          <input
            id="sp-npw"
            className="suchfeld"
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
          />
          <PasswortBalken passwort={passwort} />
        </>
      )}
      <label className="serverHaken">
        <input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
        Auf diesem Gerät angemeldet bleiben (nicht auf fremden oder geteilten Geräten)
      </label>
      {fehler && <p className="serverFehler" role="alert">{fehler}</p>}
      <div className="wahl">
        <button className="knopf" type="submit" disabled={laeuft || !gueltig}>{vorgabe ? 'Übertragen' : 'Profil anlegen'}</button>
        <button className="textknopf" type="button" onClick={onAbbrechen}>Abbrechen</button>
      </div>
    </form>
  )
}
