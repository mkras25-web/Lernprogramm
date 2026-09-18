// Bauwerke, Bauabschnitte und Levelkurve.
//
// Der Fortschritt wird als Bauablauf erzaehlt. Ein Bauwerk umfasst
// fuenfzig Stufen: zehn Abschnitte zu je fuenf. Ist es fertig, beginnt
// das naechste, groessere Bauwerk wieder bei der Baugrube - erkennbar
// an Silhouette, Untergrund, Rahmen und der Werkmarke in der Ecke.
//
// Weitere Bauwerke lassen sich anhaengen, ohne die Logik anzufassen:
// eine Zeile in WERKE, eine Teileliste in Bauabschnitt.jsx. Geplant
// sind Museum, Hochhaus und Turm - das traegt bis weit ueber Stufe 200.

export const STUFEN_JE_ABSCHNITT = 5
export const ABSCHNITTE_JE_WERK = 10
export const STUFEN_JE_WERK = STUFEN_JE_ABSCHNITT * ABSCHNITTE_JE_WERK // 50

// --------------------------------------------------------------- Kurve
//
// Der Bedarf waechst unterlinear: fruehe Stufen fallen in Minuten,
// mittlere in Tagen. Ab dem Deckel bleibt er gleich - sonst waeren
// dreistellige Stufen nur rechnerisch erreichbar.
export const LEVELKURVE = {
  grundwert: 40,
  exponent: 0.9,
  deckel: 130,
}

export function bedarfFuerStufe(stufe) {
  const n = Math.min(Math.max(stufe, 1), LEVELKURVE.deckel)
  return Math.round(LEVELKURVE.grundwert * Math.pow(n, LEVELKURVE.exponent))
}

export function xpBisStufe(stufe) {
  let summe = 0
  for (let n = 1; n < stufe; n++) summe += bedarfFuerStufe(n)
  return summe
}

export function levelAus(xp) {
  let stufe = 1
  let rest = xp
  while (rest >= bedarfFuerStufe(stufe)) {
    rest -= bedarfFuerStufe(stufe)
    stufe += 1
    if (stufe > 5000) break
  }
  const bedarf = bedarfFuerStufe(stufe)
  return { stufe, imLevel: rest, fuerLevel: bedarf, anteil: rest / bedarf, xp }
}

// ---------------------------------------------------------- Abschnitte
export const ABSCHNITTE = [
  { nr: 1,  name: 'Baugrube',      satz: 'Das Gelände ist abgesteckt, der Aushub beginnt.' },
  { nr: 2,  name: 'Gründung',      satz: 'Sauberkeitsschicht, Fundamente, Bodenplatte.' },
  { nr: 3,  name: 'Rohbau',        satz: 'Die Wände des Erdgeschosses wachsen.' },
  { nr: 4,  name: 'Geschosse',     satz: 'Decke und Obergeschoss stehen.' },
  { nr: 5,  name: 'Dachstuhl',     satz: 'Sparren, Pfetten, First — Richtfest.' },
  { nr: 6,  name: 'Gebäudehülle',  satz: 'Dachdeckung, Traufe, Kamin: dicht.' },
  { nr: 7,  name: 'Ausbau',        satz: 'Fenster, Türen, Innenwände.' },
  { nr: 8,  name: 'Fassade',       satz: 'Putz, Gesimse, Fensterbänke.' },
  { nr: 9,  name: 'Abnahme',       satz: 'Außenanlagen fertig, Bauwerk übergeben.' },
  { nr: 10, name: 'Bestand',       satz: 'Es steht. Jetzt wächst nur noch der Garten.' },
]

