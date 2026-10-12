import Ring from '../components/Ring.jsx'
import Bauabschnitt from '../components/Bauabschnitt.jsx'
import LokalBild from '../components/LokalBild.jsx'
import { naechsterRang, rangFuer } from '../lib/fortschritt.js'
import { bauwerkFuer } from '../lib/stufen.js'
import { tageBis } from '../lib/kurs.js'

export default function Heute({
  level, gestaltung = 'arch', serie, quote, tagesplan, werte, karten, baustellen, skizzen, zeichenAus = false, neue, tagesziel = 0,
  offeneSitzung, onFortsetzen, onVerwerfen, onStart, onThemen,
  aufstieg, onAufstiegGesehen, sicherungFaellig, onSichern,
  pruefungHinweis, onPruefung, offenePruefung, onPruefungFortsetzen, klausuren = [],
  kurse = [], onKurs, onVorschlaegeUebernehmen, onKursPruefung, onKurseVerwalten,
}) {
  // Klausur-Countdown (4B): naechste anstehende Klausur(en), nur Anzeige.
  const heuteBeginn = new Date()
  heuteBeginn.setHours(0, 0, 0, 0)
  const anstehend = klausuren
    .map((k) => ({ ...k, tage: Math.round((new Date(`${k.datum}T00:00`) - heuteBeginn) / 86400000) }))
    .filter((k) => k.tage >= 0)
    .sort((a, b) => a.tage - b.tage)
  const offen = tagesplan.pensum.length
  const erledigt = werte.antwortenHeute
  const anteilHeute = offen === 0 ? 1 : Math.min(1, erledigt / (erledigt + offen))
  const freieKarten = karten.filter((k) => k.frei).length
  const rang = rangFuer(level.stufe, gestaltung)
  const naechster = naechsterRang(level.stufe, gestaltung)
  const bau = bauwerkFuer(level.stufe, gestaltung)

  return (
    <div className="schirm">
      <div className="heuteRaster">
        {anstehend.length > 0 && (
          <section className="heuteBreit klausurLeiste">
            {anstehend.slice(0, 3).map((k, i) => (
              <p key={k.id} className={i === 0 ? 'klausurNaechste' : 'klausurWeitere'}>
                <span className="klausurTage">
                  {k.tage === 0 ? 'heute' : k.tage === 1 ? 'morgen' : `in ${k.tage} Tagen`}
                </span>{' '}
                Klausur {k.titel} · {new Date(`${k.datum}T00:00`).toLocaleDateString('de-DE')}
              </p>
            ))}
          </section>
        )}
        <section className="stufe">
          <Bauabschnitt stufe={level.stufe} gestaltung={gestaltung} groesse={128} />
          <div className="stufeText">
            <p className="rangName">
              {rang.name}{' '}
              <span className="bauWerk">{bau.werk.name}</span>
            </p>
            <h1 className="ueberschrift">Stufe {level.stufe}</h1>
            <p className="nebentext">{bau.abschnitt.satz}</p>
            <div className="bauBalken" title={`${level.imLevel} von ${level.fuerLevel} XP`}>
              <span style={{ width: `${Math.round(level.anteil * 100)}%` }} />
            </div>
            <p className="nebentext">
              {level.imLevel} von {level.fuerLevel} XP bis zur nächsten Stufe · {level.xp} XP gesamt
            </p>
            {naechster && (
              <p className="nebentext">
                Ab Stufe {naechster.ab}: {naechster.name}
              </p>
            )}
          </div>
        </section>

        <section className="kennzahlen">
          <Kennzahl wert={serie.tage} einheit={serie.tage === 1 ? 'Tag' : 'Tage'} bezeichnung="Serie" />
          <Kennzahl
            wert={quote?.quote ?? 0}
            einheit="%"
            bezeichnung={quote ? `an ${quote.tage} von ${quote.vonTagen} Tagen` : 'der Tage gelernt'}
          />
          <Kennzahl
            wert={erledigt}
            einheit={tagesziel > 0 ? `/ ${tagesziel}` : undefined}
            bezeichnung={tagesziel > 0 ? (erledigt >= tagesziel ? 'Tagesziel erreicht' : 'Tagesziel') : 'heute'}
          />
          <Kennzahl wert={werte.lernzeitHeuteMin} einheit="min" bezeichnung="Lernzeit" />
          <Kennzahl wert={freieKarten} bezeichnung="Detailkarten" />
        </section>

        {/* heuteLernen/heuteSitzung: nur Ansatzpunkte fuer die mobile
            Reihenfolge (CSS order, siehe styles.css) - Desktop unberuehrt. */}
        <section className="heuteBreit heuteLernen">
          {offen > 0 ? (
            <div className="aufruf">
              <Ring anteil={anteilHeute} groesse={56} staerke={5} />
              <div>
                <p className="aufrufZahl">{offen} Items warten</p>
                <p className="nebentext">
                  {tagesplan.wiederholungImPensum} Wiederholungen · {tagesplan.neuImPensum} neu ·
                  etwa {Math.max(1, Math.round(offen * 0.5))} Minuten
                  {tagesplan.aufgeschoben > 0 && ` · ${tagesplan.aufgeschoben} weitere warten (Obergrenze)`}
                </p>
              </div>
              <button className="knopf haupt schmal" onClick={() => onStart('ueben')}>
                Lernen
              </button>
            </div>
          ) : (
            <div className="aufruf ruhig">
              <div>
                <p className="aufrufZahl">Für heute durch</p>
                <p className="nebentext">
                  {serie.kulanzOffen} Kulanztage im Monat übrig, falls einmal nichts geht
                </p>
              </div>
              <button className="knopf schmal" onClick={onThemen}>
                Themen ansehen
              </button>
            </div>
          )}
        </section>

        {kurse.map((u) => (
          <KursKarte
            key={u.kurs.id}
            u={u}
            onKurs={onKurs}
            onVorschlaege={() => onVorschlaegeUebernehmen?.(u)}
            onPruefung={onKursPruefung}
            onVerwalten={onKurseVerwalten}
          />
        ))}

        {pruefungHinweis && (
          <section className="heuteBreit">
            <div className="aufruf pruefungAufruf">
              <span className="artZeichen" style={{ fontSize: '1.5rem' }}>✓︎</span>
              <div>
                <p className="aufrufZahl">{pruefungHinweis.text}</p>
                <p className="nebentext">
                  Prüfungen entstehen aus deinen geprüften Items und zählen als Lernereignisse.
                </p>
              </div>
              <button className="knopf haupt schmal" onClick={onPruefung}>
                Zu den Prüfungen
              </button>
            </div>
          </section>
        )}

        {sicherungFaellig && (
          <section className="heuteBreit">
            <div className="aufruf ruhig">
              <div>
                <p className="aufrufZahl">Fortschritt sichern</p>
                <p className="nebentext">
                  Deine Daten liegen nur in diesem Browserprofil. Die letzte Sicherung ist
                  über einen Monat her oder es gab noch keine.
                </p>
              </div>
              <button className="knopf schmal" onClick={onSichern}>Jetzt sichern</button>
            </div>
          </section>
        )}

        {aufstieg && (
          <section className="heuteBreit">
            <div className="aufstieg">
              <Bauabschnitt stufe={level.stufe} gestaltung={gestaltung} groesse={64} titel={false} />
              <div>
                <p className="aufrufZahl">
                  Stufe {level.stufe} erreicht · {bau.abschnitt.name}
                </p>
                <p className="nebentext">
                  {aufstieg.rangNeu
                    ? `Neuer Rang: ${rang.name}`
                    : `${freieKarten} Detailkarten · nächster Rang ab Stufe ${naechster?.ab ?? '–'}`}
                </p>
              </div>
              <button className="textknopf" onClick={onAufstiegGesehen}>ausblenden</button>
            </div>
          </section>
        )}

        {offenePruefung && (
          <section className="heuteBreit heuteSitzung">
            <div className="aufruf ruhig">
              <div>
                <p className="aufrufZahl">
                  {offenePruefung.abgegeben ? 'Prüfung noch nicht gespeichert' : 'Angefangene Prüfung'}
                </p>
                <p className="nebentext">
                  {offenePruefung.titel} ·{' '}
                  {offenePruefung.abgegeben
                    ? 'abgegeben, Auswertung offen'
                    : `${offenePruefung.beantwortet} von ${offenePruefung.gesamt} beantwortet`}
                </p>
              </div>
              <button className="knopf haupt schmal" onClick={onPruefungFortsetzen}>
                Fortsetzen
              </button>
            </div>
          </section>
        )}

        {offeneSitzung && (
          <section className="heuteBreit heuteSitzung">
            <div className="aufruf ruhig">
              <div>
                <p className="aufrufZahl">Angefangene Sitzung</p>
                <p className="nebentext">
                  {offeneSitzung.ids.length} Items, bei Nummer {offeneSitzung.position + 1}
                  {' '}unterbrochen am {new Date(offeneSitzung.ts).toLocaleString('de-DE')}
                </p>
              </div>
              <button className="knopf schmal" onClick={onFortsetzen}>Fortsetzen</button>
              <button className="textknopf" onClick={onVerwerfen}>Verwerfen</button>
            </div>
          </section>
        )}

        <section className="block heuteBreit">
          <h2 className="abschnitt">Betriebsarten</h2>
          <ul className="artKacheln">
            <ArtKachel
              zeichen="∞︎"
              titel="Marathon"
              text="Endlos, Fehler kommen wieder"
              onKlick={() => onStart('marathon')}
            />
            <ArtKachel
              zeichen="↯︎"
              titel="Schnellrunde"
              text="25 kurze Fragen am Stück"
              onKlick={() => onStart('schnell')}
            />
            <ArtKachel
              zeichen="✕︎"
              titel="Baustellen"
              text={baustellen > 0 ? `${baustellen} Wackelkandidaten` : 'keine offen'}
              aus={baustellen === 0}
              onKlick={() => onStart('baustellen')}
            />
            <ArtKachel
              zeichen="✎︎"
              titel="Nur Skizzen"
              text={zeichenAus ? 'ausgeblendet' : skizzen > 0 ? `${skizzen} Zeichenaufgaben` : 'keine vorhanden'}
              aus={skizzen === 0}
              onKlick={() => onStart('skizzen')}
            />
            <ArtKachel
              zeichen="◎︎"
              titel="Training"
              text={zeichenAus ? 'ausgeblendet' : 'Mit Referenzhilfe, halbe XP'}
              aus={skizzen === 0}
              onKlick={() => onStart('training')}
            />
            <ArtKachel
              zeichen="✦︎"
              titel="Neues lernen"
              text={neue > 0 ? `${neue} noch nie gesehen` : 'alles angefangen'}
              aus={neue === 0}
              onKlick={() => onStart('neu')}
            />
            <ArtKachel
              zeichen="▤︎"
              titel="Durchblättern"
              text="Nachschlagen ohne Wertung"
              klasse="nurMobilKachel"
              onKlick={() => onStart('blaettern')}
            />
          </ul>
          {/* Am Desktop kein siebter Kachel-Rest in eigener Zeile (41A) */}
          <button className="textknopf blaetternLink" onClick={() => onStart('blaettern')}>
            Alle Karten durchblättern (ohne Wertung)
          </button>
        </section>

        <section className="block heuteBreit">
          <h2 className="abschnitt">Zuletzt freigeschaltet</h2>
          {freieKarten === 0 ? (
            <p className="nebentext">
              Noch keine Detailkarte frei. Eine Karte entsteht, wenn vier Fünftel der Items einer
              Einheit sicher sitzen.
            </p>
          ) : (
            <ul className="kartenband">
              {karten
                .filter((k) => k.frei)
                .slice(0, 6)
                .map((k) => (
                  <li key={k.id} className="bandKarte">
                    {k.bild && <LokalBild src={k.bild} alt="" platzhalter={false} />}
                    <span>{k.titel}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

// Ein Kurs (lib/kurs.js): Klausurreife, Tagesplan und die Kurs-Lernarten.
function KursKarte({ u, onKurs, onVorschlaege, onPruefung, onVerwalten }) {
  const { kurs, klausur, reife, plan } = u
  const tage = klausur ? tageBis(klausur) : null
  const nichtReif = reife.gesamt - reife.sicher
  const termin = klausur
    ? `Klausur ${tage === 0 ? 'heute' : tage === 1 ? 'morgen' : `in ${tage} Tagen`} · ${new Date(`${klausur.datum}T00:00`).toLocaleDateString('de-DE')}`
    : 'ohne Klausurtermin'
  return (
    <section className="block heuteBreit">
      <div className="themenKopf">
        <h2 className="abschnitt">Kurs {kurs.titel}</h2>
        <button className="textknopf" onClick={onVerwalten}>{termin}</button>
      </div>
      {u.items.length === 0 ? (
        <p className="nebentext">
          Noch keine Fragen im Kurs. Markiere sie beim Lernen (Knopf „Kurs“) oder in Nachschlagen
          mit „Sichten“ gesammelt.
        </p>
      ) : (
        <>
          <div className="aufruf">
            <Ring anteil={reife.anteil} groesse={56} staerke={5} />
            <div>
              <p className="aufrufZahl">
                {reife.sicher} von {reife.gesamt} {klausur ? 'klausurreif' : 'sicher'}
              </p>
              <p className="nebentext">
                {plan.pensum.length > 0
                  ? `Heute im Plan: ${plan.faellig} fällig` +
                    (plan.vorgezogen ? ` · ${plan.vorgezogen} vorgezogen` : '') +
                    ` · ${plan.neu} neu` +
                    (plan.neuGesamt > plan.neu ? ` (${plan.neuGesamt} neue insgesamt)` : '')
                  : 'Für heute ist der Kursplan erledigt.'}
              </p>
            </div>
            <button
              className="knopf haupt schmal"
              disabled={plan.pensum.length === 0}
              onClick={() => onKurs(kurs.id, 'kursplan')}
            >
              Kursplan lernen
            </button>
          </div>
          <ul className="artKacheln">
            <ArtKachel
              zeichen="⚑︎"
              titel="Endspurt"
              text={nichtReif > 0 ? `${nichtReif} noch nicht ${klausur ? 'klausurreif' : 'sicher'}, bis alles sitzt` : 'alles sitzt'}
              aus={nichtReif === 0}
              onKlick={() => onKurs(kurs.id, 'endspurt')}
            />
            <ArtKachel
              zeichen="∞︎"
              titel="Alle Kursfragen"
              text={`${u.lernItems.length} Fragen gemischt`}
              aus={u.lernItems.length === 0}
              onKlick={() => onKurs(kurs.id, 'alle')}
            />
            <ArtKachel
              zeichen="◈︎"
              titel="Probeklausur"
              text={u.pruefIds.length > 0 ? `aus ${u.pruefIds.length} geprüften Kursfragen` : 'noch keine geprüften'}
              aus={u.pruefIds.length === 0}
              onKlick={onPruefung}
            />
          </ul>
        </>
      )}
      {u.vorschlaege.length > 0 && (
        <p className="nebentext">
          {u.vorschlaege.length} Fragen sind im Inhalt für diesen Kurs vorgeschlagen.{' '}
          <button className="textknopf" onClick={onVorschlaege}>Alle übernehmen</button>
        </p>
      )}
    </section>
  )
}

function ArtKachel({ zeichen, titel, text, aus, onKlick, klasse }) {
  return (
    <li className={klasse}>
      <button className={aus ? 'artKachel aus' : 'artKachel'} disabled={aus} onClick={onKlick}>
        <span className="artZeichen" aria-hidden="true">{zeichen}</span>
        <span className="artTitel">{titel}</span>
        <span className="artText">{text}</span>
      </button>
    </li>
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
