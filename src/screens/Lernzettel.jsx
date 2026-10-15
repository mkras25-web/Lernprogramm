// Lernzettel je Thema (Entscheidung 30A): Lernziele, Merksatz und alle
// Karten mit Antwort, Quelle und eigener Notiz kompakt untereinander - zum
// Ausdrucken oder als PDF sichern (Druckdialog des Browsers).

import LokalBild from '../components/LokalBild.jsx'
import { quelleText } from '../lib/quelle.js'

// Alle Bilder einer Karte fuer den Druck (Nutzerwunsch 2026-10-13): Aufgaben-
// bild, Fallbild, Vergleichsbilder und die erklaerende Abbildung zur Antwort.
function kartenBilder(item) {
  const bilder = [item.referenz, item.fallbild, ...(item.seiten ?? []).map((s) => s.bild), item.bild]
  return [...new Set(bilder.filter(Boolean))]
}

export default function Lernzettel({ thema, items, marken, onZurueck }) {
  const eigene = items.filter((i) => i.themaId === thema.id)
  const e = thema.erklaerung

  return (
    <div role="main" className="schirm lernzettel">
      <div className="themenKopf nichtDrucken">
        <button className="textknopf" onClick={onZurueck}>Zurück</button>
        <button className="knopf haupt schmal" onClick={() => window.print()}>Drucken / als PDF</button>
      </div>

      <header>
        <p className="herkunft">{thema.modulTitel}</p>
        <h1 className="ueberschrift">{thema.titel}</h1>
        <p className="nebentext">Lernzettel · {eigene.length} Karten · {new Date().toLocaleDateString('de-DE')}</p>
      </header>

      {thema.lernziele?.length > 0 && (
        <section className="lernziele">
          <h2 className="abschnitt">Lernziele</h2>
          <ul>{thema.lernziele.map((z, i) => <li key={i}>{z}</li>)}</ul>
        </section>
      )}
      {e?.merksatz && <p className="merksatz">{e.merksatz}</p>}
      {(e?.bild || thema.bild) && (
        <figure className="zettelBild">
          <LokalBild src={e?.bild ?? thema.bild} alt="" platzhalter={false} />
          {e?.bildunterschrift && <figcaption className="quelle">{e.bildunterschrift}</figcaption>}
        </figure>
      )}

      <ol className="zettelListe">
        {eigene.map((item) => {
          const notiz = marken.get(item.id)?.notiz
          return (
            <li key={item.id} className="zettelKarte">
              <p className="zettelFrage">{item.frage}</p>
              <p className="zettelAntwort">{item.antwort}</p>
              {item.typ === 'fall' && (
                <ol className="zettelTeile">
                  {(item.teile ?? []).map((t, i) => <li key={i}><strong>{t.frage}</strong> {t.antwort}</li>)}
                </ol>
              )}
              {item.vertiefung && <p className="zettelVertiefung">{item.vertiefung}</p>}
              {kartenBilder(item).length > 0 && (
                <div className="zettelBilder">
                  {kartenBilder(item).map((src) => (
                    <LokalBild key={src} src={src} alt="" platzhalter={false} />
                  ))}
                </div>
              )}
              {notiz && <p className="zettelNotiz">Notiz: {notiz}</p>}
              <p className="quelle">{quelleText(item.quelle)}</p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
