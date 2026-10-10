import React from 'react'
import { createRoot } from 'react-dom/client'
import ProfilGate from './ProfilGate.jsx'
import Fehlergrenze from './components/Fehlergrenze.jsx'
import { rueckkehrVerarbeiten } from './lib/dropbox.js'
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

// Kommt der Browser von der Dropbox-Anmeldung zurueck (?code=...), muss der
// Code getauscht und die Adresse bereinigt sein, bevor die App startet.
// Das Ergebnis holt die Oberflaeche danach mit meldungAbholen().
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
