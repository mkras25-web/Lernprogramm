import { describe, expect, it } from 'vitest'
import { erzeugeId } from './id.js'

// Regressionstest fuer einen Bug: crypto.randomUUID() ist auf sichere
// Kontexte beschraenkt und fehlt beim Zugriff vom Handy per WLAN-IP
// komplett (siehe ANLEITUNG.md) - profilErstellen() und mehrere
// Stellen in speicher.js hingen dadurch ohne jede Fehlermeldung fest.
// erzeugeId() ersetzt das ueberall durch crypto.getRandomValues(),
// das dieser Einschraenkung nicht unterliegt.
describe('erzeugeId', () => {
  it('liefert eine gueltige UUID v4', () => {
    expect(erzeugeId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('erzeugt bei jedem Aufruf einen anderen Wert', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => erzeugeId()))
    expect(ids.size).toBe(1000)
  })
})
