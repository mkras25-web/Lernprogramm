import { useState } from 'react'
import Ring from '../components/Ring.jsx'

// Drei Ebenen: alles, ein Modul, ein einzelnes Thema. Darueber liegen
// Fachbereiche - sie beschreiben das Fach. Wann etwas dran ist, steht
// getrennt davon in der Phase.
export default function Themen({
  module,
  themen,
  themenFortschritt,
  bereiche,
  phasen,
  onStart,
  onErklaerung,
}) {
  const liste = Object.entries(bereiche ?? {})
  const [bereich, setBereich] = useState(liste[0]?.[0] ?? null)
  const [offenesModul, setOffenesModul] = useState(null)

  const sichtbar = module.filter((m) => m.bereich === bereich)

  return (
    <div className="schirm">
      <div className="themenKopf">
        <h1 className="ueberschrift">Themen</h1>
        <button className="knopf schmal" onClick={() => onStart('ueben', {})}>
          Alles gemischt lernen
        </button>
      </div>

      <div className="reiter">
        {liste.map(([id, titel]) => {
          const eigene = module.filter((m) => m.bereich === id)
          const gesamt = eigene.reduce((s, m) => s + m.gesamt, 0)
          return (
            <button
              key={id}
              className={id === bereich ? 'reiterKnopf aktiv' : 'reiterKnopf'}
              onClick={() => {
                setBereich(id)
                setOffenesModul(null)
              }}
            >
              {titel}
              {gesamt > 0 && <span className="reiterZahl">{gesamt}</span>}
            </button>
          )
        })}
      </div>

      {sichtbar.map((m) => {
        const offen = offenesModul === m.id
        const eigene = themen.filter((t) => t.modulId === m.id)
        const leer = m.gesamt === 0
        return (
          <section key={m.id} className="block">
            <div className={leer ? 'themenzeile geplant' : 'themenzeile'} style={{ cursor: 'default' }}>
              <Ring anteil={m.anteil} groesse={40} staerke={4} />
              <div>
                <p className="themaTitel">
                  {m.titel}
                  <span className={`phaseMarke phase-${m.phase}`}>{phasen?.[m.phase]}</span>
                </p>
                <p className="themaZeile2">
                  {leer
                    ? `${eigene.length} Themen geplant, noch ohne Inhalte`
                    : `${m.themen} Themen · ${m.sicher} von ${m.gesamt} sicher` +
                      (m.faellig > 0 ? ` · ${m.faellig} fällig` : '')}
                </p>
              </div>
              <button className="artKnopf" onClick={() => setOffenesModul(offen ? null : m.id)}>
                {offen ? 'Zuklappen' : 'Themen zeigen'}
              </button>
              {leer ? (
                <span />
              ) : (
                <button className="knopf schmal" onClick={() => onStart('ueben', { modulId: m.id })}>
                  Modul lernen
                </button>
              )}
            </div>

            {offen && (
              <ul className="themenliste">
                {eigene.map((t) => {
                  const f = themenFortschritt.get(t.id) ?? {
                    anteil: 0, sicher: 0, gesamt: t.anzahl, faellig: 0,
                  }
                  if (t.geplant) {
                    return (
                      <li key={t.id}>
                        <div className="themenzeile geplant">
                          <Ring anteil={0} groesse={34} staerke={4} />
                          <div>
                            <p className="themaTitel">{t.titel}</p>
                            <p className="themaZeile2">noch ohne Inhalte</p>
                          </div>
                          <span />
                          <span />
                        </div>
                      </li>
                    )
                  }
                  return (
                    <li key={t.id}>
                      <div className="themenzeile">
                        <Ring anteil={f.anteil} groesse={34} staerke={4} />
                        <div>
                          <p className="themaTitel">{t.titel}</p>
                          <p className="themaZeile2">
                            {f.sicher} von {f.gesamt} sicher
                            {f.faellig > 0 ? ` · ${f.faellig} fällig` : ''}
                          </p>
                        </div>
                        {t.erklaerung ? (
                          <button className="artKnopf" onClick={() => onErklaerung(t.id)}>
                            Erklärung
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          className="knopf schmal"
                          onClick={() => onStart('ueben', { themaId: t.id })}
                        >
                          Lernen
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
