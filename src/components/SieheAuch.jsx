import { useState } from 'react'

// Querverweise auf andere Themen (Feld "siehe": Liste von Themen-IDs, am
// Item oder an der Themendatei - Entscheidung 21C). Im Lernbildschirm
// oeffnet ein Klick das Erklaerstueck des anderen Themas als Fenster,
// ohne die Sitzung zu verlassen. Unbekannte oder leere Themen werden
// still uebergangen.
export default function SieheAuch({ ids, themen, onOeffnen }) {
  const [offen, setOffen] = useState(null)
  const ziele = (ids ?? [])
    .map((id) => themen?.find((t) => t.id === id))
    .filter((t) => t && !t.geplant)
  if (ziele.length === 0) return null

  const zeigen = (t) => (onOeffnen ? onOeffnen(t.id) : setOffen(t))
  const e = offen?.erklaerung

  return (
    <div className="sieheAuch">
      <span className="zeileHinweis">Siehe auch:</span>
      {ziele.map((t) => (
        <button key={t.id} className="markenKnopf" onClick={() => zeigen(t)}>
          {t.titel}
        </button>
      ))}
      {offen && (
        <div className="schleier" onClick={() => setOffen(null)}>
          <article className="grosseKarte" style={{ maxWidth: '40rem' }} onClick={(ev) => ev.stopPropagation()}>
            <p className="herkunft">{offen.modulTitel}</p>
            <h2 className="ueberschrift">{offen.titel}</h2>
            {(e?.absaetze ?? []).map((a, i) => (
              <p key={i} className="erklaerungAbsatz">{a}</p>
            ))}
            {e?.merksatz && <p className="merksatz">{e.merksatz}</p>}
            {!e && <p className="nebentext">Zu diesem Thema gibt es noch kein Erklärstück.</p>}
            <button className="knopf schmal" onClick={() => setOffen(null)}>Schließen</button>
          </article>
        </div>
      )}
    </div>
  )
}
