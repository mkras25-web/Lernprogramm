import { useEffect, useMemo, useState } from 'react'
import { datenbankFuerProfilSetzen, exportieren } from '../lib/speicher.js'
import DropboxBereich from '../components/DropboxBereich.jsx'
import { meldungAbholen } from '../lib/dropbox.js'

const AVATAR_FARBEN = ['#adc178', '#a98467', '#457b9d', '#c1734a', '#7d8471', '#1b9aaa']

function avatarFarbe(id) {
  let summe = 0
  for (const z of id) summe += z.charCodeAt(0)
  return AVATAR_FARBEN[summe % AVATAR_FARBEN.length]
}

function initialen(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase()
}

function dateiname(name) {
  const sicher = name.trim().replace(/[^\w\-]+/g, '_') || 'profil'
  return `lernprotokoll-${sicher}-${new Date().toISOString().slice(0, 10)}.json`
}

// Startbildschirm, wenn noch kein Profil aktiv ist: Profil waehlen,
// anlegen, umbenennen, sichern, aus einer Sicherung neu anlegen oder
// loeschen. Jedes Profil hat einen eigenen, vollstaendig getrennten
// Fortschritt (siehe lib/profile.js). Die Profilliste selbst gehoert
// ProfilGate - dieser Screen ist bewusst zustandslos dafuer, damit sie
// nach einem Wechsel nie veraltet.
export default function ProfilWahl({
  profile, hinweis, onWahl, onErstellen, onUmbenennen, onFarbeAendern, onLoeschen, onImportieren, onAusDropboxLaden,
}) {
  const [neuerName, setNeuerName] = useState('')
  const [bearbeiten, setBearbeiten] = useState(null)
  const [farbWahl, setFarbWahl] = useState(null)
  const [loeschKandidat, setLoeschKandidat] = useState(null)
  const [bestaetigung, setBestaetigung] = useState('')
  const [meldung, setMeldung] = useState(null)

  // Rueckmeldung der Dropbox-Anmeldung (siehe main.jsx).
  useEffect(() => {
    const m = meldungAbholen()
    if (m) setMeldung(m)
  }, [])

  // Zuletzt benutztes Profil zuerst - bei mehreren Personen sonst
  // jedes Mal erneut die richtige Zeile aus einer langen Liste suchen.
  const sortiert = useMemo(
    () => [...profile].sort((a, b) => (b.letzterZugriff ?? b.erstelltAm ?? 0) - (a.letzterZugriff ?? a.erstelltAm ?? 0)),
    [profile]
  )

  useEffect(() => {
    if (!meldung) return
    const timer = setTimeout(() => setMeldung(null), 6000)
    return () => clearTimeout(timer)
  }, [meldung])

  function erstellen(e) {
    e.preventDefault()
    const name = neuerName.trim()
    if (!name) return
    onErstellen(name)
    setNeuerName('')
  }

  function umbenennen(id, name) {
    onUmbenennen(id, name)
    setBearbeiten(null)
  }

  async function wirklichLoeschen() {
    await onLoeschen(loeschKandidat.id)
    setLoeschKandidat(null)
    setBestaetigung('')
  }

  // Sichert ein Profil, ohne es zu betreten - fuers Umziehen auf ein
  // anderes Geraet reicht das oft schon, ohne erst hineinzuwechseln.
  async function sichern(p) {
    await datenbankFuerProfilSetzen(p.id)
    const text = await exportieren({ mitSkizzen: true, profilId: p.id, profilName: p.name })
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = dateiname(p.name)
    a.click()
    URL.revokeObjectURL(url)
  }

  async function ausDropboxLaden(eintrag) {
    try {
      const { profil, bericht, neuAngelegt } = await onAusDropboxLaden(eintrag)
      setMeldung({
        art: 'erfolg',
        text:
          `Profil „${profil.name}" ${neuAngelegt ? 'aus Dropbox geladen' : 'abgeglichen'}: ` +
          `${bericht.ereignisse} Antworten übernommen.`,
      })
    } catch (e) {
      setMeldung({ art: 'fehler', text: `Laden aus Dropbox nicht möglich: ${e.message}` })
    }
  }

  async function importieren(datei) {
    try {
      const { profil, bericht, neuAngelegt } = await onImportieren(datei)
      setMeldung({
        art: 'erfolg',
        text:
          `Profil „${profil.name}" ${neuAngelegt ? 'angelegt' : 'aktualisiert (gab es schon)'}: ${bericht.ereignisse} Ereignisse, ` +
          `${bericht.skizzen} Skizzen, ${bericht.marken} Marken, ${bericht.pruefungen} Prüfungen übernommen.`,
      })
    } catch (e) {
      setMeldung({ art: 'fehler', text: `Import nicht möglich: ${e.message}` })
    }
  }

  return (
    <div className="huelle einspaltig">
      <div className="schirm profilSchirm">
        <h1 className="ueberschrift">Wer lernt gerade?</h1>
        {hinweis && <p className="nebentext">{hinweis}</p>}

        {sortiert.length > 0 && (
          <ul className="profilListe">
            {sortiert.map((p) => (
              <li key={p.id}>
                {bearbeiten === p.id ? (
                  <UmbenennenZeile
                    profil={p}
                    onFertig={(name) => umbenennen(p.id, name)}
                    onAbbrechen={() => setBearbeiten(null)}
                  />
                ) : (
                  <div className="profilZeile">
                    <button className="profilKnopf" onClick={() => onWahl(p.id)}>
                      <span className="profilAvatar" style={{ background: p.farbe ?? avatarFarbe(p.id) }} aria-hidden="true">
                        {initialen(p.name)}
                      </span>
                      <span className="profilTexte">
                        <span className="profilName">{p.name}</span>
                        {p.letzterZugriff && (
                          <span className="profilZuletzt">
                            zuletzt aktiv {new Date(p.letzterZugriff).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </span>
                    </button>
                    <button className="artKnopf" onClick={() => setBearbeiten(p.id)}>
                      Umbenennen
                    </button>
                    <button
                      className="artKnopf"
                      onClick={() => setFarbWahl(farbWahl === p.id ? null : p.id)}
                    >
                      Farbe
                    </button>
                    <button className="artKnopf" onClick={() => sichern(p)}>
                      Sichern
                    </button>
                    <button className="artKnopf" onClick={() => setLoeschKandidat(p)}>
                      Löschen
                    </button>
                    {farbWahl === p.id && (
                      <div className="avatarFarbWahl">
                        {AVATAR_FARBEN.map((f) => (
                          <button
                            key={f}
                            className={(p.farbe ?? avatarFarbe(p.id)) === f ? 'avatarSchwatch aktiv' : 'avatarSchwatch'}
                            style={{ background: f }}
                            aria-label={`Avatarfarbe ${f}`}
                            onClick={() => {
                              onFarbeAendern(p.id, f)
                              setFarbWahl(null)
                            }}
                          />
                        ))}
                        <button
                          className="artKnopf schmal"
                          onClick={() => {
                            onFarbeAendern(p.id, null)
                            setFarbWahl(null)
                          }}
                        >
                          Automatisch
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form className="profilNeu" onSubmit={erstellen}>
          <input
            className="suchfeld"
            value={neuerName}
            onChange={(e) => setNeuerName(e.target.value)}
            placeholder="Name für ein neues Profil"
          />
          <button className="knopf" type="submit" disabled={!neuerName.trim()}>
            Profil anlegen
          </button>
        </form>

        <label className="knopf schmal profilImport">
          Profil aus Sicherung importieren
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const datei = e.target.files?.[0]
              e.target.value = ''
              if (datei) importieren(datei)
            }}
          />
        </label>

        <div className="feldgruppe" style={{ marginTop: '1.5rem' }}>
          <DropboxBereich profilWahl onMeldung={setMeldung} onProfilLaden={ausDropboxLaden} />
        </div>
      </div>

      {meldung && (
        <div
          className={meldung.art === 'fehler' ? 'meldung fehler' : 'meldung'}
          role="status"
          aria-live="polite"
        >
          <p>{meldung.text}</p>
          <button onClick={() => setMeldung(null)} aria-label="Meldung schließen">✕︎</button>
        </div>
      )}

      {loeschKandidat && (
        <div className="schleier" onClick={() => setLoeschKandidat(null)}>
          <article className="grosseKarte gefahr" onClick={(e) => e.stopPropagation()}>
            <h2 className="ueberschrift">Profil „{loeschKandidat.name}" löschen?</h2>
            <p className="nebentext">
              Der gesamte Fortschritt dieses Profils wird unwiderruflich gelöscht - alle
              Ereignisse, Skizzen, Notizen und Prüfungen. Sichere ihn vorher (Knopf „Sichern"
              in der Liste), wenn du ihn behalten willst.
            </p>
            <p className="nebentext">
              Tippe <strong>LÖSCHEN</strong>, um es zu bestätigen.
            </p>
            <input
              className="zahl"
              style={{ width: '100%' }}
              value={bestaetigung}
              onChange={(e) => setBestaetigung(e.target.value)}
              placeholder="LÖSCHEN"
            />
            <div className="wahl">
              <button
                className="knopf schmal"
                onClick={() => {
                  setLoeschKandidat(null)
                  setBestaetigung('')
                }}
              >
                Abbrechen
              </button>
              <button
                className="knopf schmal gefahr"
                disabled={bestaetigung.trim().toUpperCase() !== 'LÖSCHEN'}
                onClick={wirklichLoeschen}
              >
                Endgültig löschen
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

function UmbenennenZeile({ profil, onFertig, onAbbrechen }) {
  const [wert, setWert] = useState(profil.name)
  return (
    <form
      className="profilZeile"
      onSubmit={(e) => {
        e.preventDefault()
        if (wert.trim()) onFertig(wert.trim())
      }}
    >
      <input
        className="suchfeld"
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        autoFocus
      />
      <button className="artKnopf" type="submit">Speichern</button>
      <button className="artKnopf" type="button" onClick={onAbbrechen}>Abbrechen</button>
    </form>
  )
}
