// Durchsicht (2026-10-17): dauerhafte Qualitaetspruefung aller Inhalte.
// Den Pruefstand fuehrt Einspielen/durchsicht.py in
// public/pakete/<paket>/durchsicht.json; die App zeigt ihn nur an und
// nimmt deine Entscheidung zu Aenderungen entgegen. Die Entscheidung steht
// in der Marke des Ziels (reist mit Sicherung und Dropbox) - das Skript
// liest sie dort und laesst danach nur noch eine Fassung uebrig.
//
// Ziele: Aufgaben (Item-Id), Erklaerstuecke ("erklaerung:<thema>") und
// Bilder ("bild:bilder/<datei>.svg"). Jeder Eintrag gilt nur fuer die
// gepruefte Fassung (hash) - das Skript setzt ihn bei neuem Inhalt zurueck.
//
// Nicht zu verwechseln mit dem Itemfeld "geprueft": das sagt nur, ob der
// Normstand belegt ist (in der App "Normstand offen", wenn false).

export const EBENEN = {
  fach: 'Fachlich',
  quelle: 'Quelle',
  normstand: 'Normstand',
  didaktik: 'Didaktik',
  sprache: 'Sprache',
  technik: 'Technik',
  darstellung: 'Darstellung',
  bild: 'Bild',
}

// Lesbare Feldnamen fuer die Vorher/Nachher-Ansicht.
export const FELDNAMEN = {
  frage: 'Frage', antwort: 'Antwort', vertiefung: 'Vertiefung', quelle: 'Quelle',
  optionen: 'Antwortmöglichkeiten', richtig: 'Richtige Antwort(en)', erklaerung: 'Erklärstück',
  lernziele: 'Lernziele', merksatz: 'Merksatz', warum: 'Warum', pruefpunkte: 'Prüfpunkte',
  geprueft: 'Normstand belegt', pruefhinweis: 'Prüfhinweis', bildunterschrift: 'Bildunterschrift',
  paare: 'Paare', schritte: 'Schritte', tags: 'Schlagworte', stand: 'Stand', wert: 'Wert',
  toleranz: 'Toleranz', einheit: 'Einheit', loesung: 'Lösung', fehler: 'Fehler',
  absaetze: 'Absätze',
}

// Stand eines Ziels aus Sicht der App:
//   offen     - noch nicht (oder nicht mehr) durchgesehen
//   geprueft  - durchgesehen (ggf. mit angenommener Aenderung)
//   wartet    - geaendert, deine Entscheidung fehlt noch
//   abgelehnt - du hast die Aenderung abgelehnt; die App zeigt die alte
//               Fassung, bis das Skript sie zurueckschreibt
export function standVon(eintrag, marke) {
  if (!eintrag) return { stand: 'offen' }
  const geaendertAm = eintrag.geaendert_am ?? null
  if (eintrag.stand === 'geprueft') {
    return { stand: 'geprueft', datum: eintrag.datum, geaendertAm, grund: eintrag.geaendert_grund }
  }
  if (eintrag.stand === 'geaendert') {
    const e = marke?.durchsicht
    if (e && e.hash === eintrag.hash) {
      if (e.entscheidung === 'angenommen') {
        return { stand: 'geprueft', datum: eintrag.datum, geaendertAm: eintrag.datum, grund: eintrag.aenderung?.grund, lokal: true }
      }
      if (e.entscheidung === 'abgelehnt') return { stand: 'abgelehnt', datum: eintrag.datum, lokal: true }
    }
    return { stand: 'wartet', datum: eintrag.datum }
  }
  return { stand: 'offen', notiz: eintrag.notiz }
}

export function entscheidungAenderung(eintrag, entscheidung) {
  if (!entscheidung) return { durchsicht: null }
  return { durchsicht: { entscheidung, hash: eintrag.hash, ts: Date.now() } }
}

// Bildpfad eines abgelehnten Bildes auf die alte Fassung umbiegen.
function bildpfadeAlt(item, alteBilder) {
  if (!alteBilder.size) return item
  const um = (pfad) => {
    if (!pfad) return pfad
    for (const [neu, alt] of alteBilder) if (pfad.endsWith(`/${neu}`)) return pfad.slice(0, -neu.length) + alt
    return pfad
  }
  const neu = { ...item, bild: um(item.bild), referenz: um(item.referenz), fallbild: um(item.fallbild) }
  if (item.seiten) neu.seiten = item.seiten.map((s) => ({ ...s, bild: um(s.bild) }))
  return neu
}

