import { useEffect, useState } from 'react'

// Ein Bild, das auch fehlen darf. Buchausschnitte (bilder-lokal) liegen
// nicht im Internet - auf einem Geraet, das sie nie eingelesen hat (siehe
// lib/lokaleBilder.js), wuerde sonst ein kaputtes Bild-Symbol stehen.
// Stattdessen erklaert ein Platzhalter, was fehlt und wie es kommt.
export function BildPlatzhalter({ src }) {
  const lokal = src?.includes('/bilder-lokal/')
  return (
    <span className="bildFehlt" role="img" aria-label="Bild nicht verfügbar">
      <strong>{lokal ? 'Buchausschnitt nicht auf diesem Gerät' : 'Bild nicht verfügbar'}</strong>
      {lokal && (
        <span>
          Geschützte Bilder liegen nicht im Internet. Am PC sind sie da; am Handy über
          Einstellungen → Daten → „Bilder einlesen“ (ZIP aus Dropbox).
        </span>
      )}
    </span>
  )
}

export default function LokalBild({ src, alt = '', className, platzhalter = true, onFehler, ...rest }) {
  const [fehlt, setFehlt] = useState(false)
  useEffect(() => setFehlt(false), [src])

  if (!src) return null
  if (fehlt) return platzhalter ? <BildPlatzhalter src={src} /> : null

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => {
        setFehlt(true)
        onFehler?.()
      }}
      {...rest}
    />
  )
}
