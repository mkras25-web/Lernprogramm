// Lernzettel je Thema (Entscheidung 30A): Lernziele, Merksatz und alle
// Karten mit Antwort, Quelle und eigener Notiz kompakt untereinander - zum
// Ausdrucken oder als PDF sichern (Druckdialog des Browsers).
export default function Lernzettel({ thema, items, marken, onZurueck }) {
  const eigene = items.filter((i) => i.themaId === thema.id)
  const e = thema.erklaerung

  return (
    <div className="schirm lernzettel">
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
              {notiz && <p className="zettelNotiz">Notiz: {notiz}</p>}
              <p className="quelle">{item.quelle}</p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
