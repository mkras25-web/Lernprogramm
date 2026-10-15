import { useEffect, useState } from 'react'
import Schleier from '../components/Schleier.jsx'
import LokalBild from '../components/LokalBild.jsx'
import {
  MEILENSTEIN_GRUPPEN,
  MEILENSTEIN_STUFEN,
  MEILENSTEIN_SYMBOLE,
  xpFuerMeilenstein,
} from '../lib/fortschritt.js'
import Ring from '../components/Ring.jsx'

const RANGKLASSEN = { Entwurf: 'entwurf', 'Ausführung': 'ausfuehrung', Meisterschaft: 'meisterschaft' }
const rangKlasse = (rang) => RANGKLASSEN[rang] ?? 'entwurf'

// Bis zu sieben Materialstufen statt nur erreicht/nicht erreicht - siehe
// MEILENSTEIN_STUFEN in fortschritt.js. Manche Meilensteine haben weniger
// Stufen (m.ziele), z. B. nur Bronze.
function stempelTooltip(m) {
  if (m.maxStufe) {
    const hoechste = MEILENSTEIN_STUFEN[m.ziele.length - 1].name
    return `${m.titel} · ${hoechste}, höchste Stufe erreicht · ${xpFuerMeilenstein(m)} XP gesamt`
  }
  if (m.frei) {
    const aktuell = MEILENSTEIN_STUFEN[m.stufe - 1].name
    const naechste = MEILENSTEIN_STUFEN[m.stufe].name
    return `${m.titel} · ${aktuell} erreicht · ${m.stand} von ${m.ziel}${m.einheit ?? ''} für ${naechste}`
  }
  return `${m.titel} · ${m.stand} von ${m.ziel}${m.einheit ?? ''} für Bronze`
}

// Detailkarten sind kein Zufallsfund, sondern Beleg fuer Beherrschung.
// Deshalb zeigt auch die verschlossene Karte, wie weit es noch ist.
// Neu erreichte Stufen leuchten beim naechsten Oeffnen der Sammlung einmal
// auf (2026-10-15). Gemerkt wird je Geraet die zuletzt gesehene Stufe; der
// allererste Aufruf merkt nur, damit nicht alles auf einmal leuchtet.
const gesehenSchluessel = (profilId) => `meilensteineGesehen_${profilId}`
function gesehenLesen(profilId) {
  try {
    return JSON.parse(localStorage.getItem(gesehenSchluessel(profilId)) ?? 'null')
  } catch {
    return null
  }
}

