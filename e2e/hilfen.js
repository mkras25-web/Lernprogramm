import { expect } from '@playwright/test'

// WebKit nimmt unter voller Parallel-Last gelegentlich die Eingabe an,
// bevor React das Feld uebernommen hat - der Knopf blieb dann gesperrt und
// der Test lief in den Zeitablauf. Deshalb: eintippen, bis der Knopf frei ist.
export async function profilAnlegen(page, name, { tippen = false } = {}) {
  const feld = page.getByPlaceholder('Name für ein neues Profil')
  const knopf = page.getByRole('button', { name: 'Profil anlegen' })
  await expect(async () => {
    await feld.fill(name)
    await expect(knopf).toBeEnabled({ timeout: 1000 })
  }).toPass({ timeout: 15000 })
  if (tippen) await knopf.tap()
  else await knopf.click()
}
