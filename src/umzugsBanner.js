// Umzugs-Banner nur fuer die alte GitHub-Pages-Version (*.github.io):
// verweist gross und deutlich auf die neue Adresse. Auf maxkrasko.com und
// lokal erscheint nichts. Reines DOM (kein React), damit es auch dann
// sichtbar ist, wenn die App selbst nicht startet. Schliessen mit "x" gilt
// nur fuer die laufende Sitzung - beim naechsten Besuch kommt es wieder.

const ZIEL = 'https://maxkrasko.com'
const SCHLUESSEL = 'umzugsBannerZu'

export function istAlteGithubVersion(hostname = window.location.hostname) {
  return /(^|\.)github\.io$/i.test(hostname)
}

function schonGeschlossen() {
  try {
    return sessionStorage.getItem(SCHLUESSEL) === '1'
  } catch {
    return false
  }
}

export function umzugsBannerZeigen() {
  if (!istAlteGithubVersion() || schonGeschlossen()) return

  const stil = document.createElement('style')
  stil.textContent = `
    .umzugsBanner { position: relative; z-index: 10000; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center; gap: 1rem;
      padding: 1rem 3.5rem 1rem 1rem; background: #b3261e; color: #fff;
      font: 600 1.125rem/1.4 system-ui, sans-serif; text-align: center;
      border-bottom: 4px solid #7a1914; }
    .umzugsBanner a { color: #fff; background: rgba(255,255,255,.18);
      border: 2px solid #fff; border-radius: .5rem; padding: .5rem 1rem;
      font-weight: 700; text-decoration: none; white-space: nowrap; }
    .umzugsBanner a:hover, .umzugsBanner a:focus-visible { background: #fff; color: #7a1914; }
    .umzugsBanner button { position: absolute; top: 50%; right: .75rem;
      transform: translateY(-50%); width: 2.5rem; height: 2.5rem; border: 2px solid #fff;
      border-radius: 50%; background: transparent; color: #fff; font: 700 1.5rem/1 system-ui, sans-serif;
      cursor: pointer; }
    .umzugsBanner button:hover, .umzugsBanner button:focus-visible { background: #fff; color: #7a1914; }
    @media (max-width: 40rem) { .umzugsBanner { flex-direction: column; gap: .5rem;
      font-size: 1rem; padding: .75rem 3.25rem .75rem .75rem; }
      .umzugsBanner a { white-space: normal; max-width: 100%; box-sizing: border-box; } }
  `

  const leiste = document.createElement('div')
  leiste.className = 'umzugsBanner'
  leiste.setAttribute('role', 'region')
  leiste.setAttribute('aria-label', 'Hinweis: neue Adresse')

  const text = document.createElement('span')
  text.textContent = 'Das Lernprogramm ist umgezogen! Diese Version wird nicht mehr aktualisiert.'

  const link = document.createElement('a')
  link.href = ZIEL
  link.textContent = 'Zur neuen Version: maxkrasko.com'

  const zu = document.createElement('button')
  zu.type = 'button'
  zu.textContent = '×'
  zu.setAttribute('aria-label', 'Hinweis schließen')
  zu.addEventListener('click', () => {
    try {
      sessionStorage.setItem(SCHLUESSEL, '1')
    } catch {
      /* ohne Speicher: nur dieses Mal weg */
    }
    leiste.remove()
    stil.remove()
  })

  leiste.append(text, link, zu)
  document.head.append(stil)
  document.body.prepend(leiste)
}
