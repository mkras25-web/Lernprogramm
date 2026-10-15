import { useMemo } from 'react'
import { pensumBauen, statistik, zustaendeBerechnen } from '../lib/planer.js'
import {
  baustellen,
  beherrschungsgrad,
  kartenAuswerten,
  levelAus,
  meilensteineAuswerten,
  meilensteinWerte,
  moduleAuswerten,
  serieBerechnen,
  xpFuerPruefung,
  xpFuerMeilensteine,
  xpGesamt,
  rekorde,
} from '../lib/fortschritt.js'
import { itemsAnreichern, lernbareItems } from '../lib/sichtung.js'
import { monatspruefungFaellig, pruefungsplan } from '../lib/pruefung.js'
import { serienquote } from '../lib/stufen.js'
import { meldungenSammeln } from '../lib/meldungen.js'

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

// Alle aus Paket, Ereignissen und Einstellungen abgeleiteten Werte - aus
// App.jsx herausgeloest (52B, 2026-10-10), Rechnungen unveraendert. Nur
// useMemo, keine Effekte (die Feier-/Meldungs-Effekte bleiben in App).
export function useKennzahlen({
  rohItems, marken, ereignisse, pruefungen, skizzen, themen, paketModule, opt, gestaltung,
  speicherGeschuetzt = null, dropboxVerbunden = false,
}) {
  // Bearbeitete Fassungen ueberlagern das Paket.
  const items = useMemo(() => itemsAnreichern(rohItems, marken), [rohItems, marken])

  // Alles, was gelernt und gezaehlt wird - gesichtete Ausschluesse raus.
  const aktiveItems = useMemo(() => lernbareItems(items, marken), [items, marken])

  const zustaende = useMemo(
    () => zustaendeBerechnen(ereignisse, { zielBehaltensrate: opt.zielBehaltensrate, gewichte: opt.fsrsGewichte?.w }),
    [ereignisse, opt.zielBehaltensrate, opt.fsrsGewichte]
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
    const neuere = meilensteinWerte(aktiveEreignisse, aktiveItems, zustaende, pruefungen)
    // Paketumfang fuer die gedeckelten Meilensteine. Typen nur aus dem,
    // was tatsaechlich gelernt werden kann (Zeichenfragen ggf. aus).
    const umfang = {
      items: aktiveItems.length,
      themen: new Set(aktiveItems.map((i) => i.themaId)).size,
      module: new Set(aktiveItems.map((i) => i.modulId)).size,
      typen: new Set(
        aktiveItems.filter((i) => !opt.zeichenAusblenden || i.typ !== 'skizze').map((i) => i.typ)
      ).size,
    }
    const sortiert = [...pruefungen].sort((a, b) => b.ts - a.ts)
    let serieBestanden = 0
    for (const p of sortiert) {
      if (p.bestanden) serieBestanden += 1
      else break
    }

    const auswerten = (lv) => meilensteineAuswerten({
      ...neuere,
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
      gemeisterteThemen,
      sicher: aktiveItems.filter((i) => (zustaende.get(i.id)?.intervall ?? 0) >= 7).length,
      gemeistert: aktiveItems.filter((i) => (zustaende.get(i.id)?.intervall ?? 0) >= 60).length,
      detailkarten: karten.filter((k) => k.frei).length,
      moduleBegonnen: module.filter((m) => m.begonnen > 0).length,
      gesichtet: [...marken.values()].filter((m) => m.kategorie).length,
      notizen: [...marken.values()].filter((m) => m.notiz).length,
      lesezeichen: [...marken.values()].filter((m) => m.lesezeichen).length,
      meldungen: [...marken.values()].filter((m) => m.meldung || m.einspruch).length,
      sicherungen: opt.letzteSicherung ? 1 : 0,
    }, gestaltung, umfang)

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
      karten, module, opt.letzteSicherung, opt.zeichenAusblenden, gestaltung])


  // Rueckkanal zum Web-Chat (19A/6A): alles, was ueberarbeitet werden sollte.
  const meldeliste = useMemo(
    () => meldungenSammeln({ items, marken, zustaende }),
    [items, marken, zustaende]
  )

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

  // Zeichenfragen ausblenden (Einstellung): weder im Lernstapel noch in
  // Pruefungen. Sie bleiben gezaehlt und im Nachschlagen sichtbar.
  const ohneZeichnen = useMemo(
    () => (opt.zeichenAusblenden ? aktiveItems.filter((i) => i.typ !== 'skizze') : aktiveItems),
    [aktiveItems, opt.zeichenAusblenden]
  )

  const erlaubteItems = useMemo(
    () => (opt.ungeprueftZulassen ? ohneZeichnen : ohneZeichnen.filter((i) => i.geprueft !== false)),
    [ohneZeichnen, opt.ungeprueftZulassen]
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

  const pruefungHinweis = useMemo(() => {
    if (monatspruefungFaellig(pruefungen) && ohneZeichnen.some((i) => i.geprueft !== false)) {
      return { art: 'monat', text: 'Monatsprüfung fällig' }
    }
    const plan = pruefungsplan(themen, ohneZeichnen, zustaende, pruefungen, 1)
    if (plan.length > 0) {
      return { art: 'thema', text: `Prüfung verfügbar: ${plan[0].thema.titel}` }
    }
    return null
  }, [pruefungen, themen, ohneZeichnen, zustaende])

  // Mit Dropbox ist der Abgleich die Sicherung. Ohne Dropbox und ohne
  // dauerhaften Speicher (T3) mahnt die App schon nach 7 Tagen und ab 10
  // Antworten - der Browser darf die Daten dann selbst loeschen.
  const sicherungFaellig = useMemo(() => {
    if (dropboxVerbunden) return false
    const ungeschuetzt = speicherGeschuetzt === false
    if (ereignisse.length < (ungeschuetzt ? 10 : 50)) return false
    if (!opt.letzteSicherung) return true
    const tage = ungeschuetzt ? 7 : 30
    return Date.now() - opt.letzteSicherung > tage * 24 * 60 * 60 * 1000
  }, [ereignisse.length, opt.letzteSicherung, speicherGeschuetzt, dropboxVerbunden])

  return {
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
    pruefItems: ohneZeichnen,
    tagesplan,
    baustellenStapel,
    skizzenStapel,
    neueItems,
    pruefungHinweis,
    sicherungFaellig,
  }
}
