import { useEffect, useMemo, useRef, useState } from 'react'
import Begriffe from '../components/Begriffe.jsx'
import { passt } from '../lib/suche.js'
import { quelleText } from '../lib/quelle.js'
import { kartenJeBegriff } from '../lib/lexikon.js'

// Fachbegriff-Lexikon (2026-10-29): Reiter unter Nachschlagen und
// zugleich die Ebene, die ein Klick auf einen Begriff in einer Frage
// oeffnet (dann mit "Zurueck zur Frage"). Inhalt aus lexikon.json,
// entsteht im Themen-Chat (ANLEITUNG-THEMA-CHAT.md 2.4).
export default function Lexikon({
  eintraege = [], muster = null, items = [], themen = [], ziel = null, onZiel,
  reiter = null, zurueck = null, onItemOeffnen, onUeben, onThema,
}) {
  const [suche, setSuche] = useState('')
  const [kartenOffen, setKartenOffen] = useState(null)
  const zielRef = useRef(null)
  const zurueckRef = useRef(null)

  // Als Ebene (zurueck gesetzt) liegt der Fokus auf "Zurueck", nicht im
  // Suchfeld - sonst landeten Tasten (z. B. 1-4 aus der Lernsitzung) als
  // Suchtext darin und blendeten den gesuchten Eintrag aus.
  useEffect(() => {
    if (zurueck) zurueckRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nachId = useMemo(() => new Map(eintraege.map((e) => [e.id, e])), [eintraege])
  const themaTitel = useMemo(() => new Map(themen.map((t) => [t.id, t.titel])), [themen])
  const karten = useMemo(() => kartenJeBegriff(items, muster), [items, muster])

  // Neues Ziel (Klick auf einen Begriff): Suche leeren, hinscrollen.
  useEffect(() => {
    if (!ziel) return
    setSuche('')
    requestAnimationFrame(() => zielRef.current?.scrollIntoView({ block: 'start' }))
  }, [ziel])

  const sichtbar = useMemo(() => {
    if (!suche.trim()) return eintraege
    return eintraege.filter((e) => passt(suche, [e.begriff, ...e.varianten, e.definition, e.beispiel].filter(Boolean).join(' ')))
  }, [eintraege, suche])

  // Im A–Z ohne Suche zusaetzlich Verweiszeilen fuer Varianten
  // ("Horizontalsperre → Sperrschicht"). Ausgelassen: Varianten, die
  // ohnehin neben dem Begriff stehen (gleicher Wortanfang, z. B. Plural)
  // oder selbst ein Begriff sind.
  const verweise = useMemo(() => {
    const begriffe = new Set(eintraege.map((e) => e.begriff.toLocaleLowerCase('de')))
    const liste = []
    for (const e of eintraege) {
      const b = e.begriff.toLocaleLowerCase('de')
      for (const form of e.varianten) {
        const v = form.toLocaleLowerCase('de')
        if (begriffe.has(v) || v.slice(0, 4) === b.slice(0, 4) || v.startsWith(b) || b.startsWith(v)) continue
        liste.push({ verweis: true, begriff: form, ziel: e })
      }
    }
    return liste
  }, [eintraege])

  const gruppen = useMemo(() => {
    const nachBuchstabe = new Map()
    const zeilen = suche.trim() ? sichtbar : [...sichtbar, ...verweise].sort((a, b) => a.begriff.localeCompare(b.begriff, 'de'))
    for (const e of zeilen) {
      const b = e.begriff[0].toLocaleUpperCase('de').replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U')
      const schluessel = /[A-Z]/.test(b) ? b : '#'
      if (!nachBuchstabe.has(schluessel)) nachBuchstabe.set(schluessel, [])
      nachBuchstabe.get(schluessel).push(e)
    }
    return [...nachBuchstabe.entries()]
  }, [sichtbar, verweise, suche])

  const seite = (
    <div role="main" className="schirm lexikon">
      {reiter}
      <h1 className="ueberschrift">Lexikon</h1>
      {eintraege.length === 0 ? (
        <p className="nebentext">
          Für dieses Paket gibt es noch kein Lexikon. Die Fachbegriffe entstehen im Themen-Chat (Datei
          lexikon.json, Anleitung Abschnitt 2.4); danach sind sie in Fragen, Antworten und Erklärtexten
          anklickbar.
        </p>
      ) : (
        <>
          <p className="nebentext">
            {eintraege.length} Fachbegriffe. Unterstrichene Begriffe in Fragen, Antworten und Erklärtexten
            führen hierher.
          </p>
          <input
            className="suchfeld"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Begriff suchen, z. B. Sperrschicht, U-Wert …"
          />
          {sichtbar.length === 0 && <p className="nebentext">Kein Begriff gefunden.</p>}
          {gruppen.map(([buchstabe, liste]) => (
            <section key={buchstabe} className="block">
              <h2 className="abschnitt">{buchstabe}</h2>
              <ul className="treffer">
                {liste.map((e) => {
                  if (e.verweis) {
                    return (
                      <li key={`verweis-${e.begriff}-${e.ziel.id}`} className="lexikonVerweis">
                        {e.begriff} →{' '}
                        <button className="textknopf" onClick={() => onZiel?.(e.ziel.id)}>{e.ziel.begriff}</button>
                      </li>
                    )
                  }
                  const inKarten = karten.get(e.id) ?? []
                  const siehe = (e.siehe ?? []).map((id) => nachId.get(id)).filter(Boolean)
                  return (
                    <li
                      key={e.id}
                      id={`lexikon-${e.id}`}
                      ref={e.id === ziel ? zielRef : null}
                      className={e.id === ziel ? 'trefferKarte lexikonEintrag ziel' : 'trefferKarte lexikonEintrag'}
                    >
                      <h3 className="lexikonBegriff">
                        {e.begriff}
                        {e.varianten.length > 0 && <span className="lexikonVarianten"> · {e.varianten.join(', ')}</span>}
                      </h3>
                      <p className="lexikonText"><Begriffe text={e.definition} ohne={e.id} /></p>
                      {e.beispiel && (
                        <p className="lexikonBeispiel">
                          <span className="lexikonMarke">Beispiel</span> <Begriffe text={e.beispiel} ohne={e.id} />
                        </p>
                      )}
                      {siehe.length > 0 && (
                        <div className="wahl">
                          <span className="zeileHinweis">Siehe auch:</span>
                          {siehe.map((s) => (
                            <button key={s.id} className="markenKnopf" onClick={() => onZiel?.(s.id)}>{s.begriff}</button>
                          ))}
                        </div>
                      )}
                      {e.themen?.length > 0 && onThema && (
                        <div className="wahl">
                          {e.themen.filter((t) => themaTitel.has(t)).map((t) => (
                            <button key={t} className="textknopf" onClick={() => onThema(t)}>{themaTitel.get(t)} →</button>
                          ))}
                        </div>
                      )}
                      {e.quelle && <span className="quelle">{quelleText(e.quelle)}</span>}
                      {inKarten.length > 0 && onItemOeffnen && (
                        <div className="wahl">
                          <span className="zeileHinweis">in {inKarten.length} {inKarten.length === 1 ? 'Karte' : 'Karten'}</span>
                          <button className="textknopf" onClick={() => setKartenOffen(kartenOffen === e.id ? null : e.id)}>
                            {kartenOffen === e.id ? 'ausblenden' : 'anzeigen'}
                          </button>
                          {onUeben && (
                            <button className="textknopf" onClick={() => onUeben(inKarten.map((i) => i.id))}>üben</button>
                          )}
                        </div>
                      )}
                      {kartenOffen === e.id && (
                        <ul className="normKarten">
                          {inKarten.map((i) => (
                            <li key={i.id}>
                              <button className="textknopf" onClick={() => onItemOeffnen(i.id)}>{i.frage}</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )

  // Als Ebene: "Zurueck" fest oben, nur die Liste darunter scrollt.
  if (!zurueck) return seite
  return (
    <>
      <button ref={zurueckRef} className="knopf haupt lexikonZurueck" onClick={zurueck.onKlick}>
        ← {zurueck.text}
      </button>
      <div className="lexikonRumpf">{seite}</div>
    </>
  )
}
