import { useMemo, useState } from 'react'
import { wochenverlauf } from '../lib/fortschritt.js'

// Lernwochen (Fortschritt, 2026-10-15): ersetzt das 7x20-Raster ("Letzte
// zwanzig Wochen"), das ohne Wochentage und Zahlen nicht lesbar war.
// Ergebnis einer Gutachterrunde: Wochenzeilen Mo-So wie der Kalender-
// Bildschirm, neueste oben, links das Montagsdatum, rechts die Wochensumme,
// nur Wochen seit der ersten Antwort (erst 10, auf Wunsch bis 20).
// Details per Antippen statt Tooltip - am iPhone gibt es kein Hover.
const STANDARD_WOCHEN = 10
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const SCHWELLEN = ['0', '1–7', '8–19', '20–34', '35+']

export function dichte(anzahl) {
  if (anzahl === 0) return 0
  if (anzahl < 8) return 1
  if (anzahl < 20) return 2
  if (anzahl < 35) return 3
  return 4
}

const kurz = (d) => `${d.getDate()}.${d.getMonth() + 1}.`
const lang = (d) => d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
const quote = (richtig, anzahl) => (anzahl ? ` · ${Math.round((richtig / anzahl) * 100)} % gewusst` : '')
const antworten = (n) => `${n} ${n === 1 ? 'Antwort' : 'Antworten'}`

