// Zentrale Tastenkuerzel-Uebersicht. Die meisten Kuerzel sind schon
// direkt am jeweiligen Knopf sichtbar (siehe .taste in Lernen.jsx,
// .tastenHinweis in Sichtung.jsx) - dieses Fenster ist der eine Ort,
// an dem man alles auf einen Blick findet, erreichbar ueber die Taste
// "?" oder den Knopf in den Einstellungen.
const GRUPPEN = [
  {
    titel: 'Beim Lernen',
    kuerzel: [
      ['Leertaste', 'Antwort/Referenz aufdecken, danach weiter'],
      ['1 – 4', 'Bewerten (Nochmal · Schwer · Gut · Leicht)'],
      ['←', 'Eine Position zurückblättern'],
      ['⌫', 'Letzte Bewertung rückgängig machen'],
      ['U', 'Aufgabe überspringen, falls erlaubt'],
    ],
  },
  {
    titel: 'Beim Nachschlagen/Sichten',
    kuerzel: [
      ['← →', 'Zum vorherigen/nächsten Item blättern'],
      ['N', 'Zum nächsten ungesichteten Item springen'],
      ['R S U X', 'Sichtungskategorie setzen (Relevant · Später · Überarbeiten · Streichen)'],
      ['Esc', 'Zurück zur Liste'],
    ],
  },
]

export default function Tastenhilfe({ offen, onSchliessen }) {
  if (!offen) return null
  return (
    <div className="schleier" onClick={onSchliessen}>
      <article className="grosseKarte" style={{ maxWidth: '32rem' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="ueberschrift">Tastenkürzel</h2>
        {GRUPPEN.map((g) => (
          <div key={g.titel} className="tastenhilfeGruppe">
            <h3 className="abschnitt">{g.titel}</h3>
            <dl className="tastenhilfeListe">
              {g.kuerzel.map(([taste, text]) => (
                <div key={taste} className="tastenhilfeZeile">
                  <dt><span className="taste">{taste}</span></dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <button className="knopf" onClick={onSchliessen}>Schließen</button>
      </article>
    </div>
  )
}
