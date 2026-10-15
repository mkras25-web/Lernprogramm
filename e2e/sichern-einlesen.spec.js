import { test, expect } from '@playwright/test'
import { aufdecken, profilAnlegen } from './hilfen.js'
import fs from 'node:fs'

// Rundlauf: Fortschritt sichern und in einem neuen Profil wieder einlesen.
test('Sichern und als neues Profil einlesen ergibt denselben Stand', async ({ page }, info) => {
  await page.goto('/')
  await profilAnlegen(page, 'Quelle')
  await page.locator('.profilKnopf', { hasText: 'Quelle' }).click()
  await page.locator('button', { hasText: /^Lernen$/ }).first().click()
  for (let i = 0; i < 3; i++) {
    await aufdecken(page)
    await page.keyboard.press('3')
    await page.waitForTimeout(150)
  }
  await page.locator('.lernkopf .textknopf', { hasText: 'Zurück' }).click()

  await page.locator('.navKnopf', { hasText: 'Einstellungen' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Sichern', exact: true }).click(),
  ])
  const datei = info.outputPath('sicherung.json')
  await download.saveAs(datei)
  const daten = JSON.parse(fs.readFileSync(datei, 'utf8'))
  expect(daten.ereignisse).toHaveLength(3)

  // Neues Geraet simulieren: frischer Kontext, Import ueber die Profilwahl
  const ctx = await page.context().browser().newContext({ baseURL: info.project.use.baseURL })
  const p2 = await ctx.newPage()
  await p2.goto('/')
  await p2.locator('label.profilImport input[type=file]').setInputFiles(datei)
  await expect(p2.locator('.profilKnopf', { hasText: 'Quelle' })).toBeVisible()
  await p2.locator('.profilKnopf', { hasText: 'Quelle' }).click()
  await p2.locator('.navKnopf', { hasText: 'Fortschritt' }).click()
  await expect(p2.locator('.kennzahl', { hasText: 'Antworten' }).first()).toContainText('3')
  await ctx.close()
})
