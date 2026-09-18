import { useMemo, useState } from 'react'
import { passt } from '../lib/suche.js'

// Normenglossar zum Durchstoebern. Dieselbe Quelle, die im Lernen
// automatisch eingeblendet wird - hier nur frei zugaenglich.
export default function Glossar({ glossar }) {
  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState(null)

  const eintraege = useMemo(() => {
    const alle = Object.entries(glossar ?? {})
    if (!suche.trim()) return alle
    return alle.filter(([schluessel, e]) =>
      passt(suche, [schluessel, e.titel, e.kurz, ...(e.absaetze ?? [])].join(' '))
    )
  }, [glossar, suche])

  return (
    <div className="schirm">
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

      <ul className="treffer">
        {eintraege.map(([schluessel, e]) => (
          <li key={schluessel} className="trefferKarte">
            <button
              className="glossarKopf"
              onClick={() => setOffen(offen === schluessel ? null : schluessel)}
            >
              <span className="normTitel">{schluessel} – {e.titel}</span>
              <span className="nebentext">{offen === schluessel ? '−' : '+'}</span>
            </button>
            <p className="normKurz">{e.kurz}</p>
            {offen === schluessel &&
              e.absaetze.map((absatz, i) => (
                <p key={i} className="normAbsatz">{absatz}</p>
              ))}
          </li>
        ))}
      </ul>

      {eintraege.length === 0 && <p className="nebentext">Kein Eintrag gefunden.</p>}
    </div>
  )
}
