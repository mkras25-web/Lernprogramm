#!/bin/sh
# Lernprogramm ohne Installation starten (macOS / Linux).
# Nutzt, was meist schon da ist: python3, sonst ruby. Beenden: Strg+C.
cd "$(dirname "$0")" || exit 1
PORT=8765
URL="http://localhost:$PORT/"

oeffnen() {
  sleep 1
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  fi
}

echo "Lernprogramm laeuft auf $URL  (beenden: Strg+C)"
oeffnen &

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT" --bind 127.0.0.1
elif command -v ruby >/dev/null 2>&1; then
  exec ruby -run -e httpd . -p "$PORT" -b 127.0.0.1
else
  echo "Weder python3 noch ruby gefunden. Am einfachsten: die App ueber ihre"
  echo "Internet-Adresse oeffnen (siehe LIES-MICH.txt)."
  exit 1
fi
