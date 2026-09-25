// Bauwerke, Bauabschnitte und Levelkurve.
//
// Der Fortschritt wird als Bauablauf erzaehlt (Architektur) bzw. als
// Ansatz im Kolben (Pharmazie) - welche Erzaehlung, entscheidet die
// "Gestaltung" des aktiven Pakets (siehe STILE weiter unten). Ein
// Bauwerk/Werk umfasst fuenfzig Stufen: zehn Abschnitte zu je fuenf.
// Ist es fertig, beginnt das naechste, groessere Werk wieder von vorn -
// erkennbar an Silhouette, Untergrund, Rahmen und der Werkmarke in der
// Ecke.
//
// Weitere Werke lassen sich anhaengen, ohne die Logik anzufassen: eine
// Zeile in WERKE_ARCH, eine Teileliste in Bauabschnitt.jsx. Geplant sind
// Museum, Hochhaus und Turm - das traegt bis weit ueber Stufe 200.

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
//
// Die Erzaehlung (Abschnitts- und Bauwerknamen, Saetze) haengt an der
// "Gestaltung" des aktiven Inhaltspakets (paket.json-Feld "gestaltung",
// z. B. "arch" oder "pharma") - nicht an fest verdrahtetem Text. Neue
// Pakete mit eigener Fachrichtung bekommen so ihre eigene Zeichnung und
// Sprache, ohne dass hier oder in Bauabschnitt.jsx Architektur-Vokabular
// haengen bleibt. Fehlt/unbekannt die Gestaltung, gilt "arch" (bisheriges
// Verhalten, siehe auch STILE weiter unten).
export const ABSCHNITTE_ARCH = [
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
// beide "Baugrube" heissen. Rahmen- und Grund-Namen sind bewusst
// allgemeine Zeichentechnik-Konventionen (Skizze, Blaupause, Siegel...),
// keine Architektur-Fachbegriffe - andere Gestaltungen koennen dieselbe
// Reihe mitbenutzen, siehe WERKE_PHARMA.
export const WERKE_ARCH = [
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

// Pharmazie: ein Ansatz im Kolben statt eines Gebaeudes - bewusst nur
// ein "Werk" (siehe Bauabschnitt.jsx, dort als berechnete Fuellung
// statt als 50 einzelne Zeichenteile umgesetzt, also deutlich einfacher
// als die Architektur-Bauwerke). Reihe bewusst von WERKE_ARCH[0]
// uebernommen statt verdoppelt - Rahmen/Grund sind fachneutral.
export const ABSCHNITTE_PHARMA = [
  { nr: 1,  name: 'Ansatz',       satz: 'Der erste Tropfen fällt ins Glas.' },
  { nr: 2,  name: 'Lösung',       satz: 'Der Ansatz beginnt sich zu klären.' },
  { nr: 3,  name: 'Erwärmung',    satz: 'Erste Bläschen steigen auf.' },
  { nr: 4,  name: 'Reaktion',     satz: 'Die Färbung setzt ein.' },
  { nr: 5,  name: 'Sieden',       satz: 'Es blubbert gleichmäßig.' },
  { nr: 6,  name: 'Abkühlung',    satz: 'Der Kolben beruhigt sich.' },
  { nr: 7,  name: 'Filtration',   satz: 'Die Lösung wird klar.' },
  { nr: 8,  name: 'Abfüllung',    satz: 'Etikett und Verschluss kommen dazu.' },
  { nr: 9,  name: 'Prüfung',      satz: 'Kontrolle vor der Freigabe.' },
  { nr: 10, name: 'Charge fertig', satz: 'Bereit für die nächste Charge.' },
]

export const WERKE_PHARMA = [
  { nr: 1, name: 'Apotheke', marke: 'I', reihe: WERKE_ARCH[0].reihe },
]

// Registrierung je Gestaltung. Neue Fachrichtung: eine ABSCHNITTE_*- und
// WERKE_*-Liste hier eintragen, dazu eine Teilezeichnung in
// Bauabschnitt.jsx - der Rest (Levelkurve, Fortschrittsrechnung) bleibt
// unveraendert, weil er nur mit Zahlen rechnet.
const STILE = {
  arch: { abschnitte: ABSCHNITTE_ARCH, werke: WERKE_ARCH },
  pharma: { abschnitte: ABSCHNITTE_PHARMA, werke: WERKE_PHARMA },
}

function stilFuer(gestaltung) {
  return STILE[gestaltung] ?? STILE.arch
}

// Alles, was die Zeichnung braucht, aus einer Stufe abgeleitet.
export function bauwerkFuer(stufe, gestaltung = 'arch') {
  const { abschnitte, werke } = stilFuer(gestaltung)
  const s = Math.max(1, Math.round(stufe))
  const werkIndex = Math.min(Math.floor((s - 1) / STUFEN_JE_WERK), werke.length - 1)
  const werk = werke[werkIndex]
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
    abschnitt: abschnitte[abschnittIndex],
    imAbschnitt,
    ...werk.reihe[abschnittIndex],
  }
}

export function abschnittFuer(stufe, gestaltung = 'arch') {
  return bauwerkFuer(stufe, gestaltung).abschnitt
}

export function naechsterAbschnitt(stufe, gestaltung = 'arch') {
  const { abschnitte } = stilFuer(gestaltung)
  const b = bauwerkFuer(stufe, gestaltung)
  const rest = STUFEN_JE_ABSCHNITT - b.imAbschnitt
  return { abschnitt: abschnitte[(b.abschnitt.nr % ABSCHNITTE_JE_WERK)], inStufen: rest + 1 }
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

export function reifegradFuer(anteil, gestaltung = 'arch') {
  const stufe = stufeAusAnteil(anteil)
  if (stufe === 0) return { stufe: 0, name: 'unberührt', satz: 'Noch nichts angefangen.' }
  const b = bauwerkFuer(stufe, gestaltung)
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
