import { useMemo, useState } from 'react'
import Bildlupe from '../components/Bildlupe.jsx'

// Bild- und Detailbibliothek (F1, 2026-10-13): alle Zeichnungen des
// Pakets als Raster, nach Thema gruppiert - Konstruktionsdetails gezielt
// nachschlagen, ohne die Karte zu kennen. Je Bild "Karte oeffnen" bzw.
// "Thema", gross per Lupe.
export default function Bilder({ themen, items, onKarte, onThema }) {
  const [suche, setSuche] = useState('')
  const [modul, setModul] = useState('')

  const gruppen = useMemo(() => {
    const jeThema = new Map()
    const gesehen = new Set()
    const dazu = (thema, src, text, itemId) => {
      if (!src || gesehen.has(src)) return
      gesehen.add(src)
      if (!jeThema.has(thema.id)) jeThema.set(thema.id, { thema, bilder: [] })
      jeThema.get(thema.id).bilder.push({ src, text, itemId })
    }
    const themaVon = new Map(themen.map((t) => [t.id, t]))
    for (const t of themen) {
      if (t.geplant) continue
      // Eigenes Erklaerbild UND Themenbild - beide, wenn sie verschieden sind.
      dazu(t, t.erklaerung?.bild, t.erklaerung?.bildunterschrift ?? t.titel, null)
      dazu(t, t.bild, t.titel, null)
    }
    for (const i of items) {
      const t = themaVon.get(i.themaId)
      if (!t) continue
      dazu(t, i.bild, i.bildunterschrift ?? i.frage, i.id)
      // Aufgabenbilder: bei Beschriftung/Fehlersuche die Vorlage, bei der
      // Skizze die Referenz - alle zeigen ein Detail.
      dazu(t, i.referenz, i.frage, i.id)
      dazu(t, i.fallbild, i.frage, i.id)
      for (const s of i.seiten ?? []) dazu(t, s.bild, s.titel ?? i.frage, i.id)
    }
    return [...jeThema.values()]
  }, [themen, items])

  const module = [...new Map(themen.map((t) => [t.modulId, t.modulTitel])).entries()]
  const wort = suche.trim().toLowerCase()
  const sichtbar = gruppen
    .filter((g) => !modul || g.thema.modulId === modul)
    .map((g) => ({
      ...g,
      bilder: wort
        ? g.bilder.filter((b) => `${b.text} ${g.thema.titel}`.toLowerCase().includes(wort))
        : g.bilder,
    }))
    .filter((g) => g.bilder.length > 0)
  const anzahl = sichtbar.reduce((n, g) => n + g.bilder.length, 0)

  return (
    <div className="schirm">
      <div className="themenKopf">
        <h1 className="ueberschrift">Bilder</h1>
      </div>
      <div className="bilderFilter">
        <input
          className="suchfeld"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Suchen, z. B. Sockel, Attika, Sturz …"
        />
        {module.length > 1 && (
          <select className="paarWahl" value={modul} onChange={(e) => setModul(e.target.value)}>
            <option value="">Alle Module</option>
            {module.map(([id, titel]) => <option key={id} value={id}>{titel}</option>)}
          </select>
        )}
      </div>
      <p className="nebentext">
        {anzahl} {anzahl === 1 ? 'Zeichnung' : 'Zeichnungen'} in {sichtbar.length} Themen. Antippen vergrößert.
      </p>

      {sichtbar.map(({ thema, bilder }) => (
        <section key={thema.id} className="block">
          <div className="themenKopf">
            <h2 className="abschnitt">{thema.titel}</h2>
            {onThema && (
              <button className="textknopf" onClick={() => onThema(thema.id)}>Thema →</button>
            )}
          </div>
          <div className="zeichnungsRaster">
            {bilder.map((b) => (
              <figure key={b.src} className="zeichnungsKachel">
                <Bildlupe src={b.src} alt={b.text ?? ''} />
                {b.text && <figcaption className="quelle">{b.text}</figcaption>}
                {b.itemId && onKarte && (
                  <button className="textknopf" onClick={() => onKarte(b.itemId)}>Karte öffnen</button>
                )}
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
