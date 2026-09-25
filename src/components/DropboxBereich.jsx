import { useEffect, useState } from 'react'
import {
  appSchluessel,
  appSchluesselSetzen,
  dropboxMoeglich,
  istVerbunden,
  rueckkehrAdresse,
  trennen,
  verbindungStarten,
} from '../lib/dropbox.js'
import { profileInDropbox } from '../lib/abgleich.js'

// Dropbox-Verbindung und Abgleich. Steht in den Einstellungen (dort mit
// Abgleich-Steuerung) und in der Profilauswahl (dort mit der Liste der
// Profile in Dropbox) - auf einem neuen Geraet gibt es ja noch kein Profil,
// in dessen Einstellungen man sich verbinden koennte.
export default function DropboxBereich({ onMeldung, abgleich, onProfilLaden, profilWahl = false, einstellung, onEinstellung }) {
  const moeglich = dropboxMoeglich()
  const [schluessel, setSchluessel] = useState(null) // null = wird noch gelesen
  const [eingabe, setEingabe] = useState('')
  const [verbunden, setVerbunden] = useState(istVerbunden())
  const [profile, setProfile] = useState(null)
  const [laedt, setLaedt] = useState(false)

  useEffect(() => {
    if (moeglich) appSchluessel().then(setSchluessel)
  }, [moeglich])

  useEffect(() => {
    if (!profilWahl || !verbunden) return
    setLaedt(true)
    profileInDropbox()
      .then(setProfile)
      .catch((e) => onMeldung?.({ art: 'fehler', text: `Dropbox: ${e.message}` }))
      .finally(() => setLaedt(false))
  }, [profilWahl, verbunden])

  async function verbinden() {
    try {
      await verbindungStarten(schluessel)
    } catch (e) {
      onMeldung?.({ art: 'fehler', text: e.message })
    }
  }

  async function abmelden() {
    await trennen()
    setVerbunden(false)
    setProfile(null)
    onMeldung?.({ art: 'erfolg', text: 'Von Dropbox getrennt. Der Fortschritt auf diesem Gerät bleibt erhalten.' })
  }

  function schluesselSpeichern() {
    appSchluesselSetzen(eingabe)
    setSchluessel(eingabe.trim())
    setEingabe('')
  }

  const zeitText = abgleich?.zeit
    ? `Zuletzt abgeglichen: ${new Date(abgleich.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.`
    : 'Noch nicht abgeglichen.'

  return (
    <>
      <div className="zeile">
        <div className="zeileText">
          <p className="zeileTitel">Dropbox-Abgleich</p>
          <p className="zeileHinweis">
            {!moeglich &&
              'Der automatische Abgleich braucht eine https-Adresse (z. B. die GitHub-Adresse der App) oder localhost – über die WLAN-Adresse des PCs geht er nicht. Sichern und Einlesen per Datei funktioniert überall.'}
            {moeglich && schluessel === null && 'Wird geprüft …'}
            {moeglich && schluessel === '' && (
              <>
                Hält den Fortschritt auf allen Geräten gleich. Einmalig einzurichten: in der
                Dropbox-Entwicklerkonsole eine App anlegen (siehe ANLEITUNG-ONLINE-STELLEN.txt),
                deren „App key“ hier eintragen und als „Redirect URI“ dort diese Adresse
                hinterlegen: <code>{rueckkehrAdresse()}</code>
              </>
            )}
            {moeglich && schluessel && !verbunden && (
              <>
                Nicht verbunden. Der Fortschritt wird dann in deinem Dropbox-Ordner „Apps“
                gehalten – die App sieht nur diesen einen Ordner. Meldet Dropbox einen
                Fehler zur „redirect_uri“: diese Adresse muss in der Dropbox-Konsole unter
                „Redirect URIs“ stehen: <code>{rueckkehrAdresse()}</code>
              </>
            )}
            {moeglich && schluessel && verbunden && (
              <>
                Verbunden. {zeitText}
                {abgleich?.fehler && <> Letzter Fehler: {abgleich.fehler}</>}
              </>
            )}
          </p>
        </div>
        {moeglich && schluessel === '' && (
          <div className="wahl">
            <input
              className="zahl"
              style={{ width: '11rem' }}
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              placeholder="App key"
              aria-label="Dropbox App key"
            />
            <button className="knopf schmal" disabled={!eingabe.trim()} onClick={schluesselSpeichern}>
              Speichern
            </button>
          </div>
        )}
        {moeglich && schluessel && !verbunden && (
          <button className="knopf schmal" onClick={verbinden}>Mit Dropbox verbinden</button>
        )}
        {moeglich && schluessel && verbunden && (
          <div className="wahl">
            {abgleich && (
              <button className="knopf schmal" disabled={abgleich.laeuft} onClick={abgleich.onJetzt}>
                {abgleich.laeuft ? 'Gleicht ab …' : 'Jetzt abgleichen'}
              </button>
            )}
            <button className="knopf schmal" onClick={abmelden}>Trennen</button>
          </div>
        )}
      </div>

      {moeglich && schluessel && verbunden && einstellung && (
        <>
          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Automatisch abgleichen</p>
              <p className="zeileHinweis">Beim Öffnen, nach dem Lernen und beim Verlassen der App.</p>
            </div>
            <div className="wahl">
              {[[true, 'An'], [false, 'Aus']].map(([w, name]) => (
                <button
                  key={name}
                  className={w === einstellung.auto ? 'wahlKnopf aktiv' : 'wahlKnopf'}
                  onClick={() => onEinstellung('dropboxAuto', w)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Skizzen mitnehmen</p>
              <p className="zeileHinweis">
                Eigene Zeichnungen machen die Datei groß und den Abgleich langsamer. Aus: nur
                Antworten, Marken und Prüfungen.
              </p>
            </div>
            <div className="wahl">
              {[[true, 'An'], [false, 'Aus']].map(([w, name]) => (
                <button
                  key={name}
                  className={w === einstellung.skizzen ? 'wahlKnopf aktiv' : 'wahlKnopf'}
                  onClick={() => onEinstellung('dropboxSkizzen', w)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {profilWahl && moeglich && schluessel && verbunden && (
        <div className="zeile">
          <div className="zeileText">
            <p className="zeileTitel">Profile in Dropbox</p>
            <p className="zeileHinweis">
              {laedt && 'Wird gelesen …'}
              {!laedt && profile?.length === 0 && 'Noch keine Profile in Dropbox. Auf dem anderen Gerät dort abgleichen.'}
              {!laedt && profile?.length > 0 && 'Auf diesem Gerät als Profil laden – danach läuft es wie auf dem anderen Gerät weiter.'}
            </p>
            {!laedt && profile?.map((p) => (
              <p key={p.id} className="zeileHinweis" style={{ marginTop: '0.5rem' }}>
                <strong>{p.name}</strong> – {p.ereignisse} Antworten, {p.geraete} {p.geraete === 1 ? 'Gerät' : 'Geräte'}{' '}
                <button className="knopf schmal" onClick={() => onProfilLaden(p)}>Laden</button>
              </p>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
