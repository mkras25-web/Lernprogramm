<?php
// Profil-Server (Zweig server-profile). Eine Datei, JSON ueber HTTPS,
// Aufruf: api/index.php?a=<aktion>
// Zugangsdaten NICHT hier, sondern in lernprogramm-config/config.php oberhalb
// des Webverzeichnisses (Vorlage: docs/serverprofile/config.beispiel.php).
//
// Sicherheit (Review 2026-11-10, docs/serverprofile/SICHERHEIT.md):
//  - Passwoerter nur als Hash (SHA-256-Vorbehandlung + password_hash), nie im Klartext
//  - Zaehler VOR der Pruefung (atomar): je Profil+IP, je Profil gesamt, je IP
//  - Tokens: zufaellig, nur als Hash gespeichert, nach Passwortaenderung widerrufen
//  - Obergrenzen fuer Profile, Geraete, Tokens, Speicher; Ratenbegrenzung fuers Anlegen
//  - Loeschen ist ein Papierkorb: Daten bleiben 14 Tage (phpMyAdmin) erhalten
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Referrer-Policy: no-referrer');

const MAX_DATEI = 12 * 1024 * 1024;      // eine Geraetedatei (Text)
const MAX_PROFIL_BYTES = 400 * 1024 * 1024; // Dateien + Kopien je Profil
const TOKEN_TAGE = 120;                  // gleitend: so lange ohne Nutzung gueltig
const TOKEN_MAX_TAGE = 365;              // absolute Hoechstdauer
const TOKENS_MAX = 20;                   // je Profil, aelteste fliegen raus
const PROFILE_MAX = 100;
const GERAETE_MAX = 8;                   // Dateien je Profil
const KOPIEN_TAGE = 14;
const PAPIERKORB_TAGE = 14;
const SPERRE_VERSUCHE = 8;               // falsche Passwoerter je Profil+IP ...
const SPERRE_SEKUNDEN = 900;             // ... in diesem Fenster
const PROFIL_STUNDE_MAX = 30;            // Passwortversuche je Profil, alle IPs, je Stunde
const IP_VIERTELSTUNDE_MAX = 60;         // Anmeldeversuche je IP in 15 min
const ANLEGEN_STUNDE_MAX = 6;            // neue Profile je IP und Stunde
const SCHWACHE_PASSWOERTER = ['12345678', '123456789', '1234567890', 'password', 'passwort', 'passwort1', 'qwertzui', 'qwertyui',
    '11111111', '00000000', 'abcd1234', 'iloveyou', 'lernprogramm', 'architektur'];

function antwort(int $code, array $daten): never { http_response_code($code); echo json_encode($daten, JSON_UNESCAPED_UNICODE); exit; }
function fehler(int $code, string $text): never { antwort($code, ['fehler' => $text]); }

set_exception_handler(function (Throwable $e): void {
    error_log('lernprogramm-api: ' . get_class($e) . ': ' . $e->getMessage());
    if (!headers_sent()) http_response_code(500);
    echo json_encode(['fehler' => 'Serverfehler.']);
});

function konfig(): array {
    // lernprogramm-config/config.php oberhalb dieses Ordners (2-4 Ebenen darueber), damit
    // Live- und Testauftritt dieselbe Datei nutzen.
    $pfad = getenv('LERNPROGRAMM_KONFIG') ?: null;
    for ($ebene = 2; !$pfad && $ebene <= 4; $ebene++) {
        $kandidat = dirname(__DIR__, $ebene) . '/lernprogramm-config/config.php';
        if (is_file($kandidat)) $pfad = $kandidat;
    }
    if (!$pfad || !is_file($pfad)) fehler(503, 'Server nicht eingerichtet.');
    $k = require $pfad;
    return is_array($k) ? $k : fehler(503, 'Server nicht eingerichtet.');
}

