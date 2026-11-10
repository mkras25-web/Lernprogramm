// Einschaetzung der Passwortstaerke fuer den dezenten Balken (kein Zwang:
// erlaubt ist jedes Passwort ab PASSWORT_MIN Zeichen, der Balken berät nur).
// Gewertet werden Laenge und Vielfalt; bekannte, einfache Muster zaehlen
// immer als schwach. Die Einschaetzung ist ein Anhaltspunkt, kein Beweis.

const HAEUFIG = new Set([
  'password', 'passwort', 'passwort1', '123456', '1234567', '12345678', '123456789', '1234567890', '654321',
  'qwertz', 'qwerty', 'qwertzui', 'qwertyui', 'asdfgh', 'asdfghjk', 'abc123', 'abcdef', 'abcd1234', 'iloveyou',
  '111111', '000000', 'hallo123', 'hallo1', 'lernen', 'lernprogramm', 'architektur', 'princess', 'sonne123',
])

function einfachesMuster(pw) {
  const p = pw.toLowerCase()
  if (HAEUFIG.has(p)) return true
  if (new Set(p).size === 1) return true // aaaaaa
  const reihen = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertzuiopasdfghjklyxcvbnm', 'qwertyuiopasdfghjklzxcvbnm']
  const rueck = (s) => [...s].reverse().join('')
  if (p.length >= 4 && reihen.some((r) => r.includes(p) || rueck(r).includes(p))) return true // 123456, abcdef, qwertz
  if (/^(.{1,3})\1+$/.test(p)) return true // abcabc, 121212
  return false
}

// Liefert { stufe: 'leer' | 'schwach' | 'mittel' | 'sicher', anteil: 0..1, text }
export function passwortStaerke(pw) {
  if (!pw) return { stufe: 'leer', anteil: 0, text: '' }
  const laenge = [...pw].length
  const klassen =
    (/[a-zäöüß]/.test(pw) ? 1 : 0) + (/[A-ZÄÖÜ]/.test(pw) ? 1 : 0) + (/\d/.test(pw) ? 1 : 0) + (/[^\p{L}\d]/u.test(pw) ? 1 : 0)
  const laengenPunkte = laenge >= 16 ? 5 : laenge >= 12 ? 4 : laenge >= 10 ? 3 : laenge >= 8 ? 2 : laenge >= 6 ? 1 : 0
  const punkte = laengenPunkte + Math.min(2, Math.max(0, klassen - 1))
  if (einfachesMuster(pw) || punkte <= 2) return { stufe: 'schwach', anteil: 0.33, text: 'Schwach' }
  if (punkte <= 4) return { stufe: 'mittel', anteil: 0.66, text: 'Mittel' }
  return { stufe: 'sicher', anteil: 1, text: 'Sicher' }
}
