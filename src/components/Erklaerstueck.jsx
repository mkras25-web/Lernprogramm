import LokalBild from './LokalBild.jsx'

export default function Erklaerstueck({ thema, onLernen, onZurueck }) {
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

      <div className="steuerung">
        <button className="knopf haupt" onClick={onLernen}>
          {thema.anzahl} Items lernen
        </button>
      </div>
    </div>
  )
}