// Haengt jedem Item seinen Durchsicht-Stand an (item.durchsicht) und zeigt
// bei abgelehnten Aenderungen schon jetzt die alte Fassung.
export function durchsichtAnwenden(items, eintraege, marken) {
  if (!eintraege) return items
  const alteBilder = new Map()
  for (const [schluessel, e] of Object.entries(eintraege)) {
    if (!schluessel.startsWith('bild:') || e.stand !== 'geaendert' || !e.aenderung?.vorher_datei) continue
    if (standVon(e, marken.get(schluessel)).stand === 'abgelehnt') alteBilder.set(schluessel.slice(5), e.aenderung.vorher_datei)
  }
  return items.map((item) => {
    const eintrag = eintraege[item.id]
    const stand = standVon(eintrag, marken.get(item.id))
    let neu = { ...item, durchsicht: stand }
    if (stand.stand === 'abgelehnt' && eintrag.aenderung?.vorher) {
      for (const [feld, wert] of Object.entries(eintrag.aenderung.vorher)) {
        if (wert === null) delete neu[feld]
        else neu[feld] = wert
      }
    }
    return bildpfadeAlt(neu, alteBilder)
  })
}

// Zaehler fuer Filter und Hinweise. ziele = alle Schluessel (Items und
// Erklaerstuecke/Bilder), die es im Paket gibt.
export function durchsichtZaehlen(eintraege, marken, schluessel) {
  const z = { offen: 0, geprueft: 0, wartet: 0, abgelehnt: 0 }
  for (const k of schluessel) z[standVon(eintraege?.[k], marken.get(k)).stand] += 1
  return z
}

// Erklaerstuecke und Bilder, deren Aenderung auf dich wartet (oder die du
// schon entschieden hast, solange das Skript sie noch nicht uebernommen hat).
export function wartendeNebenziele(eintraege, marken) {
  return Object.entries(eintraege ?? {})
    .filter(([k, e]) => (k.startsWith('erklaerung:') || k.startsWith('bild:')) && e.stand === 'geaendert')
    .map(([k, e]) => ({ schluessel: k, eintrag: e, ...standVon(e, marken.get(k)) }))
}

// --- Vorher/Nachher ------------------------------------------------------

export function wertText(wert) {
  if (wert === null || wert === undefined) return ''
  if (typeof wert === 'string') return wert
  if (typeof wert === 'boolean') return wert ? 'ja' : 'nein'
  if (typeof wert === 'number') return String(wert)
  if (Array.isArray(wert)) return wert.map((w) => (typeof w === 'object' && w !== null ? wertText(w) : `• ${wertText(w)}`)).join('\n')
  return Object.entries(wert).map(([k, v]) => `${FELDNAMEN[k] ?? k}: ${wertText(v)}`).join('\n')
}

// Felder, die sich geaendert haben: [{feld, name, vorher, nachher}].
// Bei Erklaerstuecken wird eine Ebene tiefer verglichen (Absaetze,
// Merksatz ...), damit nicht das ganze Stueck als ein Block erscheint.
export function aenderungsFelder(vorher, aktuell) {
  const felder = []
  for (const [feld, alt] of Object.entries(vorher ?? {})) {
    const neu = aktuell?.[feld] ?? null
    if (feld === 'erklaerung' && alt && neu && typeof alt === 'object' && typeof neu === 'object') {
      for (const k of new Set([...Object.keys(alt), ...Object.keys(neu)])) {
        if (JSON.stringify(alt[k] ?? null) !== JSON.stringify(neu[k] ?? null)) {
          felder.push({ feld: k, name: FELDNAMEN[k] ?? k, vorher: wertText(alt[k]), nachher: wertText(neu[k]) })
        }
      }
      continue
    }
    if (JSON.stringify(alt ?? null) === JSON.stringify(neu)) continue
    felder.push({ feld, name: FELDNAMEN[feld] ?? feld, vorher: wertText(alt), nachher: wertText(neu) })
  }
  return felder
}

// Wortweiser Vergleich (laengste gemeinsame Teilfolge). Liefert
// [{art: 'gleich' | 'weg' | 'neu', text}]. Bei sehr langen Texten (mehr als
// 1500 Woerter je Seite) nur grob: alles weg, alles neu.
export function wortDiff(alt, neu) {
  const a = (alt ?? '').split(/(\s+)/).filter((t) => t !== '')
  const b = (neu ?? '').split(/(\s+)/).filter((t) => t !== '')
  if (a.length > 3000 || b.length > 3000) {
    return [...(alt ? [{ art: 'weg', text: alt }] : []), ...(neu ? [{ art: 'neu', text: neu }] : [])]
  }
  const n = a.length
  const m = b.length
  const tab = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tab[i][j] = a[i] === b[j] ? tab[i + 1][j + 1] + 1 : Math.max(tab[i + 1][j], tab[i][j + 1])
    }
  }
  const teile = []
  const dazu = (art, text) => {
    const letzt = teile[teile.length - 1]
    if (letzt && letzt.art === art) letzt.text += text
    else teile.push({ art, text })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      dazu('gleich', a[i])
      i++
      j++
    } else if (tab[i + 1][j] >= tab[i][j + 1]) {
      dazu('weg', a[i++])
    } else {
      dazu('neu', b[j++])
    }
  }
  while (i < n) dazu('weg', a[i++])
  while (j < m) dazu('neu', b[j++])
  return teile
}

export function datumKurz(iso) {
  if (!iso) return ''
  const [j, m, t] = iso.split('-')
  return `${Number(t)}.${Number(m)}.${j}`
}
