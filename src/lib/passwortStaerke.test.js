import { describe, expect, it } from 'vitest'
import { passwortStaerke } from './passwortStaerke.js'

describe('Passwortstaerke', () => {
  it('leer', () => expect(passwortStaerke('').stufe).toBe('leer'))
  it('kurz und einfach ist schwach', () => {
    for (const pw of ['abc', 'abcdef', '123456', 'password', 'aaaaaaaaaa', 'qwertz', 'abcabcabc']) {
      expect(passwortStaerke(pw).stufe, pw).toBe('schwach')
    }
  })
  it('mittel', () => {
    expect(passwortStaerke('Hund2024').stufe).toBe('mittel')
    expect(passwortStaerke('kaffeetasse').stufe).toBe('mittel')
  })
  it('sicher', () => {
    expect(passwortStaerke('Tr0ub4dor&3').stufe).toBe('sicher')
    expect(passwortStaerke('Der Hund bellt laut im Garten').stufe).toBe('sicher')
  })
})
