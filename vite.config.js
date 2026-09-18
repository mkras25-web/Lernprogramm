import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' erzeugt relative Pfade im Build. Damit laeuft die App
// sowohl lokal per Dateioeffnung als auch unter einem Unterpfad wie
// https://<name>.github.io/lernprogramm/ ohne weitere Anpassung.
export default defineConfig({
  plugins: [
    react(),
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
