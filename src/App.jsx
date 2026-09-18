import { useEffect, useMemo, useRef, useState } from 'react'
import { paketLaden, paketeLaden } from './lib/paket.js'
import {
  allesLoeschen,
  alleEreignisse,
  alleMarken,
  alleSkizzen,
  ereignisLoeschen,
  ereignisSpeichern,
  exportieren,
  importieren,
  allePruefungen,
  markeSetzen,
  pruefungSpeichern,
  skizzeLoeschen,
  skizzeSpeichern,
  speicherSichern,
} from './lib/speicher.js'
import { BEWERTUNG, pensumBauen, statistik, zustaendeBerechnen } from './lib/planer.js'
import {
  baustellen,
  beherrschungsgrad,
  kartenAuswerten,
  levelAus,
  meilensteineAuswerten,
  RAENGE,
  moduleAuswerten,
  serieBerechnen,
  xpFuerEreignis,
  xpFuerPruefung,
  xpFuerMeilensteine,
  xpGesamt,
  rekorde,
} from './lib/fortschritt.js'
import { itemsAnreichern, lernbareItems } from './lib/sichtung.js'
import { monatspruefungFaellig, pruefungsplan } from './lib/pruefung.js'
import { anwenden, laden as einstellungenLaden, speichern } from './lib/einstellungen.js'
import { serienquote } from './lib/stufen.js'
import Heute from './screens/Heute.jsx'
import Themen from './screens/Themen.jsx'
import Sammlung from './screens/Sammlung.jsx'
import Fortschritt from './screens/Fortschritt.jsx'
import Einstellungen from './screens/Einstellungen.jsx'
import Sichtung from './screens/Sichtung.jsx'
import Skizzen from './screens/Skizzen.jsx'
import Pruefung from './screens/Pruefung.jsx'
import Glossar from './screens/Glossar.jsx'
import Lernen from './screens/Lernen.jsx'
import Erklaerstueck from './components/Erklaerstueck.jsx'

const SITZUNG_SCHLUESSEL = 'offeneSitzung'

const NAVIGATION = [
  { id: 'heute', titel: 'Heute', symbol: '◴' },
  { id: 'themen', titel: 'Themen', symbol: '▤' },
  { id: 'sichtung', titel: 'Nachschlagen', symbol: '⌕' },
  { id: 'glossar', titel: 'Normen', symbol: '§' },
  { id: 'pruefung', titel: 'Prüfungen', symbol: '✓' },
  { id: 'sammlung', titel: 'Sammlung', symbol: '◈' },
  { id: 'skizzen', titel: 'Skizzen', symbol: '✎' },
  { id: 'fortschritt', titel: 'Fortschritt', symbol: '◑' },
  { id: 'einstellungen', titel: 'Einstellungen', symbol: '⚙' },
]

// Themen, in denen jedes Item gemeistert ist.
function themenFortschritt0(items, zustaende) {
  const karte = new Map()
  for (const item of items) {
    const grad = beherrschungsgrad(zustaende.get(item.id))
    const bisher = karte.get(item.themaId)
    karte.set(item.themaId, bisher === false ? false : grad === 'gemeistert')
  }
  return [...karte.values()].filter(Boolean)
}

function mischen(liste) {
  const kopie = [...liste]
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[kopie[i], kopie[j]] = [kopie[j], kopie[i]]
  }
  return kopie
}