// Je Bauwerk eine eigene Reihe aus Rahmen, Untergrund und Akzent. So
// unterscheidet sich Stufe 51 auf den ersten Blick von Stufe 1, obwohl
// beide "Baugrube" heissen.
export const WERKE = [
  {
    nr: 1,
    name: 'Wohnhaus',
    marke: 'I',
    reihe: [
      { rahmen: 'ohne',     grund: 'papier' },
      { rahmen: 'linie',    grund: 'papier' },
      { rahmen: 'linie',    grund: 'pause' },
      { rahmen: 'doppel',   grund: 'pause' },
      { rahmen: 'doppel',   grund: 'karton' },
      { rahmen: 'winkel',   grund: 'karton' },
      { rahmen: 'winkel',   grund: 'blaupause' },
      { rahmen: 'plankopf', grund: 'blaupause' },
      { rahmen: 'stempel',  grund: 'leinen' },
      { rahmen: 'siegel',   grund: 'sepia' },
    ],
  },
  {
    nr: 2,
    name: 'Stadthaus',
    marke: 'II',
    reihe: [
      { rahmen: 'linie',    grund: 'karton' },
      { rahmen: 'doppel',   grund: 'karton' },
      { rahmen: 'doppel',   grund: 'leinen' },
      { rahmen: 'winkel',   grund: 'leinen' },
      { rahmen: 'winkel',   grund: 'sepia' },
      { rahmen: 'plankopf', grund: 'sepia' },
      { rahmen: 'plankopf', grund: 'nachtblau' },
      { rahmen: 'stempel',  grund: 'nachtblau' },
      { rahmen: 'stempel',  grund: 'pergament' },
      { rahmen: 'siegel',   grund: 'kupfer' },
    ],
  },
]

// Alles, was die Zeichnung braucht, aus einer Stufe abgeleitet.
export function bauwerkFuer(stufe) {
  const s = Math.max(1, Math.round(stufe))
  const werkIndex = Math.min(Math.floor((s - 1) / STUFEN_JE_WERK), WERKE.length - 1)
  const werk = WERKE[werkIndex]
  // Ueber das letzte gebaute Bauwerk hinaus laeuft die Zaehlung weiter,
  // die Zeichnung bleibt beim letzten Stand stehen.
  const imWerk = Math.min(s - werkIndex * STUFEN_JE_WERK, STUFEN_JE_WERK)
  const abschnittIndex = Math.min(
    Math.floor((imWerk - 1) / STUFEN_JE_ABSCHNITT),
    ABSCHNITTE_JE_WERK - 1
  )
  const imAbschnitt = imWerk - abschnittIndex * STUFEN_JE_ABSCHNITT

  return {
    stufe: s,
    werk,
    werkNr: werkIndex + 1,
    imWerk,
    abschnitt: ABSCHNITTE[abschnittIndex],
    imAbschnitt,
    ...werk.reihe[abschnittIndex],
  }
}

export function abschnittFuer(stufe) {
  return bauwerkFuer(stufe).abschnitt
}

export function naechsterAbschnitt(stufe) {
  const b = bauwerkFuer(stufe)
  const rest = STUFEN_JE_ABSCHNITT - b.imAbschnitt
  return { abschnitt: ABSCHNITTE[(b.abschnitt.nr % ABSCHNITTE_JE_WERK)], inStufen: rest + 1 }
}

// ------------------------------------------------------- Themen und Module
//
// Themen und Module bekommen dasselbe Bild, nur klein: der Anteil
// sicherer Items wird auf die fuenfzig Stufen des ersten Bauwerks
// abgebildet. Ein durchgearbeitetes Thema zeigt das fertige Haus.
export function stufeAusAnteil(anteil) {
  const a = Math.max(0, Math.min(1, anteil || 0))
  if (a === 0) return 0
  return Math.max(1, Math.round(a * STUFEN_JE_WERK))
}

export function reifegradFuer(anteil) {
  const stufe = stufeAusAnteil(anteil)
  if (stufe === 0) return { stufe: 0, name: 'unberührt', satz: 'Noch nichts angefangen.' }
  const b = bauwerkFuer(stufe)
  return { stufe, name: b.abschnitt.name, satz: b.abschnitt.satz }
}

// ---------------------------------------------------------- Serienquote
export function serienquote(ereignisse, fenster = 30) {
  if (!ereignisse?.length) return { quote: 0, tage: 0, vonTagen: 0, seit: null }

  const TAG = 24 * 60 * 60 * 1000
  const tage = new Set(ereignisse.map((e) => new Date(e.ts).toDateString()))
  const erster = new Date(Math.min(...ereignisse.map((e) => e.ts)))
  erster.setHours(0, 0, 0, 0)

  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const seitTagen = Math.floor((heute - erster) / TAG) + 1
  const spanne = Math.max(1, Math.min(seitTagen, fenster))

  let getroffen = 0
  const zeiger = new Date(heute)
  for (let i = 0; i < spanne; i++) {
    if (tage.has(zeiger.toDateString())) getroffen += 1
    zeiger.setTime(zeiger.getTime() - TAG)
  }

  return {
    quote: Math.round((getroffen / spanne) * 100),
    tage: getroffen,
    vonTagen: spanne,
    seit: erster,
  }
}
