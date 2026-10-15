import { useMemo, useState } from 'react'
import Schleier from '../components/Schleier.jsx'

// Uebersicht aller gespeicherten Skizzen, nach Item gruppiert.
// Zeigt die Entwicklung ueber die Zeit und erlaubt das Aufraeumen.
export default function Skizzen({ skizzen, items, onLoeschen, onNeuZeichnen, zeichenaufgaben = 0, zeichenAus = false, onUeben }) {
  const [gross, setGross] = useState(null)
  const [loeschKandidat, setLoeschKandidat] = useState(null)

  const gruppen = useMemo(() => {
    const nachItem = new Map(items.map((i) => [i.id, i]))
    const karte = new Map()
    for (const s of skizzen) {
      if (!karte.has(s.itemId)) {
        karte.set(s.itemId, { item: nachItem.get(s.itemId), eintraege: [] })
      }
      karte.get(s.itemId).eintraege.push(s)
    }
    for (const g of karte.values()) g.eintraege.sort((a, b) => a.ts - b.ts)
    return [...karte.values()]
  }, [skizzen, items])

  return (
    <div role="main" className="schirm">
      <h1 className="ueberschrift">Skizzen</h1>
      <p className="nebentext">
        {skizzen.length} gespeicherte Zeichnungen in {gruppen.length} Aufgaben
      </p>

      {gruppen.length === 0 && (
        <div className="aufruf ruhig">
          <div>
            <p className="aufrufZahl">Noch keine Skizze gespeichert</p>
            <p className="nebentext">
              Sie entstehen, sobald du eine Zeichenaufgabe im Zeichenfeld bearbeitest.
              {zeichenAus
                ? ' Zeichenaufgaben sind in den Einstellungen ausgeblendet.'
                : zeichenaufgaben > 0 && ` ${zeichenaufgaben} Zeichenaufgaben stehen bereit.`}
            </p>
          </div>
          {zeichenaufgaben > 0 && onUeben && (
            <button className="knopf haupt schmal" onClick={onUeben}>
              Zeichenaufgaben üben
            </button>
          )}
        </div>
      )}

      {gruppen.map((g) => (
        <section key={g.item?.id ?? Math.random()} className="block">
          <h2 className="abschnitt">{g.item?.themaTitel ?? 'Unbekanntes Thema'}</h2>
          <p className="trefferFrage">{g.item?.frage ?? 'Item nicht mehr im Paket'}</p>
          {g.item && onNeuZeichnen && !zeichenAus && (
            <button className="textknopf" style={{ alignSelf: 'flex-start' }} onClick={() => onNeuZeichnen(g.item.id)}>
              Aufgabe erneut zeichnen
            </button>
          )}
          <div className="skizzenband" style={{ marginTop: '0.75rem' }}>
            {g.eintraege.map((s) => (
              <figure key={s.id} className="skizzenEintrag">
                <button
                  type="button"
                  className="lupenKnopf"
                  onClick={() => setGross(s)}
                  title="Vergrößern"
                >
                  <img src={s.bild} alt="" />
                </button>
                <figcaption>
                  {new Date(s.ts).toLocaleDateString('de-DE')}
                  <button className="textknopf" onClick={() => setLoeschKandidat(s)}>löschen</button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      {gross && (
        <Schleier onSchliessen={() => setGross(null)}>
          <div className="lupenBuehne" onClick={(e) => e.stopPropagation()}>
            <img src={gross.bild} alt="" />
            <p className="nebentext">{new Date(gross.ts).toLocaleString('de-DE')}</p>
            <button className="knopf schmal" onClick={() => setGross(null)}>Schließen</button>
          </div>
        </Schleier>
      )}

      {loeschKandidat && (
        <Schleier onSchliessen={() => setLoeschKandidat(null)}>
          <article className="grosseKarte gefahr" onClick={(e) => e.stopPropagation()}>
            <h2 className="ueberschrift">Bist du sicher?</h2>
            <p className="nebentext">
              Die Zeichnung vom {new Date(loeschKandidat.ts).toLocaleDateString('de-DE')} wird
              endgültig gelöscht.
            </p>
            <div className="wahl">
              <button className="knopf schmal" onClick={() => setLoeschKandidat(null)}>
                Abbrechen
              </button>
              <button
                className="knopf schmal gefahr"
                onClick={() => {
                  onLoeschen(loeschKandidat.id)
                  setLoeschKandidat(null)
                }}
              >
                Löschen
              </button>
            </div>
          </article>
        </Schleier>
      )}
    </div>
  )
}
