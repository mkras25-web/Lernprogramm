import Bildlupe from './Bildlupe.jsx'
import SieheAuch from './SieheAuch.jsx'
import Begriffe from './Begriffe.jsx'
import { quelleText } from '../lib/quelle.js'
import { ausDemKopfLetzter } from '../lib/ausDemKopf.js'
import { bildSchluessel, nebenzielStand } from '../lib/durchsicht.js'
import { DurchsichtMarke } from './Durchsicht.jsx'

// Themenseite (F10, 2026-10-13): Ein Einstieg je Thema statt fuenf
// Bildschirmen - Erklaerung, Lernstand, Vorab-Fragen, "Aus dem Kopf",
// Lernzettel, Zeichnungen, eigene Notizen und Fehlerkarten des Themas.
// Frueher zeigte diese Seite nur das Erklaerstueck.
export default function Erklaerstueck({
  thema,
  themen,
  anzahlHeute,
  items = [],
  zustaende = new Map(),
  marken = new Map(),
  durchsicht = {},
  profilId,
  onLernen,
  onUeben,
  onErstRaten,
  onAusDemKopf,
  onLernzettel,
  onFehlerUeben,
  imFokus = false,
  onFokus,
  verwandte = [],
  onVerwandtUeben,
  onZurueck,
  onThema,
}) {
  const e = thema.erklaerung
  const gelernt = items.filter((i) => zustaende.has(i.id)).length
  const neu = items.length - gelernt
  const jetzt = Date.now()
  const faellig = items.filter((i) => (zustaende.get(i.id)?.faelligAb ?? Infinity) <= jetzt).length
  const fehlerkarten = items
    .filter((i) => (zustaende.get(i.id)?.fehler ?? 0) > 0)
    .sort((a, b) => zustaende.get(b.id).fehler - zustaende.get(a.id).fehler)
  const notizen = items.filter((i) => marken.get(i.id)?.notiz)
  const kopf = profilId ? ausDemKopfLetzter(profilId, thema.id) : null
  // Durchsicht-Marken fuer Erklaerstueck und Bilder ("offen" zeigt nichts).
  const textStand = nebenzielStand(durchsicht, marken, `erklaerung:${thema.id}`)
  const bildStand = (src) => nebenzielStand(durchsicht, marken, bildSchluessel(src))
  const zeigt = (stand) => Boolean(stand && stand.stand !== 'offen')
  const textMarke = zeigt(textStand)
  const erklaerBild = e?.bild ?? thema.bild

  // Zeichnungen des Themas (Teil von F1): jede Datei einmal.
  const zeichnungen = []
  const gesehen = new Set([e?.bild ?? thema.bild])
  for (const i of items) {
    for (const [src, text] of [
      [i.bild, i.bildunterschrift],
      [i.referenz, i.frage],
      [i.fallbild, i.frage],
      ...(i.seiten ?? []).map((s) => [s.bild, s.titel]),
    ]) {
      if (src && !gesehen.has(src)) {
        gesehen.add(src)
        zeichnungen.push({ src, text })
      }
    }
  }

  return (
    <div role="main" className="schirm themenseite">
      <button className="textknopf" onClick={onZurueck} style={{ alignSelf: 'flex-start' }}>
        Zurück
      </button>

      <div>
        <p className="herkunft">{thema.modulTitel}</p>
        <h1 className="ueberschrift">{thema.titel}</h1>
        {items.length > 0 && (
          <p className="themaStand">
            {gelernt} von {items.length} Karten begonnen
            {faellig > 0 && ` · ${faellig} fällig`}
            {fehlerkarten.length > 0 && ` · ${fehlerkarten.length} mit Fehlern`}
            {kopf && ` · aus dem Kopf zuletzt ${kopf.k} von ${kopf.n} (${new Date(kopf.ts).toLocaleDateString('de-DE')})`}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="themaAktionen">
          {neu > 0 && onErstRaten && (
            <button className="artKnopf" onClick={onErstRaten} title="Drei Fragen vor der Erklärung – zählt nicht für die Planung">
              Erst raten (3 Fragen)
            </button>
          )}
          {onAusDemKopf && (
            <button className="artKnopf" onClick={onAusDemKopf} title="Alles aufschreiben, was du zum Thema weißt, dann vergleichen">
              Aus dem Kopf
            </button>
          )}
          {onLernzettel && (
            <button className="artKnopf" onClick={onLernzettel}>
              Lernzettel
            </button>
          )}
          {onVerwandtUeben && (
            <button
              className="artKnopf"
              onClick={onVerwandtUeben}
              title={`Heutige Portion aus diesem Thema und ${verwandte.map((t) => t.titel).join(', ')} – gemischt`}
            >
              Gemischt mit {verwandte.length === 1 ? 'verwandtem Thema' : `${verwandte.length} verwandten Themen`}
            </button>
          )}
          {onFokus && (
            <button
              className="artKnopf"
              aria-pressed={imFokus}
              onClick={onFokus}
              title={imFokus ? 'Steht auf Heute unter „Thema lernen“ – nochmal tippen nimmt es heraus' : 'Auf Heute mit eigenem Lernknopf zeigen (gezielt vorbereiten)'}
            >
              {imFokus ? '✓︎ Im Fokus auf Heute' : 'In den Fokus (Heute)'}
            </button>
          )}
        </div>
      )}

      {thema.lernziele?.length > 0 && (
        <section className="lernziele">
          <h2 className="abschnitt">Lernziele</h2>
          <ul>
            {thema.lernziele.map((z, i) => <li key={i}>{z}</li>)}
          </ul>
        </section>
      )}

      <div className="erklaerung">
        <div className="erklaerungText">
          {(e?.absaetze ?? []).map((absatz, i) => (
            <p key={i} className="erklaerungAbsatz">
              <Begriffe text={absatz} />
            </p>
          ))}
          {e?.merksatz && <p className="merksatz"><Begriffe text={e.merksatz} /></p>}
        </div>

        {(e?.bild || thema.bild) && (
          <figure style={{ margin: 0 }}>
            {/* Mit Lupe (D1): die Zeichnung ist oft der wichtigste Teil. */}
            <Bildlupe src={e?.bild ?? thema.bild} alt={e?.bildunterschrift ?? ''} />
            {(e?.bildunterschrift || zeigt(bildStand(erklaerBild))) && (
              <figcaption className="quelle" style={{ paddingTop: '0.5rem' }}>
                <Begriffe text={e?.bildunterschrift} />{' '}
                <DurchsichtMarke stand={bildStand(erklaerBild)} />
              </figcaption>
            )}
          </figure>
        )}
      </div>

      {(e?.quelle || textMarke) && (
        <p className="quelle">
          {e?.quelle && quelleText(e.quelle)}{' '}
          <DurchsichtMarke stand={textStand} />
        </p>
      )}

      {zeichnungen.length > 0 && (
        <section>
          <h2 className="abschnitt">Zeichnungen im Thema ({zeichnungen.length})</h2>
          <div className="zeichnungsRaster">
            {zeichnungen.map((z) => (
              <figure key={z.src} className="zeichnungsKachel">
                <Bildlupe src={z.src} alt={z.text ?? ''} />
                {(z.text || zeigt(bildStand(z.src))) && (
                  <figcaption className="quelle">
                    <Begriffe text={z.text} />{' '}
                    <DurchsichtMarke stand={bildStand(z.src)} />
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {notizen.length > 0 && (
        <section>
          <h2 className="abschnitt">Deine Notizen ({notizen.length})</h2>
          <ul className="themaListe">
            {notizen.map((i) => (
              <li key={i.id}>
                <span className="themaListeFrage">{i.frage}</span>
                <span className="themaListeText">{marken.get(i.id).notiz}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fehlerkarten.length > 0 && (
        <section>
          <h2 className="abschnitt">Karten mit Fehlern ({fehlerkarten.length})</h2>
          <ul className="themaListe">
            {fehlerkarten.slice(0, 8).map((i) => (
              <li key={i.id}>
                <span className="themaListeFrage">{i.frage}</span>
                <span className="themaListeText">{zustaende.get(i.id).fehler}× nicht gewusst</span>
              </li>
            ))}
          </ul>
          {onFehlerUeben && (
            <button className="knopf schmal" onClick={() => onFehlerUeben(fehlerkarten.map((i) => i.id))}>
              Diese {fehlerkarten.length} üben
            </button>
          )}
        </section>
      )}

      <SieheAuch ids={thema.siehe} themen={themen} onOeffnen={onThema} />

      <div className="steuerung">
        {anzahlHeute > 0 ? (
          <button className="knopf haupt" onClick={onLernen}>
            {anzahlHeute} {anzahlHeute === 1 ? 'Item' : 'Items'} lernen
          </button>
        ) : (
          // Nichts faellig: der Knopf startete frueher still gar nichts.
          <button className="knopf haupt" onClick={onUeben}>
            Heute nichts fällig – trotzdem üben
          </button>
        )}
      </div>
    </div>
  )
}