function mysql(): bool { return db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'; }

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $k = konfig();
    $pdo = new PDO($k['dsn'], $k['user'] ?? null, $k['pass'] ?? null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    try {
        $pdo->query('SELECT geloescht FROM profile LIMIT 1');
        $pdo->query('SELECT 1 FROM kopien LIMIT 1');
    } catch (PDOException $e) {
        schemaAnlegen($pdo);
    }
    return $pdo;
}

function schemaAnlegen(PDO $pdo): void {
    foreach ([
        'CREATE TABLE IF NOT EXISTS profile (id VARCHAR(64) PRIMARY KEY, name VARCHAR(60) NOT NULL, avatar VARCHAR(40) NOT NULL,
            pw_hash VARCHAR(255) NULL, stufe INT NOT NULL DEFAULT 1, xp INT NOT NULL DEFAULT 0, erstellt BIGINT NOT NULL, aktiv BIGINT NOT NULL,
            geloescht BIGINT NULL)',
        'CREATE TABLE IF NOT EXISTS tokens (hash CHAR(64) PRIMARY KEY, profil_id VARCHAR(64) NOT NULL, geraet VARCHAR(16) NOT NULL,
            erstellt BIGINT NOT NULL, bis BIGINT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS dateien (profil_id VARCHAR(64) NOT NULL, geraet VARCHAR(16) NOT NULL, inhalt MEDIUMTEXT NOT NULL,
            groesse INT NOT NULL DEFAULT 0, geaendert BIGINT NOT NULL, PRIMARY KEY (profil_id, geraet))',
        'CREATE TABLE IF NOT EXISTS kopien (profil_id VARCHAR(64) NOT NULL, geraet VARCHAR(16) NOT NULL, tag CHAR(8) NOT NULL,
            inhalt MEDIUMTEXT NOT NULL, groesse INT NOT NULL DEFAULT 0, PRIMARY KEY (profil_id, geraet, tag))',
        'CREATE TABLE IF NOT EXISTS versuche (schluessel VARCHAR(160) PRIMARY KEY, anzahl INT NOT NULL, bis BIGINT NOT NULL)',
    ] as $sql) $pdo->exec($sql);
    try { $pdo->exec('ALTER TABLE profile ADD COLUMN geloescht BIGINT NULL'); } catch (PDOException $e) { /* gibt es schon */ }
}

// --- Eingabe ------------------------------------------------------------------

function eingabe(): array {
    $roh = file_get_contents('php://input', false, null, 0, MAX_DATEI * 2 + 65536);
    if ($roh === '' || $roh === false) return [];
    $d = json_decode($roh, true, 8);
    return is_array($d) ? $d : fehler(400, 'Kein gueltiges JSON.');
}
function abfrage(string $schluessel): string {
    $w = $_GET[$schluessel] ?? '';
    return is_string($w) ? $w : '';
}
function profilId(mixed $id): string {
    if (!is_string($id) || !preg_match('/^[A-Za-z0-9-]{8,64}$/', $id)) fehler(400, 'Ungueltige Profil-Id.');
    return $id;
}
function geraetId(mixed $g): string {
    if (!is_string($g) || !preg_match('/^[0-9a-f]{8}$/', $g)) fehler(400, 'Ungueltige Geraete-Kennung.');
    return $g;
}
function profilName(mixed $n): string {
    $n = is_string($n) ? trim($n) : '';
    if ($n === '' || mb_strlen($n) > 40 || !preg_match('/^[\p{L}\p{N}][\p{L}\p{N} ._\-]*$/u', $n)) {
        fehler(400, 'Name: 1 bis 40 Zeichen (Buchstaben, Ziffern, Leerzeichen, . _ -).');
    }
    return $n;
}
function avatarName(mixed $a): string {
    if (!is_string($a) || !preg_match('/^[0-9]{2}-[a-z]{2,20}$/', $a)) fehler(400, 'Ungueltiges Profilbild.');
    return $a;
}
function passwortGueltig(mixed $pw): string {
    if (!is_string($pw) || mb_strlen($pw) < 8 || mb_strlen($pw) > 200) fehler(400, 'Passwort: mindestens 8 Zeichen.');
    if (in_array(mb_strtolower($pw), SCHWACHE_PASSWOERTER, true)) fehler(400, 'Dieses Passwort ist zu einfach.');
    return $pw;
}

// --- Passwoerter -----------------------------------------------------------------

// SHA-256 vorweg: hebt die 72-Byte-Grenze von bcrypt auf (laengere Passwoerter
// werden nicht still abgeschnitten).
function pwVor(string $pw): string { return base64_encode(hash('sha256', $pw, true)); }
function pwHash(string $pw): string { return password_hash(pwVor($pw), PASSWORD_DEFAULT); }

// --- Zaehler / Begrenzung ----------------------------------------------------------

function clientIp(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '?';
    if (str_contains($ip, ':')) { // IPv6: auf das /64-Netz kuerzen
        $b = @inet_pton($ip);
        if ($b !== false) return 'v6-' . bin2hex(substr($b, 0, 8));
    }
    return $ip;
}

