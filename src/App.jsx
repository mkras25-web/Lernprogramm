import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Bauabschnitt from './components/Bauabschnitt.jsx'
import { paketLaden, paketeLaden } from './lib/paket.js'
import {
  allesLoeschen,
  alleEreignisse,
  alleMarken,
  alleSkizzen,
  ereignisSpeichern,
  exportieren,
  importieren,
  allePruefungen,
  markeSetzen,
  pruefungSpeichern,
  skizzeLoeschen,
  speicherSichern,
} from './lib/speicher.js'
import { BEWERTUNG, intervallVorschau, pensumBauen, statistik, zustaendeBerechnen } from './lib/planer.js'
import {
  baustellen,
  beherrschungsgrad,
  kartenAuswerten,
  levelAus,
  meilensteineAuswerten,
  MEILENSTEIN_STUFEN,
  raengeFuer,
  moduleAuswerten,
  serieBerechnen,
  xpFuerPruefung,
  xpFuerMeilensteine,
  xpGesamt,
  rekorde,
  csvAusEreignissen,
} from './lib/fortschritt.js'
import { itemsAnreichern, lernbareItems } from './lib/sichtung.js'
import { monatspruefungFaellig, pruefungsplan } from './lib/pruefung.js'
import { anwenden, laden as einstellungenLaden, speichern } from './lib/einstellungen.js'
import { profilListe } from './lib/profile.js'
import { abgleichen, abgleichStand } from './lib/abgleich.js'
import { dropboxMoeglich, istVerbunden, meldungAbholen } from './lib/dropbox.js'
import { serienquote } from './lib/stufen.js'
import { useLernsitzung } from './hooks/useLernsitzung.js'
import { meldungenMarkdown, meldungenSammeln, textHerunterladen, wunschlisteMarkdown } from './lib/meldungen.js'
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
import MeinHeft from './screens/MeinHeft.jsx'
import Fehlerbuch from './screens/Fehlerbuch.jsx'
import Lernzettel from './screens/Lernzettel.jsx'
import Erklaerstueck from './components/Erklaerstueck.jsx'
import Tastenhilfe from './components/Tastenhilfe.jsx'

// ︎ (Text-Darstellungs-Selektor) hinter jedem Symbol - ohne das
// rendert Safari z. B. das Zahnrad farbig als Emoji, obwohl alle
// anderen Symbole hier einfache einfarbige Linienzeichen bleiben.
// gruppe: Ueberschrift in der Desktop-Seitenleiste (44A) - Lernen,
// Nachschlagen, Auswertung; Einstellungen unten abgesetzt.
const NAVIGATION = [
  { id: 'heute', titel: 'Heute', symbol: '◴︎', gruppe: 'Lernen' },
  { id: 'themen', titel: 'Themen', symbol: '▤︎', gruppe: 'Lernen' },
  { id: 'pruefung', titel: 'Prüfungen', symbol: '✓︎', gruppe: 'Lernen' },
  { id: 'sichtung', titel: 'Nachschlagen', symbol: '⌕︎', gruppe: 'Nachschlagen' },
  { id: 'glossar', titel: 'Normen', symbol: '§︎', gruppe: 'Nachschlagen' },
  { id: 'heft', titel: 'Mein Heft', symbol: '❐︎', gruppe: 'Nachschlagen' },
  { id: 'fehlerbuch', titel: 'Fehlerbuch', symbol: '✕︎', gruppe: 'Nachschlagen' },
  { id: 'skizzen', titel: 'Skizzen', symbol: '✎︎', gruppe: 'Nachschlagen' },
  { id: 'fortschritt', titel: 'Fortschritt', symbol: '◑︎', gruppe: 'Auswertung' },
  { id: 'einstellungen', titel: 'Einstellungen', symbol: '⛭︎', gruppe: 'unten' },
]

// Mobil (< 60rem): untere Leiste mit vier Hauptzielen plus "Mehr", das
// die uebrigen Ziele als Blatt von unten oeffnet. Ab 60rem bleibt es bei
// der Seitenleiste (.navigation), die Leiste ist dort per CSS aus.
const HAUPTZIELE = ['heute', 'themen', 'pruefung', 'fortschritt']
const MEHR_UNTERTITEL = {
  sichtung: 'Volltextsuche, Lesezeichen, Sichtung',
  glossar: 'Glossar der Regelwerke',
  heft: 'Alle Notizen und Lesezeichen',
  fehlerbuch: 'Jede Karte, die je falsch war',
  skizzen: 'Gespeicherte Zeichnungen',
  einstellungen: 'Palette, Schrift, Sichern, Dropbox',
}

// Sammlung ist seit 2026-10-10 ein Reiter unter Fortschritt (25A) - eigene
// Adresse (#/sammlung), aber kein eigener Navigationseintrag.
const ZIELE = new Set([...NAVIGATION.map((n) => n.id), 'sammlung', 'lernen'])
const navAktiv = (id, ansicht) => ansicht === id || (id === 'fortschritt' && ansicht === 'sammlung')

// Bildschirmadresse im Hash-Teil (#/themen), Entscheidung 27A: Zurueck/Vor
// und Neuladen bleiben auf dem Bildschirm. Bewusst "#/..." statt "#themen":
// ein nackter Hash liesse den Browser zu einem gleichnamigen Element
// springen (und Scrollpositionen sollen sich nicht aendern).
function ansichtAusAdresse() {
  const treffer = /^#\/([a-z]+)/.exec(window.location.hash)
  return treffer && ZIELE.has(treffer[1]) ? treffer[1] : null
}

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

