import { useMemo, useState } from 'react'
import { passt } from '../lib/suche.js'
import { normenFinden } from '../components/Normen.jsx'

// Normenglossar zum Durchstoebern. Dieselbe Quelle, die im Lernen
// automatisch eingeblendet wird - hier nur frei zugaenglich.
//
// Seit 2026-10-10 (Entscheidung 24B): je Norm, in welchen Karten sie
// vorkommt (anzeigen/ueben), und Gruppierung nach dem Fachbereich, in dem
// sie am haeufigsten vorkommt - statt einer langen, gleichfoermigen Liste.
export default function Glossar({ glossar, items = [], bereiche = {}, onUeben, onItemOeffnen }) {
  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState(null)
  const [kartenOffen, setKartenOffen] = useState(null)

  // Norm -> Karten, die sie erwaehnen
  const karten = useMemo(() => {
    const karte = new Map()
    for (const item of items) {
      const text = [item.frage, item.antwort, item.vertiefung, item.pruefhinweis].filter(Boolean).join(' ')
      for (const norm of normenFinden(text, glossar ?? {})) {
        if (!karte.has(norm)) karte.set(norm, [])
        karte.get(norm).push(item)
      }
    }
    return karte
  }, [items, glossar])

  const eintraege = useMemo(() => {
    const alle = Object.entries(glossar ?? {})
    if (!suche.trim()) return alle
    return alle.filter(([schluessel, e]) =>
      passt(suche, [schluessel, e.titel, e.kurz, ...(e.absaetze ?? [])].join(' '))
    )
  }, [glossar, suche])

  const gruppen = useMemo(() => {
    const nachBereich = new Map()
    for (const eintrag of eintraege) {
      const liste = karten.get(eintrag[0]) ?? []
      const zaehler = new Map()
      for (const i of liste) zaehler.set(i.bereich, (zaehler.get(i.bereich) ?? 0) + 1)
      const haupt = [...zaehler.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '_ohne'
      if (!nachBereich.has(haupt)) nachBereich.set(haupt, [])
      nachBereich.get(haupt).push(eintrag)
    }
    const reihenfolge = [...Object.keys(bereiche), '_ohne']
    return reihenfolge
      .filter((b) => nachBereich.has(b))
      .map((b) => ({ id: b, titel: b === '_ohne' ? 'Noch in keiner Karte' : bereiche[b] ?? b, eintraege: nachBereich.get(b) }))
  }, [eintraege, karten, bereiche])

  return (
    <div role="main" className="schirm">
      <h1 className="ueberschrift">Normen und Regelwerke</h1>
      <p className="nebentext">
        {Object.keys(glossar ?? {}).length} Einträge. Maßgeblich ist immer der gültige
        Normtext in seiner aktuellen Fassung – diese Erläuterungen dienen der Einordnung.
      </p>

      <input
        className="suchfeld"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Norm, Stichwort oder Begriff …"
      />

      {gruppen.map((g) => (
        <section key={g.id} className="block">
          <h2 className="abschnitt">{g.titel}</h2>
          <ul className="treffer normenliste">
            {g.eintraege.map(([schluessel, e]) => {
              const liste = karten.get(schluessel) ?? []
              return (
                <li key={schluessel} className="trefferKarte">
                  <button
                    className="glossarKopf"
                    aria-expanded={offen === schluessel}
                    onClick={() => setOffen(offen === schluessel ? null : schluessel)}
                  >
                    <span className="normTitel">
                      <span className="normSchluessel">{schluessel}</span> – {e.titel}
                    </span>
                    <span className="aufklappZeichen" aria-hidden="true">{offen === schluessel ? '−' : '+'}</span>
                  </button>
                  <p className="normKurz">{e.kurz}</p>
                  {offen === schluessel &&
                    e.absaetze.map((absatz, i) => (
                      <p key={i} className="normAbsatz">{absatz}</p>
                    ))}
                  {liste.length > 0 && (
                    <div className="wahl">
                      <span className="zeileHinweis">in {liste.length} {liste.length === 1 ? 'Karte' : 'Karten'}</span>
                      <button className="textknopf" onClick={() => setKartenOffen(kartenOffen === schluessel ? null : schluessel)}>
                        {kartenOffen === schluessel ? 'ausblenden' : 'anzeigen'}
                      </button>
                      {onUeben && (
                        <button className="textknopf" onClick={() => onUeben(liste.map((i) => i.id))}>
                          üben
                        </button>
                      )}
                    </div>
                  )}
                  {kartenOffen === schluessel && (
                    <ul className="normKarten">
                      {liste.map((i) => (
                        <li key={i.id}>
                          <button className="textknopf" onClick={() => onItemOeffnen?.(i.id)}>{i.frage}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {eintraege.length === 0 && <p className="nebentext">Kein Eintrag gefunden.</p>}
    </div>
  )
}
