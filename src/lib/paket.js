// Inhaltspakete werden zur Laufzeit geladen, nicht mitkompiliert.
// Gliederung: Paket -> Modul -> Thema -> Items.
//
// Ein Thema ohne "datei" gilt als geplant: Es erscheint in der Liste,
// wird aber nicht geladen. So steht die ganze Landkarte im Paket,
// ohne dass leere Dateien angelegt werden muessen.

// Verzeichnis aller installierten Pakete. Fehlt es, wird das
// Architekturpaket angenommen - so laeuft eine alte Ablage weiter.
export async function paketeLaden() {
  const wurzel = `${import.meta.env.BASE_URL}pakete`
  try {
    const antwort = await fetch(`${wurzel}/pakete.json`)
    if (!antwort.ok) throw new Error('kein Verzeichnis')
    const daten = await antwort.json()
    return daten.pakete ?? []
  } catch {
    return [{ id: 'arch-de', titel: 'Architektur (Deutschland)' }]
  }
}

export async function paketLaden(paketId) {
  const wurzel = `${import.meta.env.BASE_URL}pakete/${paketId}`

  const antwort = await fetch(`${wurzel}/paket.json`)
  if (!antwort.ok) {
    throw new Error(`Paket "${paketId}" nicht gefunden unter ${wurzel}/paket.json`)
  }
  const paket = await antwort.json()

  // Alle Themendateien und das Glossar GLEICHZEITIG anfordern - frueher
  // wurden sie in der Schleife nacheinander geladen (gemessen 2026-10-10:
  // 2,4 s bis Heute bei 150 ms Latenz, jetzt etwa zwei Latenzen). Die
  // Auswertung unten bleibt in Paketreihenfolge.
  const jsonOderNull = (url) =>
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  const vorab = new Map()
  for (const modul of paket.module ?? []) {
    for (const thema of modul.themen ?? []) {
      if (thema.datei && !vorab.has(thema.datei)) vorab.set(thema.datei, jsonOderNull(`${wurzel}/${thema.datei}`))
    }
  }

  // Normenglossar ist optional - fehlt es, bleibt die Funktion still.
  const normDaten = await jsonOderNull(`${wurzel}/normen.json`)
  const normen = normDaten?.eintraege ?? {}

  const items = []
  const themen = []
  const module = []

  for (const modul of paket.module ?? []) {
    module.push({
      id: modul.id,
      titel: modul.titel,
      bereich: modul.bereich,
      phase: modul.phase,
    })

    for (const thema of modul.themen ?? []) {
      const bild = thema.bild ? `${wurzel}/${thema.bild}` : undefined
      const grund = {
        id: thema.id,
        titel: thema.titel,
        modulId: modul.id,
        modulTitel: modul.titel,
        bereich: modul.bereich,
        bild,
      }

      if (!thema.datei) {
        themen.push({ ...grund, geplant: true, erklaerung: null, anzahl: 0 })
        continue
      }

      const daten = await vorab.get(thema.datei)
      if (!daten) {
        console.warn(`Thema "${thema.id}" fehlt: ${thema.datei}`)
        themen.push({ ...grund, geplant: true, erklaerung: null, anzahl: 0 })
        continue
      }

      themen.push({
        ...grund,
        geplant: false,
        erklaerung: daten.erklaerung
          ? {
              ...daten.erklaerung,
              bild: daten.erklaerung.bild ? `${wurzel}/${daten.erklaerung.bild}` : bild,
            }
          : null,
        anzahl: (daten.items ?? []).length,
        // Optional aus der Themendatei (2026-10-10): Lernziele ("Du kannst
        // ...") und Querverweise auf andere Themen-IDs.
        lernziele: Array.isArray(daten.lernziele) ? daten.lernziele : null,
        siehe: Array.isArray(daten.siehe) ? daten.siehe : null,
      })

      for (const item of daten.items ?? []) {
        items.push({
          ...item,
          referenz: item.referenz ? `${wurzel}/${item.referenz}` : undefined,
          // Erklaerende Abbildung zur Antwort (mit bildunterschrift) -
          // wird nach dem Aufdecken bzw. in der Itemansicht gezeigt.
          bild: item.bild ? `${wurzel}/${item.bild}` : undefined,
          // Ausgangsbild einer Fallaufgabe (Typ "fall")
          fallbild: item.fallbild ? `${wurzel}/${item.fallbild}` : undefined,
          // Die Bilder einer Gegenuebestellung liegen im Paketordner wie
          // jede Referenz - ohne diese Zeilen bliebe der Pfad relativ zur
          // aufgerufenen Seite und das Bild liefe ins Leere.
          seiten: item.seiten?.map((seite) => ({
            ...seite,
            bild: seite.bild ? `${wurzel}/${seite.bild}` : undefined,
          })),
          paketId: paket.id,
          modulId: modul.id,
          modulTitel: modul.titel,
          themaId: thema.id,
          themaTitel: thema.titel,
          bereich: modul.bereich,
        })
      }
    }
  }

  return {
    paket,
    items,
    themen,
    module,
    normen,
    bereiche: paket.bereiche ?? {},
    phasen: paket.phasen ?? {},
  }
}