export default function App({ profilId, onProfilWechseln }) {
  const profilName = useMemo(
    () => profilListe().find((p) => p.id === profilId)?.name ?? '',
    [profilId]
  )
  const [rohItems, setRohItems] = useState([])
  const [themen, setThemen] = useState([])
  const [paketModule, setPaketModule] = useState([])
  const [glossar, setGlossar] = useState({})
  const [bereiche, setBereiche] = useState({})
  const [phasen, setPhasen] = useState({})
  // Welche Erzaehlung/Zeichnung das Levelsystem traegt (Architektur,
  // kuenftig auch Pharmazie) - kommt aus paket.json ("gestaltung"),
  // nicht aus einer Fallunterscheidung nach Paket-Id. Siehe stufen.js.
  const [gestaltung, setGestaltung] = useState('arch')
  // Kopfdaten des aktiven Pakets (Titel, Version) - fuer Exporte und die
  // Meldung nach einem neuen Paketstand.
  const [paketInfo, setPaketInfo] = useState(null)
  const [paketliste, setPaketliste] = useState([])
  const [pruefungen, setPruefungen] = useState([])
  const [ereignisse, setEreignisse] = useState([])
  const [skizzen, setSkizzen] = useState([])
  const [marken, setMarken] = useState(new Map())
  const [fehler, setFehler] = useState(null)
  const [laedt, setLaedt] = useState(true)
  const [meldung, setMeldung] = useState(null)
  const [importFrage, setImportFrage] = useState(null)
  // Ueber den Knopf in den Einstellungen und seit 2026-10-10 auch ueber die
  // Taste "?" (45A). Frueher bewusst nicht global, weil die Kuerzel von
  // Lernen und Sichtung hinter dem offenen Fenster weitergewirkt haetten -
  // beide Handler ignorieren Tasten jetzt, solange ein .schleier offen ist,
  // und "?" wirkt im Lernbildschirm gar nicht.
  const [tastenhilfeOffen, setTastenhilfeOffen] = useState(false)

  // Angefangene Pruefung (Pruefung.jsx speichert sie je Profil, 14A) -
  // hier nur die Kurzfassung fuer den Aufruf "Pruefung fortsetzen" auf Heute.
  const pruefungSchluessel = `offenePruefung_${profilId}`
  const [offenePruefung, setOffenePruefung] = useState(() => {
    try {
      const stand = JSON.parse(localStorage.getItem(`offenePruefung_${profilId}`) ?? 'null')
      if (!stand?.itemIds?.length) return null
      return {
        titel: stand.lauf?.titel,
        gesamt: stand.itemIds.length,
        beantwortet: Object.keys(stand.antworten ?? {}).length,
        abgegeben: Boolean(stand.abgegeben),
      }
    } catch {
      return null
    }
  })

  const [opt, setOpt] = useState(() => einstellungenLaden(profilId))
  // Nach dem Neuladen auf "#/lernen" startet die App auf Heute - dort steht
  // die angefangene Sitzung zum Fortsetzen bereit (nie ein leerer Bildschirm).
  const [ansicht, setAnsicht] = useState(() => {
    const a = ansichtAusAdresse()
    return a && a !== 'lernen' ? a : 'heute'
  })
  // In Nachschlagen direkt eine Karte oeffnen (Querwege 26A: Fehlerbuch,
  // Heft, Baustellen, Pruefungsfehler).
  const [nachschlagenItem, setNachschlagenItem] = useState(null)
  const [lernzettelThema, setLernzettelThema] = useState(null)
  const oeffneItem = (id) => {
    setNachschlagenItem(id)
    setAnsicht('sichtung')
  }
  // Nur auf Schmal-/Handy-Breiten relevant (siehe styles.css): das
  // "Mehr"-Blatt der unteren Leiste. Ab 60rem gibt es weder Leiste noch
  // Blatt, die Seitenleiste zeigt alle Ziele.
  const [mehrOffen, setMehrOffen] = useState(false)

  // Bleibt das Blatt offen, waehrend das Fenster (oder eine
  // Bildschirmdrehung) ueber die Desktop-Breite waechst, soll es nicht
  // haengen bleiben, bis wieder verkleinert wird.
  useEffect(() => {
    const abfrage = window.matchMedia('(min-width: 60rem)')
    const schliessenFallsDesktop = () => {
      if (abfrage.matches) setMehrOffen(false)
    }
    abfrage.addEventListener('change', schliessenFallsDesktop)
    return () => abfrage.removeEventListener('change', schliessenFallsDesktop)
  }, [])

  // Escape schliesst das Blatt - wie die anderen Schleier-Dialoge.
  useEffect(() => {
    if (!mehrOffen) return
    const taste = (e) => {
      if (e.key === 'Escape') setMehrOffen(false)
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [mehrOffen])

  const [erklaerthema, setErklaerthema] = useState(null)
  const [aufstieg, setAufstieg] = useState(null)
  const stufeVorher = useRef(null)
  const meilensteineVorher = useRef(null)

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
        setGestaltung(paketDaten.paket?.gestaltung ?? 'arch')
        setPaketInfo(paketDaten.paket ? { id: paketDaten.paket.id, titel: paketDaten.paket.titel, version: paketDaten.paket.version } : null)
        setEreignisse(gespeicherte)
        setSkizzen(gespeicherteSkizzen)
        setMarken(new Map(gespeicherteMarken.map((m) => [m.itemId, m])))
        setPruefungen(gespeichertePruefungen)
      })
      .catch((e) => setFehler(e.message))
      .finally(() => setLaedt(false))
  }, [opt.aktivesPaket])

  useEffect(() => {
    anwenden(opt)
    speichern(profilId, opt)
  }, [opt, profilId])

  // Rueckmeldung zu Import/Export blendet sich von selbst wieder aus.
  useEffect(() => {
    if (!meldung) return
    const timer = setTimeout(() => setMeldung(null), 6000)
    return () => clearTimeout(timer)
  }, [meldung])


  // Bearbeitete Fassungen ueberlagern das Paket.
  const items = useMemo(() => itemsAnreichern(rohItems, marken), [rohItems, marken])

  // Alles, was gelernt und gezaehlt wird - gesichtete Ausschluesse raus.
  const aktiveItems = useMemo(() => lernbareItems(items, marken), [items, marken])

  const zustaende = useMemo(
    () => zustaendeBerechnen(ereignisse, { zielBehaltensrate: opt.zielBehaltensrate }),
    [ereignisse, opt.zielBehaltensrate]
  )

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

  // Meilensteine haengen von der Stufe ab, die Stufe von den
  // Meilenstein-XP. Frueher wurde nur einmal mit der Stufe OHNE
  // Meilenstein-XP gerechnet - die Sammlung zeigte dann "Stufe zehn: 8 von
  // 10", waehrend Heute schon Stufe 11 meldete. Jetzt wird wechselseitig
  // gerechnet, bis sich die Stufe nicht mehr aendert (meist 1-2 Runden).
  const { meilensteine, xpMeilensteine, level } = useMemo(() => {
    const gemeisterteThemen = [...themenFortschritt0(aktiveItems, zustaende)].filter(Boolean).length
    const werteRekord = rekorde(aktiveEreignisse)
    const sortiert = [...pruefungen].sort((a, b) => b.ts - a.ts)
    let serieBestanden = 0
    for (const p of sortiert) {
      if (p.bestanden) serieBestanden += 1
      else break
    }

    const auswerten = (lv) => meilensteineAuswerten({
      skizzen: skizzen.length,
      antworten: aktiveEreignisse.length,
      serie: serie.tage,
      stufe: lv.stufe,
      xp: lv.xp,
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
    }, gestaltung)

    let lv = levelRoh
    let liste = auswerten(lv)
    for (let runde = 0; runde < 6; runde++) {
      const naechste = levelAus(xpBasis + xpFuerMeilensteine(liste))
      if (naechste.stufe === lv.stufe && naechste.xp === lv.xp) break
      lv = naechste
      liste = auswerten(lv)
    }
    const xpM = xpFuerMeilensteine(liste)
    return { meilensteine: liste, xpMeilensteine: xpM, level: levelAus(xpBasis + xpM) }
  }, [skizzen, aktiveEreignisse, serie, levelRoh, xpBasis, pruefungen, marken, aktiveItems, zustaende,
      karten, module, opt.letzteSicherung, gestaltung])


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
      setAufstieg({ stufe: level.stufe, rangNeu: raengeFuer(gestaltung).some((r) => r.ab === level.stufe) })
    }
    stufeVorher.current = level.stufe
  }, [level.stufe, laedt, opt.aufstiegFeiern, gestaltung])

  // Dieselbe Beim-ersten-Durchlauf-nur-merken-Logik wie beim Stufenaufstieg
  // oben, hier fuer eine neu erreichte Materialstufe (Bronze, Silber, ...)
  // eines Meilensteins. Nutzt denselben Feiern-Schalter und die
  // bestehende Meldung-Infrastruktur (sonst fuer Import/Export), statt
  // eine eigene Anzeige zu bauen.
  useEffect(() => {
    if (laedt) return
    const aktuell = new Map(meilensteine.map((m) => [m.id, m.stufe]))
    if (meilensteineVorher.current === null) {
      meilensteineVorher.current = aktuell
      return
    }
    if (opt.aufstiegFeiern !== false) {
      const aufgestiegen = meilensteine.filter((m) => m.stufe > (meilensteineVorher.current.get(m.id) ?? 0))
      if (aufgestiegen.length === 1) {
        const m = aufgestiegen[0]
        setMeldung({ art: 'erfolg', text: `Meilenstein „${m.titel}" – ${MEILENSTEIN_STUFEN[m.stufe - 1].name} erreicht!` })
      } else if (aufgestiegen.length > 1) {
        setMeldung({ art: 'erfolg', text: `${aufgestiegen.length} Meilensteine weiterentwickelt, u. a. „${aufgestiegen[0].titel}"` })
      }
    }
    meilensteineVorher.current = aktuell
  }, [meilensteine, laedt, opt.aufstiegFeiern])

  // Rueckkanal zum Web-Chat (19A/6A): alles, was ueberarbeitet werden sollte.
  const meldeliste = useMemo(
    () => meldungenSammeln({ items, marken, zustaende }),
    [items, marken, zustaende]
  )

  // Neuer Paketstand (22A): Fingerabdruck je Item mit dem zuletzt gesehenen
  // Stand vergleichen und einmal melden, was neu oder ueberarbeitet ist -
  // inklusive, wie viele davon eigene Meldungen waren.
  useEffect(() => {
    if (laedt || rohItems.length === 0 || !paketInfo) return
    const schluessel = `paketstand_${profilId}_${paketInfo.id}`
    const abdruck = (it) => {
      const text = JSON.stringify(it)
      let h = 0
      for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
      return h
    }
    const jetzt = Object.fromEntries(rohItems.map((it) => [it.id, abdruck(it)]))
    let vorher = null
    try {
      vorher = JSON.parse(localStorage.getItem(schluessel) ?? 'null')
    } catch {
      vorher = null
    }
    try {
      localStorage.setItem(schluessel, JSON.stringify({ version: paketInfo.version, abdruecke: jetzt }))
    } catch {
      /* Speicher voll - Meldung entfaellt dann einfach */
    }
    if (!vorher?.abdruecke) return // erster Start mit dieser Funktion: nur merken
    const neu = Object.keys(jetzt).filter((id) => !(id in vorher.abdruecke))
    const geaendert = Object.keys(jetzt).filter((id) => id in vorher.abdruecke && vorher.abdruecke[id] !== jetzt[id])
    if (neu.length === 0 && geaendert.length === 0) return
    const gemeldet = geaendert.filter((id) => marken.get(id)?.meldung || marken.get(id)?.einspruch).length
    const teile = []
    if (neu.length) teile.push(`${neu.length} ${neu.length === 1 ? 'neue Karte' : 'neue Karten'}`)
    if (geaendert.length) teile.push(`${geaendert.length} überarbeitet${gemeldet ? ` (${gemeldet} davon deine Meldungen)` : ''}`)
    setMeldung({
      art: 'erfolg',
      text: `Neuer Inhaltsstand${paketInfo.version && vorher.version !== paketInfo.version ? ` ${paketInfo.version}` : ''}: ${teile.join(', ')}.`,
    })
  }, [laedt, rohItems, paketInfo])

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

  const {
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
    verwerfen,
  } = useLernsitzung({
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
    onSpeicherfehler: (text) => setMeldung({ art: 'fehler', text }),
    onSitzungsende: ({ antworten, richtig, minuten }) =>
      setMeldung({
        art: 'erfolg',
        text: `Sitzung beendet · ${antworten} ${antworten === 1 ? 'Antwort' : 'Antworten'}, ${richtig} richtig (${Math.round((richtig / antworten) * 100)} %) · ${minuten} min`,
      }),
  })

  // Aktueller Stand ueber eine Ref: zwei schnelle Aenderungen hintereinander
  // (z. B. Lesezeichen, dann Notiz) lasen sonst beide den alten Render-Stand
  // und die zweite ueberschrieb die erste.
  const markenRef = useRef(marken)
  markenRef.current = marken
  // --- Neue App-Version (31A) ----------------------------------------------
  const [updateBereit, setUpdateBereit] = useState(false)
  useEffect(() => {
    const bereit = () => setUpdateBereit(true)
    window.addEventListener('app-update-bereit', bereit)
    return () => window.removeEventListener('app-update-bereit', bereit)
  }, [])

  // --- Tastatur-Navigation (29A/45A) -----------------------------------------
  // "/" springt in die Suche, "?" zeigt die Kuerzel, "G" + Buchstabe wechselt
  // den Bildschirm (wie in Linear/Gmail). Nie in Eingabefeldern, nie bei
  // offenem Dialog und nie im Lernbildschirm (der hat eigene Kuerzel).
  const [suchFokus, setSuchFokus] = useState(0)
  useEffect(() => {
    const ZIELTASTEN = {
      h: 'heute', t: 'themen', n: 'sichtung', o: 'glossar', m: 'heft', b: 'fehlerbuch',
      p: 'pruefung', s: 'skizzen', f: 'fortschritt', a: 'sammlung', e: 'einstellungen',
    }
    let gWartet = 0
    function taste(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return
      if (ev.target.matches?.('input, textarea, select, [contenteditable="true"]')) return
      if (ansichtRef.current === 'lernen' || document.querySelector('.schleier, .mehrSchleier')) return
      if (ev.key === '/') {
        ev.preventDefault()
        setAnsicht('sichtung')
        setSuchFokus((n) => n + 1)
        return
      }
      if (ev.key === '?') {
        ev.preventDefault()
        setTastenhilfeOffen(true)
        return
      }
      const k = ev.key.toLowerCase()
      if (gWartet && Date.now() - gWartet < 1500 && ZIELTASTEN[k]) {
        ev.preventDefault()
        gWartet = 0
        setAnsicht(ZIELTASTEN[k])
        return
      }
      gWartet = k === 'g' ? Date.now() : 0
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [])

  // --- Adresse <-> Ansicht (27A) -------------------------------------------
  const ansichtRef = useRef(ansicht)
  ansichtRef.current = ansicht
  const verlassenRef = useRef(null)
  verlassenRef.current = verlassen
  const ausVerlauf = useRef(false)
  useEffect(() => {
    const ziel = `#/${ansicht}`
    if (ausVerlauf.current) {
      ausVerlauf.current = false
      return
    }
    if (window.location.hash === ziel) return
    // Erster Eintrag ersetzt (kein leerer Schritt zurueck), danach neue Eintraege.
    if (!window.location.hash) window.history.replaceState(null, '', ziel)
    else window.history.pushState(null, '', ziel)
  }, [ansicht])
  useEffect(() => {
    function zurueck() {
      const ziel = ansichtAusAdresse() ?? 'heute'
      setErklaerthema(null)
      setLernzettelThema(null)
      if (ansichtRef.current === 'lernen' && ziel !== 'lernen') verlassenRef.current?.()
      ausVerlauf.current = true
      // Ohne laufende Sitzung fuehrt "#/lernen" (Vor-Taste) zu Heute.
      setAnsicht(ziel === 'lernen' && ansichtRef.current !== 'lernen' ? 'heute' : ziel)
    }
    window.addEventListener('popstate', zurueck)
    return () => window.removeEventListener('popstate', zurueck)
  }, [])

  async function markeAendern(itemId, aenderung) {
    const vorher = markenRef.current.get(itemId) ?? {}
    const neu = { itemId, ...vorher, ...aenderung }
    for (const [feld, wert] of Object.entries(aenderung)) {
      if (wert === null) delete neu[feld]
    }
    markenRef.current = new Map(markenRef.current).set(itemId, neu)
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

  // Der Dateiname traegt das Profil und das Datum: mehrere Geraete legen
  // ihre Sicherungen in denselben Dropbox-Ordner, und beim Einlesen soll
  // man sofort sehen, was wozu gehoert.
  async function exportKlick(mitSkizzen = true) {
    const text = await exportieren({ mitSkizzen, profilId, profilName })
    const profilTeil = profilName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
    const dateiname = [
      'lernprotokoll',
      profilTeil,
      mitSkizzen ? '' : 'ohne-skizzen',
      new Date().toISOString().slice(0, 10),
    ]
      .filter(Boolean)
      .join('-') + '.json'

    // Am Handy landet die Datei ueber den Teilen-Dialog direkt in Dropbox
    // (oder Dateien, Mail ...) statt still im Download-Ordner zu
    // verschwinden. Am PC bleibt es beim normalen Herunterladen.
    const datei = new File([text], dateiname, { type: 'application/json' })
    const handy = window.matchMedia?.('(pointer: coarse)').matches
    if (handy && navigator.canShare?.({ files: [datei] })) {
      try {
        await navigator.share({ files: [datei], title: dateiname })
        setOpt((alt) => ({ ...alt, letzteSicherung: Date.now() }))
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }

    const url = URL.createObjectURL(datei)
    const a = document.createElement('a')
    a.href = url
    a.download = dateiname
    a.click()
    URL.revokeObjectURL(url)
    setOpt((alt) => ({ ...alt, letzteSicherung: Date.now() }))
  }

  function csvExportKlick() {
    const text = csvAusEreignissen(ereignisse, items)
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `lernprotokoll-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Eine Sicherung gehoert zu einem bestimmten Profil (Profil-Id steckt in
  // der Datei). Stammt sie von einem anderen als dem aktiven, wird
  // nachgefragt statt still zu vermischen - zwei Personen oder zwei
  // Profile derselben Person wuerden sonst ineinander laufen.
  async function importKlick(auswahl) {
    const dateien = Array.isArray(auswahl) ? auswahl : auswahl ? [auswahl] : []
    if (dateien.length === 0) return
    const texte = await Promise.all(dateien.map((d) => d.text()))
    const fremde = texte
      .map((t) => {
        try {
          return JSON.parse(t).profil
        } catch {
          return null
        }
      })
      .filter((p) => p?.id && p.id !== profilId)
    if (fremde.length > 0) {
      setImportFrage({ texte, namen: [...new Set(fremde.map((p) => p.name || 'unbekannt'))] })
      return
    }
    await importTexte(texte)
  }

  async function importTexte(texte) {
    try {
      const bericht = { ereignisse: 0, skizzen: 0, marken: 0, pruefungen: 0 }
      for (const text of texte) {
        const teil = await importieren(text)
        for (const k of Object.keys(bericht)) bericht[k] += teil[k]
      }
      await zustandNeuLesen()
      setMeldung({
        art: 'erfolg',
        text:
          `Übernommen: ${bericht.ereignisse} Ereignisse, ${bericht.skizzen} Skizzen, ` +
          `${bericht.marken} Marken, ${bericht.pruefungen} Prüfungen.`,
      })
    } catch (e) {
      setMeldung({ art: 'fehler', text: `Import nicht möglich: ${e.message}` })
    }
  }

  // Liest nach einem Import oder Abgleich alles aus der Datenbank neu ein.
  async function zustandNeuLesen() {
    const [e, s, m, p] = await Promise.all([
      alleEreignisse(), alleSkizzen(), alleMarken(), allePruefungen(),
    ])
    setEreignisse(e)
    setSkizzen(s)
    setMarken(new Map(m.map((x) => [x.itemId, x])))
    setPruefungen(p)
  }

  // --- Abgleich ueber Dropbox (siehe lib/abgleich.js) -------------------
  // still = im Hintergrund (Start, nach dem Lernen, App wird verlassen):
  // nur bei uebernommenen Staenden eine Meldung, Fehler nur im Stand.
  const [abgleichZustand, setAbgleichZustand] = useState(() => ({ laeuft: false, ...abgleichStand(profilId) }))
  const abgleichRef = useRef(null)
  abgleichRef.current = async function jetztAbgleichen(still = true) {
    if (!dropboxMoeglich() || !istVerbunden()) return
    setAbgleichZustand((z) => ({ ...z, laeuft: true }))
    try {
      const b = await abgleichen({ profilId, profilName, mitSkizzen: opt.dropboxSkizzen === true })
      const neu = b.ereignisse + b.skizzen + b.marken + b.pruefungen + b.geloescht
      if (neu > 0) await zustandNeuLesen()
      if (!still) {
        setMeldung({
          art: 'erfolg',
          text: neu > 0 ? `Abgeglichen: ${b.ereignisse} neue Antworten von anderen Geräten übernommen.` : 'Abgeglichen – nichts Neues.',
        })
      } else if (neu > 0) {
        setMeldung({ art: 'erfolg', text: `Fortschritt von einem anderen Gerät übernommen (${b.ereignisse} Antworten).` })
      }
    } catch (e) {
      if (!still) setMeldung({ art: 'fehler', text: `Abgleich nicht möglich: ${e.message}` })
    } finally {
      setAbgleichZustand({ laeuft: false, ...abgleichStand(profilId) })
    }
  }
  // Ueber eine Ref statt direkt aus opt: die Effekte unten (Sichtbarkeit,
  // Start) halten sonst die Funktion vom ersten Render fest, und das
  // Ausschalten von "automatisch abgleichen" wirkte beim Verlassen nicht.
  const autoAbgleichRef = useRef(opt.dropboxAuto)
  autoAbgleichRef.current = opt.dropboxAuto
  const automatischAbgleichen = () => {
    if (autoAbgleichRef.current !== false) abgleichRef.current?.(true)
  }

  // Nach einer Lernsitzung (Wechsel weg vom Lernbildschirm).
  const vorherigeAnsicht = useRef(null)
  useEffect(() => {
    if (vorherigeAnsicht.current === 'lernen' && ansicht !== 'lernen') automatischAbgleichen()
    vorherigeAnsicht.current = ansicht
  }, [ansicht])

  // Rueckmeldung der Dropbox-Anmeldung (ausgefuehrt in main.jsx, vor dem Start).
  useEffect(() => {
    const m = meldungAbholen()
    if (m) setMeldung(m)
  }, [])

  // Beim Start des Profils, sobald die Inhalte geladen sind.
  useEffect(() => {
    if (!laedt) automatischAbgleichen()
  }, [laedt])

  // Beim Verlassen der App (Push) bzw. Zurueckkehren nach laengerer Pause (Pull).
  useEffect(() => {
    let zuletzt = Date.now()
    function sichtbarkeit() {
      if (document.visibilityState === 'hidden') {
        zuletzt = Date.now()
        automatischAbgleichen()
      } else if (Date.now() - zuletzt > 120_000) {
        zuletzt = Date.now()
        automatischAbgleichen()
      }
    }
    document.addEventListener('visibilitychange', sichtbarkeit)
    return () => document.removeEventListener('visibilitychange', sichtbarkeit)
  }, [])

  async function loeschen() {
    await allesLoeschen()
    setEreignisse([])
    setSkizzen([])
    setMarken(new Map())
    setPruefungen([])
    verwerfen()
    setAnsicht('heute')
  }

  if (laedt) {
    return (
      <div className="huelle einspaltig">
        <div className="schirm" role="status" aria-label="Paket wird geladen">
          <div className="heuteRaster" aria-hidden="true">
            <section className="stufe">
              <span className="skeleton skeletonBau" />
              <div className="stufeText">
                <span className="skeleton" style={{ width: '7rem', height: '0.75rem' }} />
                <span className="skeleton" style={{ width: '9rem', height: '1.5rem', marginTop: '0.4rem' }} />
                <span className="skeleton" style={{ width: '95%', height: '0.9375rem', marginTop: '0.6rem' }} />
                <span className="skeleton" style={{ width: '60%', height: '0.9375rem', marginTop: '0.4rem' }} />
              </div>
            </section>
            <section className="kennzahlen">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className="skeleton" style={{ height: '4.25rem' }} />
              ))}
            </section>
            <section className="heuteBreit heuteLernen">
              <span className="skeleton" style={{ display: 'block', height: '5rem' }} />
            </section>
            <section className="heuteBreit">
              <span className="skeleton" style={{ display: 'block', height: '5rem' }} />
            </section>
          </div>
        </div>
      </div>
    )
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
          gestaltung={gestaltung}
          art={sitzung.art}
          position={position}
          gesamt={sitzung.pensum.length}
          // Zahlen der laufenden Sitzung (Rest ab der aktuellen Position),
          // nicht die globalen - in einer Themensitzung stand sonst "211 neu".
          faellig={sitzung.pensum.slice(position).filter((i) => zustaende.has(i.id)).length}
          neu={sitzung.pensum.slice(position).filter((i) => !zustaende.has(i.id)).length}
          letzteXp={letzteXp}
          stufen={opt.bewertungsstufen}
          vertiefungZeigen={opt.vertiefungZeigen}
          ueberspringenErlauben={opt.ueberspringenErlauben}
          marke={marken.get(item.id)}
          thema={themen.find((t) => t.id === item.themaId)}
          istNeu={!zustaende.has(item.id)}
          intervalle={intervallVorschau(zustaende.get(item.id), { zielBehaltensrate: opt.zielBehaltensrate })}
          // Problemkarte: ab 6 Fehlern (Nutzerentscheidung 6A)
          istProblem={(zustaende.get(item.id)?.fehler ?? 0) >= 6}
          themen={themen}
          glossar={glossar}
          fruehereSkizzen={skizzen.filter((s) => s.itemId === item.id)}
          kannZurueck={Boolean(letzteAktion)}
          onMarke={markeAendern}
          onBewerten={bewerten}
          onUeberspringen={() => weiter()}
          onZurueckblaettern={zurueckblaettern}
          onRueckgaengig={rueckgaengig}
          onZurueck={verlassen}
        />
      </div>
    )
  }

  if (lernzettelThema) {
    const thema = themen.find((t) => t.id === lernzettelThema)
    if (thema) {
      return (
        <div className="huelle einspaltig">
          <Lernzettel thema={thema} items={aktiveItems} marken={marken} onZurueck={() => setLernzettelThema(null)} />
        </div>
      )
    }
  }

  if (erklaerthema) {
    const thema = themen.find((t) => t.id === erklaerthema)
    return (
      <div className="huelle einspaltig">
        <Erklaerstueck
          thema={thema}
          themen={themen}
          onThema={(id) => setErklaerthema(id)}
          // Dieselbe Rechnung wie der Sitzungsstart (heutiges Pensum des
          // Themas) - frueher stand hier die Gesamtzahl aus der Paketdatei.
          anzahlHeute={pensumBauen(erlaubteItems.filter((i) => i.themaId === thema.id), zustaende, {
            neuProTag: opt.neuProTag,
            maxProTag: opt.maxProTag,
          }).pensum.length}
          onLernen={() => sitzungStarten('ueben', { themaId: thema.id })}
          onUeben={() => sitzungStarten('marathon', { themaId: thema.id })}
          onZurueck={() => setErklaerthema(null)}
        />
      </div>
    )
  }

  return (
    <div className="huelle">
      <nav className="navigation">
        {paketliste.length > 1 && (
          <PaketSchalter paketliste={paketliste} aktiv={opt.aktivesPaket} onWahl={(id) => setOpt((o) => ({ ...o, aktivesPaket: id }))} />
        )}
        {NAVIGATION.map((n, i) => (
          <Fragment key={n.id}>
            {n.gruppe !== 'unten' && n.gruppe !== NAVIGATION[i - 1]?.gruppe && (
              <span className="navGruppe">{n.gruppe}</span>
            )}
            {n.gruppe === 'unten' && <span className="navTrenner" aria-hidden="true" />}
            <button
              className={navAktiv(n.id, ansicht) ? 'navKnopf aktiv' : 'navKnopf'}
              aria-current={navAktiv(n.id, ansicht) ? 'page' : undefined}
              onClick={() => setAnsicht(n.id)}
            >
              <span aria-hidden="true">{n.symbol}</span>
              {n.titel}
            </button>
          </Fragment>
        ))}
        <button className="navFuss" onClick={onProfilWechseln} title="Profil wechseln">
          <Bauabschnitt stufe={level.stufe} gestaltung={gestaltung} groesse={34} titel={false} marke={false} />
          <span className="navFussText">
            <span className="navFussName">{profilName}</span>
            <span className="navFussStufe">Stufe {level.stufe} · Profil wechseln</span>
          </span>
        </button>
      </nav>

      <nav className="tabLeiste" aria-label="Hauptnavigation">
        {HAUPTZIELE.map((id) => {
          const n = NAVIGATION.find((z) => z.id === id)
          const aktiv = navAktiv(id, ansicht) && !mehrOffen
          return (
            <button
              key={id}
              className={aktiv ? 'tabKnopf aktiv' : 'tabKnopf'}
              aria-current={aktiv ? 'page' : undefined}
              onClick={() => {
                setAnsicht(id)
                setMehrOffen(false)
              }}
            >
              <span className="tabSymbol" aria-hidden="true">{n.symbol}</span>
              <span className="tabName">{n.titel}</span>
              {id === 'pruefung' && pruefungHinweis && (
                <span className="tabPunkt" title={pruefungHinweis.text} />
              )}
            </button>
          )
        })}
        <button
          className={mehrOffen || !HAUPTZIELE.some((id) => navAktiv(id, ansicht)) ? 'tabKnopf aktiv' : 'tabKnopf'}
          aria-expanded={mehrOffen}
          onClick={() => setMehrOffen((o) => !o)}
        >
          <span className="tabSymbol" aria-hidden="true">⋯︎</span>
          <span className="tabName">Mehr</span>
        </button>
      </nav>

      {mehrOffen && (
        <div className="mehrSchleier" onClick={() => setMehrOffen(false)}>
          <div
            className="mehrBlatt"
            role="dialog"
            aria-modal="true"
            aria-label="Weitere Bereiche"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mehrGriff" aria-hidden="true" />
            <h2 className="mehrTitel">Mehr</h2>
            {paketliste.length > 1 && (
              <PaketSchalter paketliste={paketliste} aktiv={opt.aktivesPaket} onWahl={(id) => setOpt((o) => ({ ...o, aktivesPaket: id }))} />
            )}
            {NAVIGATION.filter((n) => !HAUPTZIELE.includes(n.id)).map((n) => (
              <button
                key={n.id}
                className={ansicht === n.id ? 'mehrZeile aktiv' : 'mehrZeile'}
                onClick={() => {
                  setAnsicht(n.id)
                  setMehrOffen(false)
                }}
              >
                <span className="mehrSymbol" aria-hidden="true">{n.symbol}</span>
                <span className="mehrText">
                  <span className="mehrName">{n.titel}</span>
                  <span className="mehrUntertitel">{MEHR_UNTERTITEL[n.id]}</span>
                </span>
                <span className="mehrPfeil" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {importFrage && (
        <div className="schleier" onClick={() => setImportFrage(null)}>
          <article className="grosseKarte gefahr" onClick={(e) => e.stopPropagation()}>
            <h2 className="ueberschrift">Andere Person?</h2>
            <p className="nebentext">
              Diese Sicherung gehört zum Profil „{importFrage.namen.join('", „')}", du lernst
              gerade als „{profilName}". Einlesen würde beide Fortschritte vermischen.
            </p>
            <p className="nebentext">
              Für das andere Profil: zurück zur Profilauswahl und dort „Profil aus Sicherung
              importieren" wählen.
            </p>
            <div className="wahl">
              <button className="knopf schmal" onClick={() => setImportFrage(null)}>
                Abbrechen
              </button>
              <button
                className="knopf schmal gefahr"
                onClick={() => {
                  const texte = importFrage.texte
                  setImportFrage(null)
                  importTexte(texte)
                }}
              >
                Trotzdem hier einlesen
              </button>
            </div>
          </article>
        </div>
      )}

      {updateBereit && !offenePruefung && (
        <div className="meldung erfolg updateHinweis" role="status">
          <p>Neue Version der App verfügbar.</p>
          <button className="knopf schmal haupt" onClick={() => window.__appAktualisieren?.()}>
            Neu laden
          </button>
          <button onClick={() => setUpdateBereit(false)} aria-label="Später">✕︎</button>
        </div>
      )}

      {meldung && (
        <div
          className={`meldung${meldung.art === 'fehler' ? ' fehler' : ''}${meldung.art === 'erfolg' ? ' erfolg' : ''}`}
          role="status"
          aria-live="polite"
        >
          <p>{meldung.text}</p>
          <button onClick={() => setMeldung(null)} aria-label="Meldung schließen">✕︎</button>
        </div>
      )}

      {ansicht === 'heute' && (
        <Heute
          level={level}
          gestaltung={gestaltung}
          serie={serie}
          quote={quote}
          tagesplan={tagesplan}
          werte={werte}
          karten={karten}
          baustellen={baustellenStapel.length}
          skizzen={skizzenStapel.length}
          neue={neueItems.length}
          tagesziel={opt.tagesziel ?? 0}
          offeneSitzung={offeneSitzung}
          onFortsetzen={sitzungFortsetzen}
          onVerwerfen={verwerfen}
          onStart={(art) => sitzungStarten(art, {})}
          onThemen={() => setAnsicht('themen')}
          aufstieg={aufstieg}
          onAufstiegGesehen={() => setAufstieg(null)}
          pruefungHinweis={pruefungHinweis}
          onPruefung={() => setAnsicht('pruefung')}
          sicherungFaellig={sicherungFaellig}
          onSichern={() => exportKlick(false)}
          offenePruefung={offenePruefung}
          onPruefungFortsetzen={() => setAnsicht('pruefung')}
          klausuren={opt.klausuren ?? []}
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
          onLernzettel={setLernzettelThema}
          onWunschliste={() =>
            textHerunterladen(
              wunschlisteMarkdown({ module, themen, phasen }),
              `wunschliste-themen-${new Date().toISOString().slice(0, 10)}.md`
            )
          }
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
          startItem={nachschlagenItem}
          suchFokus={suchFokus}
          onStartItemErledigt={() => setNachschlagenItem(null)}
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
          speicherSchluessel={pruefungSchluessel}
          onStand={setOffenePruefung}
          onThemaUeben={(themaId) => sitzungStarten('ueben', { themaId })}
          onItemOeffnen={oeffneItem}
          onSpeichern={async (p) => {
            const eintrag = await pruefungSpeichern(p)
            setPruefungen((alte) => [...alte, eintrag])

            // Pruefungsantworten sind echte Lernereignisse: Was in der
            // Pruefung danebenging, wird im Lernstapel wieder faellig.
            const neueEreignisse = []
            for (const ergebnis of p.items) {
              // Die Ergebnisse tragen "anteil" (0..1), kein "richtig" - frueher
              // wurde hier ergebnis.richtig gelesen (immer undefined), und JEDE
              // Pruefungsantwort landete als "Nochmal" in der Planung.
              if (ergebnis.anteil === null || ergebnis.anteil === undefined) continue
              const item = items.find((i) => i.id === ergebnis.itemId)
              if (!item) continue
              // Teilpunkte (Entscheidung 18A): voll richtig = Gut, ab der
              // Haelfte = Schwer, darunter = Nochmal.
              const bewertung = ergebnis.anteil >= 1
                ? BEWERTUNG.GUT
                : ergebnis.anteil >= 0.5 ? BEWERTUNG.SCHWER : BEWERTUNG.NOCHMAL
              neueEreignisse.push(
                await ereignisSpeichern({
                  itemId: item.id,
                  paketId: item.paketId,
                  bewertung,
                  dauerMs: 0,
                  quelle: 'pruefung',
                })
              )
            }
            setEreignisse((alte) => [...alte, ...neueEreignisse])
          }}
        />
      )}
      {ansicht === 'glossar' && (
        <Glossar
          glossar={glossar}
          items={aktiveItems}
          bereiche={bereiche}
          onUeben={(ids) => sitzungStarten('fehlerstapel', { ids })}
          onItemOeffnen={oeffneItem}
        />
      )}
      {ansicht === 'sammlung' && (
        <Sammlung
          karten={karten}
          meilensteine={meilensteine}
          xpMeilensteine={xpMeilensteine}
          reiter={<AuswertungReiter ansicht={ansicht} setAnsicht={setAnsicht} />}
          onThemaUeben={(themaId) => sitzungStarten('ueben', { themaId })}
        />
      )}
      {ansicht === 'heft' && <MeinHeft items={items} marken={marken} onOeffnen={oeffneItem} />}
      {ansicht === 'fehlerbuch' && (
        <Fehlerbuch
          items={aktiveItems}
          ereignisse={aktiveEreignisse}
          zustaende={zustaende}
          onUeben={(ids) => sitzungStarten('fehlerstapel', { ids })}
          onOeffnen={oeffneItem}
        />
      )}
      {ansicht === 'skizzen' && (
        <Skizzen
          skizzen={skizzen}
          items={items}
          onLoeschen={skizzeEntfernen}
          onNeuZeichnen={(itemId) => sitzungStarten('fehlerstapel', { ids: [itemId] })}
          zeichenaufgaben={skizzenStapel.length}
          onUeben={() => sitzungStarten('skizzen', {})}
        />
      )}
      {ansicht === 'fortschritt' && (
        <Fortschritt
          ereignisse={aktiveEreignisse}
          items={aktiveItems}
          zustaende={zustaende}
          werte={werte}
          level={level}
          gestaltung={gestaltung}
          module={module}
          reiter={<AuswertungReiter ansicht={ansicht} setAnsicht={setAnsicht} />}
          onThemaUeben={(themaId) => sitzungStarten('ueben', { themaId })}
          onModulUeben={(modulId) => sitzungStarten('ueben', { modulId })}
          onItemOeffnen={oeffneItem}
        />
      )}
      {ansicht === 'einstellungen' && (
        <Einstellungen
          abgleich={{ ...abgleichZustand, onJetzt: () => abgleichRef.current?.(false) }}
          werte={opt}
          setzen={setOpt}
          anzahlEreignisse={ereignisse.length}
          anzahlSkizzen={skizzen.length}
          paketliste={paketliste}
          letzteSicherung={opt.letzteSicherung}
          onExport={exportKlick}
          onExportCsv={csvExportKlick}
          anzahlMeldungen={meldeliste.length}
          onMeldungenExport={() =>
            textHerunterladen(
              meldungenMarkdown({ eintraege: meldeliste, paket: paketInfo }),
              `meldungen-${new Date().toISOString().slice(0, 10)}.md`
            )
          }
          onImport={importKlick}
          onMeldung={setMeldung}
          onLoeschen={loeschen}
          profilName={profilName}
          onProfilWechseln={onProfilWechseln}
          onTastenhilfe={() => setTastenhilfeOffen(true)}
        />
      )}

      <Tastenhilfe offen={tastenhilfeOffen} onSchliessen={() => setTastenhilfeOffen(false)} />
    </div>
  )
}

// Reiter oben in Fortschritt und Sammlung (25A): beide Teile der Auswertung.
function AuswertungReiter({ ansicht, setAnsicht }) {
  return (
    <div className="reiter auswertungReiter">
      <button
        className={ansicht === 'fortschritt' ? 'reiterKnopf aktiv' : 'reiterKnopf'}
        onClick={() => setAnsicht('fortschritt')}
      >
        Übersicht
      </button>
      <button
        className={ansicht === 'sammlung' ? 'reiterKnopf aktiv' : 'reiterKnopf'}
        onClick={() => setAnsicht('sammlung')}
      >
        Sammlung
      </button>
    </div>
  )
}

// Paketschalter (32A): oben in der Seitenleiste bzw. im Mehr-Blatt.
function PaketSchalter({ paketliste, aktiv, onWahl }) {
  return (
    <div className="paketSchalter" role="group" aria-label="Inhaltspaket">
      {paketliste.map((pa) => (
        <button
          key={pa.id}
          className={pa.id === aktiv ? 'wahlKnopf aktiv' : 'wahlKnopf'}
          aria-pressed={pa.id === aktiv}
          onClick={() => onWahl(pa.id)}
        >
          {pa.kurz ?? pa.titel.split(' ')[0]}
        </button>
      ))}
    </div>
  )
}
