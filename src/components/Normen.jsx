import { useMemo, useState } from 'react'

// Erkennt Normverweise im Itemtext und blendet die ausfuehrliche
// Erlaeuterung ein. So steht die Erklaerung einmal im Glossar statt
// in jedem Item - und veraltet nur an einer Stelle.
// Erfasst auch EN- und ISO-Normen. Ohne das waere ein Glossareintrag
// wie "DIN EN ISO 6946" nie gefunden worden - die alte Fassung brach
// nach "DIN EN " ab, weil sie dort Ziffern erwartete.
const MUSTER =
  /\b(DIN(?:\s+EN)?(?:\s+ISO)?\s+V?\s?\d+(?:[–-]\d+)?|EN\s+ISO\s+\d+|ISO\s+\d+|GEG|HOAI|VOB\/?[ABC]?|BauGB|BauNVO|MBO|LBO|HBO)\b/g

export function normenFinden(text, glossar) {
  if (!text) return []
  const treffer = new Set()
  for (const fund of text.matchAll(MUSTER)) {
    const roh = fund[1].replace(/\s+/g, ' ').trim()
    if (glossar[roh]) {
      treffer.add(roh)
      continue
    }
    // "DIN 4108-4" auf den Oberbegriff "DIN 4108" zurueckfuehren,
    // "VOB/B" auf "VOB"
    const kurz = roh.split(/[–\-/]/)[0].trim()
    if (glossar[kurz]) treffer.add(kurz)
  }
  return [...treffer]
}

export default function Normen({ item, glossar }) {
  const [offen, setOffen] = useState(null)

  const gefunden = useMemo(() => {
    const text = [item.frage, item.antwort, item.vertiefung, item.pruefhinweis]
      .filter(Boolean)
      .join(' ')
    return normenFinden(text, glossar ?? {})
  }, [item, glossar])

  if (gefunden.length === 0) return null

  return (
    <section className="normen">
      <h2 className="abschnitt">Normen in dieser Frage</h2>
      <div className="wahl">
        {gefunden.map((schluessel) => (
          <button
            key={schluessel}
            className={offen === schluessel ? 'wahlKnopf aktiv' : 'wahlKnopf'}
            onClick={() => setOffen(offen === schluessel ? null : schluessel)}
          >
            {schluessel}
          </button>
        ))}
      </div>

      {offen && (
        <article className="normkasten">
          <h3 className="normTitel">
            {offen} – {glossar[offen].titel}
          </h3>
          <p className="normKurz">{glossar[offen].kurz}</p>
          {glossar[offen].absaetze.map((absatz, i) => (
            <p key={i} className="normAbsatz">{absatz}</p>
          ))}
        </article>
      )}
    </section>
  )
}
