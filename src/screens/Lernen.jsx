import { useEffect, useMemo, useRef, useState } from 'react'
import Skizzenfeld from '../components/Skizzenfeld.jsx'
import Bildlupe, { LupenLink } from '../components/Bildlupe.jsx'
import Normen from '../components/Normen.jsx'
import Bildpunkte from '../components/Bildpunkte.jsx'
import Bauabschnitt from '../components/Bauabschnitt.jsx'
import LokalBild from '../components/LokalBild.jsx'
import Notizfeld from '../components/Notizfeld.jsx'
import Fallaufgabe from '../components/Fallaufgabe.jsx'
import SieheAuch from '../components/SieheAuch.jsx'
import MeldenFeld from '../components/MeldenFeld.jsx'
import Auswahl from '../components/Auswahl.jsx'
import { meldenAenderung, zurueckziehenAenderung } from '../lib/meldungen.js'
import { rechnen, textFuellen, werteZiehen } from '../lib/rechnen.js'
import { BEWERTUNG, intervallKurz } from '../lib/planer.js'
import { KATEGORIEN, kategorieAus } from '../lib/sichtung.js'
import { mischen } from '../lib/mischen.js'
import { paarRichtig, paarOptionen, ersterPaarIndex } from '../lib/punkte.js'
import { quelleText } from '../lib/quelle.js'


