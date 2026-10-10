import { useMemo, useState } from 'react'
import { BEWERTUNG } from '../lib/planer.js'
import { beherrschungsgrad } from '../lib/fortschritt.js'

// Fehlerbuch (Entscheidung 28B): jede Karte, die je falsch beantwortet
// wurde, mit Fehlerzahl, letztem Fehler und heutigem Stand - und direkt
// uebbar. Anders als "Baustellen" (nur die aktuell schwaechsten) ist das
// die vollstaendige Historie.
export default function Fehlerbuch({ items, ereignisse, zustaende, onUeben, onOeffnen }) {
  const [nurOffen, setNurOffen] = useState(false)

  const eintraege = useMemo(() => {
    const nachItem = new Map(items.map((i) => [i.id, i]))
    const daten = new Map()
    for (const e of ereignisse) {
      if (e.bewertung !== BEWERTUNG.NOCHMAL) continue
      const d = daten.get(e.itemId) ?? { fehler: 0, zuletzt: 0 }
      d.fehler += 1
      d.zuletzt = Math.max(d.zuletzt, e.ts)
      daten.set(e.itemId, d)
    }
    return [...daten.entries()]
      .map(([id, d]) => {
        const item = nachItem.get(id)
        if (!item) return null
        const zustand = zustaende.get(id)
        const grad = beherrschungsgrad(zustand)
        return { item, ...d, grad, wackelig: grad !== 'sicher' && grad !== 'gefestigt' && grad !== 'gemeistert' }
      })
      .filter(Boolean)
      .sort((a, b) => b.fehler - a.fehler || b.zuletzt - a.zuletzt)
  }, [items, ereignisse, zustaende])

  const sichtbar = nurOffen ? eintraege.filter((e) => e.wackelig) : eintraege

  return (
    <div className="schirm">
      <div className="themenKopf">
        <h1 className="ueberschrift">Fehlerbuch</h1>
        {sichtbar.length > 0 && (
          <button className="knopf haupt schmal" onClick={() => onUeben(sichtbar.map((e) => e.item.id))}>
            {sichtbar.length === 1 ? 'Diese Karte üben' : `Alle ${sichtbar.length} üben`}
          </button>
        )}
      </div>
      <div className="zeile">
        <p className="nebentext">
          {eintraege.length === 0
            ? 'Noch keine falsch beantwortete Karte – das Fehlerbuch füllt sich von selbst.'
            : `${eintraege.length} Karten waren mindestens einmal falsch, ${eintraege.filter((e) => e.wackelig).length} davon sitzen noch nicht.`}
        </p>
        {eintraege.length > 0 && (
          <div className="wahl">
            <button className={!nurOffen ? 'wahlKnopf aktiv' : 'wahlKnopf'} onClick={() => setNurOffen(false)}>Alle</button>
            <button className={nurOffen ? 'wahlKnopf aktiv' : 'wahlKnopf'} onClick={() => setNurOffen(true)}>Noch wackelig</button>
          </div>
        )}
      </div>

      <ul className="treffer">
        {sichtbar.map(({ item, fehler, zuletzt, grad }) => (
          <li key={item.id} className="trefferKarte">
            <p className="herkunft">
              {item.modulTitel} · {item.themaTitel}
              <span className="kategorieMarke k-ueberarbeiten">{fehler}× falsch</span>
              <span className="kategorieMarke">{grad}</span>
            </p>
            <button className="trefferOeffnen" onClick={() => onOeffnen(item.id)}>
              <span className="trefferFrage">{item.frage}</span>
              <span className="zeileHinweis">
                zuletzt falsch am {new Date(zuletzt).toLocaleDateString('de-DE')} · Öffnen →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
