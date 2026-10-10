import LokalBild from './LokalBild.jsx'
import SieheAuch from './SieheAuch.jsx'

export default function Erklaerstueck({ thema, themen, anzahlHeute, onLernen, onUeben, onZurueck, onThema }) {
  const e = thema.erklaerung

  return (
    <div className="schirm">
      <button className="textknopf" onClick={onZurueck} style={{ alignSelf: 'flex-start' }}>
        Zurück
      </button>

      <div>
        <p className="herkunft">{thema.modulTitel}</p>
        <h1 className="ueberschrift">{thema.titel}</h1>
      </div>

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
              {absatz}
            </p>
          ))}
          {e?.merksatz && <p className="merksatz">{e.merksatz}</p>}
        </div>

        {(e?.bild || thema.bild) && (
          <figure style={{ margin: 0 }}>
            <LokalBild className="referenz" src={e?.bild ?? thema.bild} alt="" />
            {e?.bildunterschrift && (
              <figcaption className="quelle" style={{ paddingTop: '0.5rem' }}>
                {e.bildunterschrift}
              </figcaption>
            )}
          </figure>
        )}
      </div>

      {e?.quelle && <p className="quelle">{e.quelle}</p>}

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
