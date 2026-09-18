import { useCallback, useEffect, useMemo, useState } from 'react'
import { KATEGORIEN, UNGESICHTET, kategorieAus } from '../lib/sichtung.js'
import { passt } from '../lib/suche.js'
import Itemansicht from '../components/Itemansicht.jsx'

const MARKENFILTER = [
  ['alle', 'alle'],
  ['lesezeichen', 'Lesezeichen'],
  ['notiz', 'mit Notiz'],
  ['einspruch', 'Einspruch'],
  ['bearbeitet', 'bearbeitet'],
]

// Nachschlagen und Sichten sind dieselbe Tätigkeit: alle Items ansehen
// und entscheiden, was damit geschieht. Deshalb ein Bildschirm statt
// zweier fast gleicher Listen.
export default function Sichtung({
  items, themen, marken, ereignisse, zustaende, glossar, onMarke, onSammel,
  weiterNachMarke = false,
}) {
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState('alle')
  const [marke, setMarkeFilter] = useState('alle')
  const [thema, setThema] = useState('alle')
  const [ausgewaehlt, setAusgewaehlt] = useState(new Set())
  const [offenesItem, setOffenesItem] = useState(null)
  // Beim Öffnen wird die Reihenfolge festgehalten. Sonst rutscht die
  // Liste unter einem weg, sobald eine Marke gesetzt wird und das Item
  // aus dem Filter fällt - dann führt "Nächstes" ins Leere.
  const [blaetterliste, setBlaetterliste] = useState([])
  const [bearbeite, setBearbeite] = useState(null)
  const [entwurf, setEntwurf] = useState({ frage: '', antwort: '' })

  const gefiltert = useMemo(() => {
    return items.filter((i) => {
      if (thema !== 'alle' && i.themaId !== thema) return false
      const m = marken.get(i.id)
      if (marke === 'lesezeichen' && !m?.lesezeichen) return false
      if (marke === 'notiz' && !m?.notiz) return false
      if (marke === 'einspruch' && !m?.einspruch) return false
      if (marke === 'bearbeitet' && !m?.frage && !m?.antwort) return false
      if (filter !== 'alle' && kategorieAus(m).id !== filter) return false
      if (suche.trim()) {
        const text = [i.frage, i.antwort, i.vertiefung, i.themaTitel, i.modulTitel,
                      ...(i.tags ?? [])].filter(Boolean).join(' ')
        if (!passt(suche, text)) return false
      }
      return true
    })
  }, [items, marken, filter, thema, marke, suche])

  const zaehler = useMemo(() => {
    const z = { ungesichtet: 0 }
    for (const k of KATEGORIEN) z[k.id] = 0
    for (const i of items) z[kategorieAus(marken.get(i.id)).id] += 1
    return z
  }, [items, marken])

  function umschalten(id) {
    setAusgewaehlt((alt) => {
      const neu = new Set(alt)
      neu.has(id) ? neu.delete(id) : neu.add(id)
      return neu
    })
  }

  function sammelSetzen(kategorie) {
    onSammel([...ausgewaehlt], kategorie)
    setAusgewaehlt(new Set())
  }

  function bearbeitenStarten(item) {
    setBearbeite(item.id)
    setEntwurf({ frage: item.frage, antwort: item.antwort })
  }

  function oeffnen(id) {
    setBlaetterliste(gefiltert.map((i) => i.id))
    setOffenesItem(id)
  }

  const stelleIn = useCallback(
    (id) => blaetterliste.findIndex((x) => x === id),
    [blaetterliste]
  )

  const istUngesichtet = useCallback(
    (id) => kategorieAus(marken.get(id)).id === 'ungesichtet',
    [marken]
  )

  // Nächstes noch nicht gesichtetes Item in der festgehaltenen Liste.
  const naechstesOffene = useCallback(
    (abId) => {
      const start = stelleIn(abId)
      for (let i = start + 1; i < blaetterliste.length; i++) {
        if (istUngesichtet(blaetterliste[i])) return blaetterliste[i]
      }
      return null
    },
    [blaetterliste, stelleIn, istUngesichtet]
  )

  // Tastensteuerung fuer das Sichten am Stueck: Pfeile blaettern,
  // N springt zum naechsten Ungesichteten, R/S/U/X setzen die Kategorie.
  // Nicht, solange der Fokus in einem Eingabefeld steht.
  useEffect(() => {
    if (!offenesItem) return
    function taste(e) {
      const ziel = e.target?.tagName
      if (ziel === 'INPUT' || ziel === 'TEXTAREA' || ziel === 'SELECT') return
      if (e.ctrlKey || e.altKey || e.metaKey) return

      const stelle = stelleIn(offenesItem)
      if (e.key === 'ArrowRight') {
        if (stelle >= 0 && stelle < blaetterliste.length - 1) {
          setOffenesItem(blaetterliste[stelle + 1])
          e.preventDefault()
        }
        return
      }
      if (e.key === 'ArrowLeft') {
        if (stelle > 0) {
          setOffenesItem(blaetterliste[stelle - 1])
          e.preventDefault()
        }
        return
      }
      if (e.key === 'Escape') {
        setOffenesItem(null)
        return
      }

      const buchstabe = e.key.toLowerCase()
      if (buchstabe === 'n') {
        const weiter = naechstesOffene(offenesItem)
        if (weiter) setOffenesItem(weiter)
        e.preventDefault()
        return
      }

      const treffer = Object.entries(TASTEN).find(([, b]) => b === buchstabe)
      if (!treffer) return
      const jetzt = kategorieAus(marken.get(offenesItem)).id
      const neu = jetzt === treffer[0] ? null : treffer[0]
      onMarke(offenesItem, { kategorie: neu })
      if (weiterNachMarke && neu) {
        const weiter = naechstesOffene(offenesItem)
        if (weiter) setOffenesItem(weiter)
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [offenesItem, blaetterliste, stelleIn, naechstesOffene, marken, onMarke, weiterNachMarke])

  // ---------- Einzelansicht ----------
  if (offenesItem) {
    const item = items.find((i) => i.id === offenesItem)
    // Kein setState waehrend des Renderns - das bricht React ab.
    // Stattdessen eine Meldung mit Ausweg.
    if (!item) {
      return (
        <div className="schirm">
          <h1 className="ueberschrift">Item nicht mehr vorhanden</h1>
          <p className="nebentext">
            Es wurde vermutlich aus dem Paket entfernt oder das Paket wurde gewechselt.
          </p>
          <button className="knopf schmal" onClick={() => setOffenesItem(null)}>
            Zurück zur Liste
          </button>
        </div>
      )
    }
    const m = marken.get(item.id) ?? {}
    const k = kategorieAus(m)
    const stelle = stelleIn(item.id)
    const offeneDanach = blaetterliste.filter((id, i) => i > stelle && istUngesichtet(id)).length
    const naechstesOffen = naechstesOffene(item.id)

    // Kategorie setzen und, wenn gewünscht, gleich weiterspringen.
    function kategorieSetzen(katId) {
      const neu = k.id === katId ? null : katId
      onMarke(item.id, { kategorie: neu })
      if (weiterNachMarke && neu && naechstesOffen) setOffenesItem(naechstesOffen)
    }

    return (
      <div className="schirm">
        <div className="themenKopf">
          <button className="textknopf" onClick={() => setOffenesItem(null)}>
            Zurück zur Liste
          </button>
          <div className="wahl">
            <button
              className="artKnopf"
              disabled={stelle <= 0}
              onClick={() => setOffenesItem(blaetterliste[stelle - 1])}
            >
              ← Vorheriges
            </button>
            <span className="zeileHinweis">
              {stelle + 1} von {blaetterliste.length}
              {offeneDanach > 0 ? ` · noch ${offeneDanach} offen` : ' · nichts mehr offen'}
            </span>
            <button
              className="artKnopf"
              disabled={stelle < 0 || stelle >= blaetterliste.length - 1}
              onClick={() => setOffenesItem(blaetterliste[stelle + 1])}
            >
              Nächstes →
            </button>
            <button
              className="artKnopf haupt"
              disabled={!naechstesOffen}
              title="Springt zum nächsten Item ohne Sichtungsmarke (Taste N)"
              onClick={() => naechstesOffen && setOffenesItem(naechstesOffen)}
            >
              Nächstes ungesichtetes ⇥
            </button>
          </div>
        </div>

        <Itemansicht
          item={item}
          glossar={glossar}
          zustand={zustaende?.get(item.id)}
          verlauf={(ereignisse ?? []).filter((e) => e.itemId === item.id)}
        />

        <section className="block">
          <h2 className="abschnitt">Sichtung und Marken</h2>
          <p className="zeileHinweis tastenHinweis">
            Tasten: ← → blättern · N zum nächsten ungesichteten · R S U X setzen die Kategorie
            {weiterNachMarke ? ' · springt nach dem Markieren weiter' : ''}
          </p>
          <div className="marken">
            {KATEGORIEN.map((kat) => (
              <button
                key={kat.id}
                className={k.id === kat.id ? 'markenKnopf aktiv' : 'markenKnopf'}
                onClick={() => kategorieSetzen(kat.id)}
                title={`Taste ${TASTEN[kat.id]?.toUpperCase() ?? ''}`}
              >
                {kat.symbol} {kat.name}
                {TASTEN[kat.id] && (
                  <span className="tastenMarke">{TASTEN[kat.id].toUpperCase()}</span>
                )}
              </button>
            ))}
            <span className="markenTrenner" />
            <button
              className={m.lesezeichen ? 'markenKnopf aktiv' : 'markenKnopf'}
              onClick={() => onMarke(item.id, { lesezeichen: !m.lesezeichen })}
            >
              Lesezeichen
            </button>
            <button
              className={m.einspruch ? 'markenKnopf aktiv' : 'markenKnopf'}
              onClick={() => onMarke(item.id, { einspruch: !m.einspruch })}
            >
              ⚑ Stimmt so nicht
            </button>
            <button className="markenKnopf" onClick={() => bearbeitenStarten(item)}>
              ✎ Bearbeiten
            </button>
            {item.bearbeitet && (
              <button
                className="markenKnopf"
                onClick={() => onMarke(item.id, { frage: null, antwort: null })}
              >
                Original wiederherstellen
              </button>
            )}
          </div>

          {bearbeite === item.id ? (
            <>
              <textarea
                className="notizfeld"
                value={entwurf.frage}
                onChange={(e) => setEntwurf({ ...entwurf, frage: e.target.value })}
              />
              <textarea
                className="notizfeld"
                value={entwurf.antwort}
                onChange={(e) => setEntwurf({ ...entwurf, antwort: e.target.value })}
              />
              <div className="wahl">
                <button
                  className="knopf schmal"
                  onClick={() => {
                    onMarke(item.id, { frage: entwurf.frage, antwort: entwurf.antwort })
                    setBearbeite(null)
                  }}
                >
                  Übernehmen
                </button>
                <button className="textknopf" onClick={() => setBearbeite(null)}>
                  Abbrechen
                </button>
              </div>
            </>
          ) : (
            <textarea
              className="notizfeld"
              value={m.notiz ?? ''}
              placeholder="Eigene Randbemerkung zu diesem Item …"
              onChange={(e) => onMarke(item.id, { notiz: e.target.value })}
            />
          )}
        </section>
      </div>
    )
  }

  // ---------- Liste ----------
  return (
    <div className="schirm">
      <div className="themenKopf">
        <h1 className="ueberschrift">Nachschlagen und Sichten</h1>
        <p className="nebentext">
          {zaehler.ungesichtet} ungesichtet · {zaehler.relevant} relevant ·{' '}
          {zaehler.spaeter} später · {zaehler.ueberarbeiten} überarbeiten ·{' '}
          {zaehler.streichen} gestrichen
        </p>
      </div>

      <input
        className="suchfeld"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Begriff, Frage oder Schlagwort … (verzeiht Tippfehler)"
      />

      <div className="reiter">
        <button
          className={filter === 'alle' ? 'reiterKnopf aktiv' : 'reiterKnopf'}
          onClick={() => setFilter('alle')}
        >
          Alle <span className="reiterZahl">{items.length}</span>
        </button>
        <button
          className={filter === 'ungesichtet' ? 'reiterKnopf aktiv' : 'reiterKnopf'}
          onClick={() => setFilter('ungesichtet')}
        >
          {UNGESICHTET.symbol} Ungesichtet <span className="reiterZahl">{zaehler.ungesichtet}</span>
        </button>
        {KATEGORIEN.map((k) => (
          <button
            key={k.id}
            className={filter === k.id ? 'reiterKnopf aktiv' : 'reiterKnopf'}
            onClick={() => setFilter(k.id)}
          >
            {k.symbol} {k.name} <span className="reiterZahl">{zaehler[k.id]}</span>
          </button>
        ))}
      </div>

      <div className="zeile">
        <div className="wahl">
          <span className="zeileHinweis">Marke:</span>
          {MARKENFILTER.map(([id, name]) => (
            <button
              key={id}
              className={marke === id ? 'wahlKnopf aktiv' : 'wahlKnopf'}
              onClick={() => setMarkeFilter(id)}
            >
              {name}
            </button>
          ))}
        </div>

        <select className="paarWahl" value={thema} onChange={(e) => setThema(e.target.value)}>
          <option value="alle">Alle Themen</option>
          {themen.filter((t) => !t.geplant).map((t) => (
            <option key={t.id} value={t.id}>{t.modulTitel} · {t.titel}</option>
          ))}
        </select>
      </div>

      <div className="wahl">
        <span className="zeileHinweis">
          {gefiltert.length} {gefiltert.length === 1 ? 'Eintrag' : 'Einträge'}
        </span>
        {gefiltert.length > 0 && (
          <button
            className="textknopf"
            onClick={() => setAusgewaehlt(new Set(gefiltert.map((i) => i.id)))}
          >
            Alle auswählen
          </button>
        )}
        {ausgewaehlt.size > 0 && (
          <>
            <button className="textknopf" onClick={() => setAusgewaehlt(new Set())}>
              Auswahl aufheben
            </button>
            <span className="markenTrenner" />
            <span className="zeileHinweis">{ausgewaehlt.size} ausgewählt:</span>
            {KATEGORIEN.map((k) => (
              <button key={k.id} className="wahlKnopf" onClick={() => sammelSetzen(k.id)}>
                {k.symbol} {k.name}
              </button>
            ))}
            <button className="wahlKnopf" onClick={() => sammelSetzen(null)}>
              zurücksetzen
            </button>
          </>
        )}
      </div>

      <ul className="treffer">
        {gefiltert.map((item) => {
          const m = marken.get(item.id) ?? {}
          const k = kategorieAus(m)
          return (
            <li key={item.id} className="trefferKarte">
              <div className="sichtungKopf">
                <input
                  type="checkbox"
                  checked={ausgewaehlt.has(item.id)}
                  onChange={() => umschalten(item.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="herkunft">
                  {item.modulTitel} · {item.themaTitel} · {item.typ}
                  {item.geprueft === false && <span className="ungeprueft">ungeprüft</span>}
                  {k.id !== 'ungesichtet' && (
                    <span className={`kategorieMarke k-${k.id}`}>{k.symbol} {k.name}</span>
                  )}
                  {m.lesezeichen && <span className="kategorieMarke">Lesezeichen</span>}
                  {m.einspruch && <span className="kategorieMarke k-ueberarbeiten">⚑</span>}
                </p>
              </div>

              <button className="trefferOeffnen" onClick={() => oeffnen(item.id)}>
                <span className="trefferFrage">{item.frage}</span>
                <span className="trefferAntwort">{kuerzen(item.antwort)}</span>
                <span className="zeileHinweis">Öffnen →</span>
              </button>

              {m.notiz && <p className="merksatz">{m.notiz}</p>}
            </li>
          )
        })}
      </ul>

      {gefiltert.length === 0 && <p className="nebentext">Keine Items in dieser Auswahl.</p>}
    </div>
  )
}

// Tastenbelegung fuer das Sichten am Stueck. Die Buchstaben folgen
// den Anfangsbuchstaben der Kategorien.
const TASTEN = { relevant: 'r', spaeter: 's', ueberarbeiten: 'u', streichen: 'x' }

function kuerzen(text, laenge = 160) {
  if (!text || text.length <= laenge) return text
  return `${text.slice(0, laenge).trimEnd()} …`
}
