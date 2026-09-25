import { useMemo, useState } from 'react'
import Ring from '../components/Ring.jsx'
import { passt } from '../lib/suche.js'

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
  const [suche, setSuche] = useState('')
  const sucheAktiv = suche.trim().length > 0

  // Nach modulId gruppiert, damit die Suche nicht bei jedem Tastendruck
  // die ganze Themenliste neu durchfiltert.
  const themenNachModul = useMemo(() => {
    const karte = new Map()
    for (const t of themen) {
      if (!karte.has(t.modulId)) karte.set(t.modulId, [])
      karte.get(t.modulId).push(t)
    }
    return karte
  }, [themen])

  // Eine aktive Suche durchsucht ueber alle Fachbereiche hinweg - man
  // weiss beim Suchen selten noch, in welchem Bereich ein Thema steckt.
  const sichtbar = useMemo(() => {
    if (!sucheAktiv) return module.filter((m) => m.bereich === bereich)
    return module.filter((m) => {
      if (passt(suche, m.titel)) return true
      return (themenNachModul.get(m.id) ?? []).some((t) => passt(suche, t.titel))
    })
  }, [module, bereich, sucheAktiv, suche, themenNachModul])

  return (
    <div className="schirm">
      <div className="themenKopf">
        <h1 className="ueberschrift">Themen</h1>
        <button className="knopf schmal" onClick={() => onStart('ueben', {})}>
          Alles gemischt lernen
        </button>
      </div>

      <input
        className="suchfeld"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Thema suchen … (verzeiht Tippfehler)"
      />

      <div className="reiter" aria-hidden={sucheAktiv} style={sucheAktiv ? { opacity: 0.4 } : undefined}>
        {liste.map(([id, titel]) => {
          const eigene = module.filter((m) => m.bereich === id)
          const gesamt = eigene.reduce((s, m) => s + m.gesamt, 0)
          return (
            <button
              key={id}
              className={id === bereich ? 'reiterKnopf aktiv' : 'reiterKnopf'}
              disabled={sucheAktiv}
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

      {sucheAktiv && sichtbar.length === 0 && (
        <p className="nebentext">Kein Thema passt zu „{suche}".</p>
      )}

      {sichtbar.map((m) => {
        const offen = sucheAktiv ? true : offenesModul === m.id
        const eigeneAlle = themenNachModul.get(m.id) ?? []
        const eigene = sucheAktiv ? eigeneAlle.filter((t) => passt(suche, t.titel)) : eigeneAlle
        const leer = m.gesamt === 0
        return (
          <section key={m.id} className="block">
            <div className={leer ? 'themenzeile geplant' : 'themenzeile'} style={{ cursor: 'default' }}>
              <Ring anteil={m.anteil} groesse={40} staerke={4} />
              <div className="themaInfo">
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
              <div className="themenzeileAktionen">
                {!sucheAktiv && (
                  <button className="artKnopf" onClick={() => setOffenesModul(offen ? null : m.id)}>
                    {offen ? 'Zuklappen' : 'Themen zeigen'}
                  </button>
                )}
                {!leer && (
                  <button className="knopf schmal" onClick={() => onStart('ueben', { modulId: m.id })}>
                    Modul lernen
                  </button>
                )}
              </div>
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
                          <div className="themaInfo">
                            <p className="themaTitel">{t.titel}</p>
                            <p className="themaZeile2">noch ohne Inhalte</p>
                          </div>
                          <div className="themenzeileAktionen" />
                        </div>
                      </li>
                    )
                  }
                  return (
                    <li key={t.id}>
                      <div className="themenzeile">
                        <Ring anteil={f.anteil} groesse={34} staerke={4} />
                        <div className="themaInfo">
                          <p className="themaTitel">{t.titel}</p>
                          <p className="themaZeile2">
                            {f.sicher} von {f.gesamt} sicher
                            {f.faellig > 0 ? ` · ${f.faellig} fällig` : ''}
                          </p>
                        </div>
                        <div className="themenzeileAktionen">
                          {t.erklaerung && (
                            <button className="artKnopf" onClick={() => onErklaerung(t.id)}>
                              Erklärung
                            </button>
                          )}
                          <button
                            className="knopf schmal"
                            onClick={() => onStart('ueben', { themaId: t.id })}
                          >
                            Lernen
                          </button>
                        </div>
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
