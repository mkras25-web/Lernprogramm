# Lernprogramm

Eigenbau-Lernsystem mit Inhaltspaketen. Die App kennt kein Fachgebiet –
alles Fachliche steckt in austauschbaren Paketen unter `public/pakete/`.

## Einrichten

```bash
npm install
npm run dev
```

Danach im Browser die angezeigte Adresse öffnen, üblicherweise
`http://localhost:5173`.

## Inhalte ablegen

```
public/pakete/arch-de/
├── paket.json                 # Modul- und Einheitenverzeichnis
└── items/
    └── bk-sockel.json         # die Items
```

Die Datei `bk-sockel.json` gehört nach `public/pakete/arch-de/items/`.
Pakete werden zur Laufzeit geladen. Neue Einheiten brauchen nur einen
Eintrag in `paket.json` – kein Build, kein Neustart des Servers.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `src/lib/speicher.js` | Ereignisprotokoll in IndexedDB, Export und Import |
| `src/lib/planer.js` | Lernzustand aus Ereignissen ableiten, Tagespensum bauen |
| `src/lib/paket.js` | Pakete laden |
| `src/App.jsx` | Oberfläche |

Es wird nie ein Lernzustand gespeichert, nur Ereignisse: wann wurde
welches Item wie bewertet. Fälligkeiten und Statistik entstehen daraus
durch Berechnung. Das hat zwei Folgen:

- Zwei Geräte lassen sich konfliktfrei zusammenführen, indem man die
  Ereignismengen vereinigt.
- Der Wiederholungsalgorithmus lässt sich austauschen, ohne Daten zu
  migrieren. Derzeit SM-2; ein Wechsel auf FSRS betrifft nur `planer.js`.

## Synchronisation

Vorerst manuell: "Fortschritt sichern" lädt das Protokoll als JSON,
"Fortschritt einlesen" führt eine Datei mit dem lokalen Bestand
zusammen. Doppelte Ereignisse werden anhand ihrer ID verworfen, die
Reihenfolge der Importe spielt keine Rolle.

Automatischer Abgleich über einen privaten GitHub-Gist ist später
möglich, ohne dass sich an den Daten etwas ändert.

## Veröffentlichen auf GitHub Pages

`vite.config.js` verwendet `base: './'`, der Build läuft damit unter
jedem Unterpfad. Für den Weg über GitHub Actions genügt der
Standard-Workflow "Deploy static content to Pages" mit `npm run build`
und dem Ordner `dist` als Artefakt.

Wichtig: In einem öffentlichen Repository dürfen keine gescannten
Buchseiten liegen. Quellenmaterial bleibt lokal, im Repository stehen
nur Code und selbst formulierte Items.
