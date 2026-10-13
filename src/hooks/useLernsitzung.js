import { useEffect, useRef, useState } from 'react'
import { skizzeSpeichern, ereignisSpeichern, ereignisLoeschen } from '../lib/speicher.js'
import { BEWERTUNG, pensumBauen, pensumNachNochmal } from '../lib/planer.js'
import { xpFuerEreignis } from '../lib/fortschritt.js'
import { verwandteNebeneinander } from '../lib/verwandt.js'

// Vorab-Fragen (L1, 2026-10-13): nur Typen, die die App selbst auswerten
// kann - beim Raten vor der Erklaerung soll die Rueckmeldung sofort kommen.
const VORAB_TYPEN = ['mehrfachauswahl', 'numerisch', 'zuordnung', 'reihenfolge', 'vergleich']

// ALTER_SITZUNG_SCHLUESSEL war der einzige, profillose Speicherort vor
// der Einfuehrung von Nutzerprofilen - fuer die einmalige Uebernahme.
export const ALTER_SITZUNG_SCHLUESSEL = 'offeneSitzung'

function sitzungSchluesselFuer(profilId) {
  return `offeneSitzung_${profilId}`
}

// Feste Reihenfolge waere auswendig lernbar - deshalb wird bei jedem
// Sitzungsstart neu gemischt.
function mischen(liste) {
  const kopie = [...liste]
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[kopie[i], kopie[j]] = [kopie[j], kopie[i]]
  }
  return kopie
}

