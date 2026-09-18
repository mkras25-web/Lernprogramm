import React from 'react'
import { createRoot } from 'react-dom/client'
import ProfilGate from './ProfilGate.jsx'
import Fehlergrenze from './components/Fehlergrenze.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Fehlergrenze>
      <ProfilGate />
    </Fehlergrenze>
  </React.StrictMode>
)
