import { useState } from 'react'
import { kopienListe, kopieText } from '../lib/kopien.js'
import { dropboxKopieLaden, dropboxKopien } from '../lib/abgleich.js'

// Sicherheitskopien (T1, 2026-10-13): Liste der automatischen Kopien (lokal
// vor jedem Loeschen/Einlesen und taeglich vor dem Abgleich, in Dropbox die
// letzten sieben Tage je Geraet) mit "Wiederherstellen". Wiederherstellen
// ergaenzt nur, was fehlt - es loescht nichts und verdoppelt nichts.
const datum = (ts) =>
  new Date(ts).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function tagAusStempel(t) {
  return `${Number(t.slice(6, 8))}.${Number(t.slice(4, 6))}.${t.slice(0, 4)}`
}

export default function Sicherheitskopien({ profilId, dropboxVerbunden, onWiederherstellen }) {
  const [offen, setOffen] = useState(false)
  const [lokal, setLokal] = useState(null)
  const [online, setOnline] = useState(null) // null | 'laedt' | [] | { fehler }
  const [frage, setFrage] = useState(null) // { id, titel, laden }
  const [laeuft, setLaeuft] = useState(false)

  async function oeffnen() {
    setOffen(true)
    setLokal(await kopienListe(profilId).catch(() => []))
    if (dropboxVerbunden) {
      setOnline('laedt')
      setOnline(await dropboxKopien(profilId).catch((e) => ({ fehler: e.message })))
    }
  }

  async function bestaetigen() {
    setLaeuft(true)
    try {
      const text = await frage.laden()
      if (!text) throw new Error('Die Kopie ist nicht mehr vorhanden.')
      await onWiederherstellen(text)
      setFrage(null)
    } catch (e) {
      setFrage({ ...frage, fehler: e.message })
    } finally {
      setLaeuft(false)
    }
  }

  const eintrag = (id, titel, hinweis, laden) => (
    <div className="zeile" key={id}>
      <div className="zeileText">
        <p className="zeileTitel">{titel}</p>
        <p className="zeileHinweis">{hinweis}</p>
        {frage?.id === id && (
          <>
            <p className="zeileHinweis">
              Ergänzt alles aus dieser Kopie, was jetzt fehlt – Gelöschtes kommt zurück, Vorhandenes
              bleibt, nichts wird doppelt. Per Dropbox erreicht es auch die anderen Geräte.
            </p>
            {frage.fehler && <p className="zeileHinweis fehlertext">{frage.fehler}</p>}
            <div className="wahl">
              <button className="knopf schmal haupt" disabled={laeuft} onClick={bestaetigen}>
                {laeuft ? 'Stelle wieder her …' : 'Ja, wiederherstellen'}
              </button>
              <button className="knopf schmal" disabled={laeuft} onClick={() => setFrage(null)}>Abbrechen</button>
            </div>
          </>
        )}
      </div>
      {frage?.id !== id && (
        <button className="knopf schmal" onClick={() => setFrage({ id, titel, laden })}>Wiederherstellen</button>
      )}
    </div>
  )

  return (
    <div className="zeile" id="einst-kopien">
      <div className="zeileText">
        <p className="zeileTitel">Sicherheitskopien</p>
        <p className="zeileHinweis">
          Entstehen automatisch vor „Fortschritt löschen“, vor jedem Einlesen einer Sicherung und
          einmal am Tag vor dem Abgleich – auf diesem Gerät die letzten zehn
          {dropboxVerbunden ? ', in Dropbox zusätzlich je Gerät die letzten sieben Tage' : ''}.
        </p>
        {offen && (
          <div className="feldgruppe">
            {lokal === null && <p className="zeileHinweis">Lade …</p>}
            {lokal?.length === 0 && <p className="zeileHinweis">Auf diesem Gerät noch keine Kopie.</p>}
            {lokal?.map((k) =>
              eintrag(k.id, `${datum(k.ts)} · auf diesem Gerät`, `${k.grund}, ${k.anzahl} Ereignisse`, () => kopieText(k.id))
            )}
            {online === 'laedt' && <p className="zeileHinweis">Lade Kopien aus Dropbox …</p>}
            {online?.fehler && <p className="zeileHinweis fehlertext">Dropbox: {online.fehler}</p>}
            {Array.isArray(online) && online.length === 0 && (
              <p className="zeileHinweis">In Dropbox noch keine Kopie.</p>
            )}
            {Array.isArray(online) &&
              online.map((k) =>
                eintrag(k.pfad, `${tagAusStempel(k.tag)} · Dropbox`, `Gerät ${k.geraet}`, () => dropboxKopieLaden(k.pfad))
              )}
          </div>
        )}
      </div>
      {!offen && (
        <button className="knopf schmal" onClick={oeffnen}>Anzeigen</button>
      )}
    </div>
  )
}
