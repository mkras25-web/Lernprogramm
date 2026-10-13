import { useEffect, useMemo, useRef, useState } from 'react'
import Schleier from './components/Schleier.jsx'
import Navigation, { AuswertungReiter } from './components/Navigation.jsx'
import Ladeskelett from './components/Ladeskelett.jsx'
import { ansichtAusAdresse, useAdresse } from './hooks/useAdresse.js'
import { useTastaturNavigation } from './hooks/useTastaturNavigation.js'
import { useAbgleich } from './hooks/useAbgleich.js'
import { useKennzahlen } from './hooks/useKennzahlen.js'
import { paketLaden, paketeLaden } from './lib/paket.js'
import { dropboxMoeglich, istVerbunden } from './lib/dropbox.js'
import {
  allesLoeschen,
  alleEreignisse,
  alleMarken,
  alleSkizzen,
  ereignisSpeichern,
  exportieren,
  importieren,
  kursplanEintragLoeschen,
  kursplanEintragSetzen,
  kursplanLesen,
  kursplanSchreiben,
  allePruefungen,
  markeSetzen,
  pruefungSpeichern,
  skizzeLoeschen,
  speicherSichern,
} from './lib/speicher.js'
import { BEWERTUNG, heuteBewertet, heuteNichtGewusst, intervallVorschau, istWiederholung, pensumBauen } from './lib/planer.js'
import { csvAusEreignissen, MEILENSTEIN_STUFEN, raengeFuer } from './lib/fortschritt.js'
import { anwenden, laden as einstellungenLaden, speichern } from './lib/einstellungen.js'
import { profilListe } from './lib/profile.js'
import {
  endspurt,
  kennungenImInhalt,
  klausurplan,
  klausurreife,
  kursAenderung,
  kursItems,
  naechsteKlausur,
  vorschlaege,
} from './lib/kurs.js'
import { useLernsitzung } from './hooks/useLernsitzung.js'
import { verwandteThemen } from './lib/verwandt.js'
import {
  erledigteMeldungen,
  freigabenSammeln,
  inhaltsStempel,
  meldungenMarkdown,
  meldungenNachziehen,
  textHerunterladen,
  wunschlisteMarkdown,
} from './lib/meldungen.js'
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
import { KartenGrenze } from './components/Fehlergrenze.jsx'
import AusDemKopf from './components/AusDemKopf.jsx'
import Tastenhilfe from './components/Tastenhilfe.jsx'

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
  // Kennwerte-Tabellenbuch des Pakets (F3)
  const [kennwerte, setKennwerte] = useState([])
  const [pruefungen, setPruefungen] = useState([])
  const [ereignisse, setEreignisse] = useState([])
  const [skizzen, setSkizzen] = useState([])
  const [marken, setMarken] = useState(new Map())
  const [fehler, setFehler] = useState(null)
  // Zaehler fuer "Erneut versuchen" nach einem Ladefehler (B2, 2026-10-13).
  const [ladeVersuch, setLadeVersuch] = useState(0)
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
  // Kurse und Klausurtermine (speicher.js, reist mit Sicherung/Abgleich).
  const [kursplan, setKursplan] = useState(() => {
    const plan = kursplanLesen(profilId)
    if (plan.vorhanden) return plan
    // Einmalig: die Klausurtermine lagen bis 2026-10-12 in den
    // Einstellungen (reisten nicht mit) - hierher uebernehmen.
    const alt = (opt.klausuren ?? []).map((k) => ({ ...k, ts: Date.now() }))
    return kursplanSchreiben({ kurse: [], klausuren: alt }, profilId)
  })
  const kursplanAendern = {
    setzen: (art, eintrag) => setKursplan(kursplanEintragSetzen(art, eintrag, profilId)),
    loeschen: (art, id) => setKursplan(kursplanEintragLoeschen(art, id, profilId)),
  }
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
  const [erklaerthema, setErklaerthema] = useState(null)
  // "Aus dem Kopf" fuer ein Thema (L6)
  const [kopfThema, setKopfThema] = useState(null)
  // Id der zuletzt in der Sitzung gemeldeten Karte - die naechste Karte
  // bestaetigt kurz, dass sie aus dem Stapel ist (Lernen.jsx).
  const [gemeldetHinweis, setGemeldetHinweis] = useState(null)
  const [aufstieg, setAufstieg] = useState(null)
  const stufeVorher = useRef(null)
  const meilensteineVorher = useRef(null)

  // Ergebnis von navigator.storage.persist() (T3): ohne Schutz darf der
  // Browser die Daten loeschen (Safari nach 7 Tagen ohne Nutzung).
  const [speicherGeschuetzt, setSpeicherGeschuetzt] = useState(null)
  useEffect(() => {
    speicherSichern().then((ja) => setSpeicherGeschuetzt(Boolean(ja)), () => setSpeicherGeschuetzt(false))
    paketeLaden().then(setPaketliste)
  }, [])

  // Paketwechsel laedt die Inhalte neu; der Fortschritt bleibt, weil
  // Ereignisse an Item-IDs haengen, nicht an der Auswahl.
  useEffect(() => {
    setLaedt(true)
    setFehler(null)
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
        setKennwerte(paketDaten.kennwerte ?? [])
        // Ausgelassene, nicht darstellbare Karten (T4) einmal melden.
        if (paketDaten.defekt?.length) {
          const ids = paketDaten.defekt.map((d) => `${d.id} (${d.grund})`)
          setMeldung({
            art: 'fehler',
            text: `${ids.length} Karte(n) ausgelassen, weil die Itemdatei fehlerhaft ist: ${ids.slice(0, 4).join(', ')}${ids.length > 4 ? ' …' : ''}`,
          })
        }
        setEreignisse(gespeicherte)
        setSkizzen(gespeicherteSkizzen)
        setMarken(new Map(gespeicherteMarken.map((m) => [m.itemId, m])))
        setPruefungen(gespeichertePruefungen)
      })
      .catch((e) => setFehler(e.message))
      .finally(() => setLaedt(false))
  }, [opt.aktivesPaket, ladeVersuch])

  useEffect(() => {
    anwenden(opt)
    speichern(profilId, opt)
  }, [opt, profilId])

  // Rueckmeldung zu Import/Export blendet sich von selbst wieder aus.
  useEffect(() => {
    // Meldungen mit bleibt: true (Sitzungsbilanz, D5) stehen, bis man sie
    // schliesst - nach 6 s war die Bilanz oft weg, bevor man hinsah.
    if (!meldung || meldung.bleibt) return
    const timer = setTimeout(() => setMeldung(null), 6000)
    return () => clearTimeout(timer)
  }, [meldung])


  // Alle abgeleiteten Zahlen (hooks/useKennzahlen.js, 52B).
  const {
    items,
    aktiveItems,
    zustaende,
    aktiveEreignisse,
    werte,
    serie,
    quote,
    module,
    karten,
    meilensteine,
    xpMeilensteine,
    level,
    meldeliste,
    themenFortschritt,
    erlaubteItems,
    pruefItems,
    tagesplan,
    baustellenStapel,
    skizzenStapel,
    neueItems,
    pruefungHinweis,
    sicherungFaellig,
  } = useKennzahlen({
    rohItems, marken, ereignisse, pruefungen, skizzen, themen, paketModule, opt, gestaltung,
    speicherGeschuetzt, dropboxVerbunden: dropboxMoeglich() && istVerbunden(),
  })

  // Heute nicht gewusst (Heute-Bildschirm): zum ruhigen Durchlesen.
  const nichtGewusst = useMemo(() => {
    const nachId = new Map(aktiveItems.map((i) => [i.id, i]))
    return heuteNichtGewusst(aktiveEreignisse).map((id) => nachId.get(id)).filter(Boolean)
  }, [aktiveItems, aktiveEreignisse])

  // Kurse (lib/kurs.js): je Kurs Fragen, naechste Klausur, Reife, Plan.
  const kursKennungen = useMemo(() => kennungenImInhalt(items), [items])
  const kursUebersicht = useMemo(() => {
    const lernbar = new Set(erlaubteItems.map((i) => i.id))
    const pruefbar = new Set(pruefItems.filter((i) => i.geprueft !== false).map((i) => i.id))
    return kursplan.kurse.map((kurs) => {
      const alle = kursItems(aktiveItems, marken, kurs.id)
      const lernItems = alle.filter((i) => lernbar.has(i.id))
      const klausur = naechsteKlausur(kurs.id, kursplan.klausuren)
      const zeitpunkt = klausur ? new Date(`${klausur.datum}T00:00`).getTime() : Date.now()
      const reife = klausurreife(lernItems, zustaende, aktiveEreignisse, { zeitpunkt })
      const plan = klausurplan(lernItems, zustaende, { klausur, neuProTag: opt.neuProTag })
      const pruefIds = alle.filter((i) => pruefbar.has(i.id)).map((i) => i.id)
      return {
        kurs,
        items: alle,
        lernItems,
        klausur,
        reife,
        plan,
        pruefIds,
        ungeprueft: alle.length - pruefIds.length,
        vorschlaege: vorschlaege(aktiveItems, marken, kurs),
      }
    })
  }, [kursplan, aktiveItems, erlaubteItems, pruefItems, marken, zustaende, aktiveEreignisse, opt.neuProTag])

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

  // Selbst gepruefte, ungepruefte Karten fuer den Pruef-Chat (P8)
  const freigaben = useMemo(() => freigabenSammeln({ items, marken }), [items, marken])

  // Verwandte Themen fuer die Verwechslungspaare im Tagespensum (L4).
  const verwandtschaft = useMemo(() => verwandteThemen(themen, aktiveItems), [themen, aktiveItems])

  const {
    sitzung,
    position,
    letzteXp,
    letzteAktion,
    offeneSitzung,
    sitzungStarten,
    sitzungFortsetzen,
    weiter,
    ausSitzungNehmen,
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
    verwandtschaft,
    onSpeicherfehler: (text) => setMeldung({ art: 'fehler', text }),
    onSitzungsende: ({ antworten, richtig, minuten }) =>
      setMeldung({
        art: 'erfolg',
        bleibt: true,
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
  const ansichtRef = useRef(ansicht)
  ansichtRef.current = ansicht
  useTastaturNavigation({ ansichtRef, setAnsicht, setSuchFokus, setTastenhilfeOffen })

  // --- Adresse <-> Ansicht (27A) -------------------------------------------
  const verlassenRef = useRef(null)
  verlassenRef.current = verlassen
  useAdresse(ansicht, setAnsicht, ansichtRef, (ziel) => {
    setErklaerthema(null)
    setLernzettelThema(null)
    setKopfThema(null)
    if (ansichtRef.current === 'lernen' && ziel !== 'lernen') verlassenRef.current?.()
  })

  async function markeAendern(itemId, aenderung) {
    // Neue Meldung: Fingerabdruck des Paketinhalts dazu - daran erkennt die
    // App spaeter, dass die Karte ueberarbeitet wurde (P10).
    if (aenderung.meldung && !aenderung.meldung.inhalt) {
      const roh = rohItems.find((i) => i.id === itemId)
      if (roh) aenderung = { ...aenderung, meldung: { ...aenderung.meldung, inhalt: inhaltsStempel(roh) } }
    }
    const vorher = markenRef.current.get(itemId) ?? {}
    // Frischer Zeitstempel: sonst behielt die Marke den alten ts, und der
    // Abgleich hielt eine aeltere Fassung vom anderen Geraet fuer neuer.
    const neu = { itemId, ...vorher, ...aenderung, ts: Date.now() }
    for (const [feld, wert] of Object.entries(aenderung)) {
      if (wert === null) delete neu[feld]
    }
    markenRef.current = new Map(markenRef.current).set(itemId, neu)
    await markeSetzen(neu)
    setMarken((alte) => new Map(alte).set(itemId, neu))
  }

  // Frage in einen Kurs / aus einem Kurs (Marke, reist mit dem Abgleich).
  function kursFrageSetzen(itemId, kursId, rein) {
    return markeAendern(itemId, kursAenderung(markenRef.current.get(itemId), kursId, rein))
  }

  async function kursSammel(ids, kursId, rein) {
    const neueKarte = new Map(markenRef.current)
    for (const id of ids) {
      const vorher = neueKarte.get(id) ?? {}
      const eintrag = { itemId: id, ...vorher, ...kursAenderung(vorher, kursId, rein), ts: Date.now() }
      for (const [feld, wert] of Object.entries(eintrag)) if (wert === null) delete eintrag[feld]
      await markeSetzen(eintrag)
      neueKarte.set(id, eintrag)
    }
    markenRef.current = neueKarte
    setMarken(neueKarte)
  }

  function kursStarten(kursId, art) {
    const u = kursUebersicht.find((x) => x.kurs.id === kursId)
    if (!u) return
    const kursIds = new Set(u.lernItems.map((i) => i.id))
    if (art === 'kursplan') sitzungStarten('kursplan', { kursIds, ids: u.plan.pensum.map((i) => i.id) })
    else if (art === 'endspurt') sitzungStarten('endspurt', { kursIds, ids: endspurt(u.reife).map((i) => i.id) })
    else if (art === 'alle') sitzungStarten('fehlerstapel', { ids: [...kursIds] })
    else sitzungStarten(art, { kursIds })
  }

  // Gemeldete Karten stehen auf "Ueberarbeiten" (meldungen.js) - auch
  // aeltere Meldungen und solche, die per Abgleich hereinkommen.
  const nachziehenLaeuft = useRef(false)
  useEffect(() => {
    if (laedt || nachziehenLaeuft.current) return
    // Zuerst ueberarbeitete Karten abhaken (P10), dann alte Meldungen
    // nachziehen - eine erledigte Meldung gilt danach nicht mehr als gemeldet.
    const erledigt = erledigteMeldungen(marken, rohItems)
    const offen = erledigt.length ? [] : meldungenNachziehen(marken)
    if (erledigt.length === 0 && offen.length === 0) return
    nachziehenLaeuft.current = true
    ;(async () => {
      try {
        for (const [itemId, aenderung] of [...erledigt, ...offen]) await markeAendern(itemId, aenderung)
        if (erledigt.length) {
          setMeldung({
            art: 'erfolg',
            bleibt: true,
            text: `${erledigt.length} gemeldete ${erledigt.length === 1 ? 'Karte wurde' : 'Karten wurden'} überarbeitet und ${erledigt.length === 1 ? 'steht' : 'stehen'} wieder auf „ungesichtet“ – in der Sichtung neu einordnen.`,
          })
        }
      } finally {
        nachziehenLaeuft.current = false
      }
    })()
  }, [marken, laedt, rohItems])

  async function sammelSichtung(ids, kategorie) {
    const neueKarte = new Map(marken)
    for (const id of ids) {
      const vorher = neueKarte.get(id) ?? {}
      const eintrag = { itemId: id, ...vorher, kategorie, ts: Date.now() }
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
      const bericht = { ereignisse: 0, skizzen: 0, marken: 0, pruefungen: 0, kursplan: 0, geloescht: 0 }
      for (const text of texte) {
        const teil = await importieren(text)
        for (const k of Object.keys(bericht)) bericht[k] += teil[k] ?? 0
      }
      await zustandNeuLesen()
      // Kursplan und Loeschungen gehoeren mit in die Meldung - sonst hiess
      // es "Übernommen: 0 …", obwohl sich etwas geaendert hatte (B3).
      const teile = [
        `${bericht.ereignisse} Ereignisse`,
        `${bericht.skizzen} Skizzen`,
        `${bericht.marken} Marken`,
        `${bericht.pruefungen} Prüfungen`,
      ]
      if (bericht.kursplan) teile.push(`${bericht.kursplan} Kurs-/Klausureinträge`)
      if (bericht.geloescht) teile.push(`${bericht.geloescht} Löschungen angewandt`)
      setMeldung({ art: 'erfolg', text: `Übernommen: ${teile.join(', ')}.` })
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
    setKursplan(kursplanLesen(profilId))
  }

  // --- Abgleich ueber Dropbox (hooks/useAbgleich.js) ----------------------
  const { abgleichZustand, jetztAbgleichen } = useAbgleich({
    profilId, profilName, opt, laedt, ansicht, zustandNeuLesen, setMeldung,
  })

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
    return <Ladeskelett />
  }

  if (fehler) {
    // Keine Sackgasse (B2): Das gewaehlte Paket bleibt gespeichert, ohne
    // Ausweg landete man nach jedem Neustart wieder hier - etwa offline mit
    // einem Paket, das auf diesem Geraet noch nie geladen wurde.
    const andere = (paketliste ?? []).filter((p) => p.id !== opt.aktivesPaket)
    return (
      <div className="huelle einspaltig">
        <div className="schirm">
          <h1 className="ueberschrift">Inhalt fehlt</h1>
          <p className="nebentext">{fehler}</p>
          <p className="nebentext">
            Ohne Internet lassen sich nur Pakete öffnen, die auf diesem Gerät schon einmal geladen
            wurden. Dein Fortschritt ist nicht betroffen.
          </p>
          <div className="wahl">
            <button className="knopf schmal" onClick={() => setLadeVersuch((n) => n + 1)}>
              Erneut versuchen
            </button>
            {andere.map((p) => (
              <button
                key={p.id}
                className="knopf schmal"
                onClick={() => setOpt((o) => ({ ...o, aktivesPaket: p.id }))}
              >
                Zu „{p.titel ?? p.id}“ wechseln
              </button>
            ))}
            {onProfilWechseln && (
              <button className="knopf schmal" onClick={onProfilWechseln}>
                Profil wechseln
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (ansicht === 'lernen' && sitzung?.pensum[position]) {
    const item = sitzung.pensum[position]
    return (
      <div className="huelle einspaltig">
        <KartenGrenze key={item.id} kennung={item.id} onWeiter={() => weiter()} onZurueck={verlassen}>
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
          // Heute schon bewertet: weitere Antworten aendern die Planung
          // nicht (planer.js) - dann keine irrefuehrende Vorschau.
          intervalle={heuteBewertet(zustaende.get(item.id))
            ? null
            : intervallVorschau(zustaende.get(item.id), { zielBehaltensrate: opt.zielBehaltensrate })}
          heuteBewertet={heuteBewertet(zustaende.get(item.id))}
          // Problemkarte: ab 6 Fehlern (Nutzerentscheidung 6A)
          istProblem={(zustaende.get(item.id)?.fehler ?? 0) >= 6}
          zweiterVersuch={istWiederholung(sitzung.pensum, position)}
          themen={themen}
          glossar={glossar}
          fruehereSkizzen={skizzen.filter((s) => s.itemId === item.id)}
          kannZurueck={Boolean(letzteAktion)}
          onMarke={markeAendern}
          onGemeldet={(id) => {
            setGemeldetHinweis(id)
            ausSitzungNehmen(id)
          }}
          gemeldetHinweis={gemeldetHinweis !== null && gemeldetHinweis !== item.id}
          onHinweisGelesen={() => setGemeldetHinweis(null)}
          kurse={kursplan.kurse}
          onKurs={kursFrageSetzen}
          // Einfuehrungsschritt (D4): erste neue Karte eines Themas, aus dem
          // noch keine Karte beantwortet wurde und dessen Einfuehrung auf
          // diesem Geraet noch nicht gelesen ist.
          einfuehrung={
            sitzung.art !== 'vorab' &&
            sitzung.art !== 'blaettern' &&
            !zustaende.has(item.id) &&
            !(opt.eingefuehrt ?? []).includes(item.themaId) &&
            !aktiveItems.some((i) => i.themaId === item.themaId && zustaende.has(i.id))
          }
          onEingefuehrt={(id) =>
            setOpt((o) => ({ ...o, eingefuehrt: [...new Set([...(o.eingefuehrt ?? []), id])] }))
          }
          onBewerten={(...a) => { setGemeldetHinweis(null); return bewerten(...a) }}
          onUeberspringen={() => { setGemeldetHinweis(null); weiter() }}
          onZurueckblaettern={zurueckblaettern}
          onRueckgaengig={rueckgaengig}
          onZurueck={verlassen}
        />
        </KartenGrenze>
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

  if (kopfThema) {
    const thema = themen.find((t) => t.id === kopfThema)
    if (thema) {
      return (
        <div className="huelle einspaltig">
          <AusDemKopf
            thema={thema}
            profilId={profilId}
            onZurueck={() => setKopfThema(null)}
            onErklaerung={() => {
              setKopfThema(null)
              setErklaerthema(thema.id)
            }}
          />
        </div>
      )
    }
  }

  if (erklaerthema) {
    const thema = themen.find((t) => t.id === erklaerthema)
    const themaItems = aktiveItems.filter((i) => i.themaId === thema.id)
    return (
      <div className="huelle einspaltig">
        <Erklaerstueck
          thema={thema}
          themen={themen}
          items={themaItems}
          zustaende={zustaende}
          marken={marken}
          profilId={profilId}
          onErstRaten={() => sitzungStarten('vorab', { themaId: thema.id })}
          onAusDemKopf={() => setKopfThema(thema.id)}
          onLernzettel={() => setLernzettelThema(thema.id)}
          onFehlerUeben={(ids) => sitzungStarten('fehlerstapel', { ids })}
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
      <Navigation
        ansicht={ansicht}
        setAnsicht={setAnsicht}
        paketliste={paketliste}
        aktivesPaket={opt.aktivesPaket}
        onPaketWahl={(id) => setOpt((o) => ({ ...o, aktivesPaket: id }))}
        level={level}
        gestaltung={gestaltung}
        profilName={profilName}
        onProfilWechseln={onProfilWechseln}
        pruefungHinweis={pruefungHinweis}
      />

      {importFrage && (
        <Schleier onSchliessen={() => setImportFrage(null)}>
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
        </Schleier>
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
          zeichenAus={opt.zeichenAusblenden}
          neue={neueItems.length}
          tagesziel={opt.tagesziel ?? 0}
          offeneSitzung={offeneSitzung}
          onFortsetzen={sitzungFortsetzen}
          onVerwerfen={verwerfen}
          onStart={(art) => sitzungStarten(art, {})}
          onThemen={() => setAnsicht('themen')}
          nichtGewusst={nichtGewusst}
          onOeffnen={oeffneItem}
          aufstieg={aufstieg}
          onAufstiegGesehen={() => setAufstieg(null)}
          pruefungHinweis={pruefungHinweis}
          onPruefung={() => setAnsicht('pruefung')}
          sicherungFaellig={sicherungFaellig}
          speicherGeschuetzt={speicherGeschuetzt}
          onSichern={() => exportKlick(false)}
          offenePruefung={offenePruefung}
          onPruefungFortsetzen={() => setAnsicht('pruefung')}
          klausuren={kursplan.klausuren}
          kurse={kursUebersicht}
          onKurs={kursStarten}
          onVorschlaegeUebernehmen={(u) => kursSammel(u.vorschlaege.map((i) => i.id), u.kurs.id, true)}
          onKursPruefung={() => setAnsicht('pruefung')}
          onKurseVerwalten={() => setAnsicht('einstellungen')}
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
          kurse={kursplan.kurse}
          onKurs={kursFrageSetzen}
          onKursSammel={kursSammel}
          weiterNachMarke={opt.sichtungWeiter}
          startItem={nachschlagenItem}
          suchFokus={suchFokus}
          onStartItemErledigt={() => setNachschlagenItem(null)}
        />
      )}
      {ansicht === 'pruefung' && (
        <Pruefung
          items={pruefItems}
          kurse={kursUebersicht}
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
          zeichenAus={opt.zeichenAusblenden}
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
          abgleich={{ ...abgleichZustand, onJetzt: jetztAbgleichen }}
          werte={opt}
          setzen={setOpt}
          kursplan={kursplan}
          kursplanAendern={kursplanAendern}
          kennungen={kursKennungen}
          anzahlEreignisse={ereignisse.length}
          anzahlSkizzen={skizzen.length}
          paketliste={paketliste}
          letzteSicherung={opt.letzteSicherung}
          speicherGeschuetzt={speicherGeschuetzt}
          onExport={exportKlick}
          onExportCsv={csvExportKlick}
          anzahlMeldungen={meldeliste.length + freigaben.length}
          onMeldungenExport={() =>
            textHerunterladen(
              meldungenMarkdown({ eintraege: meldeliste, freigaben, paket: paketInfo }),
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