export default function Lernwochen({ ereignisse }) {
  const [alle, setAlle] = useState(false)
  // { woche: index } oder { woche: index, tag: 0-6 }
  const [auswahl, setAuswahl] = useState(null)
  const verlauf = useMemo(() => wochenverlauf(ereignisse, { maxWochen: 20 }), [ereignisse])
  const gesamt = useMemo(() => {
    const tage = new Set(ereignisse.map((e) => new Date(e.ts).toDateString())).size
    return { tage, schnitt: tage ? Math.round(ereignisse.length / tage) : 0 }
  }, [ereignisse])

  const wochen = alle ? verlauf.wochen : verlauf.wochen.slice(0, STANDARD_WOCHEN)
  const diese = verlauf.wochen[0]
  const lerntageDiese = diese.tage.filter((t) => t.anzahl > 0).length

  let detail
  const gewaehlteWoche = auswahl ? verlauf.wochen[auswahl.woche] : null
  if (gewaehlteWoche && auswahl.tag === undefined) {
    const w = gewaehlteWoche
    const tage = w.tage.filter((t) => t.anzahl > 0).length
    const minuten = w.tage.reduce((s, t) => s + t.minuten, 0)
    const richtig = w.tage.reduce((s, t) => s + t.richtig, 0)
    detail = w.summe
      ? `Woche ab ${kurz(w.montag)}: ${antworten(w.summe)} an ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} · ${minuten} min${quote(richtig, w.summe)}`
      : `Woche ab ${kurz(w.montag)}: nicht gelernt`
  } else {
    const t = gewaehlteWoche ? gewaehlteWoche.tage[auswahl.tag] : diese.tage.find((x) => x.heute)
    const name = t.heute ? 'Heute' : lang(t.datum)
    detail = t.anzahl
      ? `${name}: ${antworten(t.anzahl)} · ${t.minuten} min${quote(t.richtig, t.anzahl)}`
      : `${name}: ${t.heute ? 'noch nichts gelernt' : 'nicht gelernt'}`
  }
  const waehlen = (neu) =>
    setAuswahl((alt) => (alt && alt.woche === neu.woche && alt.tag === neu.tag ? null : neu))

  return (
    <section className="block lernwochenBlock">
      <h2 className="abschnitt">Lernwochen</h2>
      <div className="lernwochen">
        <div className="lernwochenTabelle" role="table" aria-label="Antworten je Tag, eine Zeile je Woche von Montag bis Sonntag">
          <div className="lwZeile lwKopf" role="row">
            <span role="columnheader" className="lwEcke">Woche</span>
            {WOCHENTAGE.map((t) => <span key={t} role="columnheader">{t}</span>)}
            <span role="columnheader" className="lwSumme">Antw.</span>
          </div>
          {wochen.map((w, wi) => {
            // Monatsname, sobald der Monat gegenueber der (aelteren) Zeile
            // darunter wechselt - und in der untersten Zeile.
            const aelter = wochen[wi + 1]
            const monat = !aelter || aelter.montag.getMonth() !== w.montag.getMonth()
              ? w.montag.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')
              : null
            const wocheGewaehlt = auswahl?.woche === wi && auswahl.tag === undefined
            return (
              <div key={w.montag.getTime()} role="row" className={wocheGewaehlt ? 'lwZeile gewaehlt' : 'lwZeile'}>
                <button
                  type="button"
                  role="rowheader"
                  className="lwDatum"
                  aria-pressed={wocheGewaehlt}
                  aria-label={`Woche ab ${lang(w.montag)}: ${antworten(w.summe)}`}
                  onClick={() => waehlen({ woche: wi })}
                >
                  {monat && <strong>{monat}</strong>}
                  {kurz(w.montag)}
                </button>
                {w.tage.map((t, ti) => {
                  const leer = t.zukunft || t.vorBeginn
                  const gewaehlt = auswahl?.woche === wi && auswahl.tag === ti
                  const klasse = [
                    'feld',
                    `stufe${dichte(t.anzahl)}`,
                    t.heute && 'heute',
                    t.zukunft && 'zukunft',
                    t.vorBeginn && 'vorBeginn',
                    gewaehlt && 'gewaehlt',
                  ].filter(Boolean).join(' ')
                  return leer ? (
                    <span key={ti} role="cell" className={klasse} aria-label={`${lang(t.datum)}: ${t.zukunft ? 'noch nicht' : 'vor Beginn'}`} />
                  ) : (
                    <button
                      key={ti}
                      type="button"
                      role="cell"
                      className={klasse}
                      aria-pressed={gewaehlt}
                      aria-label={`${lang(t.datum)}: ${antworten(t.anzahl)}`}
                      title={`${lang(t.datum)}: ${antworten(t.anzahl)}`}
                      onClick={() => waehlen({ woche: wi, tag: ti })}
                    />
                  )
                })}
                <span role="cell" className={w.summe ? 'lwSumme' : 'lwSumme null'}>{w.summe || '–'}</span>
              </div>
            )
          })}
        </div>

        <div className="lernwochenSeite">
          <p className="lwKennzahl">
            <strong>Diese Woche:</strong> {lerntageDiese} von 7 Tagen · {antworten(diese.summe)}
          </p>
          <p className="lwKennzahl">
            <strong>Lerntage gesamt:</strong> {gesamt.tage}
            {gesamt.tage > 0 && ` · Ø ${gesamt.schnitt} Antworten pro Lerntag`}
          </p>
          <p className="lwDetail" aria-live="polite">{detail}</p>
          <p className="lwHinweis">Tag oder Woche antippen für Einzelheiten.</p>
          <div className="lwLegende" aria-label="Farbstufen: Antworten pro Tag">
            {SCHWELLEN.map((s, i) => (
              <span key={s} className="lwLegendeStufe">
                <span className={`feld stufe${i}`} aria-hidden="true" />
                <span>{s}</span>
              </span>
            ))}
            <span className="lwLegendeText">Antworten pro Tag</span>
          </div>
        </div>
      </div>
      {verlauf.wochen.length > STANDARD_WOCHEN && (
        <button type="button" className="textknopf lwMehr" onClick={() => setAlle((a) => !a)}>
          {alle ? `Nur die letzten ${STANDARD_WOCHEN} Wochen zeigen` : `Ältere Wochen zeigen (${verlauf.wochen.length - STANDARD_WOCHEN})`}
        </button>
      )}
    </section>
  )
}
