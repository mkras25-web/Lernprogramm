import { useEffect, useMemo, useRef, useState } from 'react'
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
  xpFuerPruefung,
  xpFuerMeilensteine,
  xpGesamt,
  rekorde,
} from './lib/fortschritt.js'
import { itemsAnreichern, lernbareItems } from './lib/sichtung.js'
import { monatspruefungFaellig, pruefungsplan } from './lib/pruefung.js'
import { anwenden, laden as einstellungenLaden, speichern } from './lib/einstellungen.js'
import { profilListe } from './lib/profile.js'
import { serienquote } from './lib/stufen.js'
import { useLernsitzung } from './hooks/useLernsitzung.js'
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
import Tastenhilfe from './components/Tastenhilfe.jsx'

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
  const [paketliste, setPaketliste] = useState([])
  const [pruefungen, setPruefungen] = useState([])
  const [ereignisse, setEreignisse] = useState([])
  const [skizzen, setSkizzen] = useState([])
  const [marken, setMarken] = useState(new Map())
  const [fehler, setFehler] = useState(null)
  const [laedt, setLaedt] = useState(true)
  const [meldung, setMeldung] = useState(null)
  // Bewusst nur ueber einen Knopf in den Einstellungen erreichbar, nicht
  // ueber eine globale "?"-Taste: Lernen und Sichtung haben eigene,
  // aktive Tastaturkuerzel (1-4, R/S/U/X, ...) - ein global offenes
  // Overlay wuerde deren Tasten unbemerkt durchlassen und im
  // Hintergrund z. B. eine Bewertung ausloesen.
  const [tastenhilfeOffen, setTastenhilfeOffen] = useState(false)

  const [opt, setOpt] = useState(() => einstellungenLaden(profilId))
  const [ansicht, setAnsicht] = useState('heute')
  const [erklaerthema, setErklaerthema] = useState(null)
  const [aufstieg, setAufstieg] = useState(null)
  const stufeVorher = useRef(null)

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
  })

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
    const text = await exportieren({ mitSkizzen, profilId, profilName })
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
        <div className="ladeAnzeige" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p className="nebentext">Paket wird geladen …</p>
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
          onZurueckblaettern={zurueckblaettern}
          onRueckgaengig={rueckgaengig}
          onZurueck={verlassen}
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

      {meldung && (
        <div
          className={meldung.art === 'fehler' ? 'meldung fehler' : 'meldung'}
          role="status"
          aria-live="polite"
        >
          <p>{meldung.text}</p>
          <button onClick={() => setMeldung(null)} aria-label="Meldung schließen">✕</button>
        </div>
      )}

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
          onVerwerfen={verwerfen}
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
          profilName={profilName}
          onProfilWechseln={onProfilWechseln}
          onTastenhilfe={() => setTastenhilfeOffen(true)}
        />
      )}

      <Tastenhilfe offen={tastenhilfeOffen} onSchliessen={() => setTastenhilfeOffen(false)} />
    </div>
  )
}
