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

const TYPNAMEN = {
  karte: 'Karteikarte',
  mehrfachauswahl: 'Mehrfachauswahl',
  numerisch: 'Zahlenwert',
  zuordnung: 'Zuordnung',
  skizze: 'Skizze',
  reihenfolge: 'Reihenfolge',
  bildbeschriftung: 'Bildbeschriftung',
  fehlersuche: 'Fehlersuche',
  vergleich: 'Gegenüberstellung',
  freitext: 'Eigene Erklärung',
  rechnen: 'Rechenaufgabe',
}

export default function Fortschritt({ ereignisse, items, zustaende, werte, level, module }) {
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
  const rang = rangFuer(level.stufe)
  const naechster = naechsterRang(level.stufe)
  const bau = bauwerkFuer(level.stufe)

  const verteilung = GRADE.map((grad) => ({
    grad,
    anzahl: items.filter((i) => beherrschungsgrad(zustaende.get(i.id)) === grad).length,
  }))

  return (
    <div className="schirm">
      <h1 className="ueberschrift">Fortschritt</h1>

      {/* Kopfzeile: Rang, Stufe, Gesamtfortschritt */}
      <section className="fortschrittKopf">
        <Bauabschnitt stufe={level.stufe} groesse={92} />
        <div>
          <p className="rangName">
            {rang.name}
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
            anteil={aussicht.anteil}
            groesse={92}
            staerke={7}
            beschriftung={`${Math.round(aussicht.anteil * 100)}`}
          />
          <p className="nebentext">
            {aussicht.sicher} von {items.length} sicher
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
          <div className="kalender">
            {felder.map((f, i) => (
              <span
                key={i}
                className={`feld stufe${dichte(f.anzahl)}`}
                title={`${f.datum.toLocaleDateString('de-DE')}: ${f.anzahl}`}
              />
            ))}
          </div>
        </section>

        <section className="block">
          <h2 className="abschnitt">Fällig in den nächsten Tagen</h2>
          <div className="saeulen">
            {vorschau.map((anzahl, i) => (
              <div key={i} className="saeule">
                <div className="saeuleFuellung" style={{ height: `${(anzahl / maxVorschau) * 100}%` }} />
                <span className="saeuleName">{i === 0 ? 'heute' : `+${i}`}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="block">
          <h2 className="abschnitt">Beherrschung</h2>
          <ul className="verteilung">
            {verteilung.map((v) => (
              <li key={v.grad}>
                <span className="verteilungName">{v.grad}</span>
                <span className="verteilungBalken">
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
                <Bauabschnitt stufe={stufeAusAnteil(m.anteil)} groesse={44} titel={false} />
                <div>
                  <p className="kachelZeile stark">{m.titel}</p>
                  <p className="kachelZeile">
                    {reifegradFuer(m.anteil).name} · {m.sicher} von {m.gesamt} sicher
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="block heuteBreit">
          <h2 className="abschnitt">Nach Thema</h2>
          <ul className="fortschrittKacheln">
            {themen.map((t) => (
              <li key={t.id} className="fortschrittKachel">
                <Bauabschnitt stufe={stufeAusAnteil(t.anteil)} groesse={44} titel={false} />
                <div>
                  <p className="kachelZeile stark">{t.titel}</p>
                  <p className="kachelZeile">
                    {reifegradFuer(t.anteil).name} · {t.sicher} von {t.gesamt} sicher
                    {t.trefferquote !== null ? ` · ${t.trefferquote} % Treffer` : ''}
                  </p>
                </div>
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
                  <span className="baustelleFrage">{item.frage}</span>
                  <span className="baustelleZahl">{zustand.fehler}× daneben</span>
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
