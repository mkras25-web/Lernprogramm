import { lastvorschau, nachWochen } from '../lib/kalender.js'
import { tageBis } from '../lib/kurs.js'

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

// Semesterkalender (F8, 2026-10-13): alle Klausurtermine und die erwartete
// Lernlast je Tag fuer die naechsten acht Wochen. Warnt bei Tagen ueber dem
// Tageslimit. Ohne Export (Nutzerentscheidung).
export default function Kalender({ zustaende, neueAnzahl, opt, klausuren = [], kurse = [] }) {
  const felder = lastvorschau({
    zustaende,
    neueAnzahl,
    neuProTag: opt.neuProTag,
    maxProTag: opt.maxProTag,
    klausuren,
  })
  const wochen = nachWochen(felder)
  const spitze = felder.reduce((a, b) => (b.summe > a.summe ? b : a), felder[0])
  const maxSumme = Math.max(1, ...felder.map((f) => f.summe))
  const ueberlast = felder.filter((f) => f.ueberlast)
  const anstehend = klausuren
    .filter((k) => k.datum && tageBis(k) >= 0)
    .sort((a, b) => a.datum.localeCompare(b.datum))
  const datum = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })

  return (
    <div className="schirm">
      <div className="themenKopf">
        <h1 className="ueberschrift">Kalender</h1>
      </div>
      <p className="nebentext">
        Erwartete Karten je Tag in den nächsten acht Wochen: fällige Wiederholungen nach heutigem Stand
        plus neue Karten ({opt.neuProTag} am Tag, solange es neue gibt). Was aus künftigem Lernen dazukommt,
        fehlt noch – die Zahlen sind eine Untergrenze.
        {spitze?.summe > 0 && ` Spitze: ${spitze.summe} Karten am ${datum(spitze.datum)}`}
      </p>
      {ueberlast.length > 0 && (
        <p className="problemHinweis">
          An {ueberlast.length} {ueberlast.length === 1 ? 'Tag' : 'Tagen'} liegt mehr an als dein Tageslimit von{' '}
          {opt.maxProTag} Karten – dort bleibt etwas liegen. Früher anfangen oder das Limit anheben.
        </p>
      )}

      {anstehend.length > 0 && (
        <section className="block">
          <h2 className="abschnitt">Klausuren</h2>
          <ul className="themaListe">
            {anstehend.map((k) => {
              const u = kurse.find((x) => x.kurs.id === k.kursId)
              const tage = tageBis(k)
              return (
                <li key={k.id}>
                  <span className="themaListeFrage">
                    {k.titel} · {new Date(`${k.datum}T00:00`).toLocaleDateString('de-DE')} ·{' '}
                    {tage === 0 ? 'heute' : tage === 1 ? 'morgen' : `in ${tage} Tagen`}
                  </span>
                  {u && (
                    <span className="themaListeText">
                      Kurs {u.kurs.titel}: {u.reife.sicher} von {u.reife.gesamt} Fragen klausurreif
                      {u.plan.neuGesamt > 0 && ` · ${u.plan.neuGesamt} noch nie gelernt`}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="block heuteBreit">
        <div className="kalender" role="table" aria-label="Lernlast je Tag">
          <div className="kalenderKopf" role="row">
            {WOCHENTAGE.map((t) => <span key={t} role="columnheader">{t}</span>)}
          </div>
          {wochen.map((woche, i) => (
            <div key={i} className="kalenderWoche" role="row">
              {woche.map((f, j) =>
                f ? (
                  <div
                    key={j}
                    role="cell"
                    className={[
                      'kalenderTag',
                      f.ueberlast ? 'ueberlast' : '',
                      f.klausuren.length ? 'klausurTag' : '',
                      j >= 5 ? 'wochenende' : '',
                    ].join(' ')}
                    title={`${datum(f.datum)}: ${f.faellig} fällig, ${f.neu} neu${f.klausuren.map((k) => ` · Klausur ${k.titel}`).join('')}`}
                  >
                    <span className="kalenderDatum">{datum(f.datum)}</span>
                    <span className="kalenderBalken">
                      <span style={{ height: `${Math.round((f.summe / maxSumme) * 100)}%` }} />
                    </span>
                    <span className="kalenderZahl">{f.summe || ''}</span>
                    {f.klausuren.map((k) => (
                      <span key={k.id} className="kalenderKlausur">{k.titel}</span>
                    ))}
                  </div>
                ) : (
                  <div key={j} role="cell" className="kalenderTag leer" />
                )
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
