import { EBENEN, aenderungsFelder, datumKurz, wortDiff } from '../lib/durchsicht.js'

// Kleine Marke im Kartenkopf: ✓ geprueft, wartet auf dich, abgelehnt.
// "offen" zeigt bewusst nichts - das ist anfangs fast alles.
export function DurchsichtMarke({ stand }) {
  if (!stand || stand.stand === 'offen') return null
  if (stand.stand === 'wartet') {
    return (
      <span className="durchsichtMarke wartet" title="Bei der Durchsicht geändert – deine Zustimmung fehlt (Nachschlagen)">
        ✎︎ geändert · wartet auf dich
      </span>
    )
  }
  if (stand.stand === 'abgelehnt') {
    return (
      <span className="durchsichtMarke abgelehnt" title="Du hast die Änderung abgelehnt – es gilt die alte Fassung">
        ↺︎ Änderung abgelehnt
      </span>
    )
  }
  return (
    <>
      <span className="durchsichtMarke geprueft" title={`In der Durchsicht geprüft${stand.datum ? ` am ${datumKurz(stand.datum)}` : ''}`}>
        ✓︎ geprüft
      </span>
      {stand.geaendertAm && (
        <span className="durchsichtMarke geaendert" title={stand.grund ? `Geändert: ${stand.grund}` : 'Bei der Durchsicht geändert'}>
          geändert {datumKurz(stand.geaendertAm).replace(/\.\d{4}$/, '.')}
        </span>
      )}
    </>
  )
}

// Vorher/Nachher eines Textes, Wort fuer Wort markiert.
function Textvergleich({ vorher, nachher }) {
  const teile = wortDiff(vorher, nachher)
  return (
    <div className="durchsichtVergleich">
      <div>
        <p className="zeileHinweis">Vorher</p>
        <p className="vergleichText">
          {teile.filter((t) => t.art !== 'neu').map((t, i) => (
            <span key={i} className={t.art === 'weg' ? 'diffWeg' : undefined}>{t.text}</span>
          ))}
          {!vorher && <span className="zeileHinweis">(leer)</span>}
        </p>
      </div>
      <div>
        <p className="zeileHinweis">Nachher</p>
        <p className="vergleichText">
          {teile.filter((t) => t.art !== 'weg').map((t, i) => (
            <span key={i} className={t.art === 'neu' ? 'diffNeu' : undefined}>{t.text}</span>
          ))}
          {!nachher && <span className="zeileHinweis">(entfernt)</span>}
        </p>
      </div>
    </div>
  )
}

// Abschnitt "Durchsicht" einer Aufgabe, eines Erklaerstuecks oder Bildes:
// was geprueft wurde, und bei einer Aenderung Vorher/Nachher mit
// Annehmen/Ablehnen. aktuell = Inhalt der Datei, wie er jetzt ist.
export function DurchsichtBlock({ titel, eintrag, stand, aktuell, bildAlt, bildNeu, onEntscheiden }) {
  if (!eintrag) {
    return (
      <section className="block durchsichtBlock">
        <h2 className="abschnitt">{titel ?? 'Durchsicht'}</h2>
        <p className="nebentext">Noch nicht durchgesehen.</p>
      </section>
    )
  }
  const ebenen = (eintrag.ebenen ?? []).map((e) => EBENEN[e] ?? e).join(', ')
  const wartetOderLokal = eintrag.stand === 'geaendert'
  const felder = wartetOderLokal && eintrag.aenderung?.vorher ? aenderungsFelder(eintrag.aenderung.vorher, aktuell) : []
  return (
    <section className={`block durchsichtBlock${stand.stand === 'wartet' ? ' wartet' : ''}`}>
      <h2 className="abschnitt">{titel ?? 'Durchsicht'}</h2>
      <p className="nebentext">
        {stand.stand === 'offen'
          ? 'Noch offen'
          : stand.stand === 'wartet'
            ? 'Bei der Durchsicht geändert – bitte ansehen und entscheiden.'
            : stand.stand === 'abgelehnt'
              ? 'Änderung abgelehnt – es gilt die alte Fassung.'
              : '✓︎ Geprüft'}
        {eintrag.datum && ` · ${datumKurz(eintrag.datum)}`}
        {ebenen && ` · ${ebenen}`}
      </p>
      {eintrag.notiz && <p className="zeileHinweis">Befund: {eintrag.notiz}</p>}
      {stand.stand === 'geprueft' && stand.geaendertAm && stand.grund && (
        <p className="zeileHinweis">Geändert am {datumKurz(stand.geaendertAm)}: {stand.grund}</p>
      )}

      {wartetOderLokal && (
        <>
          <p className="durchsichtGrund">
            <strong>Warum:</strong> {eintrag.aenderung?.grund}
            {eintrag.aenderung?.beleg && (
              <>
                <br />
                <strong>Beleg:</strong> {eintrag.aenderung.beleg}
              </>
            )}
          </p>
          {felder.map((f) => (
            <div key={f.feld} className="durchsichtFeld">
              <p className="zeileTitel">{f.name}</p>
              <Textvergleich vorher={f.vorher} nachher={f.nachher} />
            </div>
          ))}
          {bildAlt && (
            <div className="durchsichtVergleich">
              <div>
                <p className="zeileHinweis">Vorher</p>
                <img className="durchsichtBild" src={bildAlt} alt="Bild vor der Änderung" />
              </div>
              <div>
                <p className="zeileHinweis">Nachher</p>
                <img className="durchsichtBild" src={bildNeu} alt="Bild nach der Änderung" />
              </div>
            </div>
          )}
          {wartetOderLokal && felder.length === 0 && !bildAlt && (
            <p className="zeileHinweis">Kein Unterschied mehr sichtbar (Datei inzwischen erneuert?).</p>
          )}
          <div className="wahl">
            {stand.stand === 'wartet' ? (
              <>
                <button className="knopf schmal" onClick={() => onEntscheiden('angenommen')}>
                  ✓︎ Änderung annehmen
                </button>
                <button className="knopf schmal" onClick={() => onEntscheiden('abgelehnt')}>
                  Ablehnen, alte Fassung behalten
                </button>
              </>
            ) : (
              <>
                <span className="zeileHinweis">
                  {stand.stand === 'abgelehnt' ? 'Abgelehnt' : 'Angenommen'} – wird beim nächsten Übernehmen
                  (durchsicht.py) endgültig, dann bleibt nur eine Fassung.
                </span>
                <button className="textknopf" onClick={() => onEntscheiden(null)}>
                  Entscheidung zurücknehmen
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
