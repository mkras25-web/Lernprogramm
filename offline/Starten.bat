@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Lernprogramm (ohne Installation)
echo ============================================

if not exist "%~dp0server.ps1" (
    echo.
    echo server.ps1 fehlt neben dieser Datei. Wurde das ZIP nur geoeffnet?
    echo Bitte zuerst mit Rechtsklick - Alle extrahieren - entpacken und
    echo Starten.bat im entpackten Ordner doppelklicken.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

pause
