import { useState } from 'react'
import { quelleText } from '../lib/quelle.js'

// Kennwerte-Tabellenbuch (F3, 2026-10-13): Mindestmasse, Grenz- und
// Richtwerte zum Nachschlagen, je Wert mit Quelle. Inhalt aus
// kennwerte.json des Pakets (ANLEITUNG-THEMA-CHAT.md 2.3), entsteht im
// Themen-Chat.
export default function Kennwerte({ gruppen = [], themen = [], onThema }) {
  const [suche, setSuche] = useState('')
  const wort = suche.trim().toLowerCase()
  const themaTitel = new Map(themen.map((t) => [t.id, t.titel]))
  const sichtbar = gruppen
    .map((g) => ({
      ...g,
      eintraege: (g.eintraege ?? []).filter(
        (e) => !wort || [e.name, e.wert, e.einheit, e.hinweis, e.norm, quelleText(e.quelle), g.titel].join(' ').toLowerCase().includes(wort)
      ),
    }))
    .filter((g) => g.eintraege.length > 0)

  return (
    <div className="schirm">
      <div className="themenKopf">
        <h1 className="ueberschrift">Kennwerte</h1>
      </div>
      {gruppen.length === 0 ? (
        <p className="nebentext">
          Für dieses Paket gibt es noch keine Kennwerte. Sie entstehen im Themen-Chat nebenbei, wenn ein
          Auszug ohnehin eine Tabelle mit Maßen oder Grenzwerten liefert (Datei kennwerte.json, Anleitung
          Abschnitt 2.3).
        </p>
      ) : (
        <>
          <input
            className="suchfeld"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Suchen, z. B. Steigung, U-Wert, Brüstung …"
          />
          {sichtbar.length === 0 && <p className="nebentext">Nichts gefunden.</p>}
          {sichtbar.map((g) => (
            <section key={g.id} className="block">
              <h2 className="abschnitt">{g.titel}</h2>
              <ul className="kennwertListe">
                {g.eintraege.map((e, i) => (
                  <li key={e.id ?? i} className="kennwert">
                    <span className="kennwertName">
                      {e.name}
                      {e.geprueft === false && <span className="ungeprueft">ungeprüft</span>}
                    </span>
                    <span className="kennwertWert">
                      {e.wert}
                      {e.einheit && <span className="einheit"> {e.einheit}</span>}
                    </span>
                    {e.hinweis && <span className="kennwertHinweis">{e.hinweis}</span>}
                    <span className="quelle">
                      {[e.norm, quelleText(e.quelle)].filter(Boolean).join(' · ')}
                    </span>
                    {e.themen?.length > 0 && onThema && (
                      <span className="kennwertThemen">
                        {e.themen.map((t) => (
                          <button key={t} className="textknopf" onClick={() => onThema(t)}>
                            {themaTitel.get(t) ?? t} →
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
