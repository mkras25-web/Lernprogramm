// Platzhalter, solange das Inhaltspaket laedt - aus App.jsx (52B).
export default function Ladeskelett() {
  return (
    <div className="huelle einspaltig">
      <div className="schirm" role="status" aria-label="Paket wird geladen">
        <div className="heuteRaster" aria-hidden="true">
          <div className="heuteSeite">
          <section className="stufe">
            <span className="skeleton skeletonBau" />
            <div className="stufeText">
              <span className="skeleton" style={{ width: '7rem', height: '0.75rem' }} />
              <span className="skeleton" style={{ width: '9rem', height: '1.5rem', marginTop: '0.4rem' }} />
              <span className="skeleton" style={{ width: '95%', height: '0.9375rem', marginTop: '0.6rem' }} />
              <span className="skeleton" style={{ width: '60%', height: '0.9375rem', marginTop: '0.4rem' }} />
            </div>
          </section>
          <section className="kennzahlen">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="skeleton" style={{ height: '4.25rem' }} />
            ))}
          </section>
          </div>
          <div className="heuteHaupt">
          <section className="heuteBreit heuteLernen">
            <span className="skeleton" style={{ display: 'block', height: '5rem' }} />
          </section>
          <section className="heuteBreit heuteRest">
            <span className="skeleton" style={{ display: 'block', height: '5rem' }} />
          </section>
          </div>
        </div>
      </div>
    </div>
  )
}
