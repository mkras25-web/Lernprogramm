import { useEffect, useRef, useState } from 'react'
import { skizzeSpeichern, ereignisSpeichern, ereignisLoeschen } from '../lib/speicher.js'
import { BEWERTUNG, pensumBauen } from '../lib/planer.js'
import { xpFuerEreignis } from '../lib/fortschritt.js'

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
}) {
  const [sitzung, setSitzung] = useState(null)
  const [position, setPosition] = useState(0)
  const [letzteXp, setLetzteXp] = useState(0)
  const [letzteAktion, setLetzteAktion] = useState(null)
  const [offeneSitzung, setOffeneSitzung] = useState(null)
  const startZeit = useRef(Date.now())
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
    }
    localStorage.setItem(sitzungSchluessel, JSON.stringify(daten))
    setOffeneSitzung(daten)
  }

  function sitzungStarten(art = 'ueben', bereich = {}) {
    let grundmenge = erlaubteItems
    if (bereich.modulId) grundmenge = grundmenge.filter((i) => i.modulId === bereich.modulId)
    if (bereich.themaId) grundmenge = grundmenge.filter((i) => i.themaId === bereich.themaId)

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
    else {
      pensum = pensumBauen(grundmenge, zustaende, {
        neuProTag: opt.neuProTag,
        maxProTag: opt.maxProTag,
      }).pensum
    }

    if (opt.reihenfolge === 'gemischt' && art !== 'blaettern') pensum = mischen(pensum)
    if (pensum.length === 0) return

    const neueSitzung = { art, pensum }
    setSitzung(neueSitzung)
    setPosition(0)
    setLetzteXp(0)
    setLetzteAktion(null)
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
    setSitzung({ art: offeneSitzung.art, pensum })
    setPosition(Math.min(offeneSitzung.position, pensum.length - 1))
    setLetzteXp(0)
    setLetzteAktion(null)
    startZeit.current = Date.now()
    setAnsicht('lernen')
  }

  function weiter(zusatz = 0, sitzungJetzt = sitzung) {
    // Zwei schnelle Tastendruecke auf dem letzten Item konnten diese
    // Funktion ein zweites Mal aufrufen, nachdem die Sitzung schon
    // beendet war - dann war sitzungJetzt null und der Zugriff auf
    // .art brach die ganze Oberflaeche ab.
    if (!sitzungJetzt?.pensum?.length) {
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
      setAnsicht('heute')
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

    if (skizzenbild && opt.skizzenSichern) {
      const eintrag = await skizzeSpeichern(item.id, skizzenbild)
      setSkizzen((alte) => [...alte, eintrag])
    }

    if (sitzung.art === 'blaettern') {
      weiter()
      return
    }

    const ereignis = await ereignisSpeichern({
      itemId: item.id,
      paketId: item.paketId,
      bewertung,
      dauerMs: Date.now() - startZeit.current,
      hilfe: hilfeGenutzt || undefined,
    })
    setEreignisse((alte) => [...alte, ereignis])
    setLetzteXp(xpFuerEreignis(ereignis, item))
    setLetzteAktion({ ereignisId: ereignis.id, position })

    let zusatz = 0
    let sitzungJetzt = sitzung
    if (bewertung === BEWERTUNG.NOCHMAL) {
      sitzungJetzt = { ...sitzung, pensum: [...sitzung.pensum, item] }
      setSitzung(sitzungJetzt)
      zusatz = 1
    }
    weiter(zusatz, sitzungJetzt)
  }

  // Rueckgaengig: Ereignis loeschen und eine Position zurueck.
  async function rueckgaengig() {
    if (!letzteAktion || !sitzung) return
    await ereignisLoeschen(letzteAktion.ereignisId)
    setEreignisse((alte) => alte.filter((e) => e.id !== letzteAktion.ereignisId))
    setPosition(letzteAktion.position)
    setLetzteXp(0)
    setLetzteAktion(null)
    startZeit.current = Date.now()
  }

  function zurueckblaettern() {
    // Blaettert nur zurueck - gespeicherte Bewertungen bleiben.
    // Wer erneut bewertet, erzeugt ein zweites Ereignis; das ist
    // gewollt, weil auch die zweite Antwort eine Antwort ist.
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
    setAnsicht('heute')
    setSitzung(null)
  }

  return {
    sitzung,
    position,
    letzteXp,
    letzteAktion,
    offeneSitzung,
    sitzungStarten,
    sitzungFortsetzen,
    weiter,
    bewerten,
    rueckgaengig,
    zurueckblaettern,
    verlassen,
    verwerfen: () => sitzungSichern(null),
  }
}
