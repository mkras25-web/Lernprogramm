import React from 'react'
import { createRoot } from 'react-dom/client'
import ProfilGate from './ProfilGate.jsx'
import Fehlergrenze from './components/Fehlergrenze.jsx'
import { rueckkehrVerarbeiten } from './lib/dropbox.js'
import { umzugsBannerZeigen } from './umzugsBanner.js'
import { registerSW } from 'virtual:pwa-register'

// Neue Version der App (31A): der Service Worker meldet sie, die App zeigt
// einen Hinweis "Neue Version – neu laden" (App.jsx), aber nie mitten in
// einer Lern- oder Pruefungssitzung. Stuendlich wird nachgesehen - eine als
// Home-Bildschirm-App offene Seite wird sonst tagelang nicht neu geladen.
const aktualisieren = registerSW({
  onNeedRefresh() {
    window.__appAktualisieren = () => aktualisieren(true)
    window.dispatchEvent(new Event('app-update-bereit'))
  },
  onRegisteredSW(_url, registrierung) {
    if (registrierung) setInterval(() => registrierung.update().catch(() => {}), 60 * 60 * 1000)
  },
})
import './styles.css'

// Schutz gegen Einbetten in eine fremde Seite (Clickjacking): eine
// unsichtbar darueber gelegte Seite koennte Klicks auf "Profil loeschen"
// oder "Dropbox trennen" lenken. Per Meta-CSP geht frame-ancestors nicht,
// GitHub Pages setzt keine Header - deshalb hier (Audit 2026-11-04).
function eingebettet() {
  try {
    return window.top !== window.self
  } catch {
    return true // fremder Origin darueber: Zugriff auf top verweigert
  }
}

umzugsBannerZeigen()

if (eingebettet()) {
  const hinweis = document.createElement('p')
  hinweis.style.cssText = 'font: 1rem/1.5 system-ui, sans-serif; padding: 1rem'
  hinweis.textContent = 'Das Lernprogramm lässt sich nicht in einer anderen Seite einbetten. Bitte direkt öffnen.'
  document.getElementById('root').replaceChildren(hinweis)
} else {
  starten()
}

// Kommt der Browser von der Dropbox-Anmeldung zurueck (?code=...), muss der
// Code getauscht und die Adresse bereinigt sein, bevor die App startet.
// Das Ergebnis holt die Oberflaeche danach mit meldungAbholen().
function starten() {
  rueckkehrVerarbeiten()
    .catch(() => null)
    .finally(() => {
      createRoot(document.getElementById('root')).render(
        <React.StrictMode>
          <Fehlergrenze>
            <ProfilGate />
          </Fehlergrenze>
        </React.StrictMode>
      )
    })
}