// Buendelt alles rund um eine laufende Lernsitzung: welches Pensum,
// an welcher Position, wie es nach einer Bewertung weitergeht und wie
// eine Bewertung als Ereignis landet. App.jsx bleibt so auf
// Datenhaltung und Bildschirmwahl beschraenkt - die Sitzungslogik
// lebt an genau einer Stelle.
export function useLernsitzung({
  profilId,
  erlaubteItems,
  zustaende,
  opt,
  baustellenStapel,
  skizzenStapel,
  neueItems,
  setEreignisse,
  setSkizzen,
  setAnsicht,
  setErklaerthema,
  verwandtschaft = new Map(),
  onSpeicherfehler,
  onSitzungsende,
}) {
  const [sitzung, setSitzung] = useState(null)
  const [position, setPosition] = useState(0)
  const [letzteXp, setLetzteXp] = useState(0)
  // Stapel der bisherigen Bewertungen dieser Sitzung, neueste zuletzt -
  // erlaubt mehrstufiges Rueckgaengig statt nur einen Schritt zurueck.
  // Auf 50 begrenzt, damit eine lange Marathon-Sitzung nicht unbegrenzt waechst.
  const [verlauf, setVerlauf] = useState([])
  const [offeneSitzung, setOffeneSitzung] = useState(null)
  const startZeit = useRef(Date.now())
  // Bilanz der laufenden Sitzung fuer die Meldung am Ende (Nutzer-
  // entscheidung 9B: kurze Meldung statt eigener Abschlusskarte).
  const bilanz = useRef({ antworten: 0, richtig: 0, start: Date.now() })
  function bilanzMelden() {
    const b = bilanz.current
    if (b.antworten > 0) onSitzungsende?.({ ...b, minuten: Math.max(1, Math.round((Date.now() - b.start) / 60000)) })
    bilanz.current = { antworten: 0, richtig: 0, start: Date.now() }
  }
  const sitzungSchluessel = sitzungSchluesselFuer(profilId)

  useEffect(() => {
    try {
      const roh = localStorage.getItem(sitzungSchluessel)
      if (roh) setOffeneSitzung(JSON.parse(roh))
    } catch {
      /* ignorieren */
    }
    // profilId aendert sich innerhalb eines gemounteten Hooks nicht -
    // App.jsx wird beim Profilwechsel per key={profilId} neu montiert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function sitzungSichern(neueSitzung, pos) {
    if (!neueSitzung) {
      localStorage.removeItem(sitzungSchluessel)
      setOffeneSitzung(null)
      return
    }
    const daten = {
      art: neueSitzung.art,
      ids: neueSitzung.pensum.map((i) => i.id),
      position: pos,
      ts: Date.now(),
      // Bilanz reist mit: nach einem Neuladen nannte die Schlussmeldung
      // sonst nur die Antworten seit dem Fortsetzen.
      bilanz: { ...bilanz.current },
    }
    localStorage.setItem(sitzungSchluessel, JSON.stringify(daten))
    setOffeneSitzung(daten)
  }

  function sitzungStarten(art = 'ueben', bereich = {}) {
    let grundmenge = erlaubteItems
    if (bereich.modulId) grundmenge = grundmenge.filter((i) => i.modulId === bereich.modulId)
    if (bereich.themaId) grundmenge = grundmenge.filter((i) => i.themaId === bereich.themaId)
    // Kurs (kurs.js): nur die Fragen des Kurses, sonst alles wie gewohnt.
    if (bereich.kursIds) grundmenge = grundmenge.filter((i) => bereich.kursIds.has(i.id))

    let pensum
    if (art === 'baustellen') pensum = baustellenStapel.filter((i) => grundmenge.includes(i))
    else if (art === 'skizzen') pensum = skizzenStapel.filter((i) => grundmenge.includes(i))
    else if (art === 'neu') pensum = neueItems.filter((i) => grundmenge.includes(i))
    else if (art === 'training') pensum = skizzenStapel.filter((i) => grundmenge.includes(i))
    else if (art === 'fehlerstapel') {
      const menge = new Set(bereich.ids ?? [])
      pensum = mischen(erlaubteItems.filter((i) => menge.has(i.id)))
    }
    else if (art === 'marathon') {
      // Endlos: Der Stapel wird beim Aufbrauchen nachgefuellt, Fehler
      // kommen ohnehin ans Ende. Beendet wird von Hand.
      pensum = mischen(grundmenge)
    }
    else if (art === 'schnell') {
      // Zwei Minuten, so viele wie moeglich - bewusst kurze Itemtypen.
      pensum = mischen(
        grundmenge.filter((i) => ['karte', 'mehrfachauswahl', 'numerisch'].includes(i.typ))
      ).slice(0, 25)
    }
    else if (art === 'blaettern') pensum = grundmenge
    else if (art === 'vorab') {
      // "Erst raten": drei noch nie beantwortete Karten des Themas, bevorzugt
      // automatisch auswertbare. Zaehlt nicht fuer die Planung (bewerten).
      const offen = mischen(grundmenge.filter((i) => !zustaende.has(i.id)))
      const auswertbar = offen.filter((i) => VORAB_TYPEN.includes(i.typ))
      pensum = [...auswertbar, ...offen.filter((i) => !VORAB_TYPEN.includes(i.typ))].slice(0, 3)
    }
    else if (art === 'kursplan' || art === 'endspurt') {
      // Fertig berechnete Reihenfolge aus kurs.js (Klausurplan/Endspurt).
      const nachId = new Map(grundmenge.map((i) => [i.id, i]))
      pensum = (bereich.ids ?? []).map((id) => nachId.get(id)).filter(Boolean)
    }
    else {
      pensum = pensumBauen(grundmenge, zustaende, {
        neuProTag: opt.neuProTag,
        maxProTag: opt.maxProTag,
      }).pensum
    }

    if (opt.reihenfolge === 'gemischt' && art !== 'blaettern') pensum = mischen(pensum)
    // Verwechslungspaare (L4): im normalen Tagespensum verwandte Karten
    // verschiedener Themen nacheinander - nur bei gemischter Reihenfolge,
    // die feste Themenreihenfolge bleibt unangetastet.
    if (opt.reihenfolge === 'gemischt' && (art === 'ueben' || art === 'heute')) {
      pensum = verwandteNebeneinander(pensum, verwandtschaft)
    }
    if (pensum.length === 0) return

    const neueSitzung = { art, pensum }
    setSitzung(neueSitzung)
    setPosition(0)
    setLetzteXp(0)
    bilanz.current = { antworten: 0, richtig: 0, start: Date.now() }
    setVerlauf([])
    setErklaerthema(null)
    startZeit.current = Date.now()
    sitzungSichern(neueSitzung, 0)
    setAnsicht('lernen')
  }

  function sitzungFortsetzen() {
    if (!offeneSitzung) return
    const nachId = new Map(erlaubteItems.map((i) => [i.id, i]))
    const pensum = offeneSitzung.ids.map((id) => nachId.get(id)).filter(Boolean)
    if (pensum.length === 0) {
      sitzungSichern(null)
      return
    }
    const b = offeneSitzung.bilanz
    bilanz.current = b && Number.isFinite(b.antworten)
      ? { antworten: b.antworten, richtig: b.richtig ?? 0, start: b.start ?? Date.now() }
      : { antworten: 0, richtig: 0, start: Date.now() }
    setSitzung({ art: offeneSitzung.art, pensum })
    setPosition(Math.min(offeneSitzung.position, pensum.length - 1))
    setLetzteXp(0)
    setVerlauf([])
    startZeit.current = Date.now()
    setAnsicht('lernen')
  }

  // Gemeldete Karte (Lernen.jsx): ohne Bewertung weiter und alle spaeteren
  // Vorkommen aus dem Stapel nehmen - sie soll nicht noch einmal kommen.
  function ausSitzungNehmen(itemId) {
    if (!sitzung) return
    const pensum = [
      ...sitzung.pensum.slice(0, position + 1),
      ...sitzung.pensum.slice(position + 1).filter((i) => i.id !== itemId),
    ]
    const neu = { ...sitzung, pensum }
    setSitzung(neu)
    weiter(0, neu)
  }

  function weiter(zusatz = 0, sitzungJetzt = sitzung) {
    // Zwei schnelle Tastendruecke auf dem letzten Item konnten diese
    // Funktion ein zweites Mal aufrufen, nachdem die Sitzung schon
    // beendet war - dann war sitzungJetzt null und der Zugriff auf
    // .art brach die ganze Oberflaeche ab.
    if (!sitzungJetzt?.pensum?.length) {
      bilanzMelden()
      setAnsicht('heute')
      setSitzung(null)
      setPosition(0)
      return
    }

    const naechste = position + 1

    // Marathon endet nicht von selbst - der Stapel wird nachgefuellt.
    if (sitzungJetzt.art === 'marathon' && naechste >= sitzungJetzt.pensum.length) {
      const nachschub = mischen(erlaubteItems)
      const erweitert = { ...sitzungJetzt, pensum: [...sitzungJetzt.pensum, ...nachschub] }
      setSitzung(erweitert)
      setPosition(naechste)
      sitzungSichern(erweitert, naechste)
      startZeit.current = Date.now()
      return
    }

    if (naechste >= sitzungJetzt.pensum.length + zusatz) {
      bilanzMelden()
      // Nach dem Raten kommt die Erklaerung (L1): jetzt liest man sie mit
      // den eigenen Vermutungen im Kopf.
      if (sitzungJetzt.art === 'vorab') {
        setErklaerthema(sitzungJetzt.pensum[0]?.themaId ?? null)
        setAnsicht('themen')
      } else {
        setAnsicht('heute')
      }
      setSitzung(null)
      setPosition(0)
      sitzungSichern(null)
      return
    }
    setPosition(naechste)
    sitzungSichern(sitzungJetzt, naechste)
    startZeit.current = Date.now()
  }

  async function bewerten(bewertung, skizzenbild, hilfeGenutzt = false) {
    const item = sitzung?.pensum?.[position]
    if (!item) return
    let sitzungBasis = sitzung

    // Neubewertung nach dem Zurueckblaettern ERSETZT die alte (Nutzer-
    // entscheidung 2A) - frueher zaehlten beide, auch fuer die XP. Geloescht
    // wird wie bei "Rueckgaengig" samt Loeschvermerk, sonst braechte der
    // Dropbox-Abgleich die alte Bewertung vom anderen Geraet zurueck.
    const frueher = verlauf.find((v) => v.position === position)
    if (frueher && sitzung.art !== 'blaettern') {
      try {
        await ereignisLoeschen(frueher.ereignisId)
      } catch (e) {
        onSpeicherfehler?.(`Alte Bewertung nicht ersetzt: ${e?.message ?? e}`)
        return
      }
      setEreignisse((alte) => alte.filter((e) => e.id !== frueher.ereignisId))
      bilanz.current.antworten -= 1
      if (frueher.richtig) bilanz.current.richtig -= 1
      // Ein frueheres "Nochmal" hatte die Karte ans Ende gehaengt -
      // diesen Stand zuruecknehmen, sonst kaeme sie doppelt.
      sitzungBasis = { ...sitzung, pensum: frueher.pensumVorher }
    }

    if (skizzenbild && opt.skizzenSichern) {
      const eintrag = await skizzeSpeichern(item.id, skizzenbild)
      setSkizzen((alte) => [...alte, eintrag])
    }

    // Blaettern und Vorab-Fragen speichern nichts - beim Raten vor der
    // Erklaerung gibt es nichts zu planen (L1).
    if (sitzung.art === 'blaettern' || sitzung.art === 'vorab') {
      weiter()
      return
    }

    let ereignis
    try {
      ereignis = await ereignisSpeichern({
        itemId: item.id,
        paketId: item.paketId,
        bewertung,
        dauerMs: Date.now() - startZeit.current,
        hilfe: hilfeGenutzt || undefined,
        // Betriebsart: fuer Statistik und Herkunft der Antwort.
        art: sitzungBasis.art,
      })
    } catch (e) {
      // Nicht weiterblaettern: sonst waere die Antwort still verloren.
      onSpeicherfehler?.(`Antwort nicht gespeichert: ${e?.message ?? e}. Bitte nochmal bewerten.`)
      return
    }
    setEreignisse((alte) => [...alte, ereignis])
    setLetzteXp(xpFuerEreignis(ereignis, item))
    // pensumVorher merkt sich den Stapel vor dieser Bewertung - bei
    // "Nochmal" haengt bewerten() das Item erneut ans Ende an, das muss
    // ein spaeteres Rueckgaengig mit zurueckdrehen.
    const richtig = bewertung !== BEWERTUNG.NOCHMAL
    bilanz.current.antworten += 1
    if (richtig) bilanz.current.richtig += 1
    setVerlauf((alt) => [
      ...alt.filter((v) => v !== frueher).slice(-49),
      { ereignisId: ereignis.id, position, pensumVorher: sitzungBasis.pensum, richtig },
    ])

    let zusatz = 0
    let sitzungJetzt = sitzungBasis
    if (sitzungBasis !== sitzung) setSitzung(sitzungBasis)
    if (bewertung === BEWERTUNG.NOCHMAL) {
      const pensumNeu = pensumNachNochmal(sitzungBasis.pensum, position)
      if (pensumNeu !== sitzungBasis.pensum) {
        sitzungJetzt = { ...sitzungBasis, pensum: pensumNeu }
        setSitzung(sitzungJetzt)
        zusatz = 1
      }
    }
    weiter(zusatz, sitzungJetzt)
  }

  // Rueckgaengig: letzte Bewertung vom Stapel nehmen, ihr Ereignis
  // loeschen, Position und Pensum auf den Stand davor zuruecksetzen.
  // Wiederholtes Aufrufen geht Schritt fuer Schritt weiter zurueck, bis
  // der Stapel dieser Sitzung leer ist.
  async function rueckgaengig() {
    if (verlauf.length === 0 || !sitzung) return
    const eintrag = verlauf[verlauf.length - 1]
    await ereignisLoeschen(eintrag.ereignisId)
    bilanz.current.antworten -= 1
    if (eintrag.richtig) bilanz.current.richtig -= 1
    setEreignisse((alte) => alte.filter((e) => e.id !== eintrag.ereignisId))
    const pensumWiederhergestellt = eintrag.pensumVorher
    setSitzung((alt) => (alt.pensum.length !== pensumWiederhergestellt.length
      ? { ...alt, pensum: pensumWiederhergestellt }
      : alt))
    setPosition(eintrag.position)
    setLetzteXp(0)
    setVerlauf((alt) => alt.slice(0, -1))
    sitzungSichern({ ...sitzung, pensum: pensumWiederhergestellt }, eintrag.position)
    startZeit.current = Date.now()
  }

  function zurueckblaettern() {
    // Blaettert nur zurueck - die gespeicherte Bewertung bleibt, bis
    // erneut bewertet wird; die neue ersetzt sie dann (siehe bewerten).
    if (position === 0) return
    const neu = position - 1
    setPosition(neu)
    setLetzteXp(0)
    sitzungSichern(sitzung, neu)
    startZeit.current = Date.now()
  }

  // Sitzung ohne Weiterspielen verlassen - der gespeicherte Stand
  // (fuer "Fortsetzen") bleibt dabei erhalten.
  function verlassen() {
    bilanzMelden()
    setAnsicht('heute')
    setSitzung(null)
  }

  return {
    sitzung,
    position,
    letzteXp,
    letzteAktion: verlauf[verlauf.length - 1] ?? null,
    offeneSitzung,
    sitzungStarten,
    sitzungFortsetzen,
    weiter,
    ausSitzungNehmen,
    bewerten,
    rueckgaengig,
    zurueckblaettern,
    verlassen,
    verwerfen: () => sitzungSichern(null),
  }
}
