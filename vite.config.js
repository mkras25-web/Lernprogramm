import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Urheberrechtlich geschuetzte Buchausschnitte (public/pakete/*/bilder-lokal)
// duerfen nie in einen Build wandern, den man veroeffentlicht - auch nicht,
// wenn jemand lokal baut und den dist-Ordner hochlaedt. Sie liegen im
// Entwicklungsordner nur fuer den PC-Betrieb; aufs Handy kommen sie ueber
// den ZIP-Import in den Einstellungen.
function ohneLokaleBilder() {
  return {
    name: 'ohne-lokale-bilder',
    apply: 'build',
    // Vor dem PWA-Plugin (das danach die Precache-Liste erzeugt).
    enforce: 'post',
    closeBundle: {
      order: 'pre',
      handler() {
        const pakete = join('dist', 'pakete')
        if (!existsSync(pakete)) return
        for (const p of readdirSync(pakete, { withFileTypes: true })) {
          if (p.isDirectory()) {
            rmSync(join(pakete, p.name, 'bilder-lokal'), { recursive: true, force: true })
          }
        }
      },
    },
  }
}

// base: './' erzeugt relative Pfade im Build. Damit laeuft die App unter
// einem Unterpfad wie https://<name>.github.io/lernprogramm/ ohne weitere
// Anpassung. NICHT per Doppelklick auf dist/index.html (file://): Browser
// blockieren dort Module und fetch, die Seite bleibt leer. Ohne Node laeuft
// sie ueber das Offline-Paket (app/offline/, siehe ANLEITUNG.md 1.5).
export default defineConfig({
  plugins: [
    react(),
    ohneLokaleBilder(),
    // Macht die App auf dem Handy installierbar (Icon auf dem
    // Home-Bildschirm, eigenes Fenster ohne Browserleiste) und
    // cached die App-Huelle fuers Offline-Starten. Inhaltspakete
    // (public/pakete/...) werden zusaetzlich beim ersten Aufruf
    // mitgecached, damit einmal geladene Themen auch ohne Verbindung
    // weiter lernbar bleiben - ohne extra Downloadschritt.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Lernprogramm',
        short_name: 'Lernprogramm',
        description: 'Karteikarten-Lernprogramm mit Wiederholung nach Fälligkeit.',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f0ead2',
        theme_color: '#f7f3e4',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        runtimeCaching: [
          {
            // Ueber die Einstellungen eingelesene Buchausschnitte (siehe
            // lib/lokaleBilder.js). Stehen NUR im Geraete-Cache, nie im
            // Netz - deshalb erst hier nachsehen und nie die Pakete-Regel
            // darunter (die wuerde einen 404 vom Server vorziehen).
            urlPattern: ({ url }) => url.pathname.includes('/bilder-lokal/'),
            handler: 'CacheFirst',
            options: { cacheName: 'lokale-bilder' },
          },
          {
            // Lerninhalte (Items, Bilder, Normen) je Paket - werden
            // sofort aus dem Cache bedient, im Hintergrund aber
            // aufgefrischt, sobald wieder eine Verbindung besteht.
            urlPattern: ({ url }) => url.pathname.includes('/pakete/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pakete-inhalte',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
