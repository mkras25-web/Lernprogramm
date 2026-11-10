// Vorgaben (2026-11-10): Markierungen des Autors (Profil "Max") als
// Startwert fuer alle anderen. Die Datei public/pakete/<paket>/vorgaben.json
// entsteht in Einstellungen ("Meine Markierungen als Vorgabe exportieren")
// und wird mit der App veroeffentlicht.
//
// Enthalten: Sichtung "Ueberarbeiten" und "Streichen" sowie Entscheidungen
// zu Durchsicht-Aenderungen (angenommen/abgelehnt, nur fuer genau die
// geprueft Fassung = hash). "Relevant" und "Spaeter" sind persoenlich und
// werden nie vorgegeben.
//
// Die Vorgabe liegt als Ebene UNTER den eigenen Marken: sie wird nur beim
// Lesen eingeblendet (Feld _vorgabe markiert, was geerbt ist) und nie in die
// Datenbank geschrieben. Hat der Nutzer selbst entschieden - auch "ungesichtet"
// bzw. "offen" - gilt seine Entscheidung. Spaetere Aenderungen der Vorgabe
// kommen so bei allen an, die nicht selbst entschieden haben.

export const VORGABE_KATEGORIEN = ['ueberarbeiten', 'streichen']

export function vorgabenErzeugen(marken, paketId) {
  const kategorien = {}
  const durchsicht = {}
  for (const [id, m] of marken) {
    if (VORGABE_KATEGORIEN.includes(m.kategorie)) kategorien[id] = m.kategorie
    const d = m.durchsicht
    if (d && (d.entscheidung === 'angenommen' || d.entscheidung === 'abgelehnt') && d.hash) {
      durchsicht[id] = { entscheidung: d.entscheidung, hash: d.hash }
    }
  }
  return { version: 1, paket: paketId, erstellt: new Date().toISOString().slice(0, 10), kategorien, durchsicht }
}

export function vorgabenPruefen(daten) {
  if (!daten || typeof daten !== 'object') return null
  const nurObjekt = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {})
  const kategorien = {}
  for (const [id, k] of Object.entries(nurObjekt(daten.kategorien))) {
    if (VORGABE_KATEGORIEN.includes(k)) kategorien[id] = k
  }
  const durchsicht = {}
  for (const [id, d] of Object.entries(nurObjekt(daten.durchsicht))) {
    if (d && (d.entscheidung === 'angenommen' || d.entscheidung === 'abgelehnt') && typeof d.hash === 'string') {
      durchsicht[id] = { entscheidung: d.entscheidung, hash: d.hash }
    }
  }
  return { kategorien, durchsicht }
}

export function vorgabenAnwenden(marken, vorgaben) {
  if (!vorgaben) return marken
  const neu = new Map(marken)
  for (const [id, kategorie] of Object.entries(vorgaben.kategorien ?? {})) {
    const m = neu.get(id)
    if (m && m.kategorie !== undefined) continue
    neu.set(id, { itemId: id, ...m, kategorie, _vorgabe: { ...m?._vorgabe, kategorie: true } })
  }
  for (const [id, d] of Object.entries(vorgaben.durchsicht ?? {})) {
    const m = neu.get(id)
    if (m?.durchsicht) continue
    neu.set(id, { itemId: id, ...m, durchsicht: { ...d, ts: 0 }, _vorgabe: { ...m?._vorgabe, durchsicht: true } })
  }
  return neu
}

// Marke ohne die geerbten Felder - nur das darf in die Datenbank.
export function ohneVorgabe(marke) {
  if (!marke?._vorgabe) return marke
  const { _vorgabe, ...rest } = marke
  for (const feld of Object.keys(_vorgabe)) delete rest[feld]
  return rest
}

// "Entfernen" (null) muss bei vorgegebenen Feldern als eigene Entscheidung
// gespeichert werden, sonst kaeme die Vorgabe beim naechsten Laden zurueck.
export function entfernenAlsEntscheidung(aenderung, itemId, vorgaben) {
  if (!vorgaben) return aenderung
  let neu = aenderung
  if (aenderung.kategorie === null && vorgaben.kategorien?.[itemId]) {
    neu = { ...neu, kategorie: 'ungesichtet' }
  }
  if (aenderung.durchsicht === null && vorgaben.durchsicht?.[itemId]) {
    neu = { ...neu, durchsicht: { entscheidung: 'offen', hash: vorgaben.durchsicht[itemId].hash, ts: Date.now() } }
  }
  return neu
}
