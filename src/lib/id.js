// crypto.randomUUID() ist auf sichere Kontexte beschraenkt (HTTPS oder
// localhost) - ruft man das Programm vom Handy per WLAN-IP des PCs auf
// (siehe ANLEITUNG.md, "Handy im selben WLAN"), ist das KEIN sicherer
// Kontext, und crypto.randomUUID existiert dort schlicht nicht. Der
// Aufruf wirft dann eine Ausnahme, oft mitten in einem Event-Handler,
// den die Error Boundary nicht abfaengt - die Oberflaeche haengt ohne
// jede Fehlermeldung fest.
//
// crypto.getRandomValues() unterliegt dieser Einschraenkung nicht und
// ist ueberall verfuegbar - damit laesst sich eine gueltige UUID v4
// selbst bauen, im selben Format wie crypto.randomUUID() sie liefert.
export function erzeugeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