// Atomar erhoehen (Festfenster), neuen Stand liefern.
function zaehler(string $schluessel, int $fenster): int {
    $jetzt = time();
    $ende = $jetzt + $fenster;
    if (mysql()) {
        db()->prepare('INSERT INTO versuche (schluessel, anzahl, bis) VALUES (?,1,?)
            ON DUPLICATE KEY UPDATE anzahl = IF(bis < ?, 1, anzahl + 1), bis = IF(bis < ?, ?, bis)')
            ->execute([$schluessel, $ende, $jetzt, $jetzt, $ende]);
    } else {
        db()->prepare('INSERT INTO versuche (schluessel, anzahl, bis) VALUES (?,1,?)
            ON CONFLICT(schluessel) DO UPDATE SET anzahl = CASE WHEN bis < ? THEN 1 ELSE anzahl + 1 END,
            bis = CASE WHEN bis < ? THEN ? ELSE bis END')
            ->execute([$schluessel, $ende, $jetzt, $jetzt, $ende]);
    }
    $z = db()->prepare('SELECT anzahl FROM versuche WHERE schluessel = ?');
    $z->execute([$schluessel]);
    return (int)($z->fetchColumn() ?: 1);
}
function begrenzen(string $schluessel, int $limit, int $fenster, string $text = 'Zu viele Versuche. Bitte spaeter erneut probieren.'): void {
    if (zaehler($schluessel, $fenster) > $limit) fehler(429, $text);
}

function passwortPruefen(array $profil, mixed $pw, string $id): void {
    if ($profil['pw_hash'] === null) return;
    begrenzen('g|' . $id, PROFIL_STUNDE_MAX, 3600);
    begrenzen('i|' . clientIp(), IP_VIERTELSTUNDE_MAX, 900);
    $s = 'p|' . $id . '|' . clientIp();
    begrenzen($s, SPERRE_VERSUCHE, SPERRE_SEKUNDEN);
    $ok = false;
    $neuHashen = false;
    if (is_string($pw) && strlen($pw) <= 1000) {
        $ok = password_verify(pwVor($pw), $profil['pw_hash']);
        if (!$ok && password_verify($pw, $profil['pw_hash'])) { $ok = true; $neuHashen = true; } // Altbestand ohne Vorbehandlung
        elseif ($ok && password_needs_rehash($profil['pw_hash'], PASSWORD_DEFAULT)) $neuHashen = true;
    }
    if (!$ok) fehler(403, 'Falsches Passwort.');
    db()->prepare('DELETE FROM versuche WHERE schluessel = ?')->execute([$s]);
    if ($neuHashen) db()->prepare('UPDATE profile SET pw_hash = ? WHERE id = ?')->execute([pwHash($pw), $id]);
}

// --- Profile / Tokens -----------------------------------------------------------------

function profilHolen(string $id): array {
    $z = db()->prepare('SELECT * FROM profile WHERE id = ? AND geloescht IS NULL');
    $z->execute([$id]);
    return $z->fetch() ?: fehler(404, 'Profil nicht gefunden.');
}

function aufraeumen(): void {
    $jetzt = time();
    db()->prepare('DELETE FROM tokens WHERE bis < ? OR erstellt < ?')->execute([$jetzt, $jetzt - TOKEN_MAX_TAGE * 86400]);
    db()->prepare('DELETE FROM versuche WHERE bis < ?')->execute([$jetzt]);
    $z = db()->prepare('SELECT id FROM profile WHERE geloescht IS NOT NULL AND geloescht < ?');
    $z->execute([$jetzt - PAPIERKORB_TAGE * 86400]);
    foreach ($z->fetchAll() as $p) {
        foreach (['dateien', 'kopien', 'tokens'] as $t) db()->prepare("DELETE FROM $t WHERE profil_id = ?")->execute([$p['id']]);
        db()->prepare('DELETE FROM profile WHERE id = ?')->execute([$p['id']]);
    }
}

function neuerToken(string $profil, string $geraet): string {
    aufraeumen();
    $z = db()->prepare('SELECT hash FROM tokens WHERE profil_id = ? ORDER BY erstellt ASC');
    $z->execute([$profil]);
    $alle = $z->fetchAll();
    for ($i = 0; $i < count($alle) - (TOKENS_MAX - 1); $i++) {
        db()->prepare('DELETE FROM tokens WHERE hash = ?')->execute([$alle[$i]['hash']]);
    }
    $token = bin2hex(random_bytes(32));
    $jetzt = time();
    db()->prepare('INSERT INTO tokens (hash, profil_id, geraet, erstellt, bis) VALUES (?,?,?,?,?)')
        ->execute([hash('sha256', $token), $profil, $geraet, $jetzt, $jetzt + TOKEN_TAGE * 86400]);
    return $token;
}

// Prueft den Token (Kopfzeile X-Token); liefert [profilId, tokenHash, geraet].
function angemeldet(): array {
    $token = $_SERVER['HTTP_X_TOKEN'] ?? '';
    if (!is_string($token) || !preg_match('/^[0-9a-f]{64}$/', $token)) fehler(401, 'Nicht angemeldet.');
    $h = hash('sha256', $token);
    $z = db()->prepare('SELECT t.profil_id, t.geraet, t.bis, t.erstellt FROM tokens t JOIN profile p ON p.id = t.profil_id
        WHERE t.hash = ? AND p.geloescht IS NULL');
    $z->execute([$h]);
    $t = $z->fetch();
    $jetzt = time();
    if (!$t || (int)$t['bis'] < $jetzt || (int)$t['erstellt'] < $jetzt - TOKEN_MAX_TAGE * 86400) fehler(401, 'Anmeldung abgelaufen.');
    if ((int)$t['bis'] < $jetzt + (TOKEN_TAGE - 1) * 86400) {
        db()->prepare('UPDATE tokens SET bis = ? WHERE hash = ?')->execute([$jetzt + TOKEN_TAGE * 86400, $h]);
    }
    db()->prepare('UPDATE profile SET aktiv = ? WHERE id = ? AND aktiv < ?')->execute([$jetzt, $t['profil_id'], $jetzt - 3600]);
    return [$t['profil_id'], $h, $t['geraet']];
}

function eigenesGeraet(array $d, string $tokenGeraet): string {
    $g = geraetId($d['geraet'] ?? null);
    if ($g !== $tokenGeraet) fehler(403, 'Nur die eigene Geraetedatei darf geaendert werden.');
    return $g;
}

// --- Anfrage ----------------------------------------------------------------------------

$a = abfrage('a');
$methode = $_SERVER['REQUEST_METHOD'] ?? '';
if ($methode !== 'GET' && $methode !== 'POST') fehler(405, 'Nur GET und POST.');
// Fremde Seiten ausschliessen (Browser senden Sec-Fetch-Site mit), zusaetzlich zur
// eigenen Kopfzeile bei POST: nicht-einfache Kopfzeilen loesen eine Vorabfrage aus,
// die dieser Server nie bestaetigt (kein CORS).
$sf = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
if ($sf !== '' && $sf !== 'same-origin' && $sf !== 'none') fehler(403, 'Nicht erlaubt.');
if ($methode === 'POST' && ($_SERVER['HTTP_X_LERNPROGRAMM'] ?? '') !== '1') fehler(400, 'Kopfzeile fehlt.');

switch ($a) {
    case 'profile': // oeffentlich: Anmeldebildschirm (nur Id, Name, Bild, Stufe, Passwort ja/nein)
        $z = db()->query('SELECT id, name, avatar, stufe, (pw_hash IS NOT NULL) AS pw FROM profile WHERE geloescht IS NULL ORDER BY aktiv DESC');
        antwort(200, ['profile' => array_map(fn($p) => [
            'id' => $p['id'], 'name' => $p['name'], 'avatar' => $p['avatar'], 'stufe' => (int)$p['stufe'], 'passwort' => (bool)$p['pw'],
        ], $z->fetchAll())]);

    case 'anlegen':
        $d = eingabe();
        begrenzen('a|' . clientIp(), ANLEGEN_STUNDE_MAX, 3600, 'Zu viele neue Profile von dieser Adresse. Bitte spaeter erneut probieren.');
        $z = db()->query('SELECT COUNT(*) FROM profile WHERE geloescht IS NULL');
        if ((int)$z->fetchColumn() >= PROFILE_MAX) fehler(403, 'Die Profilgrenze ist erreicht.');
        $id = profilId($d['id'] ?? bin2hex(random_bytes(16)));
        $name = profilName($d['name'] ?? null);
        $avatar = avatarName($d['avatar'] ?? '01-haus');
        $pw = (array_key_exists('passwort', $d) && $d['passwort'] !== null) ? pwHash(passwortGueltig($d['passwort'])) : null;
        $geraet = geraetId($d['geraet'] ?? null);
        $z = db()->prepare('SELECT 1 FROM profile WHERE id = ? OR (geloescht IS NULL AND LOWER(name) = LOWER(?))');
        $z->execute([$id, $name]);
        if ($z->fetch()) fehler(409, 'Profil oder Name gibt es schon.');
        db()->prepare('INSERT INTO profile (id, name, avatar, pw_hash, erstellt, aktiv) VALUES (?,?,?,?,?,?)')
            ->execute([$id, $name, $avatar, $pw, time(), time()]);
        antwort(200, ['id' => $id, 'token' => neuerToken($id, $geraet)]);

    case 'anmelden':
        $d = eingabe();
        $id = profilId($d['id'] ?? null);
        $geraet = geraetId($d['geraet'] ?? null);
        begrenzen('i|' . clientIp(), IP_VIERTELSTUNDE_MAX, 900);
        $p = profilHolen($id);
        passwortPruefen($p, $d['passwort'] ?? null, $id);
        antwort(200, ['token' => neuerToken($id, $geraet)]);

    case 'abmelden':
        [, $h] = angemeldet();
        db()->prepare('DELETE FROM tokens WHERE hash = ?')->execute([$h]);
        antwort(200, ['ok' => true]);

    case 'meta': // Name, Bild und Level (Level meldet das Geraet)
        [$id] = angemeldet();
        $d = eingabe();
        if (isset($d['stufe'], $d['xp'])) {
            db()->prepare('UPDATE profile SET stufe = ?, xp = ? WHERE id = ?')
                ->execute([max(1, min(999, (int)$d['stufe'])), max(0, min(100000000, (int)$d['xp'])), $id]);
        }
        if (isset($d['avatar'])) db()->prepare('UPDATE profile SET avatar = ? WHERE id = ?')->execute([avatarName($d['avatar']), $id]);
        if (isset($d['name'])) {
            $n = profilName($d['name']);
            $z = db()->prepare('SELECT 1 FROM profile WHERE geloescht IS NULL AND LOWER(name) = LOWER(?) AND id <> ?');
            $z->execute([$n, $id]);
            if ($z->fetch()) fehler(409, 'Diesen Namen gibt es schon.');
            db()->prepare('UPDATE profile SET name = ? WHERE id = ?')->execute([$n, $id]);
        }
        antwort(200, ['ok' => true]);

    case 'passwort': // setzen, aendern (alt noetig, falls vorhanden) oder entfernen (neu = null)
        [$id, $h] = angemeldet();
        $d = eingabe();
        $p = profilHolen($id);
        passwortPruefen($p, $d['alt'] ?? null, $id);
        $neu = ($d['neu'] ?? null) === null ? null : pwHash(passwortGueltig($d['neu']));
        db()->prepare('UPDATE profile SET pw_hash = ? WHERE id = ?')->execute([$neu, $id]);
        // Alle anderen Anmeldungen (andere Geraete, gestohlene Tokens) verfallen.
        db()->prepare('DELETE FROM tokens WHERE profil_id = ? AND hash <> ?')->execute([$id, $h]);
        antwort(200, ['ok' => true, 'passwort' => $neu !== null]);

    case 'dateien': // Abgleich: Geraetedateien dieses Profils
        [$id] = angemeldet();
        $z = db()->prepare('SELECT geraet, geaendert, groesse FROM dateien WHERE profil_id = ?');
        $z->execute([$id]);
        antwort(200, ['dateien' => $z->fetchAll()]);

    case 'datei':
        [$id] = angemeldet();
        $z = db()->prepare('SELECT inhalt, geaendert FROM dateien WHERE profil_id = ? AND geraet = ?');
        $z->execute([$id, geraetId(abfrage('geraet'))]);
        $r = $z->fetch() ?: fehler(404, 'Datei nicht gefunden.');
        antwort(200, ['text' => $r['inhalt'], 'geaendert' => (int)$r['geaendert']]);

    case 'hochladen':
        [$id, , $tokenGeraet] = angemeldet();
        $d = eingabe();
        $g = eigenesGeraet($d, $tokenGeraet);
        $text = $d['text'] ?? null;
        if (!is_string($text) || strlen($text) > MAX_DATEI || !json_validate($text)) fehler(400, 'Datei ungueltig oder zu gross.');
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $sperre = mysql() ? ' FOR UPDATE' : '';
            $z = $pdo->prepare('SELECT inhalt, groesse FROM dateien WHERE profil_id = ? AND geraet = ?' . $sperre);
            $z->execute([$id, $g]);
            $alt = $z->fetch();
            if (!$alt) {
                $z = $pdo->prepare('SELECT COUNT(*) FROM dateien WHERE profil_id = ?');
                $z->execute([$id]);
                if ((int)$z->fetchColumn() >= GERAETE_MAX) fehler(403, 'Zu viele Geraete fuer dieses Profil.');
            }
            $z = $pdo->prepare('SELECT (SELECT COALESCE(SUM(groesse),0) FROM dateien WHERE profil_id = ?) + (SELECT COALESCE(SUM(groesse),0) FROM kopien WHERE profil_id = ?)');
            $z->execute([$id, $id]);
            if ((int)$z->fetchColumn() + strlen($text) > MAX_PROFIL_BYTES) fehler(413, 'Speichergrenze dieses Profils erreicht.');
            // Tageskopie: beim ersten Hochladen des Tages den bisherigen Stand (von gestern) sichern.
            $heute = gmdate('Ymd');
            if ($alt) {
                $z = $pdo->prepare('SELECT 1 FROM kopien WHERE profil_id = ? AND geraet = ? AND tag = ?');
                $z->execute([$id, $g, $heute]);
                if (!$z->fetch()) {
                    $pdo->prepare('INSERT INTO kopien (profil_id, geraet, tag, inhalt, groesse) VALUES (?,?,?,?,?)')
                        ->execute([$id, $g, $heute, $alt['inhalt'], (int)$alt['groesse']]);
                }
            }
            $pdo->prepare('DELETE FROM kopien WHERE profil_id = ? AND geraet = ? AND tag < ?')
                ->execute([$id, $g, gmdate('Ymd', time() - KOPIEN_TAGE * 86400)]);
            $pdo->prepare('DELETE FROM dateien WHERE profil_id = ? AND geraet = ?')->execute([$id, $g]);
            $jetzt = time();
            $pdo->prepare('INSERT INTO dateien (profil_id, geraet, inhalt, groesse, geaendert) VALUES (?,?,?,?,?)')
                ->execute([$id, $g, $text, strlen($text), $jetzt]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        antwort(200, ['ok' => true, 'geaendert' => $jetzt, 'groesse' => strlen($text)]);

    case 'kopien':
        [$id] = angemeldet();
        $z = db()->prepare('SELECT geraet, tag, groesse FROM kopien WHERE profil_id = ? ORDER BY tag DESC');
        $z->execute([$id]);
        antwort(200, ['kopien' => $z->fetchAll()]);

    case 'kopie':
        [$id] = angemeldet();
        $tag = abfrage('tag');
        if (!preg_match('/^[0-9]{8}$/', $tag)) fehler(400, 'Ungueltiger Tag.');
        $z = db()->prepare('SELECT inhalt FROM kopien WHERE profil_id = ? AND geraet = ? AND tag = ?');
        $z->execute([$id, geraetId(abfrage('geraet')), $tag]);
        $r = $z->fetch() ?: fehler(404, 'Kopie nicht gefunden.');
        antwort(200, ['text' => $r['inhalt']]);

    case 'dateiLoeschen':
        [$id, , $tokenGeraet] = angemeldet();
        $d = eingabe();
        db()->prepare('DELETE FROM dateien WHERE profil_id = ? AND geraet = ?')->execute([$id, eigenesGeraet($d, $tokenGeraet)]);
        antwort(200, ['ok' => true]);

    case 'profilLoeschen': // Papierkorb: 14 Tage zurueckholbar (phpMyAdmin: profile.geloescht auf NULL setzen)
        [$id] = angemeldet();
        $d = eingabe();
        passwortPruefen(profilHolen($id), $d['passwort'] ?? null, $id);
        db()->prepare('UPDATE profile SET geloescht = ? WHERE id = ?')->execute([time(), $id]);
        db()->prepare('DELETE FROM tokens WHERE profil_id = ?')->execute([$id]);
        antwort(200, ['ok' => true]);

    default:
        fehler(404, 'Unbekannte Aktion.');
}
