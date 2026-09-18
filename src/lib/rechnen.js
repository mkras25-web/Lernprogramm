// Kleiner, sicherer Formelrechner für Aufgaben mit wechselnden Zahlen.
// Bewusst kein eval: erlaubt sind nur Zahlen, Variablennamen, die vier
// Grundrechenarten, Klammern und wenige Funktionen.

const FUNKTIONEN = {
  wurzel: Math.sqrt,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
}

function zerlegen(text) {
  const teile = []
  const muster = /\s*([0-9]*\.?[0-9]+|[a-zA-Zä-ü_][a-zA-Z0-9ä-ü_]*|[()+\-*/,^])/g
  let fund
  let gelesen = 0
  while ((fund = muster.exec(text)) !== null) {
    if (fund.index !== gelesen) throw new Error('Unerlaubtes Zeichen in der Formel')
    teile.push(fund[1])
    gelesen = muster.lastIndex
  }
  if (gelesen !== text.length) throw new Error('Formel nicht vollständig lesbar')
  return teile
}

// Rekursiver Abstieg: Summe -> Produkt -> Potenz -> Wert
export function rechnen(formel, werte = {}) {
  const teile = zerlegen(formel)
  let i = 0

  const schauen = () => teile[i]
  const nehmen = () => teile[i++]

  function summe() {
    let ergebnis = produkt()
    while (schauen() === '+' || schauen() === '-') {
      const zeichen = nehmen()
      const rechts = produkt()
      ergebnis = zeichen === '+' ? ergebnis + rechts : ergebnis - rechts
    }
    return ergebnis
  }

  function produkt() {
    let ergebnis = potenz()
    while (schauen() === '*' || schauen() === '/') {
      const zeichen = nehmen()
      const rechts = potenz()
      ergebnis = zeichen === '*' ? ergebnis * rechts : ergebnis / rechts
    }
    return ergebnis
  }

  function potenz() {
    const basis = wert()
    if (schauen() === '^') {
      nehmen()
      return Math.pow(basis, potenz())
    }
    return basis
  }

  function wert() {
    const teil = nehmen()
    if (teil === undefined) throw new Error('Formel endet unerwartet')
    if (teil === '-') return -wert()
    if (teil === '(') {
      const inhalt = summe()
      if (nehmen() !== ')') throw new Error('Klammer nicht geschlossen')
      return inhalt
    }
    if (/^[0-9.]/.test(teil)) return parseFloat(teil)

    if (schauen() === '(') {
      nehmen()
      const argumente = [summe()]
      while (schauen() === ',') {
        nehmen()
        argumente.push(summe())
      }
      if (nehmen() !== ')') throw new Error('Klammer nicht geschlossen')
      const fn = FUNKTIONEN[teil]
      if (!fn) throw new Error(`Unbekannte Funktion: ${teil}`)
      return fn(...argumente)
    }

    if (teil in werte) return werte[teil]
    throw new Error(`Unbekannte Größe: ${teil}`)
  }

  const ergebnis = summe()
  if (i !== teile.length) throw new Error('Formel nicht vollständig verarbeitet')
  return ergebnis
}

// Erzeugt zu einem Item einen konkreten Satz Zahlen. Der Seed sorgt
// dafür, dass dieselbe Frage innerhalb einer Sitzung stabil bleibt.
export function werteZiehen(variablen, seed) {
  let zufall = Math.abs(seed) || 1
  const naechste = () => {
    zufall = (zufall * 1103515245 + 12345) & 0x7fffffff
    return zufall / 0x7fffffff
  }

  const werte = {}
  for (const v of variablen) {
    if (Array.isArray(v.auswahl)) {
      werte[v.name] = v.auswahl[Math.floor(naechste() * v.auswahl.length)]
      continue
    }
    const schritt = v.schritt ?? 0.01
    const stufen = Math.round((v.bis - v.von) / schritt)
    const stufe = Math.floor(naechste() * (stufen + 1))
    werte[v.name] = Math.round((v.von + stufe * schritt) / schritt) * schritt
  }
  return werte
}

// Setzt {name} im Text durch den gezogenen Wert samt Einheit.
export function textFuellen(text, werte, variablen) {
  if (!text) return text
  return text.replace(/\{([a-zA-Zä-ü_][a-zA-Z0-9ä-ü_]*)\}/g, (treffer, name) => {
    if (!(name in werte)) return treffer
    const v = variablen.find((x) => x.name === name)
    const zahl = Number(werte[name].toFixed(v?.stellen ?? 3))
    // Deutsche Schreibweise: Dezimalkomma und echtes Minuszeichen
    const zahltext = String(zahl).replace('.', ',').replace('-', '\u2212')
    return v?.einheit ? `${zahltext} ${v.einheit}` : zahltext
  })
}
