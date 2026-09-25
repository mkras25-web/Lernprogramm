import { useEffect, useState } from 'react'
import { PALETTEN, SCHRIFTGROESSEN, STANDARD } from '../lib/einstellungen.js'
import DropboxBereich from '../components/DropboxBereich.jsx'
import {
  lokaleBilderImportieren,
  lokaleBilderLoeschen,
  lokaleBilderMoeglich,
  lokaleBilderZaehlen,
} from '../lib/lokaleBilder.js'

// navigator.storage.estimate() ist nur eine grobe Schaetzung des
// Browsers (rundet, zaehlt teils Overhead mit) - reicht aber, um zu
// zeigen, ob der Speicher trotz mehrerer Profile mit eigener IndexedDB
// noch unauffaellig ist.
function alsMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function useSpeicherSchaetzung() {
  const [schaetzung, setSchaetzung] = useState(null)
  useEffect(() => {
    if (!navigator.storage?.estimate) return
    let abgebrochen = false
    navigator.storage.estimate().then((s) => {
      if (!abgebrochen) setSchaetzung(s)
    })
    return () => {
      abgebrochen = true
    }
  }, [])
  return schaetzung
}

export default function Einstellungen({
  werte, setzen, anzahlEreignisse, anzahlSkizzen, paketliste, letzteSicherung,
  onExport, onExportCsv, onImport, onLoeschen, profilName, onProfilWechseln, onTastenhilfe, onMeldung, abgleich,
}) {
  const [loeschfrage, setLoeschfrage] = useState(false)
  const [palettenfenster, setPalettenfenster] = useState(false)
  const [bestaetigung, setBestaetigung] = useState('')
  const speicher = useSpeicherSchaetzung()

  // Buchausschnitte fuers Handy (siehe lib/lokaleBilder.js).
  const bilderMoeglich = lokaleBilderMoeglich()
  const [lokaleBilder, setLokaleBilder] = useState(null)
  useEffect(() => {
    if (bilderMoeglich) lokaleBilderZaehlen().then(setLokaleBilder).catch(() => setLokaleBilder({}))
  }, [bilderMoeglich])
  const anzahlLokal = Object.values(lokaleBilder ?? {}).reduce((s, n) => s + n, 0)

  async function bilderEinlesen(datei) {
    if (!datei) return
    try {
      const bericht = await lokaleBilderImportieren(datei)
      setLokaleBilder(await lokaleBilderZaehlen())
      const ohneDienst = !navigator.serviceWorker?.controller
      onMeldung?.({
        art: 'erfolg',
        text:
          `${bericht.anzahl} Bilder eingelesen.` +
          (ohneDienst ? ' Bitte die Seite einmal neu laden, damit sie erscheinen.' : ''),
      })
    } catch (e) {
      onMeldung?.({ art: 'fehler', text: `Bilder einlesen nicht möglich: ${e.message}` })
    }
  }

  async function bilderEntfernen() {
    await lokaleBilderLoeschen()
    setLokaleBilder({})
    onMeldung?.({ art: 'erfolg', text: 'Eingelesene Bilder von diesem Gerät entfernt.' })
  }

  const aktivePalette = PALETTEN.find((p) => p.id === werte.palette) ?? PALETTEN[0]
  const stufeIndex = Math.max(
    0,
    SCHRIFTGROESSEN.findIndex((g) => g.wert === werte.schriftgroesse)
  )
  const aktuelleGroesse = SCHRIFTGROESSEN[stufeIndex]

  function aendern(feld, wert) {
    setzen({ ...werte, [feld]: wert })
  }

  return (
    <div className="schirm">
      <h1 className="ueberschrift">Einstellungen</h1>

      <section className="block">
        <h2 className="abschnitt">Profil</h2>
        <div className="feldgruppe">
          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Angemeldet als {profilName}</p>
              <p className="zeileHinweis">
                Jedes Profil hat einen eigenen, vollständig getrennten Fortschritt - auch über
                mehrere Inhaltspakete hinweg. Zum Umziehen auf ein anderes Gerät: unten
                sichern, dort einlesen.
              </p>
            </div>
            <button className="knopf schmal" onClick={onProfilWechseln}>
              Profil wechseln
            </button>
          </div>
        </div>
      </section>

      <section className="block">
        <h2 className="abschnitt">Inhaltspaket</h2>
        <div className="feldgruppe">
          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Aktives Paket</p>
              <p className="zeileHinweis">
                Der Fortschritt bleibt paketübergreifend erhalten – Ereignisse hängen an den
                Items, nicht an der Auswahl.
              </p>
            </div>
            <Wahl
              wert={werte.aktivesPaket}
              optionen={(paketliste ?? []).map((p) => [p.id, p.titel])}
              onWahl={(w) => aendern('aktivesPaket', w)}
            />
          </div>
          {(paketliste ?? []).length < 2 && (
            <p className="zeileHinweis">
              Weitere Pakete werden erkannt, sobald sie unter public/pakete liegen und in
              pakete.json eingetragen sind.
            </p>
          )}
        </div>
      </section>

      <section className="block">
        <h2 className="abschnitt">Darstellung</h2>
        <div className="feldgruppe">
          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Farbpalette</p>
              <p className="zeileHinweis">
                Färbt die ganze App um. {PALETTEN.length} Paletten stehen zur Wahl.
              </p>
            </div>
            <button className="paletteZeile" onClick={() => setPalettenfenster(true)}>
              <span className="palettenstreifen">
                {aktivePalette.tupfer.map((f) => (
                  <span key={f} style={{ background: f }} />
                ))}
              </span>
              <span className="paletteName">{aktivePalette.name}</span>
              <span className="zeileHinweis">ändern</span>
            </button>
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Schriftgröße</p>
              <p className="zeileHinweis">
                Skaliert die ganze Oberfläche mit, nicht nur den Fließtext.
              </p>
              <p className="schriftprobe">
                Die Perimeterdämmung liegt außerhalb der Abdichtung.
              </p>
            </div>
            <div className="groessenwahl">
              <button
                className="groessenKnopf klein"
                disabled={stufeIndex <= 0}
                aria-label="Kleiner"
                onClick={() => aendern('schriftgroesse', SCHRIFTGROESSEN[stufeIndex - 1].wert)}
              >
                A
              </button>
              <span className="groessenStand">{aktuelleGroesse.name}</span>
              <button
                className="groessenKnopf gross"
                disabled={stufeIndex >= SCHRIFTGROESSEN.length - 1}
                aria-label="Größer"
                onClick={() => aendern('schriftgroesse', SCHRIFTGROESSEN[stufeIndex + 1].wert)}
              >
                A
              </button>
            </div>
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Farbenblindmodus</p>
              <p className="zeileHinweis">
                Richtig und falsch bekommen zusätzlich ein Zeichen, Akzente wechseln auf ein
                blau-orangenes Paar. Farbe trägt dann nie allein die Aussage.
              </p>
            </div>
            <Wahl
              wert={werte.farbenblind}
              optionen={[[false, 'Aus'], [true, 'An']]}
              onWahl={(w) => aendern('farbenblind', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Inhaltsbreite</p>
              <p className="zeileHinweis">Breit nutzt den Bildschirm aus, schmal hält Zeilen kürzer.</p>
            </div>
            <Wahl
              wert={werte.breite}
              optionen={[['breit', 'Breit'], ['schmal', 'Schmal']]}
              onWahl={(w) => aendern('breite', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Stufenaufstieg feiern</p>
              <p className="zeileHinweis">
                Blendet nach einem Aufstieg die gewachsene Bauzeichnung ein. Aus heißt: Die
                Stufe steigt still, sichtbar nur im Kopf und im Fortschritt.
              </p>
            </div>
            <Wahl
              wert={werte.aufstiegFeiern}
              optionen={[[true, 'An'], [false, 'Aus']]}
              onWahl={(w) => aendern('aufstiegFeiern', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Animationen</p>
              <p className="zeileHinweis">Ringe und Einblendungen bewegen sich.</p>
            </div>
            <Wahl
              wert={werte.animationen}
              optionen={[[true, 'An'], [false, 'Aus']]}
              onWahl={(w) => aendern('animationen', w)}
            />
          </div>
        </div>
      </section>

      <section className="block">
        <h2 className="abschnitt">Lernen</h2>
        <div className="feldgruppe">
          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Neue Items pro Tag</p>
              <p className="zeileHinweis">
                Jedes neue Item erzeugt Wiederholungen für Monate. Hoch ansetzen rächt sich in
                drei Wochen.
              </p>
            </div>
            <Wahl
              wert={werte.neuProTag}
              optionen={[[3, '3'], [6, '6'], [10, '10'], [15, '15']]}
              onWahl={(w) => aendern('neuProTag', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Obergrenze pro Tag</p>
              <p className="zeileHinweis">Schützt vor Überfälligkeitsbergen nach einer Pause.</p>
            </div>
            <Wahl
              wert={werte.maxProTag}
              optionen={[[20, '20'], [30, '30'], [50, '50'], [999, 'ohne']]}
              onWahl={(w) => aendern('maxProTag', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Reihenfolge</p>
              <p className="zeileHinweis">
                Gemischt fühlt sich anstrengender an und sitzt nachweislich besser als
                thematisch geblockt.
              </p>
            </div>
            <Wahl
              wert={werte.reihenfolge}
              optionen={[['gemischt', 'Gemischt'], ['thematisch', 'Thematisch']]}
              onWahl={(w) => aendern('reihenfolge', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Bewertungsstufen</p>
              <p className="zeileHinweis">Vier sind genauer, zwei gehen schneller.</p>
            </div>
            <Wahl
              wert={werte.bewertungsstufen}
              optionen={[[2, 'Zwei'], [4, 'Vier']]}
              onWahl={(w) => aendern('bewertungsstufen', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Ungeprüfte Items</p>
              <p className="zeileHinweis">
                Items, deren Normbezug noch nicht abgeglichen ist. Im Lernstapel sinnvoll, in
                Prüfungen nie.
              </p>
            </div>
            <Wahl
              wert={werte.ungeprueftZulassen}
              optionen={[[true, 'Zulassen'], [false, 'Ausblenden']]}
              onWahl={(w) => aendern('ungeprueftZulassen', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Überspringen erlauben</p>
              <p className="zeileHinweis">Item weglegen, ohne es zu bewerten.</p>
            </div>
            <Wahl
              wert={werte.ueberspringenErlauben}
              optionen={[[true, 'An'], [false, 'Aus']]}
              onWahl={(w) => aendern('ueberspringenErlauben', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Skizzen sichern</p>
              <p className="zeileHinweis">
                Jede gezeichnete Skizze wird als Bild behalten – derzeit {anzahlSkizzen}.
              </p>
            </div>
            <Wahl
              wert={werte.skizzenSichern}
              optionen={[[true, 'An'], [false, 'Aus']]}
              onWahl={(w) => aendern('skizzenSichern', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Beim Sichten weiterspringen</p>
              <p className="zeileHinweis">
                Nach dem Setzen einer Sichtungsmarke gleich zum nächsten ungesichteten Item.
                Schneller beim Durcharbeiten, nimmt aber den Blick zurück auf das eben
                Markierte.
              </p>
            </div>
            <Wahl
              wert={werte.sichtungWeiter}
              optionen={[[true, 'An'], [false, 'Aus']]}
              onWahl={(w) => aendern('sichtungWeiter', w)}
            />
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Vertiefung anzeigen</p>
              <p className="zeileHinweis">Der zusätzliche Absatz unter der Antwort.</p>
            </div>
            <Wahl
              wert={werte.vertiefungZeigen}
              optionen={[[true, 'An'], [false, 'Aus']]}
              onWahl={(w) => aendern('vertiefungZeigen', w)}
            />
          </div>
        </div>
      </section>

      <section className="block">
        <h2 className="abschnitt">Daten</h2>
        <div className="feldgruppe">
          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Fortschritt sichern</p>
              <p className="zeileHinweis">
                {anzahlEreignisse} Ereignisse, {anzahlSkizzen} Skizzen. Skizzen machen die Datei
                groß – für den reinen Fortschritt genügt die Fassung ohne sie.
                {letzteSicherung
                  ? ` Zuletzt gesichert am ${new Date(letzteSicherung).toLocaleDateString('de-DE')}.`
                  : ' Noch nie gesichert.'}
              </p>
            </div>
            <div className="wahl">
              <button className="knopf schmal" onClick={() => onExport(true)}>Sichern</button>
              <button className="knopf schmal" onClick={() => onExport(false)}>
                Ohne Skizzen
              </button>
              <label className="knopf schmal">
                Einlesen
                <input
                  type="file"
                  accept=".json,application/json"
                  multiple
                  hidden
                  onChange={(e) => {
                    onImport(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>

          <DropboxBereich
            onMeldung={onMeldung}
            abgleich={abgleich}
            einstellung={{ auto: werte.dropboxAuto !== false, skizzen: werte.dropboxSkizzen === true }}
            onEinstellung={aendern}
          />

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Buchausschnitte einlesen</p>
              <p className="zeileHinweis">
                Geschützte Bilder liegen nicht im Internet. Am Handy hier die Bilder-ZIP einlesen
                (vom PC mit <code>bilder_packen.py</code> erzeugt, über Dropbox geteilt). Sie
                bleiben auf diesem Gerät.
                {!bilderMoeglich
                  ? ' Auf diesem Gerät gerade nicht möglich (braucht eine https-Adresse).'
                  : anzahlLokal > 0
                    ? ` Eingelesen: ${Object.entries(lokaleBilder).map(([p, n]) => `${p} ${n}`).join(', ')}.`
                    : ' Noch keine eingelesen.'}
              </p>
            </div>
            {bilderMoeglich && (
              <div className="wahl">
                <label className="knopf schmal">
                  Bilder einlesen
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    hidden
                    onChange={(e) => {
                      bilderEinlesen(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                {anzahlLokal > 0 && (
                  <button className="knopf schmal" onClick={bilderEntfernen}>Entfernen</button>
                )}
              </div>
            )}
          </div>

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Als Tabelle exportieren</p>
              <p className="zeileHinweis">
                Jede Antwort als eigene Zeile (Datum, Thema, Bewertung, Dauer) - für eigene
                Auswertung in Excel oder Calc. Für Wiederherstellung/Sicherung stattdessen oben
                „Sichern" benutzen.
              </p>
            </div>
            <button className="knopf schmal" onClick={onExportCsv}>Als CSV</button>
          </div>

          {speicher && (
            <div className="zeile">
              <div className="zeileText">
                <p className="zeileTitel">Belegter Speicher</p>
                <p className="zeileHinweis">
                  {alsMB(speicher.usage)} MB von {alsMB(speicher.quota)} MB, die der Browser
                  diesem Profil zugesteht. Wächst mit Skizzen und Ereignissen.
                </p>
              </div>
            </div>
          )}

          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Einstellungen zurücksetzen</p>
              <p className="zeileHinweis">Betrifft nur Darstellung und Lernvorgaben.</p>
            </div>
            <button className="knopf schmal" onClick={() => setzen({ ...STANDARD })}>
              Zurücksetzen
            </button>
          </div>

          <div className="zeile gefahrzeile">
            <div className="zeileText">
              <p className="zeileTitel">Allen Fortschritt löschen</p>
              <p className="zeileHinweis">
                Löscht das gesamte Ereignisprotokoll. Fälligkeiten, XP, Stufen und
                Detailkarten sind danach weg und lassen sich nicht wiederherstellen.
              </p>
            </div>
            <button className="knopf schmal gefahr" onClick={() => setLoeschfrage(true)}>
              Löschen
            </button>
          </div>
        </div>
      </section>

      <section className="block">
        <h2 className="abschnitt">Hilfe</h2>
        <div className="feldgruppe">
          <div className="zeile">
            <div className="zeileText">
              <p className="zeileTitel">Tastenkürzel</p>
              <p className="zeileHinweis">
                Übersicht aller Tastenkürzel beim Lernen und beim Sichten.
              </p>
            </div>
            <button className="knopf schmal" onClick={onTastenhilfe}>
              Anzeigen
            </button>
          </div>
        </div>
      </section>

      {palettenfenster && (
        <div className="schleier" onClick={() => setPalettenfenster(false)}>
          <article className="grosseKarte" style={{ maxWidth: '44rem' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="ueberschrift">Farbpalette</h2>
            <p className="nebentext">
              Die Auswahl wirkt sofort. Bei einigen Paletten habe ich einen dunklen Neutralton
              ergänzt, weil sonst kein Text lesbar wäre.
            </p>
            <div className="palettenfenster">
              {PALETTEN.map((pa) => (
                <button
                  key={pa.id}
                  className={pa.id === werte.palette ? 'paletteZeile aktiv' : 'paletteZeile'}
                  onClick={() => aendern('palette', pa.id)}
                >
                  <span className="palettenstreifen">
                    {pa.tupfer.map((f) => (
                      <span key={f} style={{ background: f }} />
                    ))}
                  </span>
                  <span className="paletteName">{pa.name}</span>
                  {pa.id === werte.palette && <span className="paletteHaken">✓︎</span>}
                </button>
              ))}
            </div>
            <button className="knopf" onClick={() => setPalettenfenster(false)}>
              Schließen
            </button>
          </article>
        </div>
      )}

      {loeschfrage && (
        <div className="schleier" onClick={() => setLoeschfrage(false)}>
          <article className="grosseKarte gefahr" onClick={(e) => e.stopPropagation()}>
            <h2 className="ueberschrift">Bist du sicher?</h2>
            <p className="nebentext">
              {anzahlEreignisse} Ereignisse werden gelöscht. Das ist endgültig. Wenn du nicht
              sicher bist, sichere vorher deinen Fortschritt.
            </p>
            <p className="nebentext">
              Tippe <strong>LÖSCHEN</strong>, um es zu bestätigen.
            </p>
            <input
              className="zahl"
              style={{ width: '100%' }}
              value={bestaetigung}
              onChange={(e) => setBestaetigung(e.target.value)}
              placeholder="LÖSCHEN"
            />
            <div className="wahl">
              <button
                className="knopf schmal"
                onClick={() => {
                  setLoeschfrage(false)
                  setBestaetigung('')
                }}
              >
                Abbrechen
              </button>
              <button
                className="knopf schmal gefahr"
                disabled={bestaetigung.trim().toUpperCase() !== 'LÖSCHEN'}
                onClick={() => {
                  onLoeschen()
                  setLoeschfrage(false)
                  setBestaetigung('')
                }}
              >
                Endgültig löschen
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

function Wahl({ wert, optionen, onWahl }) {
  return (
    <div className="wahl">
      {optionen.map(([w, name]) => (
        <button
          key={String(w)}
          className={w === wert ? 'wahlKnopf aktiv' : 'wahlKnopf'}
          onClick={() => onWahl(w)}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
