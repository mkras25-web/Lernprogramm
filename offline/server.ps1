# Kleiner Webserver fuer das Offline-Paket - nutzt nur, was in Windows
# eingebaut ist (PowerShell + .NET). Nichts muss installiert werden.
# Gestartet ueber Starten.bat. Beenden: Fenster schliessen oder Strg+C.

$port = 8765   # fest: die Adresse http://localhost:8765/ ist auch in der
               # Dropbox-Konsole als Redirect URI einzutragen
# Wo liegt die App? Im Offline-Paket direkt neben diesem Skript; im
# Projektordner (app\offline) in app\dist, sobald einmal gebaut wurde.
$root = [IO.Path]::GetFullPath($PSScriptRoot)
if (-not (Test-Path -LiteralPath (Join-Path $root 'index.html'))) {
  $dist = Join-Path (Split-Path $root -Parent) 'dist'
  if (Test-Path -LiteralPath (Join-Path $dist 'index.html')) { $root = [IO.Path]::GetFullPath($dist) }
}
if (-not (Test-Path -LiteralPath (Join-Path $root 'index.html'))) {
  Write-Host ""
  Write-Host "Hier liegt keine fertige App (index.html fehlt) - deshalb wuerde der"
  Write-Host "Browser nur 'Seite nicht gefunden' zeigen."
  Write-Host ""
  Write-Host "Moegliche Gruende:"
  Write-Host " - Das ZIP wurde nur geoeffnet, nicht entpackt. Erst 'Alle extrahieren',"
  Write-Host "   dann Starten.bat im entpackten Ordner doppelklicken."
  Write-Host " - Du startest aus dem Projektordner (app\offline), aber es wurde noch"
  Write-Host "   nie gebaut. Dort einmal 'npm run build' ausfuehren (im Ordner app) -"
  Write-Host "   oder das fertige Offline-Paket von der Internet-Adresse laden:"
  Write-Host "   <Adresse>/lernprogramm-offline.zip"
  Write-Host ""
  exit 1
}
Write-Host "App-Ordner: $root"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'
  '.txt' = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "Der Port $port ist schon belegt - laeuft das Lernprogramm vielleicht schon?"
  Write-Host "Dann einfach im Browser http://localhost:$port/ oeffnen."
  exit 1
}

Write-Host ""
Write-Host "Lernprogramm laeuft auf  http://localhost:$port/"
Write-Host "Der Browser oeffnet sich gleich. Zum Beenden dieses Fenster schliessen."
Write-Host ""
Start-Process "http://localhost:$port/"

try {
  while ($listener.IsListening) {
    # Asynchron warten, damit Strg+C jederzeit wirkt.
    $aufgabe = $listener.GetContextAsync()
    while (-not $aufgabe.AsyncWaitHandle.WaitOne(300)) { }
    $ctx = $aufgabe.Result
    try {
      $relativ = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($relativ -eq '') { $relativ = 'index.html' }
      $pfad = [IO.Path]::GetFullPath((Join-Path $root $relativ))

      # Nur Dateien unterhalb dieses Ordners ausliefern.
      if (-not $pfad.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $ctx.Response.StatusCode = 403
      } else {
        if (Test-Path -LiteralPath $pfad -PathType Container) { $pfad = Join-Path $pfad 'index.html' }
        if (Test-Path -LiteralPath $pfad -PathType Leaf) {
          $endung = [IO.Path]::GetExtension($pfad).ToLower()
          $ctx.Response.ContentType = if ($mime.ContainsKey($endung)) { $mime[$endung] } else { 'application/octet-stream' }
          $bytes = [IO.File]::ReadAllBytes($pfad)
          $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
          $ctx.Response.ContentLength64 = $bytes.Length
          $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
          $ctx.Response.StatusCode = 404
          $ctx.Response.ContentType = 'text/plain; charset=utf-8'
          $text = [Text.Encoding]::UTF8.GetBytes("Nicht gefunden: /$relativ`r`n(Lernprogramm-Server, App-Ordner: $root)")
          $ctx.Response.OutputStream.Write($text, 0, $text.Length)
        }
      }
    } catch {
      # Der Browser hat die Verbindung abgebrochen o. ae. - weiter.
    } finally {
      try { $ctx.Response.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
}
