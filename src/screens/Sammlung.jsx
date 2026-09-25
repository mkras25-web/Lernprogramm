import { useState } from 'react'
import {
  MEILENSTEIN_GRUPPEN,
  MEILENSTEIN_STUFEN,
  MEILENSTEIN_SYMBOLE,
  xpFuerMeilenstein,
} from '../lib/fortschritt.js'
import Ring from '../components/Ring.jsx'

const RANGKLASSEN = { Entwurf: 'entwurf', 'Ausführung': 'ausfuehrung', Meisterschaft: 'meisterschaft' }
const rangKlasse = (rang) => RANGKLASSEN[rang] ?? 'entwurf'

// Sieben Materialstufen statt nur erreicht/nicht erreicht - siehe
// MEILENSTEIN_STUFEN in fortschritt.js fuer die Ziel-Vervielfachung.
function stempelTooltip(m) {
  if (m.maxStufe) {
    return `${m.titel} · Diamant, höchste Stufe erreicht · ${xpFuerMeilenstein(m)} XP gesamt`
  }
  if (m.frei) {
    const aktuell = MEILENSTEIN_STUFEN[m.stufe - 1].name
    const naechste = MEILENSTEIN_STUFEN[m.stufe].name
    return `${m.titel} · ${aktuell} erreicht · ${m.stand} von ${m.ziel} für ${naechste}`
  }
  return `${m.titel} · ${m.stand} von ${m.ziel} für Bronze`
}

// Detailkarten sind kein Zufallsfund, sondern Beleg fuer Beherrschung.
// Deshalb zeigt auch die verschlossene Karte, wie weit es noch ist.
export default function Sammlung({ karten, meilensteine, xpMeilensteine = 0 }) {
  const [offen, setOffen] = useState(null)
  const [gruppe, setGruppe] = useState('alle')

  const frei = karten.filter((k) => k.frei).length
  const alle = meilensteine ?? []
  const meilensteineFrei = alle.filter((m) => m.frei).length
  const gefiltert = gruppe === 'alle' ? alle : alle.filter((m) => m.gruppe === gruppe)
  const naechste = alle
    .filter((m) => !m.frei)
    .sort((a, b) => b.anteil - a.anteil)
    .slice(0, 3)

  return (
    <div className="schirm">
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
                  <p className="kachelZeile">{m.stand} von {m.ziel}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <h2 className="abschnitt">Detailkarten</h2>
        <p className="zeileHinweis">
          Entsteht automatisch für jedes Thema, sobald mindestens 80 % seiner Items
          „sicher" oder besser sitzen (siehe Beherrschungsgrade im Fortschritt) - kein
          Zufallsfund, sondern Beleg für gelerntes Wissen. Ab 95 % wird die Karte zu
          „Ausführung", sobald 80 % der Items sogar „gemeistert" sind zu „Meisterschaft".
          Die verschlossene Karte zeigt schon den aktuellen Anteil.
        </p>
        <ul className="kartengitter">
          {karten.map((k) => (
            <li key={k.id}>
              <button
                className={k.frei ? `karte rang-${rangKlasse(k.rang)}` : 'karte verschlossen'}
                onClick={() => k.frei && setOffen(k)}
              >
                <div className="kartenBild">
                  {k.frei && k.bild ? (
                    <img src={k.bild} alt="" />
                  ) : (
                    <span className="fortschrittZahl">{Math.round(k.anteil * 100)} %</span>
                  )}
                </div>
                <span className="kartenTitel">{k.titel}</span>
                <span className="kartenRang">{k.frei ? k.rang : 'verschlossen'}</span>
              </button>
            </li>
          ))}
        </ul>
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
                className={`stempel g-${m.gruppe} ${m.frei ? `frei stufe-${m.stufe}` : 'offen'}`}
                title={stempelTooltip(m)}
              >
                <span className="stempelRand" aria-hidden="true" />
                <span className="stempelZeichen" aria-hidden="true">
                  {MEILENSTEIN_SYMBOLE[m.gruppe] ?? '★︎'}
                </span>
                <span className="stempelTitel">{m.titel}</span>
                {m.frei && (
                  <span className="stempelMaterial">{MEILENSTEIN_STUFEN[m.stufe - 1].name}</span>
                )}
                <span className="stempelStufen" aria-hidden="true">
                  {MEILENSTEIN_STUFEN.map((s) => (
                    <span
                      key={s.stufe}
                      className={s.stufe <= m.stufe ? 'stufePip erreicht' : 'stufePip'}
                    />
                  ))}
                </span>
                <span className="stempelFuss">
                  {m.maxStufe
                    ? `${MEILENSTEIN_GRUPPEN[m.gruppe]} · ${xpFuerMeilenstein(m)} XP`
                    : `${m.stand} von ${m.ziel} für ${MEILENSTEIN_STUFEN[m.stufe].name}`}
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
        <div className="schleier" onClick={() => setOffen(null)}>
          <article className="grosseKarte" onClick={(e) => e.stopPropagation()}>
            <p className="kartenHerkunft">{offen.modulTitel}</p>
            <h2 className="ueberschrift">{offen.titel}</h2>
            {offen.bild && <img className="grossesBild" src={offen.bild} alt="" />}
            <dl className="kartenWerte">
              <div><dt>Rang</dt><dd>{offen.rang}</dd></div>
              <div><dt>Items</dt><dd>{offen.gesamt}</dd></div>
              <div><dt>gemeistert</dt><dd>{offen.gemeistert}</dd></div>
            </dl>
            <button className="knopf" onClick={() => setOffen(null)}>Schließen</button>
          </article>
        </div>
      )}
    </div>
  )
}
