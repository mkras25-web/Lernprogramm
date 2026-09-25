import Ring from '../components/Ring.jsx'
import Bauabschnitt from '../components/Bauabschnitt.jsx'
import { naechsterRang, rangFuer } from '../lib/fortschritt.js'
import { bauwerkFuer } from '../lib/stufen.js'

export default function Heute({
  level, gestaltung = 'arch', serie, quote, tagesplan, werte, karten, baustellen, skizzen, neue,
  offeneSitzung, onFortsetzen, onVerwerfen, onStart, onThemen,
  aufstieg, onAufstiegGesehen, sicherungFaellig, onSichern,
  pruefungHinweis, onPruefung,
}) {
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
          <Kennzahl wert={erledigt} bezeichnung="heute" />
          <Kennzahl wert={werte.lernzeitHeuteMin} einheit="min" bezeichnung="Lernzeit" />
          <Kennzahl wert={freieKarten} bezeichnung="Detailkarten" />
        </section>

        <section className="heuteBreit">
          {offen > 0 ? (
            <div className="aufruf">
              <Ring anteil={anteilHeute} groesse={56} staerke={5} />
              <div>
                <p className="aufrufZahl">{offen} Items warten</p>
                <p className="nebentext">
                  {tagesplan.faelligGesamt} Wiederholungen · {Math.min(tagesplan.neuGesamt, offen)} neu ·
                  etwa {Math.max(1, Math.round(offen * 0.5))} Minuten
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

        {pruefungHinweis && (
          <section className="heuteBreit">
            <div className="aufruf">
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

        {offeneSitzung && (
          <section className="heuteBreit">
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
              text={skizzen > 0 ? `${skizzen} Zeichenaufgaben` : 'keine vorhanden'}
              aus={skizzen === 0}
              onKlick={() => onStart('skizzen')}
            />
            <ArtKachel
              zeichen="◎︎"
              titel="Training"
              text="Mit Referenzhilfe, halbe XP"
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
              onKlick={() => onStart('blaettern')}
            />
          </ul>
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
                    {k.bild && <img src={k.bild} alt="" />}
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

function ArtKachel({ zeichen, titel, text, aus, onKlick }) {
  return (
    <li>
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
