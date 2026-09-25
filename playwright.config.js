import { defineConfig, devices } from '@playwright/test'

// E2E-Tests laufen gegen den echten Vite-Dev-Server, nicht gegen
// gemockte Module - siehe ANLEITUNG.md fuer den Hintergrund, warum
// Playwright hier nur als devDependency und ohne CI-Anbindung lebt
// (rein lokales Lernprogramm, keine Pipeline).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
