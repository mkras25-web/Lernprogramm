import { useMemo, useState } from 'react'
import {
  PRUEFUNGSARTEN,
  REIFE_SCHWELLE,
  auswerten,
  ergebnisRechnen,
  gepruefteItems,
  monatspruefungFaellig,
  offeneWiederholungen,
  pruefungBauen,
  pruefungsplan,
} from '../lib/pruefung.js'
import { punkteFuer } from '../lib/punkte.js'
import Bildpunkte from '../components/Bildpunkte.jsx'
import LokalBild from '../components/LokalBild.jsx'

export default function Pruefung({
  items, themen, zustaende, module, bereiche, pruefungen, onSpeichern, onFehlerLernen,
}) {
  const [lauf, setLauf] = useState(null)
  const [position, setPosition] = useState(0)
  const [antworten, setAntworten] = useState({})
  const [markiert, setMarkiert] = useState(new Set())
  const [auswertung, setAuswertung] = useState(null)

  const faellig = useMemo(() => monatspruefungFaellig(pruefungen), [pruefungen])
  const verfuegbar = useMemo(() => gepruefteItems(items).length, [items])
  const wiederholungen = useMemo(() => offeneWiederholungen(pruefungen), [pruefungen])
  const plan = useMemo(
    () => pruefungsplan(themen, items, zustaende, pruefungen),
    [themen, items, zustaende, pruefungen]
  )

  const themenReife = useMemo(
    () =>
      themen
        .filter((t) => !t.geplant)
        .map((t) => {
          const eigene = gepruefteItems(items, { themaId: t.id })
          const letzte = pruefungen
            .filter((p) => p.themaId === t.id)
            .sort((a, b) => b.ts - a.ts)[0]
          const begonnen = eigene.some((i) => zustaende.has(i.id))
          return { thema: t, anzahl: eigene.length, reif: eigene.length >= REIFE_SCHWELLE, letzte, begonnen }
        })
        .sort((a, b) => b.anzahl - a.anzahl),
    [themen, items, pruefungen, zustaende]
  )

  const bereichsReife = useMemo(
    () =>
      Object.entries(bereiche ?? {}).map(([id, titel]) => {
        const eigene = gepruefteItems(items, { bereich: id })
        const letzte = pruefungen
          .filter((p) => p.bereichId === id)
          .sort((a, b) => b.ts - a.ts)[0]
        return { id, titel, anzahl: eigene.length, reif: eigene.length >= REIFE_SCHWELLE * 2, letzte }
      }),
    [bereiche, items, pruefungen]
  )

  function starten(art, zusatz = {}) {
    const vorgabe = PRUEFUNGSARTEN[art]
    const gewaehlt = pruefungBauen(items, zustaende, {
      anzahl: vorgabe.anzahl,
      bereich: zusatz.bereich ?? {},
      nurIds: zusatz.nurIds ?? null,
    })
    if (gewaehlt.length === 0) return
    setLauf({
      art,
      titel: zusatz.titel ?? vorgabe.titel,
      themaId: zusatz.bereich?.themaId ?? null,
      bereichId: zusatz.bereich?.bereich ?? null,
      items: gewaehlt,
      start: Date.now(),
    })
    setPosition(0)
    setAntworten({})
    setMarkiert(new Set())
    setAuswertung(null)
  }

  function abgeben() {
    setAuswertung({
      ergebnisse: auswerten(lauf.items, antworten),
      dauerMs: Date.now() - lauf.start,
    })
  }

  function urteilSetzen(itemId, richtig) {
    setAuswertung((alt) => ({
      ...alt,
      ergebnisse: alt.ergebnisse.map((e) =>
        e.item.id === itemId
          ? { ...e, erreicht: richtig ? e.punkte : 0, anteil: richtig ? 1 : 0 }
          : e
      ),
    }))
  }

  function abschliessen() {
    const zahlen = ergebnisRechnen(auswertung.ergebnisse)
    onSpeichern({
      art: lauf.art,
      titel: lauf.titel,
      themaId: lauf.themaId,
      bereichId: lauf.bereichId,
      ...zahlen,
      dauerMs: auswertung.dauerMs,
      items: auswertung.ergebnisse.map((e) => ({
        itemId: e.item.id,
        anteil: e.anteil,
        erreicht: e.erreicht,
        punkte: e.punkte,
      })),
    })
    setLauf(null)
    setAuswertung(null)
  }

  // ---------- Ergebnisblatt ----------
  if (auswertung) {
    const offen = auswertung.ergebnisse.filter((e) => e.erreicht === null)
    const zahlen = ergebnisRechnen(auswertung.ergebnisse)
    const fehler = auswertung.ergebnisse.filter((e) => e.anteil !== null && e.anteil < 1)

    return (
      <div className="schirm">
        <div className="themenKopf">
          <h1 className="ueberschrift">{lauf.titel} – Auswertung</h1>
          <button className="knopf schmal" onClick={() => window.print()}>Drucken</button>
        </div>

        <section className={zahlen.bestanden ? 'ergebnisblatt bestanden' : 'ergebnisblatt durchgefallen'}>
          <div className="ergebnisZahl">
            <span className="ergebnisProzent">{zahlen.prozent}</span>
            <span className="ergebnisEinheit">%</span>
          </div>
          <div>
            <p className="aufrufZahl">{zahlen.note}</p>
            <p className="nebentext">
              {zahlen.erreicht} von {zahlen.moeglich} Punkten · {auswertung.ergebnisse.length} Fragen
              · {Math.round(auswertung.dauerMs / 60000)} Minuten
            </p>
            {!zahlen.bestanden && (
              <p className="nebentext warnton">
                Nicht bestanden. Eine Wiederholung dieser Prüfung ist erforderlich.
              </p>
            )}
          </div>
        </section>

        {offen.length > 0 && (
          <p className="nebentext">
            {offen.length} frei formulierte Antworten musst du selbst beurteilen. Vergleiche mit
            der Musterantwort und entscheide ehrlich – ungenau zählt als falsch.
          </p>
        )}

        <ul className="treffer">
          {auswertung.ergebnisse.map((e) => (
            <li key={e.item.id} className="trefferKarte">
              <p className="herkunft">
                {e.item.modulTitel} · {e.item.themaTitel}
                <span className="punkteMarke">{e.punkte} P</span>
                {e.erreicht !== null && (
                  <span className={e.anteil === 1 ? 'kategorieMarke k-relevant' : 'kategorieMarke k-streichen'}>
                    {e.erreicht} von {e.punkte}
                  </span>
                )}
                {markiert.has(e.item.id) && <span className="kategorieMarke k-spaeter">markiert</span>}
              </p>
              <p className="trefferFrage">{e.item.frage}</p>
              {typeof e.eingabe === 'string' && e.eingabe.trim() && (
                <p className="eigeneAntwort">Deine Antwort: {e.eingabe}</p>
              )}
              <p className="trefferAntwort">{e.item.antwort}</p>

              {e.erreicht === null && (
                <div className="wahl">
                  <button className="wahlKnopf" onClick={() => urteilSetzen(e.item.id, true)}>
                    gewusst
                  </button>
                  <button className="wahlKnopf" onClick={() => urteilSetzen(e.item.id, false)}>
                    nicht gewusst
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="steuerung">
          <button className="knopf haupt" disabled={offen.length > 0} onClick={abschliessen}>
            {offen.length > 0 ? `Noch ${offen.length} zu beurteilen` : 'Ergebnis speichern'}
          </button>
          {offen.length === 0 && fehler.length > 0 && (
            <div className="wahl">
              <button
                className="knopf schmal"
                onClick={() => {
                  abschliessen()
                  onFehlerLernen(fehler.map((e) => e.item.id))
                }}
              >
                Fehler jetzt lernen ({fehler.length})
              </button>
              <button
                className="knopf schmal"
                onClick={() => {
                  const ids = fehler.map((e) => e.item.id)
                  abschliessen()
                  setTimeout(() => starten('nach', { nurIds: ids, titel: 'Nachprüfung' }), 0)
                }}
              >
                Nachprüfung starten
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---------- Laufende Pruefung ----------
  if (lauf) {
    const item = lauf.items[position]
    const beantwortet = lauf.items.filter((i) => antworten[i.id] !== undefined).length

    return (
      <div className="schirm lernschirm">
        <header className="lernkopf">
          <button className="textknopf" onClick={() => setLauf(null)}>Abbrechen</button>
          <div className="schnitt">
            {lauf.items.map((i, n) => (
              <span
                key={i.id}
                className={
                  antworten[i.id] !== undefined
                    ? 'schicht voll'
                    : n === position
                      ? 'schicht aktiv'
                      : 'schicht'
                }
              />
            ))}
          </div>
          <span className="pensumZahl">
            {position + 1}/{lauf.items.length} · {beantwortet} beantwortet
          </span>
        </header>

        <article className="karteninhalt" style={{ margin: '0 auto', width: '100%' }}>
          <p className="herkunft">
            {item.modulTitel} · {item.themaTitel}
            <span className="punkteMarke">{punkteFuer(item)} P</span>
          </p>
          <h1 className="frage">{item.frage}</h1>
          <PruefEingabe
            item={item}
            wert={antworten[item.id]}
            setWert={(w) => setAntworten({ ...antworten, [item.id]: w })}
          />
          <div className="marken">
            <button
              className={markiert.has(item.id) ? 'markenKnopf aktiv' : 'markenKnopf'}
              onClick={() =>
                setMarkiert((alt) => {
                  const neu = new Set(alt)
                  neu.has(item.id) ? neu.delete(item.id) : neu.add(item.id)
                  return neu
                })
              }
            >
              ⚑ Zur Nachkontrolle markieren
            </button>
          </div>
        </article>

        <div className="steuerung">
          <div className="arten">
            {position > 0 && (
              <button className="artKnopf" onClick={() => setPosition(position - 1)}>Zurück</button>
            )}
            {position < lauf.items.length - 1 ? (
              <button className="knopf haupt schmal" onClick={() => setPosition(position + 1)}>
                Weiter
              </button>
            ) : (
              <button className="knopf haupt schmal" onClick={abgeben}>Prüfung abgeben</button>
            )}
            {markiert.size > 0 && (
              <button
                className="artKnopf"
                onClick={() => {
                  const naechste = lauf.items.findIndex((i) => markiert.has(i.id))
                  if (naechste >= 0) setPosition(naechste)
                }}
              >
                Zu markierter Frage ({markiert.size})
              </button>
            )}
          </div>
          <p className="nebentext" style={{ marginTop: '0.75rem' }}>
            Keine Rückmeldung vor der Abgabe. Unbeantwortete Fragen zählen als falsch.
          </p>
        </div>
      </div>
    )
  }

  // ---------- Übersicht ----------
  const historie = [...pruefungen].sort((a, b) => b.ts - a.ts)
  const beste = historie.reduce((m, p) => (p.prozent > (m?.prozent ?? -1) ? p : m), null)
  const reifeThemen = themenReife.filter((t) => t.reif).length

  return (
    <div className="schirm">
      <h1 className="ueberschrift">Prüfungen</h1>

      <section className="bereitschaft">
        <div>
          <p className="bereitschaftZahl">{verfuegbar}</p>
          <p className="kennzahlName">geprüfte Items bereit</p>
        </div>
        <div>
          <p className="bereitschaftZahl">{reifeThemen}</p>
          <p className="kennzahlName">prüfungsreife Themen</p>
        </div>
        <div>
          <p className="bereitschaftZahl">{historie.length}</p>
          <p className="kennzahlName">abgelegte Prüfungen</p>
        </div>
        <div>
          <p className="bereitschaftZahl">{beste ? `${beste.prozent} %` : '–'}</p>
          <p className="kennzahlName">bestes Ergebnis</p>
        </div>
      </section>

      {(faellig || wiederholungen.length > 0) && (
        <section className="block">
          {faellig && (
            <div className="aufruf">
              <div>
                <p className="aufrufZahl">Monatsprüfung fällig</p>
                <p className="nebentext">
                  {historie.length === 0
                    ? 'Noch keine Prüfung abgelegt.'
                    : 'Die letzte liegt mehr als 30 Tage zurück.'}
                </p>
              </div>
              <button className="knopf haupt schmal" onClick={() => starten('monat')}>
                Jetzt starten
              </button>
            </div>
          )}
          {wiederholungen.map((p) => (
            <div key={p.id} className="aufruf ruhig" style={{ marginTop: '0.5rem' }}>
              <div>
                <p className="aufrufZahl">Wiederholung nötig: {p.titel}</p>
                <p className="nebentext">
                  Beim letzten Mal {p.prozent} % – nicht bestanden.
                </p>
              </div>
              <button
                className="knopf schmal"
                onClick={() => starten('thema', {
                  bereich: { themaId: p.themaId },
                  titel: p.titel,
                })}
              >
                Wiederholen
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="block">
        <h2 className="abschnitt">Prüfungsarten</h2>
        <ul className="artKacheln">
          {['monat', 'woche', 'frei'].map((art) => {
            const a = PRUEFUNGSARTEN[art]
            const letzte = historie.find((p) => p.art === art)
            return (
              <li key={art}>
                <button className="artKachel" onClick={() => starten(art)}>
                  <span className="artZeichen">{a.zeichen}</span>
                  <span className="artTitel">{a.titel}</span>
                  <span className="artText">{a.anzahl} Fragen · {a.text}</span>
                  <span className="artFuss">
                    {letzte ? `zuletzt ${letzte.prozent} %` : 'noch nie abgelegt'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {plan.length > 0 && (
        <section className="block">
          <h2 className="abschnitt">Vorschlag für diese Woche</h2>
          <ul className="themenliste">
            {plan.map((e) => (
              <li key={e.thema.id}>
                <div className="themenzeile">
                  <span className="planZeichen">▣︎</span>
                  <div className="themaInfo">
                    <p className="themaTitel">{e.thema.titel}</p>
                    <p className="themaZeile2">
                      {e.verfuegbar} geprüfte Items ·{' '}
                      {e.letzte
                        ? `zuletzt ${e.letzte.prozent} % am ${new Date(e.letzte.ts).toLocaleDateString('de-DE')}`
                        : 'noch nie geprüft'}
                    </p>
                  </div>
                  <div className="themenzeileAktionen">
                    <button
                      className="knopf schmal"
                      onClick={() => starten('thema', {
                        bereich: { themaId: e.thema.id },
                        titel: `Themenprüfung ${e.thema.titel}`,
                      })}
                    >
                      Prüfen
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <h2 className="abschnitt">Nach Fachbereich</h2>
        <ul className="pruefKacheln">
          {bereichsReife.map((b) => (
            <li key={b.id}>
              <button
                className={b.reif ? 'pruefKachel' : 'pruefKachel aus'}
                disabled={!b.reif}
                onClick={() => starten('bereich', {
                  bereich: { bereich: b.id },
                  titel: `Bereichsprüfung ${b.titel}`,
                })}
              >
                <span className="pruefTitel">{b.titel}</span>
                <span className="pruefZeile">
                  {b.reif ? `${b.anzahl} Items bereit` : `${b.anzahl} von ${REIFE_SCHWELLE * 2} Items`}
                </span>
                {b.letzte && <span className="pruefErgebnis">{b.letzte.prozent} %</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2 className="abschnitt">Nach Thema</h2>
        <ul className="pruefKacheln">
          {themenReife.map((t) => (
            <li key={t.thema.id}>
              <button
                className={t.reif ? 'pruefKachel' : 'pruefKachel aus'}
                disabled={!t.reif}
                onClick={() =>
                  starten(t.begonnen ? 'thema' : 'diagnose', {
                    bereich: { themaId: t.thema.id },
                    titel: `${t.begonnen ? 'Themenprüfung' : 'Diagnose'} ${t.thema.titel}`,
                  })
                }
              >
                <span className="pruefTitel">{t.thema.titel}</span>
                <span className="pruefZeile">
                  {t.reif
                    ? `${t.anzahl} Items · ${t.begonnen ? 'Themenprüfung' : 'Diagnose möglich'}`
                    : `${t.anzahl} von ${REIFE_SCHWELLE} Items`}
                </span>
                {t.letzte && (
                  <span className={t.letzte.bestanden ? 'pruefErgebnis' : 'pruefErgebnis schwach'}>
                    {t.letzte.prozent} %
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2 className="abschnitt">Verlauf</h2>
        {historie.length === 0 ? (
          <p className="nebentext">Noch keine Prüfung abgelegt.</p>
        ) : (
          <>
            <Verlaufskurve pruefungen={[...historie].reverse()} />
            <ul className="verteilung" style={{ marginTop: '1rem' }}>
              {historie.slice(0, 12).map((p) => (
                <li key={p.id}>
                  <span className="verteilungName">
                    {new Date(p.ts).toLocaleDateString('de-DE')} · {p.titel}
                  </span>
                  <span className="verteilungBalken">
                    <span
                      style={{ width: `${p.prozent}%`, background: p.bestanden ? '' : 'var(--warnung)' }}
                    />
                  </span>
                  <span className="verteilungZahl">{p.prozent} %</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

function Verlaufskurve({ pruefungen }) {
  if (pruefungen.length < 2) return null
  const breite = 100
  const hoehe = 40
  const punkte = pruefungen.map((p, i) => {
    const x = (i / (pruefungen.length - 1)) * breite
    const y = hoehe - (p.prozent / 100) * hoehe
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <svg className="verlaufskurve" viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="none">
      <line x1="0" y1={hoehe / 2} x2={breite} y2={hoehe / 2}
            stroke="var(--linie)" strokeWidth="0.4" strokeDasharray="2 2" />
      <polyline points={punkte.join(' ')} fill="none"
                stroke="var(--fortschritt)" strokeWidth="1.2" />
      {pruefungen.map((p, i) => {
        const [x, y] = punkte[i].split(',')
        return <circle key={p.id} cx={x} cy={y} r="1.2"
                       fill={p.bestanden ? 'var(--fortschritt)' : 'var(--warnung)'} />
      })}
    </svg>
  )
}

function PruefEingabe({ item, wert, setWert }) {
  if (item.typ === 'mehrfachauswahl') {
    const gewaehlt = wert ?? []
    return (
      <ul className="optionen">
        {item.optionen.map((text, i) => (
          <li key={i}>
            <button
              className={gewaehlt.includes(i) ? 'option aktiv' : 'option'}
              onClick={() =>
                setWert(gewaehlt.includes(i) ? gewaehlt.filter((g) => g !== i) : [...gewaehlt, i])
              }
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    )
  }

  if (item.typ === 'numerisch' || item.typ === 'rechnen') {
    return (
      <div className="zahlzeile">
        <input className="zahl" inputMode="decimal" value={wert ?? ''}
               onChange={(e) => setWert(e.target.value)} placeholder="Wert" />
        <span className="einheit">{item.einheit}</span>
      </div>
    )
  }

  if (item.typ === 'zuordnung') {
    const zuordnung = wert ?? {}
    return (
      <ul className="paare">
        {item.paare.map(([links], i) => (
          <li key={i}>
            <span className="paarLinks">{links}</span>
            <select className="paarWahl" value={zuordnung[i] ?? ''}
                    onChange={(e) => setWert({ ...zuordnung, [i]: Number(e.target.value) })}>
              <option value="">bitte zuordnen …</option>
              {item.paare.map(([, rechts], j) => (
                <option key={j} value={j}>{rechts}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    )
  }

  if (item.typ === 'bildbeschriftung' || item.typ === 'fehlersuche') {
    const namen = item.punkte?.map((p) => p.name) ?? []
    return (
      <div className="beschriftung">
        <Bildpunkte
          referenz={item.referenz}
          punkte={item.typ === 'fehlersuche' ? item.bereiche : item.punkte}
          zuordnung={item.typ === 'bildbeschriftung' ? (wert ?? {}) : null}
          namen={namen}
          gewaehlt={item.typ === 'fehlersuche' ? (wert ?? null) : null}
          onWahl={(nr, index) =>
            item.typ === 'fehlersuche' ? setWert(nr) : setWert({ ...(wert ?? {}), [nr]: index })
          }
        />
      </div>
    )
  }

  if (item.typ === 'vergleich') {
    return (
      <div className="vergleich">
        {item.seiten.map((seite, i) => (
          <button key={i} className={wert === i ? 'vergleichSeite aktiv' : 'vergleichSeite'}
                  onClick={() => setWert(i)}>
            <span className="vergleichTitel">{seite.titel}</span>
            {seite.bild && <LokalBild src={seite.bild} alt="" />}
            <span className="vergleichText">{seite.beschreibung}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <textarea className="notizfeld" style={{ minHeight: '7rem' }} value={wert ?? ''}
              placeholder="Antwort in eigenen Worten …"
              onChange={(e) => setWert(e.target.value)} />
  )
}