export default function Sammlung({ karten, meilensteine, xpMeilensteine = 0, reiter, onThemaUeben, profilId }) {
  const [offen, setOffen] = useState(null)
  const [gruppe, setGruppe] = useState('alle')
  const [gesehen] = useState(() => (profilId ? gesehenLesen(profilId) : null))
  useEffect(() => {
    if (!profilId || !meilensteine?.length) return
    const stand = gesehenLesen(profilId) ?? {}
    for (const m of meilensteine) stand[m.id] = Math.max(stand[m.id] ?? 0, m.stufe)
    try {
      localStorage.setItem(gesehenSchluessel(profilId), JSON.stringify(stand))
    } catch {
      /* Speicher voll - dann leuchtet es eben noch einmal */
    }
  }, [profilId, meilensteine])
  const istNeu = (m) => gesehen !== null && m.stufe > (gesehen[m.id] ?? 0)

  const frei = karten.filter((k) => k.frei).length
  const alle = meilensteine ?? []
  const meilensteineFrei = alle.filter((m) => m.frei).length
  const gefiltert = gruppe === 'alle' ? alle : alle.filter((m) => m.gruppe === gruppe)
  const naechste = alle
    .filter((m) => !m.frei)
    .sort((a, b) => b.anteil - a.anteil)
    .slice(0, 3)

  return (
    <div role="main" className="schirm">
      {reiter}
      <div className="themenKopf">
        <h1 className="ueberschrift">Sammlung</h1>
        <button className="knopf schmal" onClick={() => window.print()}>
          Drucken oder als PDF sichern
        </button>
      </div>

      <section className="bereitschaft">
        <div>
          <p className="bereitschaftZahl">{frei}</p>
          <p className="kennzahlName">von {karten.length} Detailkarten</p>
        </div>
        <div>
          <p className="bereitschaftZahl">{meilensteineFrei}</p>
          <p className="kennzahlName">von {alle.length} Meilensteinen</p>
        </div>
        <div>
          <p className="bereitschaftZahl">
            {alle.length ? Math.round((meilensteineFrei / alle.length) * 100) : 0} %
          </p>
          <p className="kennzahlName">Sammlung vollständig</p>
        </div>
        <div>
          <p className="bereitschaftZahl">{xpMeilensteine}</p>
          <p className="kennzahlName">XP aus Meilensteinen</p>
        </div>
      </section>

      {naechste.length > 0 && (
        <section className="block">
          <h2 className="abschnitt">Als Nächstes erreichbar</h2>
          <ul className="naechste">
            {naechste.map((m) => (
              <li key={m.id}>
                <Ring anteil={m.anteil} groesse={38} staerke={4} />
                <div>
                  <p className="kachelZeile stark">{m.titel}</p>
                  <p className="kachelZeile">{m.stand} von {m.ziel}{m.einheit ?? ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <h2 className="abschnitt">Detailkarten</h2>
        <p className="zeileHinweis">
          Eine Detailkarte entsteht automatisch für jedes Thema, sobald mindestens 80 %
          seiner Items „sicher" oder besser sitzen (siehe Beherrschungsgrade im
          Fortschritt) – kein Zufallsfund, sondern Beleg für gelerntes Wissen. Bei 95 %
          steigt sie auf „Ausführung", und wenn 80 % der Items sogar „gemeistert" sind, auf
          „Meisterschaft". Verschlossene Karten zeigen schon den aktuellen Anteil.
        </p>
        {karten.some((k) => k.frei) && (
          <ul className="kartengitter">
            {karten.filter((k) => k.frei).map((k) => (
              <li key={k.id}>
                <button className={`karte rang-${rangKlasse(k.rang)}`} onClick={() => setOffen(k)}>
                  <div className="kartenBild">
                    {k.bild ? (
                      <LokalBild src={k.bild} alt="" platzhalter={false} />
                    ) : (
                      <span className="fortschrittZahl">{Math.round(k.anteil * 100)} %</span>
                    )}
                  </div>
                  <span className="kartenTitel">{k.titel}</span>
                  <span className="kartenRang">{k.rang}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* Verschlossene Karten flach statt grosser leerer Platzhalter (25A):
            Titel und Fortschritt bis zur Freischaltung bei 80 %. */}
        {karten.some((k) => !k.frei) && (
          <ul className="kartenVerschlossen">
            {karten.filter((k) => !k.frei).map((k) => (
              <li key={k.id} className="karteFlach">
                <span className="kartenTitel">{k.titel}</span>
                <span className="karteFlachBalken" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.round((k.anteil / 0.8) * 100))}%` }} />
                </span>
                <span className="kartenRang">{Math.round(k.anteil * 100)} % · frei ab 80 %</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <div className="themenKopf">
          <h2 className="abschnitt">Meilensteine</h2>
        </div>
        <div className="reiter">
          <button
            className={gruppe === 'alle' ? 'reiterKnopf aktiv' : 'reiterKnopf'}
            onClick={() => setGruppe('alle')}
          >
            Alle <span className="reiterZahl">{alle.length}</span>
          </button>
          {Object.entries(MEILENSTEIN_GRUPPEN).map(([id, titel]) => {
            const eigene = alle.filter((m) => m.gruppe === id)
            return (
              <button
                key={id}
                className={gruppe === id ? 'reiterKnopf aktiv' : 'reiterKnopf'}
                onClick={() => setGruppe(id)}
              >
                {titel}
                <span className="reiterZahl">
                  {eigene.filter((m) => m.frei).length}/{eigene.length}
                </span>
              </button>
            )
          })}
        </div>

        <ul className="stempelwand">
          {gefiltert.map((m) => (
            <li key={m.id}>
              <div
                className={`stempel g-${m.gruppe} ${m.frei ? `frei stufe-${m.stufe}` : 'offen'}${istNeu(m) ? ' neu' : ''}`}
                title={stempelTooltip(m)}
              >
                {istNeu(m) && <span className="stempelNeuMarke">Neu</span>}
                <span className="stempelRand" aria-hidden="true" />
                <span className="stempelZeichen" aria-hidden="true">
                  {MEILENSTEIN_SYMBOLE[m.gruppe] ?? '★︎'}
                </span>
                <span className="stempelTitel">{m.titel}</span>
                {m.frei && (
                  <span className="stempelMaterial">{MEILENSTEIN_STUFEN[m.stufe - 1].name}</span>
                )}
                <span className="stempelStufen" aria-hidden="true">
                  {MEILENSTEIN_STUFEN.slice(0, m.ziele.length).map((s) => (
                    <span
                      key={s.stufe}
                      className={s.stufe <= m.stufe ? 'stufePip erreicht' : 'stufePip'}
                    />
                  ))}
                </span>
                <span className="stempelFuss">
                  {m.maxStufe
                    ? `${MEILENSTEIN_GRUPPEN[m.gruppe]} · ${xpFuerMeilenstein(m)} XP`
                    : `${m.stand} von ${m.ziel}${m.einheit ?? ''} für ${MEILENSTEIN_STUFEN[m.stufe].name}`}
                </span>
                {!m.maxStufe && (
                  <span className="stempelBalken" aria-hidden="true">
                    <span style={{ width: `${Math.round(m.anteil * 100)}%` }} />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {offen && (
        <Schleier onSchliessen={() => setOffen(null)}>
          <article className="grosseKarte" onClick={(e) => e.stopPropagation()}>
            <p className="kartenHerkunft">{offen.modulTitel}</p>
            <h2 className="ueberschrift">{offen.titel}</h2>
            {offen.bild && <LokalBild className="grossesBild" src={offen.bild} alt="" />}
            <dl className="kartenWerte">
              <div><dt>Rang</dt><dd>{offen.rang}</dd></div>
              <div><dt>Items</dt><dd>{offen.gesamt}</dd></div>
              <div><dt>gemeistert</dt><dd>{offen.gemeistert}</dd></div>
            </dl>
            <div className="wahl">
              {onThemaUeben && (
                <button className="knopf schmal haupt" onClick={() => onThemaUeben(offen.id)}>
                  Thema wiederholen
                </button>
              )}
              <button className="knopf schmal" onClick={() => setOffen(null)}>Schließen</button>
            </div>
          </article>
        </Schleier>
      )}
    </div>
  )
}
