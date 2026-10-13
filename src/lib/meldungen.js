// Rueckkanal zum Inhalte-Web-Chat (Entscheidungen 19A, 6A, 20A).
//
// Sammelt alles, was an einer Karte ueberarbeitet werden sollte, und baut
// daraus eine Markdown-Datei zum Einfuegen in den Themen-Chat: eigene
// Meldungen (Grund + Kommentar), Einspruch-Marken, Sichtung "Ueberarbeiten",
// eigene Bearbeitungen von Frage/Antwort und Problemkarten (>= 6 Fehler).
// Gruppiert nach Thema, je Karte mit Id, Typ, Quelle und Originaltext -
// der Chat findet damit die Stelle in der Itemdatei ohne Rueckfrage.

import { quelleText } from './quelle.js'

export const MELDEGRUENDE = [
  ['falsch', 'Inhaltlich falsch'],
  ['unklar', 'Unklar formuliert'],
  ['quelle', 'Quelle prüfen'],
  ['bild', 'Bild fehlt/falsch'],
  ['sonstiges', 'Sonstiges'],
]

export const PROBLEM_SCHWELLE = 6

// Melden (Nutzerwunsch 2026-10-12): eine gemeldete Karte gilt sofort als
// "Ueberarbeiten" - damit ist sie nicht mehr lernbar (sichtung.js) und
// kommt weder im Lernen noch in Pruefungen dran, bis der Web-Chat sie
// ueberarbeitet hat. Die vorherige Sichtung wird gemerkt und beim
// Zurueckziehen wiederhergestellt. Rueckgabe: Aenderung fuer markeAendern
// (null loescht ein Feld). meldung = { grund, text, ts } oder null (nur
// Einspruch "Stimmt so nicht").
export function meldenAenderung(marke, meldung = null) {
  const aenderung = { einspruch: true, kategorie: 'ueberarbeiten' }
  if (meldung) aenderung.meldung = meldung
  if (marke?.kategorie !== 'ueberarbeiten' && marke?.kategorieVorMeldung === undefined) {
    aenderung.kategorieVorMeldung = marke?.kategorie ?? 'keine'
  }
  return aenderung
}

export function zurueckziehenAenderung(marke) {
  const aenderung = { einspruch: null, meldung: null, kategorieVorMeldung: null }
  // Nur zuruecksetzen, wenn die Sichtung seit dem Melden nicht von Hand
  // geaendert wurde.
  if (marke?.kategorie === 'ueberarbeiten' && marke?.kategorieVorMeldung !== undefined) {
    aenderung.kategorie = marke.kategorieVorMeldung === 'keine' ? null : marke.kategorieVorMeldung
  }
  return aenderung
}

export function istGemeldet(marke) {
  return Boolean(marke?.meldung || marke?.einspruch)
}

// Meldungen von vor 2026-10-12 (oder von einem Geraet mit altem Stand)
// nachziehen: gemeldet, aber noch lernbar eingeordnet und nie von dieser
// Regel beruehrt (kein kategorieVorMeldung). Wer eine gemeldete Karte
// danach bewusst wieder auf "Relevant" setzt, behaelt das.
export function meldungenNachziehen(marken) {
  const aenderungen = []
  for (const [itemId, m] of marken) {
    if (!istGemeldet(m) || m.kategorieVorMeldung !== undefined) continue
    if (m.kategorie && m.kategorie !== 'relevant') continue
    aenderungen.push([itemId, meldenAenderung(m)])
  }
  return aenderungen
}

// --- Erledigte Meldungen (P10, 2026-10-13) -------------------------------
//
// Beim Melden merkt sich die Marke einen Fingerabdruck des Karteninhalts
// (meldung.inhalt). Aendert eine spaetere Lieferung die Karte, gilt die
// Meldung als erledigt: Meldung und Einspruch verschwinden, die Karte geht
// auf "ungesichtet" zurueck (Nutzerwunsch: erst nach erneuter Sichtung
// wieder einordnen) und die alte Meldung bleibt als "erledigt" vermerkt.

// Felder, die der Inhalte-Chat beim Ueberarbeiten aendert - nicht die
// Zuordnungen, die der Lader setzt.
const INHALT = ['frage', 'antwort', 'vertiefung', 'quelle', 'stand', 'geprueft', 'pruefhinweis',
  'optionen', 'richtig', 'warum', 'paare', 'schritte', 'wert', 'toleranz', 'einheit', 'pruefpunkte',
  'punkte', 'bereiche', 'fehlerNr', 'seiten', 'teile', 'referenz', 'bild']

