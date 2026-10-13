import {
  GRADE,
  beherrschungsgrad,
  baustellen,
  faelligkeitsvorschau,
  naechsterRang,
  prognose,
  rangFuer,
  rekorde,
  tageszeiten,
  tagesverlauf,
  themenAuswerten,
  typStatistik,
  wochenbericht,
} from '../lib/fortschritt.js'
import Ring from '../components/Ring.jsx'
import Bauabschnitt from '../components/Bauabschnitt.jsx'
import { bauwerkFuer, reifegradFuer, stufeAusAnteil } from '../lib/stufen.js'
import { TYPNAMEN } from '../lib/sichtung.js'
import { behaltensrate, wiederholungenBewerten } from '../lib/planer.js'

// Ab so vielen planungswirksamen Bewertungen lohnt das Anpassen der
// FSRS-Gewichte an die eigenen Daten (Anki-FAQ; L7, 2026-10-13).
const ANPASSEN_AB = 1000
const prozent = (x) => (x === null ? '–' : `${Math.round(x * 100)} %`)


export default function Fortschritt({
  ereignisse, items, zustaende, werte, level, gestaltung = 'arch', module,
  zielBehaltensrate = 0.9, fsrsGewichte = null,
  reiter, onThemaUeben, onModulUeben, onItemOeffnen,
}) {
  // Echte Behaltensrate bei Wiederholungen neben der Vorhersage (F6/L7).
  const wiederholungen = wiederholungenBewerten(ereignisse, { zielBehaltensrate, gewichte: fsrsGewichte?.w })
  const rate = behaltensrate(wiederholungen)
  const vierWochen = behaltensrate(wiederholungen.filter((w) => w.ts > Date.now() - 28 * 24 * 60 * 60 * 1000))
  const modulVon = new Map(items.map((i) => [i.id, i.modulTitel]))
  const jeModul = [...new Set(wiederholungen.map((w) => modulVon.get(w.itemId)).filter(Boolean))]
    .map((titel) => ({ titel, ...behaltensrate(wiederholungen.filter((w) => modulVon.get(w.itemId) === titel)) }))
    .sort((a, b) => b.anzahl - a.anzahl)
  const planungswirksam = new Set(ereignisse.map((e) => `${e.itemId}|${new Date(e.ts).toDateString()}`)).size
  const felder = tagesverlauf(ereignisse, 140)
  const vorschau = faelligkeitsvorschau(zustaende, 7)
  const maxVorschau = Math.max(1, ...vorschau)
  const stapel = baustellen(items, zustaende, 5)
  const themen = [...themenAuswerten(items, zustaende).values()].sort((a, b) => b.anteil - a.anteil)
  const woche = wochenbericht(ereignisse)
  const bestwerte = rekorde(ereignisse)
  const typen = typStatistik(items, ereignisse)
  const zeiten = tageszeiten(ereignisse)
  const maxZeit = Math.max(1, ...zeiten.map((z) => z.anzahl))
  const aussicht = prognose(items, zustaende, ereignisse)
  const rang = rangFuer(level.stufe, gestaltung)
  const naechster = naechsterRang(level.stufe, gestaltung)
  const bau = bauwerkFuer(level.stufe, gestaltung)

  const verteilung = GRADE.map((grad) => ({
    grad,
    anzahl: items.filter((i) => beherrschungsgrad(zustaende.get(i.id)) === grad).length,
  }))
  // Leitzahl (42A): angelernt oder besser - "sicher" allein stand bei
  // frischen Profilen lange auf 0 und wirkte entmutigend.
  const begonnen = verteilung.filter((v) => v.grad !== 'neu').reduce((s, v) => s + v.anzahl, 0)
  const anteilBegonnen = items.length ? begonnen / items.length : 0

  // Monatsbeschriftung ueber dem Kalender: je Wochenspalte (7 Felder) der
  // Monat, sobald er wechselt.
  const monate = []
  for (let w = 0; w * 7 < felder.length; w++) {
    const tag = felder[w * 7]?.datum
    const vorher = w > 0 ? felder[(w - 1) * 7]?.datum : null
    monate.push(tag && (!vorher || tag.getMonth() !== vorher.getMonth())
      ? tag.toLocaleDateString('de-DE', { month: 'short' })
      : '')
  }

  return (
    <div className="schirm">
      {reiter}
      <h1 className="ueberschrift">Fortschritt</h1>

      {/* Kopfzeile: Rang, Stufe, Gesamtfortschritt */}
      <section className="fortschrittKopf">
        <Bauabschnitt stufe={level.stufe} gestaltung={gestaltung} groesse={92} />
        <div>
          <p className="rangName">
            {rang.name}{' '}
            <span className="bauWerk">{bau.werk.name}</span>
          </p>
          <h2 className="ueberschrift">Stufe {level.stufe}</h2>
          <p className="nebentext">{bau.abschnitt.satz}</p>
          <div className="bauBalken">
            <span style={{ width: `${Math.round(level.anteil * 100)}%` }} />
          </div>
          <p className="nebentext">
            {level.imLevel} / {level.fuerLevel} XP
            {naechster && ` · ${naechster.name} ab Stufe ${naechster.ab}`}
          </p>
        </div>
        <div className="fortschrittGesamt">
          <Ring
            anteil={anteilBegonnen}
            groesse={92}
            staerke={7}
            beschriftung={`${Math.round(anteilBegonnen * 100)} %`}
          />
          <p className="nebentext">
            {begonnen} von {items.length} angelernt oder besser · davon {aussicht.sicher} sicher
            {aussicht.wochen ? ` · Rest in etwa ${aussicht.wochen} Wochen` : ''}
          </p>
        </div>
      </section>

      <div className="fortschrittRaster">
        <section className="kennzahlen heuteBreit">
          <Kennzahl wert={level.xp} bezeichnung="XP gesamt" />
          <Kennzahl wert={werte.antwortenGesamt} bezeichnung="Antworten" />
          <Kennzahl wert={werte.trefferquote ?? '–'} einheit="%" bezeichnung="Treffer" />
          <Kennzahl wert={bestwerte.gesamtMinuten} einheit="min" bezeichnung="Lernzeit" />
        </section>

        {/* Bestwerte */}
        <section className="block heuteBreit">
          <h2 className="abschnitt">Bestwerte</h2>
          <ul className="bestwerte">
            <Bestwert
              zeichen="▲"
              wert={bestwerte.besterTag.anzahl}
              name="Antworten an einem Tag"
              zusatz={bestwerte.besterTag.datum &&
                new Date(bestwerte.besterTag.datum).toLocaleDateString('de-DE')}
            />
            <Bestwert
              zeichen="◷"
              wert={`${bestwerte.laengsterTag.minuten} min`}
              name="längste Sitzung an einem Tag"
              zusatz={bestwerte.laengsterTag.datum &&
                new Date(bestwerte.laengsterTag.datum).toLocaleDateString('de-DE')}
            />
            <Bestwert zeichen="◆" wert={bestwerte.laengsteSerie} name="längste Serie in Tagen" />
            <Bestwert zeichen="●" wert={bestwerte.aktiveTage} name="aktive Tage insgesamt" />
            <Bestwert zeichen="≈" wert={bestwerte.schnitt} name="Antworten je aktivem Tag" />
            <Bestwert
              zeichen="★"
              wert={verteilung.find((v) => v.grad === 'gemeistert')?.anzahl ?? 0}
              name="gemeisterte Items"
            />
          </ul>
        </section>

        <section className="block">
          <h2 className="abschnitt">Diese Woche</h2>
          <div className="kennzahlen">
            <Vergleich wert={woche.diese.antworten} vorher={woche.letzte.antworten} bezeichnung="Antworten" />
            <Vergleich wert={woche.diese.minuten} vorher={woche.letzte.minuten} einheit="min" bezeichnung="Lernzeit" />
            <Vergleich wert={woche.diese.tage} vorher={woche.letzte.tage} bezeichnung="Tage" />
            <Vergleich
              wert={woche.diese.trefferquote ?? 0}
              vorher={woche.letzte.trefferquote ?? 0}
              einheit="%"
              bezeichnung="Treffer"
            />
          </div>
        </section>

        <section className="block">
          <h2 className="abschnitt">Wann du lernst</h2>
          <div className="saeulen">
            {zeiten.map((z) => (
              <div key={z.id} className="saeule">
                <span className="saeuleZahl">{z.anzahl}</span>
                <div
                  className="saeuleFuellung"
                  style={{ height: `${(z.anzahl / maxZeit) * 100}%` }}
                  title={`${z.anzahl} Antworten`}
                />
                <span className="saeuleName">{z.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="block">
          <h2 className="abschnitt">Letzte zwanzig Wochen</h2>
          <div className="kalenderMonate" aria-hidden="true">
            {monate.map((m, i) => <span key={i}>{m}</span>)}
          </div>
          <div className="kalender">
            {felder.map((f, i) => (
              <span
                key={i}
                className={`feld stufe${dichte(f.anzahl)}`}
                title={`${f.datum.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}: ${f.anzahl} ${f.anzahl === 1 ? 'Antwort' : 'Antworten'}`}
              />
            ))}
          </div>
          <div className="kalenderLegende" aria-hidden="true">
            <span>weniger</span>
            {[0, 1, 2, 3, 4].map((st) => <span key={st} className={`feld stufe${st}`} />)}
            <span>mehr</span>
          </div>
        </section>

        <section className="block faelligBlock">
          <h2 className="abschnitt">Fällig in den nächsten Tagen</h2>
          <div className="saeulen">
            {vorschau.map((anzahl, i) => (
              <div key={i} className="saeule">
                <span className="saeuleZahl">{anzahl}</span>
                <div className="saeuleFuellung" style={{ height: `${(anzahl / maxVorschau) * 100}%` }} title={`${anzahl} fällig`} />
                <span className="saeuleName">{i === 0 ? 'heute' : `+${i}`}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="block heuteBreit">
          <h2 className="abschnitt">Behaltensrate</h2>
          {rate.anzahl === 0 ? (
            <p className="nebentext">Noch keine Wiederholungen – sobald Karten wiederkommen, steht hier, wie viel du davon wirklich wusstest.</p>
          ) : (
            <>
              <p className="nebentext">
                Bei {rate.anzahl} Wiederholungen wusstest du {prozent(rate.tatsaechlich)}. Die Planung hatte{' '}
                {prozent(rate.vorhergesagt)} erwartet, dein Ziel ist {prozent(zielBehaltensrate)}.
                {vierWochen.anzahl > 0 && ` Letzte vier Wochen: ${prozent(vierWochen.tatsaechlich)} bei ${vierWochen.anzahl} Wiederholungen.`}
              </p>
              <p className="zeileHinweis">
                {rate.anzahl < 50
                  ? 'Noch wenige Wiederholungen – die Zahl schwankt stark.'
                  : rate.tatsaechlich < zielBehaltensrate - 0.05
                    ? 'Du behältst deutlich weniger als angestrebt: ein höheres Ziel in den Einstellungen bringt mehr, aber kürzere Wiederholungsabstände.'
                    : rate.tatsaechlich > zielBehaltensrate + 0.05
                      ? 'Du behältst mehr als angestrebt – ein etwas niedrigeres Ziel spart Wiederholungen.'
                      : 'Ziel und Wirklichkeit passen zusammen.'}
              </p>
              {jeModul.length > 1 && (
                <ul className="verteilung">
                  {jeModul.map((m) => (
                    <li key={m.titel}>
                      <span className="verteilungName">{m.titel}</span>
                      <span className="verteilungBalken">
                        <span style={{ width: `${Math.round(m.tatsaechlich * 100)}%` }} />
                      </span>
                      <span className="verteilungZahl">{prozent(m.tatsaechlich)} · {m.anzahl}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="zeileHinweis">
                {fsrsGewichte?.w
                  ? `Planung mit eigenen Gewichten (berechnet aus ${fsrsGewichte.basis ?? '?'} Bewertungen).`
                  : planungswirksam >= ANPASSEN_AB
                    ? `${planungswirksam} Bewertungen – genug, um die Planung an dich anzupassen: Einspielen\fsrs_anpassen.py, Ergebnis in den Einstellungen eintragen.`
                    : `Anpassen der Planung an dich lohnt ab etwa ${ANPASSEN_AB} Bewertungen (bisher ${planungswirksam}).`}
              </p>
            </>
          )}
        </section>

        <section className="block">
          <h2 className="abschnitt">Beherrschung</h2>
          <ul className="verteilung">
            {verteilung.map((v) => (
              <li key={v.grad}>
                <span className="verteilungName">{v.grad}</span>
                <span className={`verteilungBalken grad-${v.grad}`}>
                  <span style={{ width: `${items.length ? (v.anzahl / items.length) * 100 : 0}%` }} />
                </span>
                <span className="verteilungZahl">{v.anzahl}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="block">
          <h2 className="abschnitt">Nach Aufgabenart</h2>
          {typen.length === 0 ? (
            <p className="nebentext">Noch keine Antworten.</p>
          ) : (
            <ul className="verteilung">
              {typen.map((t) => (
                <li key={t.typ}>
                  <span className="verteilungName">{TYPNAMEN[t.typ] ?? t.typ}</span>
                  <span className="verteilungBalken">
                    <span style={{ width: `${t.quote}%` }} />
                  </span>
                  <span className="verteilungZahl">{t.quote}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Module und Themen als kompakte Kacheln statt langer Balken */}
        <section className="block heuteBreit">
          <h2 className="abschnitt">Nach Modul</h2>
          <ul className="fortschrittKacheln">
            {(module ?? []).filter((m) => m.gesamt > 0).map((m) => (
              <li key={m.id} className="fortschrittKachel">
                <Ring anteil={m.anteil} groesse={40} staerke={4} />
                <div>
                  <p className="kachelZeile stark">{m.titel}</p>
                  <p className="kachelZeile">
                    {reifegradFuer(m.anteil, gestaltung, m.begonnen > 0).name} · {m.sicher} von {m.gesamt} sicher
                  </p>
                </div>
                {onModulUeben && (
                  <button className="artKnopf kachelAktion" onClick={() => onModulUeben(m.id)}>Üben</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="block heuteBreit">
          <h2 className="abschnitt">Nach Thema</h2>
          <ul className="fortschrittKacheln">
            {themen.map((t) => (
              <li key={t.id} className="fortschrittKachel">
                <Ring anteil={t.anteil} groesse={40} staerke={4} />
                <div>
                  <p className="kachelZeile stark">{t.titel}</p>
                  <p className="kachelZeile">
                    {reifegradFuer(t.anteil, gestaltung, t.trefferquote !== null).name} · {t.sicher} von {t.gesamt} sicher
                    {t.trefferquote !== null ? ` · ${t.trefferquote} % Treffer` : ''}
                  </p>
                </div>
                {onThemaUeben && (
                  <button className="artKnopf kachelAktion" onClick={() => onThemaUeben(t.id)}>Üben</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {stapel.length > 0 && (
          <section className="block heuteBreit">
            <h2 className="abschnitt">Baustellen</h2>
            <ul className="baustellen">
              {stapel.map(({ item, zustand }) => (
                <li key={item.id}>
                  <button className="trefferOeffnen" onClick={() => onItemOeffnen?.(item.id)}>
                    <span className="baustelleFrage">{item.frage}</span>
                    <span className="baustelleZahl">{zustand.fehler}× daneben · Öffnen →</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function dichte(anzahl) {
  if (anzahl === 0) return 0
  if (anzahl < 8) return 1
  if (anzahl < 20) return 2
  if (anzahl < 35) return 3
  return 4
}

function Bestwert({ zeichen, wert, name, zusatz }) {
  return (
    <li className="bestwert">
      <span className="bestwertZeichen" aria-hidden="true">{zeichen}</span>
      <span className="bestwertZahl">{wert}</span>
      <span className="bestwertName">{name}</span>
      {zusatz && <span className="bestwertZusatz">{zusatz}</span>}
    </li>
  )
}

function Vergleich({ wert, vorher, einheit, bezeichnung }) {
  const unterschied = wert - vorher
  return (
    <div className="kennzahl">
      <p className="kennzahlWert">
        {wert}
        {einheit && <span className="kennzahlEinheit"> {einheit}</span>}
      </p>
      <p className="kennzahlName">
        {bezeichnung}
        {vorher > 0 && (
          <span className={unterschied >= 0 ? ' besser' : ' schlechter'}>
            {' '}{unterschied >= 0 ? '+' : ''}{unterschied}
          </span>
        )}
      </p>
    </div>
  )
}

function Kennzahl({ wert, einheit, bezeichnung }) {
  return (
    <div className="kennzahl">
      <p className="kennzahlWert">
        {wert}
        {einheit && <span className="kennzahlEinheit"> {einheit}</span>}
      </p>
      <p className="kennzahlName">{bezeichnung}</p>
    </div>
  )
}
