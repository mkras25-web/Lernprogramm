import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' erzeugt relative Pfade im Build. Damit laeuft die App
// sowohl lokal per Dateioeffnung als auch unter einem Unterpfad wie
// https://<name>.github.io/lernprogramm/ ohne weitere Anpassung.
export default defineConfig({
  plugins: [react()],
  base: './',
})