export function inhaltsStempel(item) {
  const text = JSON.stringify(INHALT.map((f) => item?.[f] ?? null))
  let h = 2166136261 // FNV-1a, reicht zum Wiedererkennen
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

const monat = (ts) => new Date(ts).toISOString().slice(0, 7)

// Ist die gemeldete Karte seit der Meldung ueberarbeitet worden?
export function meldungErledigt(marke, item) {
  if (!item || !istGemeldet(marke)) return false
  const m = marke.meldung
  if (m?.inhalt) return m.inhalt !== inhaltsStempel(item)
  // Meldungen von vor dem Fingerabdruck: ein neuerer "stand" (JJJJ-MM) als
  // der Monat der Meldung zeigt eine Ueberarbeitung an.
  const ts = m?.ts ?? marke.ts
  return Boolean(ts && typeof item.stand === 'string' && item.stand > monat(ts))
}

export function erledigtAenderung(marke) {
  return {
    einspruch: null,
    meldung: null,
    kategorieVorMeldung: null,
    kategorie: null,
    erledigt: { ts: Date.now(), grund: marke?.meldung?.grund ?? 'einspruch', text: marke?.meldung?.text ?? '' },
  }
}

// [itemId, aenderung] fuer alle gemeldeten Karten, die inzwischen
// ueberarbeitet sind. items = rohe Paket-Items (ohne eigene Fassung).
export function erledigteMeldungen(marken, items) {
  const nachId = new Map(items.map((i) => [i.id, i]))
  const ergebnis = []
  for (const [itemId, m] of marken) {
    if (meldungErledigt(m, nachId.get(itemId))) ergebnis.push([itemId, erledigtAenderung(m)])
  }
  return ergebnis
}

// --- Freigaben (P8, 2026-10-13) ------------------------------------------
// Der Nutzer markiert eine ungepruefte Karte als selbst geprueft (mit
// Notiz, gegen welche Fassung). Das ist ein Pruefauftrag fuer den Pruef-Chat,
// keine Freigabe im Inhalt - geprueft wird dort mit Fundstelle gesetzt.
export function freigabenSammeln({ items, marken }) {
  return items
    .filter((i) => i.geprueft === false && marken.get(i.id)?.freigabe)
    .map((item) => ({ item, freigabe: marken.get(item.id).freigabe }))
}

const grundName = (id) => MELDEGRUENDE.find(([g]) => g === id)?.[1] ?? id

// Liefert je Item die Gruende, warum es in die Liste gehoert.
export function meldungenSammeln({ items, marken, zustaende }) {
  const ergebnis = []
  for (const item of items) {
    const m = marken.get(item.id) ?? {}
    const gruende = []
    if (m.meldung) gruende.push({ art: 'meldung', text: `${grundName(m.meldung.grund)}${m.meldung.text ? ` – ${m.meldung.text}` : ''}` })
    else if (m.einspruch) gruende.push({ art: 'einspruch', text: 'Einspruch („Stimmt so nicht“), ohne Begründung' })
    if (m.kategorie === 'ueberarbeiten') gruende.push({ art: 'ueberarbeiten', text: 'In der Sichtung als „Überarbeiten“ markiert' })
    if (m.frage || m.antwort) gruende.push({ art: 'bearbeitet', text: 'Eigene Fassung von Frage/Antwort (siehe unten)' })
    const fehler = zustaende?.get(item.id)?.fehler ?? 0
    if (fehler >= PROBLEM_SCHWELLE) gruende.push({ art: 'problem', text: `Problemkarte: ${fehler}× falsch beantwortet` })
    if (m.notiz && gruende.length > 0) gruende.push({ art: 'notiz', text: `Eigene Notiz: ${m.notiz}` })
    if (gruende.length) ergebnis.push({ item, marke: m, gruende })
  }
  return ergebnis
}

export function meldungenMarkdown({ eintraege, freigaben = [], paket, datum = new Date() }) {
  const tag = datum.toLocaleDateString('de-DE')
  const zeilen = [
    `# Meldungen aus der Lern-App – ${tag}`,
    '',
    `Paket: ${paket?.titel ?? paket?.id ?? '?'}${paket?.version ? ` (Version ${paket.version})` : ''} · ${eintraege.length} Karten` +
      (freigaben.length ? ` · ${freigaben.length} Freigaben` : ''),
    '',
    'Bitte die genannten Karten in den jeweiligen Itemdateien prüfen und',
    'überarbeiten. Quellenpflicht gilt wie immer (Buch + gedruckte Seite).',
    '',
  ]
  const jeThema = new Map()
  for (const e of eintraege) {
    const k = e.item.themaId
    if (!jeThema.has(k)) jeThema.set(k, { titel: `${e.item.modulTitel} · ${e.item.themaTitel}`, liste: [] })
    jeThema.get(k).liste.push(e)
  }
  for (const [themaId, gruppe] of jeThema) {
    zeilen.push(`## ${gruppe.titel} (\`${themaId}\`)`, '')
    for (const { item, marke, gruende } of gruppe.liste) {
      zeilen.push(`### \`${item.id}\` · ${item.typ}`, '')
      for (const g of gruende) zeilen.push(`- ${g.text}`)
      zeilen.push('', `**Frage:** ${item.frage}`, '', `**Antwort:** ${item.antwort ?? '–'}`)
      if (item.quelle) zeilen.push('', `**Quelle:** ${quelleText(item.quelle)}`)
      if (marke.frage || marke.antwort) {
        zeilen.push('', '**Eigene Fassung:**')
        if (marke.frage) zeilen.push(`- Frage: ${marke.frage}`)
        if (marke.antwort) zeilen.push(`- Antwort: ${marke.antwort}`)
      }
      zeilen.push('')
    }
  }
  if (freigaben.length) {
    zeilen.push(
      '## Freigaben',
      '',
      'Karten mit `geprueft: false`, die der Nutzer selbst als geprüft markiert hat.',
      'Prüfauftrag für den Prüf-Chat (ANLEITUNG-THEMA-CHAT.md 7.2), keine Freigabe:',
      '`geprueft` erst mit belegter Fundstelle auf `true` setzen.',
      ''
    )
    for (const { item, freigabe } of freigaben) {
      zeilen.push(`### \`${item.id}\` · ${item.themaTitel}`, '')
      zeilen.push(`- Nutzer: ${freigabe.text || '(ohne Notiz)'} (${new Date(freigabe.ts).toLocaleDateString('de-DE')})`)
      if (item.pruefhinweis) zeilen.push(`- Prüfhinweis: ${item.pruefhinweis}`)
      zeilen.push('', `**Frage:** ${item.frage}`, '', `**Antwort:** ${item.antwort ?? '–'}`)
      if (item.quelle) zeilen.push('', `**Quelle:** ${quelleText(item.quelle)}`)
      zeilen.push('')
    }
  }
  return zeilen.join('\n')
}

// Wunschliste fuer den Web-Chat (20A): Themen ohne Inhalt, nach Phase und
// Modul geordnet (frueh vor mittel vor spaet).
export function wunschlisteMarkdown({ module, themen, phasen, datum = new Date() }) {
  const reihenfolge = ['frueh', 'mittel', 'spaet']
  const leer = themen.filter((t) => t.geplant)
  const zeilen = [
    `# Themen ohne Inhalt – ${datum.toLocaleDateString('de-DE')}`,
    '',
    `${leer.length} von ${themen.length} Themen haben noch keine Aufgaben.`,
    '',
  ]
  const modulNach = new Map(module.map((m) => [m.id, m]))
  const phaseVon = (t) => modulNach.get(t.modulId)?.phase ?? 'ohne'
  const gruppen = [...reihenfolge, 'ohne']
  for (const phase of gruppen) {
    const liste = leer.filter((t) => phaseVon(t) === phase)
    if (!liste.length) continue
    zeilen.push(`## ${phasen?.[phase]?.titel ?? phasen?.[phase] ?? (phase === 'ohne' ? 'Ohne Phase' : phase)}`, '')
    let modulVorher = null
    for (const t of liste) {
      if (t.modulId !== modulVorher) {
        zeilen.push(`**${t.modulTitel}**`)
        modulVorher = t.modulId
      }
      zeilen.push(`- ${t.titel} (\`${t.id}\`)`)
    }
    zeilen.push('')
  }
  return zeilen.join('\n')
}

export function textHerunterladen(text, dateiname, typ = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: typ }))
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  a.click()
  URL.revokeObjectURL(url)
}
