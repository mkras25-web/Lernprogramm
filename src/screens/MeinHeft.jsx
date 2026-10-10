import { useMemo } from 'react'

// "Mein Heft" (Entscheidung 28A): alle eigenen Notizen und Lesezeichen an
// einem Ort, nach Thema gruppiert und druckbar. Vorher gab es sie nur als
// Filter in Nachschlagen.
export default function MeinHeft({ items, marken, onOeffnen }) {
  const gruppen = useMemo(() => {
    const karte = new Map()
    for (const item of items) {
      const m = marken.get(item.id)
      if (!m?.notiz && !m?.lesezeichen) continue
      const k = item.themaId
      if (!karte.has(k)) karte.set(k, { titel: item.themaTitel, modul: item.modulTitel, eintraege: [] })
      karte.get(k).eintraege.push({ item, marke: m })
    }
    return [...karte.values()]
  }, [items, marken])

  const anzahl = gruppen.reduce((s, g) => s + g.eintraege.length, 0)

  return (
    <div className="schirm heft">
      <div className="themenKopf">
        <h1 className="ueberschrift">Mein Heft</h1>
        {anzahl > 0 && (
          <button className="knopf schmal nichtDrucken" onClick={() => window.print()}>
            Drucken
          </button>
        )}
      </div>
      <p className="nebentext">
        {anzahl > 0
          ? `${anzahl} Karten mit Notiz oder Lesezeichen in ${gruppen.length} Themen.`
          : 'Noch nichts gesammelt. Beim Lernen und in Nachschlagen lassen sich Karten mit Lesezeichen versehen oder mit einer eigenen Notiz ergänzen – sie erscheinen dann hier.'}
      </p>

      {gruppen.map((g) => (
        <section key={g.titel} className="block">
          <h2 className="abschnitt">{g.modul} · {g.titel}</h2>
          <ul className="treffer">
            {g.eintraege.map(({ item, marke }) => (
              <li key={item.id} className="trefferKarte">
                <p className="herkunft">
                  {marke.lesezeichen && <span className="kategorieMarke k-relevant">Lesezeichen</span>}
                  {marke.notiz && <span className="kategorieMarke k-spaeter">Notiz</span>}
                </p>
                <p className="trefferFrage">{item.frage}</p>
                <p className="trefferAntwort">{item.antwort}</p>
                {marke.notiz && <p className="merksatz">{marke.notiz}</p>}
                <button className="textknopf nichtDrucken" style={{ alignSelf: 'flex-start' }} onClick={() => onOeffnen(item.id)}>
                  In Nachschlagen öffnen
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
