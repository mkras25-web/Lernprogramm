// "Aus dem Kopf" (L6, 2026-10-13): je Thema alles aufschreiben oder
// skizzieren, was man weiss, und danach gegen die Lernziele abhaken.
// Freier Abruf festigt staerker als erneutes Lesen (Karpicke & Blunt 2011).
// Die Planung bleibt unberuehrt; gemerkt wird nur das letzte Ergebnis je
// Thema auf diesem Geraet, als Anhaltspunkt auf der Themenseite.

const schluessel = (profilId) => `ausDemKopf_${profilId}`

function lesen(profilId) {
  try {
    return JSON.parse(localStorage.getItem(schluessel(profilId)) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

export function ausDemKopfLetzter(profilId, themaId) {
  return lesen(profilId)[themaId] ?? null
}

export function ausDemKopfMerken(profilId, themaId, ergebnis) {
  try {
    const alle = lesen(profilId)
    alle[themaId] = { ...ergebnis, ts: Date.now() }
    localStorage.setItem(schluessel(profilId), JSON.stringify(alle))
  } catch {
    /* Speicher voll oder gesperrt - das Ergebnis ist nur ein Anhaltspunkt */
  }
}

// Wogegen abgehakt wird: die Lernziele des Themas, sonst die Kernaussagen
// des Erklaerstuecks (Merksatz und der erste Satz jedes Absatzes) - die
// meisten Themen haben noch keine Lernziele.
export function pruefliste(thema) {
  if (thema?.lernziele?.length) return { art: 'lernziele', punkte: thema.lernziele }
  const e = thema?.erklaerung ?? {}
  const punkte = []
  if (e.merksatz) punkte.push(e.merksatz)
  for (const absatz of e.absaetze ?? []) {
    const satz = ersterSatz(String(absatz))
    if (satz && !punkte.includes(satz)) punkte.push(satz)
  }
  return { art: 'kernaussagen', punkte }
}

// Punkt hinter einer Abkuerzung oder Ordnungszahl ("§ 35a Abs. 2",
// "z. B.", "3. OG") beendet keinen Satz - sonst blieb "… nach § 35a Abs."
// als Kernaussage stehen.
const ABKUERZUNG = /(?:^|[\s(])(?:Abs|Nr|bzw|ca|vgl|ggf|evtl|inkl|max|min|bzgl|Art|Kap|Abschn|Abb|Tab|S|z|B|d|h|u|a|o|s|i|e|v|Dr|Prof|Dipl|Ing|gem|sog|Std|St|Mio|Mrd|\d+)\.$/

export function ersterSatz(text) {
  const ende = /[.!?](?=\s|$)/g
  let treffer
  while ((treffer = ende.exec(text))) {
    const bis = treffer.index + 1
    if (text[treffer.index] === '.' && ABKUERZUNG.test(text.slice(0, bis))) continue
    return text.slice(0, bis).trim()
  }
  return text.trim()
}
