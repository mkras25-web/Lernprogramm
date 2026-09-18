import { useEffect, useState } from 'react'
import App from './App.jsx'
import ProfilWahl from './screens/ProfilWahl.jsx'
import {
  profilListe,
  aktivesProfilId,
  aktivesProfilSetzen,
  profilZuletztAktiv,
  profilErstellen,
  profilUmbenennen,
  profilLoeschen,
  altbestandAlsProfilUebernehmen,
} from './lib/profile.js'
import { datenbankFuerProfilSetzen, importieren } from './lib/speicher.js'

// Vorgeschaltet vor App: klaert, welches Nutzerprofil gerade lernt,
// bevor irgendeine Datenbank geoeffnet wird. App selbst weiss nichts
// von anderen Profilen - sie bekommt einfach eine profilId und startet
// bei jedem Wechsel komplett frisch (key={profilId} erzwingt das).
export default function ProfilGate() {
  const [bereit, setBereit] = useState(false)
  const [profile, setProfile] = useState([])
  const [profilId, setProfilId] = useState(null)
  const [hinweis, setHinweis] = useState(null)

  useEffect(() => {
    let abgebrochen = false

    async function einrichten() {
      let liste = profilListe()

      if (liste.length === 0) {
        // Erstkontakt mit dem Profilsystem: alten, profillosen Bestand
        // pruefen und - falls vorhanden - unveraendert uebernehmen.
        const uebernommen = await altbestandAlsProfilUebernehmen()
        if (uebernommen) {
          liste = [uebernommen]
          setHinweis(`Dein bisheriger Fortschritt liegt jetzt im Profil „${uebernommen.name}".`)
        }
      }

      if (abgebrochen) return
      setProfile(liste)

      const aktiv = aktivesProfilId()
      if (aktiv && liste.some((p) => p.id === aktiv)) {
        await datenbankFuerProfilSetzen(aktiv)
        profilZuletztAktiv(aktiv)
        if (!abgebrochen) setProfilId(aktiv)
      }
      if (!abgebrochen) setBereit(true)
    }

    einrichten()
    return () => {
      abgebrochen = true
    }
  }, [])

  async function profilWaehlen(id) {
    await datenbankFuerProfilSetzen(id)
    aktivesProfilSetzen(id)
    profilZuletztAktiv(id)
    setHinweis(null)
    setProfilId(id)
  }

  // Zurueck zur Auswahl, ohne das zuletzt aktive Profil aus dem
  // Speicher zu entfernen - beim naechsten Programmstart springt die
  // App sonst nicht mehr direkt hinein.
  function profilWechseln() {
    setProfilId(null)
  }

  // Die Profilliste lebt nur hier - ProfilWahl ruft diese Handler nur
  // auf und bleibt selbst zustandslos, damit sie nach einem Wechsel
  // nie eine veraltete Liste zeigt.
  function profilAnlegen(name) {
    const profil = profilErstellen(name)
    setProfile((alle) => [...alle, profil])
  }

  function profilUmbenennenUndMerken(id, name) {
    profilUmbenennen(id, name)
    setProfile((alle) => alle.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  async function profilEntfernen(id) {
    await profilLoeschen(id)
    setProfile((alle) => alle.filter((p) => p.id !== id))
  }

  // Legt aus einer Sicherungsdatei ein NEUES Profil an, statt in ein
  // bestehendes hineinzumergen - so entsteht nie versehentlich ein
  // Datendurcheinander, wenn die Datei vom falschen Profil stammt.
  // Schlaegt die Uebernahme fehl, bleibt kein leeres Profil zurueck.
  async function profilAusSicherungImportieren(datei) {
    const text = await datei.text()
    let daten
    try {
      daten = JSON.parse(text)
    } catch {
      throw new Error('Die Datei ist kein gültiges Sicherungs-JSON.')
    }
    if (!Array.isArray(daten.ereignisse)) {
      throw new Error('Die Datei enthält kein Ereignisprotokoll.')
    }

    const name = daten.profil?.name?.trim() || 'Importiertes Profil'
    const profil = profilErstellen(name)
    try {
      await datenbankFuerProfilSetzen(profil.id)
      const bericht = await importieren(text)
      setProfile((alle) => [...alle, profil])
      return { profil, bericht }
    } catch (e) {
      await profilLoeschen(profil.id)
      throw e
    }
  }

  if (!bereit) {
    return (
      <div className="huelle einspaltig">
        <div className="ladeAnzeige" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
        </div>
      </div>
    )
  }

  if (!profilId) {
    return (
      <ProfilWahl
        profile={profile}
        hinweis={hinweis}
        onWahl={profilWaehlen}
        onErstellen={profilAnlegen}
        onUmbenennen={profilUmbenennenUndMerken}
        onLoeschen={profilEntfernen}
        onImportieren={profilAusSicherungImportieren}
      />
    )
  }

  return <App key={profilId} profilId={profilId} onProfilWechseln={profilWechseln} />
}
