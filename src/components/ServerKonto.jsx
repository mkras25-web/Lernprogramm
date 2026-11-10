import { useEffect, useState } from 'react'
import ProfilEditor from './ProfilEditor.jsx'
import { abmelden, avatarUrl, profileLaden } from '../lib/server.js'

// Konto auf dem Profil-Server (Einstellungen, nur mit Server-Anmeldung):
// Bearbeiten (Name, Bild, Passwort) ueber ProfilEditor, Abmelden auf diesem
// Geraet. Loeschen gibt es nur auf dem Profil-Auswahlbildschirm.
export default function ServerKonto({ profilId, onAbgemeldet }) {
  const [profil, setProfil] = useState(null)
  const [editor, setEditor] = useState(false)

  const laden = () => profileLaden().then((l) => setProfil(l.find((p) => p.id === profilId) ?? null)).catch(() => {})
  useEffect(() => { laden() }, [profilId])

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
        <div className="zeileText"><p className="zeileTitel">Name, Bild und Passwort</p></div>
        <button className="knopf schmal" onClick={() => setEditor(true)}>Bearbeiten</button>
      </div>
      <div className="zeile">
        <div className="zeileText">
          <p className="zeileTitel">Auf diesem Gerät abmelden</p>
          <p className="zeileHinweis">Beim nächsten Mal wird das Passwort (falls gesetzt) wieder abgefragt.</p>
        </div>
        <button className="knopf schmal" onClick={async () => { await abmelden(profilId); onAbgemeldet?.() }}>Abmelden</button>
      </div>
      {editor && (
        <ProfilEditor
          profil={profil}
          onGeaendert={setProfil}
          onSchliessen={() => { setEditor(false); laden() }}
        />
      )}
    </>
  )
}
