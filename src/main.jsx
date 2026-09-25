import React from 'react'
import { createRoot } from 'react-dom/client'
import ProfilGate from './ProfilGate.jsx'
import Fehlergrenze from './components/Fehlergrenze.jsx'
import { rueckkehrVerarbeiten } from './lib/dropbox.js'
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