export default function App() {
  const [rohItems, setRohItems] = useState([])
  const [themen, setThemen] = useState([])
  const [paketModule, setPaketModule] = useState([])
  const [glossar, setGlossar] = useState({})
  const [bereiche, setBereiche] = useState({})
  const [phasen, setPhasen] = useState({})
  const [paketliste, setPaketliste] = useState([])
  const [pruefungen, setPruefungen] = useState([])
  const [ereignisse, setEreignisse] = useState([])
  const [skizzen, setSkizzen] = useState([])
  const [marken, setMarken] = useState(new Map())
  const [fehler, setFehler] = useState(null)
  const [laedt, setLaedt] = useState(true)

  const [opt, setOpt] = useState(einstellungenLaden)
  const [ansicht, setAnsicht] = useState('heute')
  const [erklaerthema, setErklaerthema] = useState(null)
  const [sitzung, setSitzung] = useState(null)
  const [position, setPosition] = useState(0)
  const [letzteXp, setLetzteXp] = useState(0)
  const [letzteAktion, setLetzteAktion] = useState(null)
  const [offeneSitzung, setOffeneSitzung] = useState(null)
  const [aufstieg, setAufstieg] = useState(null)
  const stufeVorher = useRef(null)
  const startZeit = useRef(Date.now())

  useEffect(() => {
    speicherSichern()
    paketeLaden().then(setPaketliste)
  }, [])

  // Paketwechsel laedt die Inhalte neu; der Fortschritt bleibt, weil
  // Ereignisse an Item-IDs haengen, nicht an der Auswahl.
  useEffect(() => {
    setLaedt(true)
    Promise.all([
      paketLaden(opt.aktivesPaket),
      alleEreignisse(),
      alleSkizzen(),
      alleMarken(),
      allePruefungen(),
    ])
      .then(([paketDaten, gespeicherte, gespeicherteSkizzen, gespeicherteMarken, gespeichertePruefungen]) => {
        setRohItems(paketDaten.items)
        setThemen(paketDaten.themen)
        setPaketModule(paketDaten.module)
        setGlossar(paketDaten.normen ?? {})
        setBereiche(paketDaten.bereiche ?? {})
        setPhasen(paketDaten.phasen ?? {})
        setEreignisse(gespeicherte)
        setSkizzen(gespeicherteSkizzen)
        setMarken(new Map(gespeicherteMarken.map((m) => [m.itemId, m])))
        setPruefungen(gespeichertePruefungen)
      })
      .catch((e) => setFehler(e.message))
      .finally(() => setLaedt(false))
  }, [opt.aktivesPaket])

  useEffect(() => {
    try {
      const roh = localStorage.getItem(SITZUNG_SCHLUESSEL)
      if (roh) setOffeneSitzung(JSON.parse(roh))
    } catch {
      /* ignorieren */
    }
  }, [])

  useEffect(() => {
    anwenden(opt)
    speichern(opt)
  }, [opt])


  // Bearbeitete Fassungen ueberlagern das Paket.
  const items = useMemo(() => itemsAnreichern(rohItems, marken), [rohItems, marken])

  // Alles, was gelernt und gezaehlt wird - gesichtete Ausschluesse raus.
  const aktiveItems = useMemo(() => lernbareItems(items, marken), [items, marken])

  const zustaende = useMemo(() => zustaendeBerechnen(ereignisse), [ereignisse])

  const aktiveEreignisse = useMemo(() => {
    const erlaubt = new Set(aktiveItems.map((i) => i.id))
    return ereignisse.filter((e) => erlaubt.has(e.itemId))
  }, [ereignisse, aktiveItems])

  const werte = useMemo(() => statistik(aktiveEreignisse, zustaende), [aktiveEreignisse, zustaende])
  // Zwei Durchgaenge, weil Meilensteine XP geben und zugleich von der
  // Stufe abhaengen: erst die Stufe ohne sie, daraus die Meilensteine,
  // daraus die endgueltige Stufe. Ohne diese Trennung haengt die
  // Rechnung im Kreis.
  const xpBasis = useMemo(() => {
    const ausLernen = xpGesamt(aktiveEreignisse, items)
    const ausPruefungen = pruefungen.reduce((s, p) => s + xpFuerPruefung(p), 0)
    return ausLernen + ausPruefungen
  }, [aktiveEreignisse, items, pruefungen])
  const levelRoh = useMemo(() => levelAus(xpBasis), [xpBasis])
  const serie = useMemo(() => serieBerechnen(ereignisse), [ereignisse])
  // Zweite, ruhigere Ebene neben der Serie: an wie vielen der letzten
  // dreissig Tage wurde gelernt. Faellt nach einer Pause nicht auf null.
  const quote = useMemo(() => serienquote(ereignisse), [ereignisse])
  const module = useMemo(
    () => moduleAuswerten(paketModule, aktiveItems, zustaende),
    [paketModule, aktiveItems, zustaende]
  )
  const karten = useMemo(
    () => kartenAuswerten(aktiveItems, zustaende, themen),
    [aktiveItems, zustaende, themen]
  )

  const meilensteine = useMemo(() => {
    const gemeisterteThemen = [...themenFortschritt0(aktiveItems, zustaende)].filter(Boolean).length
    const werteRekord = rekorde(aktiveEreignisse)
    const sortiert = [...pruefungen].sort((a, b) => b.ts - a.ts)
    let serieBestanden = 0
    for (const p of sortiert) {
      if (p.bestanden) serieBestanden += 1
      else break
    }

    return meilensteineAuswerten({
      skizzen: skizzen.length,
      antworten: aktiveEreignisse.length,
      serie: serie.tage,
      stufe: levelRoh.stufe,
      xp: levelRoh.xp,
      minuten: werteRekord.gesamtMinuten,
      aktiveTage: werteRekord.aktiveTage,
      pruefungen: pruefungen.length,
      bestanden: pruefungen.filter((p) => p.bestanden).length,
      bestandenSerie: serieBestanden,
      bestePruefung: pruefungen.reduce((m, p) => Math.max(m, p.prozent ?? 0), 0),
      gemeisterteThemen,
      sicher: aktiveItems.filter((i) => (zustaende.get(i.id)?.intervall ?? 0) >= 7).length,
      gemeistert: aktiveItems.filter((i) => (zustaende.get(i.id)?.intervall ?? 0) >= 60).length,
      detailkarten: karten.filter((k) => k.frei).length,
      moduleBegonnen: module.filter((m) => m.begonnen > 0).length,
      gesichtet: [...marken.values()].filter((m) => m.kategorie).length,
      notizen: [...marken.values()].filter((m) => m.notiz).length,
      sicherungen: opt.letzteSicherung ? 1 : 0,
    })
  }, [skizzen, aktiveEreignisse, serie, levelRoh, pruefungen, marken, aktiveItems, zustaende,
      karten, module, opt.letzteSicherung])

  const xpMeilensteine = useMemo(() => xpFuerMeilensteine(meilensteine), [meilensteine])
  const level = useMemo(() => levelAus(xpBasis + xpMeilensteine), [xpBasis, xpMeilensteine])

  // Stufenaufstieg bemerken. Beim ersten Durchlauf nur merken, damit
  // nicht jeder Seitenaufruf als Aufstieg gefeiert wird. Wer es ruhig
  // haben will, schaltet das Feiern in den Einstellungen ab.
  useEffect(() => {
    if (laedt) return
    if (stufeVorher.current === null) {
      stufeVorher.current = level.stufe
      return
    }
    if (level.stufe > stufeVorher.current && opt.aufstiegFeiern !== false) {
      setAufstieg({ stufe: level.stufe, rangNeu: RAENGE.some((r) => r.ab === level.stufe) })
    }
    stufeVorher.current = level.stufe
  }, [level.stufe, laedt, opt.aufstiegFeiern])

  const themenFortschritt = useMemo(() => {
    const karte = new Map()
    for (const item of aktiveItems) {
      if (!karte.has(item.themaId)) karte.set(item.themaId, { gesamt: 0, sicher: 0, faellig: 0 })
      const eintrag = karte.get(item.themaId)
      const zustand = zustaende.get(item.id)
      eintrag.gesamt += 1
      if (zustand && zustand.intervall >= 7) eintrag.sicher += 1
      if (zustand && zustand.faelligAb <= Date.now()) eintrag.faellig += 1
    }
    for (const e of karte.values()) e.anteil = e.gesamt ? e.sicher / e.gesamt : 0
    return karte
  }, [aktiveItems, zustaende])

  const erlaubteItems = useMemo(
    () => (opt.ungeprueftZulassen ? aktiveItems : aktiveItems.filter((i) => i.geprueft !== false)),
    [aktiveItems, opt.ungeprueftZulassen]
  )

  const tagesplan = useMemo(
    () =>
      pensumBauen(erlaubteItems, zustaende, {
        neuProTag: opt.neuProTag,
        maxProTag: opt.maxProTag,
      }),
    [erlaubteItems, zustaende, opt.neuProTag, opt.maxProTag]
  )

  const baustellenStapel = useMemo(
    () => baustellen(erlaubteItems, zustaende, 20).map((b) => b.item),
    [erlaubteItems, zustaende]
  )
  const skizzenStapel = useMemo(() => erlaubteItems.filter((i) => i.typ === 'skizze'), [erlaubteItems])
  const neueItems = useMemo(
    () => erlaubteItems.filter((i) => !zustaende.has(i.id)),
    [erlaubteItems, zustaende]
  )

  function sitzungSichern(neueSitzung, pos) {
    if (!neueSitzung) {
      localStorage.removeItem(SITZUNG_SCHLUESSEL)
      setOffeneSitzung(null)
      return
    }
    const daten = {
      art: neueSitzung.art,
      ids: neueSitzung.pensum.map((i) => i.id),
      position: pos,
      ts: Date.now(),
    }
    localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(daten))
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

  async function markeAendern(itemId, aenderung) {
    const vorher = marken.get(itemId) ?? {}
    const neu = { itemId, ...vorher, ...aenderung }
    for (const [feld, wert] of Object.entries(aenderung)) {
      if (wert === null) delete neu[feld]
    }
    await markeSetzen(neu)
    setMarken((alte) => new Map(alte).set(itemId, neu))
  }

  async function sammelSichtung(ids, kategorie) {
    const neueKarte = new Map(marken)
    for (const id of ids) {
      const vorher = neueKarte.get(id) ?? {}
      const eintrag = { itemId: id, ...vorher, kategorie }
      if (kategorie === null) delete eintrag.kategorie
      await markeSetzen(eintrag)
      neueKarte.set(id, eintrag)
    }
    setMarken(neueKarte)
  }

  async function skizzeEntfernen(id) {
    await skizzeLoeschen(id)
    setSkizzen((alte) => alte.filter((s) => s.id !== id))
  }

  const pruefungHinweis = useMemo(() => {
    if (monatspruefungFaellig(pruefungen) && aktiveItems.some((i) => i.geprueft !== false)) {
      return { art: 'monat', text: 'Monatsprüfung fällig' }
    }
    const plan = pruefungsplan(themen, aktiveItems, zustaende, pruefungen, 1)
    if (plan.length > 0) {
      return { art: 'thema', text: `Prüfung verfügbar: ${plan[0].thema.titel}` }
    }
    return null
  }, [pruefungen, themen, aktiveItems, zustaende])

  const sicherungFaellig = useMemo(() => {
    if (ereignisse.length < 50) return false
    if (!opt.letzteSicherung) return true
    return Date.now() - opt.letzteSicherung > 30 * 24 * 60 * 60 * 1000
  }, [ereignisse.length, opt.letzteSicherung])

  async function exportKlick(mitSkizzen = true) {
    const text = await exportieren({ mitSkizzen })
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `lernprotokoll${mitSkizzen ? '' : '-ohne-skizzen'}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setOpt((alt) => ({ ...alt, letzteSicherung: Date.now() }))
  }

  async function importKlick(datei) {
    if (!datei) return
    try {
      const bericht = await importieren(await datei.text())
      const [e, s, m, p] = await Promise.all([
        alleEreignisse(), alleSkizzen(), alleMarken(), allePruefungen(),
      ])
      setEreignisse(e)
      setSkizzen(s)
      setMarken(new Map(m.map((x) => [x.itemId, x])))
      setPruefungen(p)
      alert(
        `Übernommen: ${bericht.ereignisse} Ereignisse, ${bericht.skizzen} Skizzen, ` +
          `${bericht.marken} Marken, ${bericht.pruefungen} Prüfungen.`
      )
    } catch (e) {
      alert(`Import nicht möglich: ${e.message}`)
    }
  }

  async function loeschen() {
    await allesLoeschen()
    setEreignisse([])
    setSkizzen([])
    setMarken(new Map())
    setPruefungen([])
    sitzungSichern(null)
    setAnsicht('heute')
  }

  if (laedt) {
    return <div className="huelle einspaltig"><p className="nebentext">Paket wird geladen …</p></div>
  }

  if (fehler) {
    return (
      <div className="huelle einspaltig">
        <h1 className="ueberschrift">Inhalt fehlt</h1>
        <p className="nebentext">{fehler}</p>
      </div>
    )
  }

  if (ansicht === 'lernen' && sitzung?.pensum[position]) {
    const item = sitzung.pensum[position]
    return (
      <div className="huelle einspaltig">
        <Lernen
          item={item}
          level={level}
          art={sitzung.art}
          position={position}
          gesamt={sitzung.pensum.length}
          faellig={tagesplan.faelligGesamt}
          neu={tagesplan.neuGesamt}
          letzteXp={letzteXp}
          stufen={opt.bewertungsstufen}
          vertiefungZeigen={opt.vertiefungZeigen}
          ueberspringenErlauben={opt.ueberspringenErlauben}
          marke={marken.get(item.id)}
          thema={themen.find((t) => t.id === item.themaId)}
          istNeu={!zustaende.has(item.id)}
          glossar={glossar}
          fruehereSkizzen={skizzen.filter((s) => s.itemId === item.id)}
          kannZurueck={Boolean(letzteAktion)}
          onMarke={markeAendern}
          onBewerten={bewerten}
          onUeberspringen={() => weiter()}
          onZurueckblaettern={() => {
            // Blaettert nur zurueck - gespeicherte Bewertungen bleiben.
            // Wer erneut bewertet, erzeugt ein zweites Ereignis; das ist
            // gewollt, weil auch die zweite Antwort eine Antwort ist.
            if (position === 0) return
            const neu = position - 1
            setPosition(neu)
            setLetzteXp(0)
            sitzungSichern(sitzung, neu)
            startZeit.current = Date.now()
          }}
          onRueckgaengig={rueckgaengig}
          onZurueck={() => {
            setAnsicht('heute')
            setSitzung(null)
          }}
        />
      </div>
    )
  }

  if (erklaerthema) {
    const thema = themen.find((t) => t.id === erklaerthema)
    return (
      <div className="huelle einspaltig">
        <Erklaerstueck
          thema={thema}
          onLernen={() => sitzungStarten('ueben', { themaId: thema.id })}
          onZurueck={() => setErklaerthema(null)}
        />
      </div>
    )
  }

  return (
    <div className="huelle">
      <nav className="navigation">
        {NAVIGATION.map((n) => (
          <button
            key={n.id}
            className={ansicht === n.id ? 'navKnopf aktiv' : 'navKnopf'}
            onClick={() => setAnsicht(n.id)}
          >
            <span aria-hidden="true">{n.symbol}</span>
            {n.titel}
          </button>
        ))}
      </nav>

      {ansicht === 'heute' && (
        <Heute
          level={level}
          serie={serie}
          quote={quote}
          tagesplan={tagesplan}
          werte={werte}
          karten={karten}
          baustellen={baustellenStapel.length}
          skizzen={skizzenStapel.length}
          neue={neueItems.length}
          offeneSitzung={offeneSitzung}
          onFortsetzen={sitzungFortsetzen}
          onVerwerfen={() => sitzungSichern(null)}
          onStart={(art) => sitzungStarten(art, {})}
          onThemen={() => setAnsicht('themen')}
          aufstieg={aufstieg}
          onAufstiegGesehen={() => setAufstieg(null)}
          pruefungHinweis={pruefungHinweis}
          onPruefung={() => setAnsicht('pruefung')}
          sicherungFaellig={sicherungFaellig}
          onSichern={() => exportKlick(false)}
        />
      )}
      {ansicht === 'themen' && (
        <Themen
          module={module}
          themen={themen}
          themenFortschritt={themenFortschritt}
          bereiche={bereiche}
          phasen={phasen}
          onStart={sitzungStarten}
          onErklaerung={setErklaerthema}
        />
      )}
      {ansicht === 'sichtung' && (
        <Sichtung
          items={items}
          themen={themen}
          marken={marken}
          ereignisse={ereignisse}
          zustaende={zustaende}
          glossar={glossar}
          onMarke={markeAendern}
          onSammel={sammelSichtung}
          weiterNachMarke={opt.sichtungWeiter}
        />
      )}
      {ansicht === 'pruefung' && (
        <Pruefung
          items={aktiveItems}
          themen={themen}
          zustaende={zustaende}
          module={module}
          bereiche={bereiche}
          pruefungen={pruefungen}
          onFehlerLernen={(ids) => sitzungStarten('fehlerstapel', { ids })}
          onSpeichern={async (p) => {
            const eintrag = await pruefungSpeichern(p)
            setPruefungen((alte) => [...alte, eintrag])

            // Pruefungsantworten sind echte Lernereignisse: Was in der
            // Pruefung danebenging, wird im Lernstapel wieder faellig.
            const neueEreignisse = []
            for (const ergebnis of p.items) {
              if (ergebnis.richtig === null) continue
              const item = items.find((i) => i.id === ergebnis.itemId)
              if (!item) continue
              neueEreignisse.push(
                await ereignisSpeichern({
                  itemId: item.id,
                  paketId: item.paketId,
                  bewertung: ergebnis.richtig ? BEWERTUNG.GUT : BEWERTUNG.NOCHMAL,
                  dauerMs: 0,
                  quelle: 'pruefung',
                })
              )
            }
            setEreignisse((alte) => [...alte, ...neueEreignisse])
          }}
        />
      )}
      {ansicht === 'glossar' && <Glossar glossar={glossar} />}
      {ansicht === 'sammlung' && (
        <Sammlung karten={karten} meilensteine={meilensteine} xpMeilensteine={xpMeilensteine} />
      )}
      {ansicht === 'skizzen' && (
        <Skizzen skizzen={skizzen} items={items} onLoeschen={skizzeEntfernen} />
      )}
      {ansicht === 'fortschritt' && (
        <Fortschritt
          ereignisse={aktiveEreignisse}
          items={aktiveItems}
          zustaende={zustaende}
          werte={werte}
          level={level}
          module={module}
        />
      )}
      {ansicht === 'einstellungen' && (
        <Einstellungen
          werte={opt}
          setzen={setOpt}
          anzahlEreignisse={ereignisse.length}
          anzahlSkizzen={skizzen.length}
          paketliste={paketliste}
          letzteSicherung={opt.letzteSicherung}
          onExport={exportKlick}
          onImport={importKlick}
          onLoeschen={loeschen}
        />
      )}
    </div>
  )
}
