import { describe, expect, it } from 'vitest'
import { ersterSatz, pruefliste } from './ausDemKopf.js'

describe('Aus dem Kopf: Kernaussagen', () => {
  it('schneidet nicht an Abkuerzungen und Ordnungszahlen ab', () => {
    expect(ersterSatz('Der Anspruch folgt aus § 20i Abs. 1 SGB V. Weiter.')).toBe('Der Anspruch folgt aus § 20i Abs. 1 SGB V.')
    expect(ersterSatz('Nach DIN 4108-2 bzw. z. B. DIN 4108-3 gilt das. Zweiter.')).toBe('Nach DIN 4108-2 bzw. z. B. DIN 4108-3 gilt das.')
    expect(ersterSatz('Im 3. OG liegt die Wohnung. Danach.')).toBe('Im 3. OG liegt die Wohnung.')
    expect(ersterSatz('Ziegel, Kalksandstein usw. Danach.')).toBe('Ziegel, Kalksandstein usw.')
    expect(ersterSatz('Ohne Satzende')).toBe('Ohne Satzende')
  })

  it('nimmt Lernziele vor Kernaussagen', () => {
    expect(pruefliste({ lernziele: ['A'] })).toEqual({ art: 'lernziele', punkte: ['A'] })
    expect(pruefliste({ erklaerung: { merksatz: 'M.', absaetze: ['Eins. Zwei.', 'Drei!'] } }).punkte).toEqual(['M.', 'Eins.', 'Drei!'])
  })
})
