import { useEffect, useState } from 'react'
import { AVATARE, abmelden, avatarUrl, metaSenden, passwortAendern, profileLaden } from '../lib/server.js'

// Konto auf dem Profil-Server (Einstellungen, nur mit Server-Anmeldung):
// Profilbild, Passwort setzen/aendern/entfernen, auf diesem Geraet abmelden.
export default function ServerKonto({ profilId, onAbgemeldet, onMeldung }) {
  const [profil, setProfil] = useState(null)
  const [offen, setOffen] = useState(null) // 'bild' | 'passwort'
  const [alt, setAlt] = useState('')
  const [neu, setNeu] = useState('')
  const [laeuft, setLaeuft] = useState(false)

  const laden = () => profileLaden().then((l) => setProfil(l.find((p) => p.id === profilId) ?? null)).catch(() => {})
  useEffect(() => { laden() }, [profilId])

  async function ausfuehren(arbeit, erfolg) {
    setLaeuft(true)
    try {
      await arbeit()
      onMeldung?.({ art: 'erfolg', text: erfolg })
      setOffen(null)
      setAlt('')
      setNeu('')
      await laden()
    } catch (e) {
      onMeldung?.({ art: 'fehler', text: e.message })
    } finally {
      setLaeuft(false)
    }
  }

  if (!profil) return null
  return (
    <>
      <div className="zeile">
        <div className="zeileText">
          <p className="zeileTitel">Konto auf dem Server</p>
          <p className="zeileHinweis">
            Dein Fortschritt wird automatisch auf dem Server gespeichert. Passwort:{' '}
            {profil.passwort ? 'gesetzt' : 'keines (jeder kann dieses Profil öffnen)'}.
          </p>
        </div>
        <img className="serverAvatar" src={avatarUrl(profil.avatar)} alt="" width="48" height="48" />
      </div>

      <div className="zeile">
        <div className="zeileText"><p className="zeileTitel">Profilbild</p></div>
        <button className="knopf schmal" onClick={() => setOffen(offen === 'bild' ? null : 'bild')}>Ändern</button>
      </div>
      {offen === 'bild' && (
        <div className="avatarRaster" role="radiogroup" aria-label="Profilbild">
          {AVATARE.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={profil.avatar === a}
              disabled={laeuft}
              className={profil.avatar === a ? 'avatarWahl aktiv' : 'avatarWahl'}
              onClick={() => ausfuehren(() => metaSenden(profilId, { avatar: a }), 'Profilbild geändert.')}
            >
              <img src={avatarUrl(a)} alt="" width="48" height="48" />
            </button>
          ))}
        </div>
      )}

      <div className="zeile">
        <div className="zeileText">
          <p className="zeileTitel">Passwort</p>
          <p className="zeileHinweis">Optional. Mindestens 6 Zeichen.</p>
        </div>
        <button className="knopf schmal" onClick={() => setOffen(offen === 'passwort' ? null : 'passwort')}>
          {profil.passwort ? 'Ändern / entfernen' : 'Festlegen'}
        </button>
      </div>
      {offen === 'passwort' && (
        <form
          className="serverFormular"
          onSubmit={(e) => {
            e.preventDefault()
            ausfuehren(() => passwortAendern(profilId, { alt: alt || null, neu }), 'Passwort gespeichert.')
          }}
        >
          <input type="text" name="username" autoComplete="username" value={profil.name} readOnly hidden />
          {profil.passwort && (
            <>
              <label className="feldname" htmlFor="sk-alt">Aktuelles Passwort</label>
              <input id="sk-alt" className="suchfeld" type="password" autoComplete="current-password" value={alt} onChange={(e) => setAlt(e.target.value)} />
            </>
          )}
          <label className="feldname" htmlFor="sk-neu">Neues Passwort</label>
          <input id="sk-neu" className="suchfeld" type="password" autoComplete="new-password" value={neu} onChange={(e) => setNeu(e.target.value)} />
          <div className="wahl">
            <button className="knopf schmal" type="submit" disabled={laeuft || neu.length < 6 || (profil.passwort && !alt)}>Speichern</button>
            {profil.passwort && (
              <button
                className="knopf schmal"
                type="button"
                disabled={laeuft || !alt}
                onClick={() => ausfuehren(() => passwortAendern(profilId, { alt, neu: null }), 'Passwort entfernt.')}
              >
                Passwort entfernen
              </button>
            )}
          </div>
        </form>
      )}

      <div className="zeile">
        <div className="zeileText">
          <p className="zeileTitel">Auf diesem Gerät abmelden</p>
          <p className="zeileHinweis">Beim nächsten Mal wird das Passwort (falls gesetzt) wieder abgefragt.</p>
        </div>
        <button className="knopf schmal" onClick={async () => { await abmelden(profilId); onAbgemeldet?.() }}>Abmelden</button>
      </div>
    </>
  )
}