export default function Lernen({
  item,
  level,
  gestaltung = 'arch',
  art,
  position,
  gesamt,
  faellig,
  neu,
  letzteXp,
  stufen,
  vertiefungZeigen,
  ueberspringenErlauben,
  marke,
  thema,
  istNeu,
  intervalle,
  istProblem,
  zweiterVersuch = false,
  heuteBewertet = false,
  themen,
  glossar,
  fruehereSkizzen,
  kannZurueck,
  onMarke,
  onGemeldet,
  gemeldetHinweis = false,
  onHinweisGelesen,
  kurse = [],
  onKurs,
  // Einfuehrungsschritt vor der ersten neuen Karte eines Themas (D4)
  einfuehrung = false,
  onEingefuehrt,
  onBewerten,
  onUeberspringen,
  onZurueckblaettern,
  onRueckgaengig,
  onZurueck,
}) {
  const [aufgedeckt, setAufgedeckt] = useState(false)
  const [eingabe, setEingabe] = useState(null)
  const [notizOffen, setNotizOffen] = useState(false)
  const [meldenOffen, setMeldenOffen] = useState(false)
  // Ungepruefte Karte selbst geprueft (P8)
  const [freigabeOffen, setFreigabeOffen] = useState(false)
  // Beim zweiten Versuch ist die Erklaerung gleich offen: verstehen statt
  // nur nochmal raten (Nutzerentscheidung 2026-10-12).
  const [erklaerungOffen, setErklaerungOffen] = useState(zweiterVersuch)
  const [hilfeGenutzt, setHilfeGenutzt] = useState(false)
  // Abgehakte Pruefpunkte (L3): steuern den Bewertungsvorschlag.
  const [gehakt, setGehakt] = useState([])
  // Vertiefung "erst ueberlegen" aufgeklappt (L2)
  const [warumOffen, setWarumOffen] = useState(false)
  // Bild zur Themen-Erklaerung im Erklaerkasten aufgeklappt (D2)
  const [erklaerbildOffen, setErklaerbildOffen] = useState(false)
  // Einfuehrung (D4) fuer diese Karte schon weggeklickt
  const [eingefuehrt, setEingefuehrt] = useState(false)
  const bildRef = useRef(null)
  const seed = useMemo(() => (item.id + position).split('').reduce((s, z) => s + z.charCodeAt(0), 0), [item.id, position])

  useEffect(() => {
    setAufgedeckt(false)
    setEingabe(null)
    setNotizOffen(false)
    setMeldenOffen(false)
    setFreigabeOffen(false)
    setErklaerungOffen(zweiterVersuch)
    setHilfeGenutzt(false)
    setGehakt([])
    setWarumOffen(false)
    setErklaerbildOffen(false)
    setEingefuehrt(false)
    // zweiterVersuch haengt nur an item/position
  }, [item.id, position])

  // Automatische Bewertung, wo die App die Antwort kennt.
  const urteil = useMemo(() => {
    if (item.typ === 'mehrfachauswahl') {
      const gewaehlt = new Set(eingabe ?? [])
      const richtig = new Set(item.richtig)
      if (gewaehlt.size === 0) return null
      const gleich =
        gewaehlt.size === richtig.size && [...richtig].every((r) => gewaehlt.has(r))
      return gleich ? 'richtig' : 'falsch'
    }
    if (item.typ === 'numerisch') {
      const zahl = parseFloat(String(eingabe ?? '').replace(',', '.'))
      if (Number.isNaN(zahl)) return null
      return Math.abs(zahl - item.wert) <= (item.toleranz ?? 0) ? 'richtig' : 'falsch'
    }
    if (item.typ === 'zuordnung') {
      const zuordnung = eingabe ?? {}
      if (Object.keys(zuordnung).length < item.paare.length) return null
      return item.paare.every((_, i) => paarRichtig(item, i, zuordnung[i])) ? 'richtig' : 'falsch'
    }
    if (item.typ === 'reihenfolge') {
      // Antippen zum Einsortieren (D7): erst die vollstaendige Reihe zaehlt.
      // Halb einsortiert und aufgedeckt ist falsch - sonst gab es kein
      // Urteil und "Gut" blieb frei waehlbar.
      const reihe = eingabe ?? []
      if (reihe.length === 0) return null
      if (reihe.length < item.schritte.length) return aufgedeckt ? 'falsch' : null
      return reihe.every((wert, i) => wert === i) ? 'richtig' : 'falsch'
    }
    if (item.typ === 'bildbeschriftung') {
      const zuordnung = eingabe ?? {}
      if (Object.keys(zuordnung).length < item.punkte.length) return null
      return item.punkte.every((p, i) => zuordnung[p.nr] === i) ? 'richtig' : 'falsch'
    }
    if (item.typ === 'fehlersuche') {
      if (eingabe == null) return null
      return eingabe === item.fehlerNr ? 'richtig' : 'falsch'
    }
    if (item.typ === 'vergleich') {
      if (eingabe == null) return null
      return eingabe === item.richtig ? 'richtig' : 'falsch'
    }
    if (item.typ === 'rechnen') {
      const zahl = parseFloat(String(eingabe ?? '').replace(',', '.'))
      if (Number.isNaN(zahl)) return null
      try {
        const werte = werteZiehen(item.variablen, seed)
        const soll = rechnen(item.formel, werte)
        const toleranz = item.toleranz ?? Math.abs(soll) * 0.02
        return Math.abs(zahl - soll) <= toleranz ? 'richtig' : 'falsch'
      } catch {
        return null
      }
    }
    return null
  }, [item, eingabe, seed, aufgedeckt])

  // Pruefpunkte (L3, Nutzerentscheidung 2026-10-13): Die Haekchen schlagen
  // die Bewertung vor (unter der Haelfte Nochmal, ab der Haelfte Schwer,
  // alle Gut) - und "Gut"/"Leicht" gibt es erst, wenn alle abgehakt sind.
  // Lernende ueberschaetzen freie Antworten; der Punkt-fuer-Punkt-Abgleich
  // macht die Selbstbewertung genauer (Rawson & Dunlosky 2011).
  const pruefpunkte = urteil === null && art !== 'vorab' ? item.pruefpunkte ?? [] : []
  const pruefVorschlag = pruefpunkte.length === 0
    ? null
    : gehakt.length === pruefpunkte.length
      ? BEWERTUNG.GUT
      : gehakt.length / pruefpunkte.length >= 0.5 && stufen === 4
        ? BEWERTUNG.SCHWER
        : BEWERTUNG.NOCHMAL
  const gutGesperrt = pruefpunkte.length > 0 && gehakt.length < pruefpunkte.length
  const vorschlag = urteil === 'richtig' ? BEWERTUNG.GUT : urteil === 'falsch' ? BEWERTUNG.NOCHMAL : pruefVorschlag
  const einfuehrungAktiv = einfuehrung && !eingefuehrt && Boolean(thema?.erklaerung)

  function einfuehrungFertig() {
    setEingefuehrt(true)
    onEingefuehrt?.(item.themaId)
  }

  function bewerten(bewertung) {
    if (gutGesperrt && (bewertung === BEWERTUNG.GUT || bewertung === BEWERTUNG.LEICHT)) return
    const bild = bildRef.current?.() ?? null
    onBewerten(bewertung, bild, hilfeGenutzt)
  }

  // Aktueller Stand fuer den Tasten-Handler: der wird erst nach dem
  // Neuzeichnen neu gebunden - eine Taste genau dazwischen sah sonst noch
  // den alten Stand (z. B. "nichts rueckgaengig zu machen").
  const rueckgaengigRef = useRef({ kannZurueck, onRueckgaengig })
  rueckgaengigRef.current = { kannZurueck, onRueckgaengig }

  // Kam der Fokus per Tab-Taste (dann loesen Enter/Leertaste den Knopf
  // aus) oder per Maus/Finger (dann bleibt es beim Kuerzel "aufdecken")?
  // :focus-visible taugt dafuer nicht: Chromium setzt es nach einem
  // Mausklick, sobald danach irgendeine Taste gedrueckt wird.
  const fokusPerTab = useRef(false)
  useEffect(() => {
    const tab = (e) => {
      if (e.key === 'Tab') fokusPerTab.current = true
    }
    const zeiger = () => {
      fokusPerTab.current = false
    }
    window.addEventListener('keydown', tab, true)
    window.addEventListener('pointerdown', zeiger, true)
    return () => {
      window.removeEventListener('keydown', tab, true)
      window.removeEventListener('pointerdown', zeiger, true)
    }
  }, [])

  // Tastenkuerzel. Leertaste deckt auf, Ziffern bewerten.
  useEffect(() => {
    function taste(e) {
      // Offener Dialog/Bildlupe (.schleier) liegt ueber der Karte: Ziffern
      // und Leertaste duerfen nicht die Karte dahinter bewerten.
      if (document.querySelector('.schleier')) return
      // Strg/Alt/Cmd-Kombinationen gehoeren dem Browser.
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if (!(e.key === 'Enter' && e.target.matches('textarea'))) return
      }
      // Checkboxen (Pruefpunkte) sind kein Textfeld - nach einem Klick
      // darauf blieben 1-4 sonst wirkungslos.
      const imFeld = e.target.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, select')
      if (imFeld) {
        // In einem Eingabefeld gehoert die Leertaste dem Text.
        // Enter bestaetigt die Eingabe und gibt den Fokus frei -
        // danach funktionieren die Kuerzel wie gewohnt.
        const mitStrg = e.ctrlKey || e.metaKey
        const istTextfeld = e.target.tagName === 'TEXTAREA'
        if (e.key === 'Enter' && (!istTextfeld || mitStrg)) {
          e.preventDefault()
          e.target.blur()
        }
        return
      }
      if (e.code === 'Space' || e.key === 'Enter') {
        // Per Tab angesteuerter Knopf: Enter/Leertaste loesen DIESEN Knopf
        // aus, nicht "Aufdecken". Nach einem Mausklick bleibt es beim
        // gewohnten Kuerzel (siehe fokusPerTab).
        if (fokusPerTab.current && e.target.matches('button, a')) return
        e.preventDefault()
        if (einfuehrungAktiv) einfuehrungFertig()
        else if (!aufgedeckt) setAufgedeckt(true)
        else if (art === 'blaettern' || art === 'vorab') bewerten(BEWERTUNG.GUT)
        return
      }
      if (einfuehrungAktiv) {
        // Backspace auch hier abfangen (WebKit: "Seite zurueck", siehe unten).
        if (e.key === 'Backspace') e.preventDefault()
        return
      }
      if (e.key.toLowerCase() === 'w' && aufgedeckt && vertiefungZeigen === 'einklappen') {
        setWarumOffen((o) => !o)
        return
      }
      if (e.key === 'Backspace') {
        // Immer abfangen: in WebKit heisst die Taste sonst "Seite zurueck" -
        // seit den Bildschirmadressen (#/lernen) verliesse das die Sitzung,
        // wenn gerade nichts rueckgaengig zu machen ist.
        e.preventDefault()
        if (rueckgaengigRef.current.kannZurueck) rueckgaengigRef.current.onRueckgaengig()
        return
      }
      if (e.key === 'ArrowLeft' && position > 0) {
        e.preventDefault()
        onZurueckblaettern()
        return
      }
      if (!aufgedeckt || art === 'blaettern' || art === 'vorab') {
        if (e.key.toLowerCase() === 'u' && ueberspringenErlauben) onUeberspringen()
        return
      }
      const zuordnung = stufen === 4
        ? { 1: BEWERTUNG.NOCHMAL, 2: BEWERTUNG.SCHWER, 3: BEWERTUNG.GUT, 4: BEWERTUNG.LEICHT }
        : { 1: BEWERTUNG.NOCHMAL, 2: BEWERTUNG.GUT }
      if (zuordnung[e.key]) {
        e.preventDefault()
        bewerten(zuordnung[e.key])
      }
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  })

  const schichten = Array.from({ length: Math.min(Math.max(gesamt, 1), 60) })

  // Die Spaltigkeit haengt am Aufgabentyp, nicht am Aufdeckzustand.
  // Sonst springt das Raster mitten in der Frage.
  const MIT_ARBEITSFLAECHE = ['skizze', 'bildbeschriftung', 'fehlersuche', 'vergleich', 'rechnen']
  const zweispaltig = MIT_ARBEITSFLAECHE.includes(item.typ)

  // Bildaufgaben: Zeichnung rechts, Zuordnung links unter der Frage -
  // so sieht man beides gleichzeitig, ohne zu scrollen.
  const BILDAUFGABEN = ['bildbeschriftung', 'fehlersuche']
  const istBildaufgabe = BILDAUFGABEN.includes(item.typ)
  const namen = istBildaufgabe && item.punkte ? item.punkte.map((p) => p.name) : []
  // Gemischt wie die anderen Auswahllisten (mehrfachauswahl, zuordnung) -
  // sonst liesse sich die feste Reihenfolge auswendig lernen. Einmal hier
  // berechnet, damit Bildpunkte (im Bild) und BildListe (Liste daneben)
  // dieselbe Reihenfolge zeigen.
  const namenReihenfolge = item.typ === 'bildbeschriftung' ? mischen(namen.length, seed + 11) : []
  const kategorie = kategorieAus(marke)

  // Loesung als eigener Block (38A): bei einspaltigen Aufgaben steht sie
  // NACH der eigenen Eingabe (Frage -> deine Antwort -> Loesung), bei
  // Bildaufgaben bleibt sie in der linken Spalte neben der Zeichnung.
  const antwortBlock = aufgedeckt && (
      <div className="antwort">
        {item.pruefpunkte && (
          <Pruefliste key={item.id} punkte={item.pruefpunkte} gehakt={gehakt} setGehakt={setGehakt} />
        )}
        <p className="antworttext">{item.antwort}</p>
        {/* Vertiefung (L2): "zeigen" (true), "einklappen" (erst selbst
            ueberlegen, warum - Elaboration) oder aus (false). */}
        {item.vertiefung && vertiefungZeigen === 'einklappen' && !warumOffen && (
          <button className="warumKnopf" onClick={() => setWarumOffen(true)}>
            <strong>Warum ist das so?</strong> Erst selbst überlegen, dann aufklappen
            <span className="taste">W</span>
          </button>
        )}
        {item.vertiefung && (vertiefungZeigen === true || (vertiefungZeigen === 'einklappen' && warumOffen)) && (
          <p className="vertiefung">{item.vertiefung}</p>
        )}
        {item.bild && (
          <figure style={{ margin: 0 }}>
            <Bildlupe src={item.bild} alt={item.bildunterschrift ?? ''} />
            {item.bildunterschrift && (
              <figcaption className="quelle" style={{ paddingTop: '0.5rem' }}>
                {item.bildunterschrift}
              </figcaption>
            )}
          </figure>
        )}
        <p className="quelle">{quelleText(item.quelle)}</p>
        {item.pruefhinweis && <p className="pruefhinweis">{item.pruefhinweis}</p>}
        <Normen item={item} glossar={glossar} />
        <SieheAuch ids={item.siehe} themen={themen} />
      </div>
    )

  return (
    <div role="main" className="schirm lernschirm">
      <header className="lernkopf">
        <button className="textknopf" onClick={onZurueck}>Zurück</button>
        {/* Ab 30 Karten ein durchgehender Balken statt kaum unterscheidbarer
            Kaestchen (40A); im Marathon ohnehin kein festes Ende. */}
        {gesamt > 30 || art === 'marathon' ? (
          <div className="schnitt durchgehend" role="img" aria-label={`${position} von ${gesamt}`}>
            <span style={{ width: `${art === 'marathon' ? 100 : Math.round((position / Math.max(gesamt, 1)) * 100)}%` }} />
          </div>
        ) : (
          <div className="schnitt" role="img" aria-label={`${position} von ${gesamt}`}>
            {schichten.map((_, i) => (
              <span key={i} className={i < position ? 'schicht voll' : 'schicht'} />
            ))}
          </div>
        )}
        {level && (
          <span className="lernkopfBau" title={`Stufe ${level.stufe}`}>
            <Bauabschnitt stufe={level.stufe} gestaltung={gestaltung} groesse={30} titel={false} marke={false} />
          </span>
        )}
        <span
          className="pensumZahl"
          title={faellig > 0 || neu > 0 ? `Noch ${faellig} Wiederholungen, ${neu} neue Karten` : undefined}
        >
          {art === 'marathon' ? `${position} · Marathon` : `${position} von ${gesamt}`}
        </span>
        {letzteXp > 0 && art !== 'blaettern' && <span className="xpFlug">+{letzteXp} XP</span>}
      </header>

      {einfuehrungAktiv ? (
        <Einfuehrung thema={thema} onWeiter={einfuehrungFertig} />
      ) : (
      <>
      <div className={zweispaltig ? 'lernRaster' : 'lernRaster einspurig'}>
        <article className="karteninhalt">
          <p className="herkunft">
            {art === 'vorab' && <span className="neuMarke">Erst raten · zählt nicht</span>}
            {istNeu && art !== 'vorab' && <span className="neuMarke">Neu</span>}
            {istProblem && <span className="problemMarke">Problemkarte</span>}
            {item.modulTitel} · {item.themaTitel}
            {item.geprueft === false && <span className="ungeprueft">ungeprüft</span>}
            {item.bearbeitet && <span className="bearbeitetMarke">bearbeitet</span>}
          </p>

          <h1 className="frage">
            {item.typ === 'rechnen'
              ? textFuellen(item.frage, werteZiehen(item.variablen, seed), item.variablen)
              : item.frage}
          </h1>

          {/* Erklaerung: bei neuen Karten vorab, sonst nach dem Aufdecken -
              gerade nach einem Fehler hilft das Nachlesen am meisten (7A). */}
          {art !== 'vorab' && (istNeu || aufgedeckt || zweiterVersuch) && thema?.erklaerung && (
            <div className="erklaerkasten">
              <button className="textknopf" onClick={() => setErklaerungOffen((o) => !o)}>
                {erklaerungOffen ? 'Erklärung ausblenden' : 'Erklärung zum Thema zeigen'}
              </button>
              {erklaerungOffen && (
                <div className="erklaerungText" style={{ marginTop: '0.75rem' }}>
                  {(thema.erklaerung.absaetze ?? []).map((a, i) => (
                    <p key={i} className="erklaerungAbsatz">{a}</p>
                  ))}
                  {thema.erklaerung.merksatz && (
                    <p className="merksatz">{thema.erklaerung.merksatz}</p>
                  )}
                  {/* Bild der Erklaerung als eigener Aufklapper (D2): die
                      Zeichnung erklaert oft mehr als der Text. */}
                  {thema.erklaerung.bild && (
                    <div className="erklaerbild">
                      <button className="textknopf" onClick={() => setErklaerbildOffen((o) => !o)}>
                        {erklaerbildOffen ? 'Zeichnung ausblenden' : 'Zeichnung zur Erklärung zeigen'}
                      </button>
                      {erklaerbildOffen && (
                        <figure style={{ margin: '0.5rem 0 0' }}>
                          <Bildlupe src={thema.erklaerung.bild} alt={thema.erklaerung.bildunterschrift ?? ''} />
                          {thema.erklaerung.bildunterschrift && (
                            <figcaption className="quelle" style={{ paddingTop: '0.5rem' }}>
                              {thema.erklaerung.bildunterschrift}
                            </figcaption>
                          )}
                        </figure>
                      )}
                    </div>
                  )}
                  {thema.erklaerung.quelle && <p className="quelle">{quelleText(thema.erklaerung.quelle)}</p>}
                </div>
              )}
            </div>
          )}

          {istBildaufgabe && (
            <BildListe
              item={item}
              wert={eingabe}
              setWert={setEingabe}
              gesperrt={aufgedeckt}
              namen={namen}
              reihenfolge={namenReihenfolge}
            />
          )}

          {zweispaltig && antwortBlock}

          {gemeldetHinweis && !aufgedeckt && (
            <p className="problemHinweis">
              Vorige Karte gemeldet – sie steht auf „Überarbeiten“ und kommt nicht mehr dran,
              bis sie überarbeitet ist.{' '}
              <button className="textknopf" onClick={onHinweisGelesen}>ausblenden</button>
            </p>
          )}

          {istProblem && aufgedeckt && (
            <p className="problemHinweis">
              Diese Karte klappt bisher nicht ({'≥'}6 Fehler). Erklärung zum Thema lesen – oder
              melden, falls die Karte selbst das Problem ist. Sie steht ohnehin schon in der
              Meldeliste für den Web-Chat.{' '}
              {!meldenOffen && (
                <button className="textknopf" onClick={() => setMeldenOffen(true)}>Melden</button>
              )}
            </p>
          )}

          <div className="marken">
            <button
              className={marke?.lesezeichen ? 'markenKnopf aktiv' : 'markenKnopf'}
              onClick={() => onMarke(item.id, { lesezeichen: !marke?.lesezeichen })}
            >
              Lesezeichen
            </button>
            <button
              className={marke?.notiz ? 'markenKnopf aktiv' : 'markenKnopf'}
              onClick={() => setNotizOffen((n) => !n)}
            >
              Notiz
            </button>
            <button
              className={marke?.meldung ? 'markenKnopf aktiv' : 'markenKnopf'}
              onClick={() => setMeldenOffen((o) => !o)}
            >
              {marke?.meldung ? '⚑︎ Gemeldet' : '⚑︎ Melden'}
            </button>
            {item.geprueft === false && (
              <button
                className={marke?.freigabe ? 'markenKnopf aktiv' : 'markenKnopf'}
                title="Du hast den Prüfhinweis selbst gegen die aktuelle Fassung geprüft"
                onClick={() => setFreigabeOffen((o) => !o)}
              >
                {marke?.freigabe ? '✓︎ Selbst geprüft' : 'Selbst geprüft'}
              </button>
            )}
            <span className="markenTrenner" />
            {/* Am Desktop display:contents (wirkungslos), mobil eine eigene
                Zeile, damit "Sichtung:" nicht allein am Zeilenende haengt. */}
            <span className="markenGruppe">
              <span className="zeileHinweis">Sichtung:</span>
              {KATEGORIEN.map((k) => (
                <button
                  key={k.id}
                  className={kategorie.id === k.id ? 'markenKnopf aktiv' : 'markenKnopf'}
                  title={`Als "${k.name}" einordnen`}
                  onClick={() =>
                    onMarke(item.id, { kategorie: kategorie.id === k.id ? null : k.id })
                  }
                >
                  {k.symbol} {k.name}
                </button>
              ))}
            </span>
            {kurse.length > 0 && onKurs && (
              <span className="markenGruppe">
                <span className="zeileHinweis">Kurs:</span>
                {kurse.map((k) => {
                  const drin = (marke?.kurse ?? []).includes(k.id)
                  return (
                    <button
                      key={k.id}
                      className={drin ? 'markenKnopf aktiv' : 'markenKnopf'}
                      title={drin ? `Aus dem Kurs "${k.titel}" nehmen` : `Zum Kurs "${k.titel}" hinzufügen`}
                      onClick={() => onKurs(item.id, k.id, !drin)}
                    >
                      {drin ? '✓︎' : '+︎'} {k.titel}
                    </button>
                  )
                })}
              </span>
            )}
          </div>

          {meldenOffen && (
            <MeldenFeld
              key={item.id}
              meldung={marke?.meldung}
              onMelden={async (meldung) => {
                const neu = !marke?.meldung
                await onMarke(item.id, { ...meldenAenderung(marke, meldung), meldung })
                setMeldenOffen(false)
                // Erstmals gemeldet: Karte aus der Sitzung nehmen und weiter.
                if (neu) onGemeldet?.(item.id)
              }}
              onZurueckziehen={() => {
                onMarke(item.id, zurueckziehenAenderung(marke))
                setMeldenOffen(false)
              }}
              onSchliessen={() => setMeldenOffen(false)}
            />
          )}

          {freigabeOffen && (
            <FreigabeFeld
              key={item.id}
              freigabe={marke?.freigabe}
              pruefhinweis={item.pruefhinweis}
              onSpeichern={(text) => {
                onMarke(item.id, { freigabe: { text, ts: Date.now() } })
                setFreigabeOffen(false)
              }}
              onZuruecknehmen={() => {
                onMarke(item.id, { freigabe: null })
                setFreigabeOffen(false)
              }}
              onSchliessen={() => setFreigabeOffen(false)}
            />
          )}

          {notizOffen && (
            <Notizfeld
              key={item.id}
              wert={marke?.notiz}
              onSpeichern={(t) => onMarke(item.id, { notiz: t })}
            />
          )}
        </article>

        <div className="arbeitsflaeche">
          {art === 'training' && hilfeGenutzt && !aufgedeckt && item.referenz && (
            <div style={{ marginBottom: '1rem' }}>
              <p className="zeileHinweis">Hilfe genutzt – dieses Item zählt mit halber XP.</p>
              <Bildlupe src={item.referenz} alt="Referenz" />
            </div>
          )}
          <Eingabefeld
            item={item}
            wert={eingabe}
            setWert={setEingabe}
            gesperrt={aufgedeckt}
            bildRef={bildRef}
            seed={seed}
            namenReihenfolge={namenReihenfolge}
          />

          {aufgedeckt && item.typ === 'skizze' && item.referenz && (
            <div style={{ marginTop: '1rem' }}>
              <Bildlupe src={item.referenz} alt="Referenzzeichnung" />
            </div>
          )}

          {aufgedeckt && fruehereSkizzen?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h2 className="abschnitt">Deine früheren Versuche</h2>
              <div className="skizzenband">
                {fruehereSkizzen.slice(-6).map((s) => (
                  <img key={s.id} src={s.bild} alt=""
                       title={new Date(s.ts).toLocaleDateString('de-DE')} />
                ))}
              </div>
            </div>
          )}
        </div>

        {!zweispaltig && antwortBlock}
      </div>

      <div className="steuerung">
        {!aufgedeckt ? (
          <div className="arten">
            <button className="knopf haupt" onClick={() => setAufgedeckt(true)}>
              {item.typ === 'skizze' ? 'Referenz zeigen' : 'Antwort zeigen'}
              <span className="taste">Leertaste</span>
            </button>
            {art === 'training' && item.referenz && !hilfeGenutzt && (
              <button className="artKnopf" onClick={() => setHilfeGenutzt(true)}>
                Referenz kurz zeigen <span className="taste bleibt">halbe XP</span>
              </button>
            )}
            {position > 0 && (
              <button className="artKnopf" onClick={onZurueckblaettern}>
                Zurück <span className="taste">←</span>
              </button>
            )}
            {ueberspringenErlauben && art !== 'blaettern' && (
              <button className="artKnopf" onClick={onUeberspringen}>
                Überspringen <span className="taste">U</span>
              </button>
            )}
            {kannZurueck && (
              <button className="artKnopf" onClick={onRueckgaengig}>
                Rückgängig <span className="taste">⌫</span>
              </button>
            )}
          </div>
        ) : art === 'blaettern' || art === 'vorab' ? (
          <>
            {art === 'vorab' && (
              <p className={urteil ? `urteilZeile ${urteil}` : 'urteilZeile'}>
                {urteil === 'richtig'
                  ? 'Richtig geraten.'
                  : urteil === 'falsch'
                    ? 'Daneben – macht nichts: Wer vorher rät, behält die Erklärung danach besser.'
                    : 'Vorab-Frage – zählt nicht für die Planung.'}
              </p>
            )}
            <button className="knopf haupt" onClick={() => bewerten(BEWERTUNG.GUT)}>
              {art === 'vorab' && position + 1 >= gesamt ? 'Zur Erklärung' : 'Weiter'} <span className="taste">Leertaste</span>
            </button>
          </>
        ) : (
          <>
            {urteil && (
              <p className={urteil === 'richtig' ? 'urteilZeile richtig' : 'urteilZeile falsch'}>
                {urteil === 'richtig'
                  ? 'Automatisch als richtig erkannt – Bewertung vorgeschlagen.'
                  : 'Automatisch als falsch erkannt – bei einem Vertipper bitte korrigieren.'}
              </p>
            )}
            {zweiterVersuch ? (
              <p className="urteilZeile">
                Zweiter Versuch – zählt nicht mehr für die Planung. Bei „Nochmal“ kommt die Karte nicht mehr in dieser Sitzung.
              </p>
            ) : heuteBewertet && (
              <p className="urteilZeile">
                Heute schon bewertet – diese Antwort ändert die Planung nicht mehr.
              </p>
            )}
            {pruefpunkte.length > 0 && (
              <p className="urteilZeile">
                {gutGesperrt
                  ? `Prüfpunkte: ${gehakt.length} von ${pruefpunkte.length} abgehakt – „Gut“ gibt es erst, wenn alle sitzen.`
                  : 'Alle Prüfpunkte abgehakt – „Gut“ vorgeschlagen.'}
              </p>
            )}
            <div className="bewertung">
              <button
                className={vorschlag === BEWERTUNG.NOCHMAL ? 'knopf vorschlag' : 'knopf'}
                onClick={() => bewerten(BEWERTUNG.NOCHMAL)}
              >
                <span className="bewertungZeile">Nochmal <span className="taste">1</span></span>
                <small className="bewertungBedeutung">nicht gewusst</small>
                {intervalle && <small className="intervallHinweis">{intervallKurz(intervalle[BEWERTUNG.NOCHMAL])}</small>}
              </button>
              {stufen === 4 && (
                <button
                  className={vorschlag === BEWERTUNG.SCHWER ? 'knopf vorschlag' : 'knopf'}
                  onClick={() => bewerten(BEWERTUNG.SCHWER)}
                >
                  <span className="bewertungZeile">Schwer <span className="taste">2</span></span>
                  <small className="bewertungBedeutung">mit Mühe</small>
                  {intervalle && <small className="intervallHinweis">{intervallKurz(intervalle[BEWERTUNG.SCHWER])}</small>}
                </button>
              )}
              <button
                className={vorschlag === BEWERTUNG.GUT ? 'knopf vorschlag' : 'knopf'}
                disabled={gutGesperrt}
                title={gutGesperrt ? 'Erst alle Prüfpunkte abhaken' : undefined}
                onClick={() => bewerten(BEWERTUNG.GUT)}
              >
                <span className="bewertungZeile">Gut <span className="taste">{stufen === 4 ? '3' : '2'}</span></span>
                <small className="bewertungBedeutung">gewusst</small>
                {intervalle && <small className="intervallHinweis">{intervallKurz(intervalle[BEWERTUNG.GUT])}</small>}
              </button>
              {stufen === 4 && (
                <button
                  className="knopf"
                  disabled={gutGesperrt}
                  title={gutGesperrt ? 'Erst alle Prüfpunkte abhaken' : undefined}
                  onClick={() => bewerten(BEWERTUNG.LEICHT)}
                >
                  <span className="bewertungZeile">Leicht <span className="taste">4</span></span>
                  <small className="bewertungBedeutung">sofort gewusst</small>
                  {intervalle && <small className="intervallHinweis">{intervallKurz(intervalle[BEWERTUNG.LEICHT])}</small>}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      </>
      )}
    </div>
  )
}

// Einfuehrungsschritt (D4, 2026-10-13): vor der ersten neuen Karte eines
// Themas, das noch nie geuebt wurde, steht die Erklaerung einmal ganz -
// erst verstehen, dann abfragen. Danach ist sie in den Karten zugeklappt.
function Einfuehrung({ thema, onWeiter }) {
  const e = thema.erklaerung
  return (
    <div className="einfuehrung">
      <p className="herkunft">
        <span className="neuMarke">Neues Thema</span>
        {thema.modulTitel}
      </p>
      <h1 className="ueberschrift">{thema.titel}</h1>
      {thema.lernziele?.length > 0 && (
        <section className="lernziele">
          <h2 className="abschnitt">Lernziele</h2>
          <ul>
            {thema.lernziele.map((z, i) => <li key={i}>{z}</li>)}
          </ul>
        </section>
      )}
      <div className="erklaerung">
        <div className="erklaerungText">
          {(e.absaetze ?? []).map((a, i) => <p key={i} className="erklaerungAbsatz">{a}</p>)}
          {e.merksatz && <p className="merksatz">{e.merksatz}</p>}
        </div>
        {(e.bild || thema.bild) && (
          <figure style={{ margin: 0 }}>
            <Bildlupe src={e.bild ?? thema.bild} alt={e.bildunterschrift ?? ''} />
            {e.bildunterschrift && (
              <figcaption className="quelle" style={{ paddingTop: '0.5rem' }}>{e.bildunterschrift}</figcaption>
            )}
          </figure>
        )}
      </div>
      {e.quelle && <p className="quelle">{quelleText(e.quelle)}</p>}
      <div className="steuerung">
        <button className="knopf haupt" onClick={onWeiter}>
          Zur ersten Karte <span className="taste">Leertaste</span>
        </button>
      </div>
    </div>
  )
}

// Zuordnungsliste zur Bildaufgabe. Zeigt denselben Zustand wie die
// Punkte im Bild - anklickbar ist beides.
function BildListe({ item, wert, setWert, gesperrt, namen, reihenfolge }) {
  if (item.typ === 'fehlersuche') {
    return (
      <div className="bildListe">
        {!gesperrt ? (
          <p className="zeileHinweis">
            Klicke im Bild den Bereich an, in dem der Fehler steckt.
            {wert ? ` Gewählt: Bereich ${wert}.` : ''}
          </p>
        ) : (
          <p className="merksatz">Fehler in Bereich {item.fehlerNr}: {item.folge}</p>
        )}
      </div>
    )
  }

  const zuordnung = wert ?? {}
  const offen = item.punkte.filter((p) => zuordnung[p.nr] === undefined).length

  return (
    <div className="bildListe">
      {!gesperrt && (
        <p className="zeileHinweis">
          Klicke eine Zahl im Bild an und wähle die Bezeichnung. Noch {offen} offen.
        </p>
      )}
      <ul className="zuordnungsliste">
        {item.punkte.map((p, i) => {
          const gewaehltIndex = zuordnung[p.nr]
          const richtig = gesperrt && gewaehltIndex === i
          return (
            <li key={p.nr} className={gesperrt ? (richtig ? 'richtig' : 'falsch') : ''}>
              <span className="zuordnungNr">{p.nr}</span>
              {gesperrt ? (
                <span className="zuordnungText">
                  {p.name}
                  {!richtig && gewaehltIndex !== undefined && (
                    <span className="zuordnungDaneben"> statt {namen[gewaehltIndex]}</span>
                  )}
                </span>
              ) : (
                <Auswahl
                  wert={gewaehltIndex ?? ''}
                  leer="bitte benennen …"
                  titel={`Punkt ${p.nr} benennen`}
                  optionen={reihenfolge.map((j) => ({ wert: j, text: namen[j] }))}
                  onWahl={(j) => setWert({ ...zuordnung, [p.nr]: j })}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Pruefliste({ punkte, gehakt, setGehakt }) {
  return (
    <>
      <ul className="pruefpunkte">
        {punkte.map((text, i) => (
          <li key={i}>
            <input
              type="checkbox"
              id={`pp-${i}`}
              checked={gehakt.includes(i)}
              onChange={() =>
                setGehakt((g) => (g.includes(i) ? g.filter((x) => x !== i) : [...g, i]))
              }
            />
            <label htmlFor={`pp-${i}`}>{text}</label>
          </li>
        ))}
      </ul>
      <p className="pruefstand">{gehakt.length} von {punkte.length} getroffen</p>
    </>
  )
}

function Eingabefeld({ item, wert, setWert, gesperrt, bildRef, seed, namenReihenfolge }) {
  // Bildaufgaben: die Zeichnung gehoert in die Arbeitsflaeche. Ohne diese
  // beiden Zweige fiel Eingabefeld bis hierher durch bis zum return null -
  // die Fehlersuche zeigte gar nichts, die Bildbeschriftung nur die Liste.
  if (item.typ === 'bildbeschriftung') {
    const zuordnung = wert ?? {}
    return (
      <Bildpunkte
        referenz={item.referenz}
        punkte={item.punkte}
        zuordnung={zuordnung}
        namen={item.punkte.map((p) => p.name)}
        aufgedeckt={gesperrt}
        onWahl={(nr, index) => setWert({ ...zuordnung, [nr]: index })}
        reihenfolge={namenReihenfolge}
      />
    )
  }

  if (item.typ === 'fehlersuche') {
    return (
      <Bildpunkte
        referenz={item.referenz}
        punkte={item.bereiche}
        aufgedeckt={gesperrt}
        gewaehlt={wert ?? null}
        onWahl={(nr) => setWert(nr)}
        loesung={gesperrt ? item.fehlerNr : null}
      />
    )
  }

  if (item.typ === 'skizze') {
    return <Skizzenfeld referenz={item.referenz} aufgedeckt={gesperrt} bildRef={bildRef} />
  }

  if (item.typ === 'fall') {
    return <Fallaufgabe key={item.id + seed} item={item} gesperrt={gesperrt} />
  }

  if (item.typ === 'mehrfachauswahl') {
    const reihe = mischen(item.optionen.length, seed)
    const gewaehlt = wert ?? []
    return (
      <ul className="optionen">
        {reihe.map((i) => {
          const aktiv = gewaehlt.includes(i)
          const richtig = item.richtig.includes(i)
          // Nach dem Aufdecken drei Zustaende (D3, 2026-10-13): richtig
          // gewaehlt, richtig aber uebersehen, falsch gewaehlt - frueher sahen
          // die ersten beiden gleich aus.
          const zustand = !gesperrt ? null : richtig ? (aktiv ? 'richtig' : 'uebersehen') : aktiv ? 'falsch' : null
          const klasse = ['option', aktiv ? 'aktiv' : '', zustand ?? ''].join(' ')
          return (
            <li key={i}>
              <button
                className={klasse}
                disabled={gesperrt}
                onClick={() => setWert(aktiv ? gewaehlt.filter((g) => g !== i) : [...gewaehlt, i])}
              >
                {zustand && (
                  <span className="optionZeichen" aria-hidden="true">
                    {zustand === 'richtig' ? '✓︎' : zustand === 'falsch' ? '✗︎' : '○︎'}
                  </span>
                )}
                {item.optionen[i]}
                {zustand === 'uebersehen' && <span className="optionMarke">übersehen</span>}
                {/* Begruendung je Option (Feld "warum", 21A) - erst nach dem
                    Aufdecken, sonst verraete sie die Loesung. */}
                {gesperrt && item.warum?.[i] && <span className="optionWarum">{item.warum[i]}</span>}
              </button>
            </li>
          )
        })}
        {gesperrt && <Trefferzeile item={item} gewaehlt={gewaehlt} />}
      </ul>
    )
  }

  if (item.typ === 'numerisch') {
    const zahl = parseFloat(String(wert ?? '').replace(',', '.'))
    const trifft = Math.abs(zahl - item.wert) <= (item.toleranz ?? 0)
    return (
      <div className="zahlzeile">
        <input
          className="zahl"
          inputMode="decimal"
          value={wert ?? ''}
          disabled={gesperrt}
          onChange={(e) => setWert(e.target.value)}
          placeholder="Wert"
        />
        <span className="einheit">{item.einheit}</span>
        {gesperrt && !Number.isNaN(zahl) && (
          <span className={trifft ? 'urteil richtig' : 'urteil falsch'}>
            {trifft ? 'im Rahmen' : `Soll: ${item.wert}`}
          </span>
        )}
        {!gesperrt && <span className="feldhinweis">Enter bestätigt, dann Leertaste</span>}
      </div>
    )
  }

  // Zuordnung wird jetzt tatsaechlich abgefragt: Die rechte Spalte ist
  // gemischt, die Zuweisung erfolgt ueber Auswahlfelder.
  // Freitext beim Lernen ohne Schreibfeld (Nutzerwunsch 2026-10-14): im Kopf
  // beantworten, aufdecken, selbst bewerten - wie eine Karteikarte. In
  // Pruefungen bleibt das Schreibfeld (eigenes Markup in Pruefung.jsx).
  if (item.typ === 'freitext') return null

  if (item.typ === 'vergleich') {
    return (
      <div className="vergleich">
        {item.seiten.map((seite, i) => {
          const gewaehlt = wert === i
          const richtig = gesperrt && i === item.richtig
          const klasse = [
            'vergleichSeite',
            gewaehlt ? 'aktiv' : '',
            richtig ? 'richtig' : '',
            gesperrt && gewaehlt && !richtig ? 'falsch' : '',
          ].join(' ')
          return (
            <div key={i} className="vergleichSpalte">
              <button className={klasse} disabled={gesperrt} onClick={() => setWert(i)}>
                <span className="vergleichTitel">{seite.titel}</span>
                {seite.bild && <LokalBild src={seite.bild} alt="" />}
                <span className="vergleichText">{seite.beschreibung}</span>
              </button>
              {/* Die Bilder stecken im Auswahlknopf - Lupe daher daneben (D1) */}
              {seite.bild && <LupenLink src={seite.bild} alt={seite.titel ?? ''} />}
            </div>
          )
        })}
      </div>
    )
  }

  if (item.typ === 'rechnen') {
    const werte = werteZiehen(item.variablen, seed)
    let soll = null
    try {
      soll = rechnen(item.formel, werte)
    } catch {
      soll = null
    }
    const zahl = parseFloat(String(wert ?? '').replace(',', '.'))
    const toleranz = item.toleranz ?? (soll !== null ? Math.abs(soll) * 0.02 : 0)
    return (
      <div className="beschriftung">
        <ul className="gegebene">
          {item.variablen.map((v) => (
            <li key={v.name}>
              <span className="paarLinks">{v.titel ?? v.name}</span>
              <span className="paarRechts">
                {Number(werte[v.name].toFixed(v.stellen ?? 3))} {v.einheit ?? ''}
              </span>
            </li>
          ))}
        </ul>
        <div className="zahlzeile">
          <input
            className="zahl"
            inputMode="decimal"
            value={wert ?? ''}
            disabled={gesperrt}
            onChange={(e) => setWert(e.target.value)}
            placeholder="Ergebnis"
          />
          <span className="einheit">{item.einheit}</span>
          {!gesperrt && <span className="feldhinweis">Enter bestätigt, dann Leertaste</span>}
          {gesperrt && soll !== null && (
            <span className={Math.abs(zahl - soll) <= toleranz ? 'urteil richtig' : 'urteil falsch'}>
              Soll: {Number(soll.toFixed(item.stellen ?? 3))} {item.einheit}
            </span>
          )}
        </div>
        {gesperrt && item.loesungsweg && (
          <p className="merksatz">{textFuellen(item.loesungsweg, werte, item.variablen)}</p>
        )}
      </div>
    )
  }

  if (item.typ === 'reihenfolge') {
    // Antippen zum Einsortieren (D7, 2026-10-13): die Schritte in der
    // richtigen Reihenfolge antippen, sie wandern nach oben; ein Tipp auf
    // einen eingeordneten Schritt nimmt ihn (und alles danach) zurueck.
    // Frueher nur Pfeile - bei 6-8 Schritten viele Tipper am Handy.
    const gewaehlt = wert ?? []
    const vorrat = mischen(item.schritte.length, seed + 3).filter((i) => !gewaehlt.includes(i))
    const anzeige = gesperrt ? [...gewaehlt, ...vorrat] : gewaehlt
    return (
      <div className="reihenAuswahl">
        {anzeige.length > 0 && (
          <ol className="reihenfolge">
            {anzeige.map((index, platz) => {
              const richtig = gesperrt && index === platz
              const ungesetzt = gesperrt && platz >= gewaehlt.length
              return (
                <li key={index} className={gesperrt ? (richtig ? 'richtig' : 'falsch') : ''}>
                  <span className="reihenNr">{platz + 1}</span>
                  {gesperrt ? (
                    <span className="reihenText">
                      {item.schritte[index]}
                      {ungesetzt && <span className="zuordnungDaneben"> (nicht eingeordnet)</span>}
                      {!richtig && <span className="zuordnungDaneben"> – richtig: {item.schritte[platz]}</span>}
                    </span>
                  ) : (
                    <button
                      className="reihenText reihenZurueck"
                      title="Zurücknehmen"
                      onClick={() => setWert(gewaehlt.slice(0, platz))}
                    >
                      {item.schritte[index]}
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        {!gesperrt && vorrat.length > 0 && (
          <>
            <p className="zeileHinweis">
              {gewaehlt.length === 0 ? 'Tippe die Schritte in der richtigen Reihenfolge an.' : `Noch ${vorrat.length} einordnen – Tipp auf einen eingeordneten Schritt nimmt ihn zurück.`}
            </p>
            <ul className="reihenVorrat">
              {vorrat.map((index) => (
                <li key={index}>
                  <button className="option" onClick={() => setWert([...gewaehlt, index])}>
                    {item.schritte[index]}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }

  if (item.typ === 'zuordnung') {
    const reihe = mischen(item.paare.length, seed + 7)
    const zuordnung = wert ?? {}
    return (
      <ul className="paare">
        {item.paare.map(([links], i) => {
          const gewaehlt = zuordnung[i]
          const richtig = gesperrt && paarRichtig(item, i, gewaehlt)
          return (
            <li key={i} className={gesperrt ? (richtig ? 'paarRichtig' : 'paarFalsch') : ''}>
              <span className="paarLinks">{links}</span>
              {gesperrt ? (
                <span className="paarRechts">{item.paare[i][1]}</span>
              ) : (
                <Auswahl
                  wert={ersterPaarIndex(item, gewaehlt) ?? ''}
                  leer="bitte zuordnen …"
                  titel={links}
                  optionen={paarOptionen(item, reihe).map((j) => ({ wert: j, text: item.paare[j][1] }))}
                  onWahl={(j) => setWert({ ...zuordnung, [i]: j })}
                />
              )}
            </li>
          )
        })}
      </ul>
    )
  }

  return null
}

// Trefferzeile zur Mehrfachauswahl (D3): wie viele der richtigen Optionen
// gewaehlt, wie viele falsche zu viel.
function Trefferzeile({ item, gewaehlt }) {
  const richtig = new Set(item.richtig)
  const getroffen = gewaehlt.filter((g) => richtig.has(g)).length
  const zuViel = gewaehlt.filter((g) => !richtig.has(g)).length
  const teile = [`${getroffen} von ${richtig.size} richtigen gewählt`]
  if (richtig.size - getroffen > 0) teile.push(`${richtig.size - getroffen} übersehen`)
  if (zuViel > 0) teile.push(`${zuViel} zu viel`)
  return <li className="trefferZeile">{teile.join(' · ')}</li>
}

// Freigabe einer ungeprueften Karte (P8, 2026-10-13): Der Nutzer hat den
// Pruefhinweis selbst nachgeschlagen. Geht als Pruefauftrag in den Export
// ("Freigaben") - die Karte selbst bleibt ungeprueft, bis der Pruef-Chat
// sie mit Fundstelle freigibt.
function FreigabeFeld({ freigabe, pruefhinweis, onSpeichern, onZuruecknehmen, onSchliessen }) {
  const [text, setText] = useState(freigabe?.text ?? '')
  return (
    <div className="meldenFeld">
      <p className="zeileTitel">Selbst geprüft</p>
      {pruefhinweis && <p className="zeileHinweis">Prüfhinweis: {pruefhinweis}</p>}
      <textarea
        className="notizfeld"
        value={text}
        placeholder="Wogegen geprüft? z. B. „DIN 4108-3:2018, Tab. 2 – Wert gilt unverändert“"
        onChange={(e) => setText(e.target.value)}
      />
      <p className="zeileHinweis">
        Geht in den Meldungen-Export unter „Freigaben“. Die Karte bleibt „ungeprüft“, bis der Prüf-Chat
        sie mit Fundstelle freigibt.
      </p>
      <div className="wahl">
        <button className="knopf schmal" onClick={() => onSpeichern(text.trim())}>
          {freigabe ? 'Ändern' : 'Als geprüft vormerken'}
        </button>
        {freigabe && (
          <button className="knopf schmal" onClick={onZuruecknehmen}>
            Zurücknehmen
          </button>
        )}
        <button className="textknopf" onClick={onSchliessen}>Abbrechen</button>
      </div>
    </div>
  )
}
