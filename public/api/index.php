<?php
// Profil-Server (Entwurf, Zweig server-profile, noch nicht live).
// Eine Datei, JSON ueber HTTPS, Aufruf: api/index.php?a=<aktion>
// Zugangsdaten NICHT hier, sondern in ../../lernprogramm-config/config.php
// (oberhalb des Webverzeichnisses; Vorlage: docs/serverprofile/config.beispiel.php).
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const MAX_DATEI = 12 * 1024 * 1024;   // eine Geraetedatei
const TOKEN_TAGE = 365;               // "angemeldet bleiben", gleitend
const SPERRE_VERSUCHE = 6;            // falsche Passwoerter je Profil+IP
const SPERRE_SEKUNDEN = 900;
const KOPIEN_TAGE = 14;               // Tageskopien je Profil und Geraet

function antwort(int $code, array $daten): never { http_response_code($code); echo json_encode($daten, JSON_UNESCAPED_UNICODE); exit; }
function fehler(int $code, string $text): never { antwort($code, ['fehler' => $text]); }

function konfig(): array {
    // Gesucht wird lernprogramm-config/config.php oberhalb dieses Ordners
    // (1-3 Ebenen darueber), damit Live- und Testauftritt dieselbe Datei nutzen.
    $pfad = getenv('LERNPROGRAMM_KONFIG') ?: null;
    for ($ebene = 2; !$pfad && $ebene <= 4; $ebene++) {
        $kandidat = dirname(__DIR__, $ebene) . '/lernprogramm-config/config.php';
        if (is_file($kandidat)) $pfad = $kandidat;
    }
    if (!$pfad || !is_file($pfad)) fehler(503, 'Server nicht eingerichtet (config.php fehlt).');
    $k = require $pfad;
    return is_array($k) ? $k : fehler(503, 'config.php ungueltig.');
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $k = konfig();
    $pdo = new PDO($k['dsn'], $k['user'] ?? null, $k['pass'] ?? null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    foreach ([
        'CREATE TABLE IF NOT EXISTS profile (id VARCHAR(64) PRIMARY KEY, name VARCHAR(60) NOT NULL, avatar VARCHAR(40) NOT NULL,
            pw_hash VARCHAR(255) NULL, stufe INT NOT NULL DEFAULT 1, xp INT NOT NULL DEFAULT 0, erstellt BIGINT NOT NULL, aktiv BIGINT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS tokens (hash CHAR(64) PRIMARY KEY, profil_id VARCHAR(64) NOT NULL, geraet VARCHAR(16) NOT NULL,
            erstellt BIGINT NOT NULL, bis BIGINT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS dateien (profil_id VARCHAR(64) NOT NULL, geraet VARCHAR(16) NOT NULL, inhalt MEDIUMTEXT NOT NULL,
            groesse INT NOT NULL DEFAULT 0, geaendert BIGINT NOT NULL, PRIMARY KEY (profil_id, geraet))',
        'CREATE TABLE IF NOT EXISTS kopien (profil_id VARCHAR(64) NOT NULL, geraet VARCHAR(16) NOT NULL, tag CHAR(8) NOT NULL,
            inhalt MEDIUMTEXT NOT NULL, groesse INT NOT NULL DEFAULT 0, PRIMARY KEY (profil_id, geraet, tag))',
        'CREATE TABLE IF NOT EXISTS versuche (schluessel VARCHAR(120) PRIMARY KEY, anzahl INT NOT NULL, bis BIGINT NOT NULL)',
    ] as $sql) $pdo->exec($sql);
    return $pdo;
}

function eingabe(): array {
    $roh = file_get_contents('php://input', false, null, 0, MAX_DATEI + 4096);
    if ($roh === '' || $roh === false) return [];
    $d = json_decode($roh, true);
    return is_array($d) ? $d : fehler(400, 'Kein gueltiges JSON.');
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
    if ($n === '' || mb_strlen($n) > 40) fehler(400, 'Name fehlt oder ist zu lang (max. 40 Zeichen).');
    return $n;
}
function avatarName(mixed $a): string {
    if (!is_string($a) || !preg_match('/^[0-9]{2}-[a-z]{2,20}$/', $a)) fehler(400, 'Ungueltiges Profilbild.');
    return $a;
}

function neuerToken(string $profil, string $geraet): string {
    $token = bin2hex(random_bytes(32));
    $jetzt = time();
    db()->prepare('INSERT INTO tokens (hash, profil_id, geraet, erstellt, bis) VALUES (?,?,?,?,?)')
        ->execute([hash('sha256', $token), $profil, $geraet, $jetzt, $jetzt + TOKEN_TAGE * 86400]);
    return $token;
}

// Prueft den Token (Kopfzeile X-Token) und liefert [profilId, tokenHash].
function angemeldet(): array {
    $token = $_SERVER['HTTP_X_TOKEN'] ?? '';
    if (!preg_match('/^[0-9a-f]{64}$/', $token)) fehler(401, 'Nicht angemeldet.');
    $h = hash('sha256', $token);
    $z = db()->prepare('SELECT profil_id, bis FROM tokens WHERE hash = ?');
    $z->execute([$h]);
    $t = $z->fetch();
    if (!$t || (int)$t['bis'] < time()) fehler(401, 'Anmeldung abgelaufen.');
    db()->prepare('UPDATE tokens SET bis = ? WHERE hash = ?')->execute([time() + TOKEN_TAGE * 86400, $h]);
    db()->prepare('UPDATE profile SET aktiv = ? WHERE id = ?')->execute([time(), $t['profil_id']]);
    return [$t['profil_id'], $h];
}

function sperrePruefen(string $profil): string {
    $schluessel = $profil . '|' . ($_SERVER['REMOTE_ADDR'] ?? '?');
    $z = db()->prepare('SELECT anzahl, bis FROM versuche WHERE schluessel = ?');
    $z->execute([$schluessel]);
    $v = $z->fetch();
    if ($v && (int)$v['bis'] > time() && (int)$v['anzahl'] >= SPERRE_VERSUCHE) {
        fehler(429, 'Zu viele Versuche. Bitte in ein paar Minuten erneut probieren.');
    }
    return $schluessel;
}
function versuchZaehlen(string $schluessel, bool $erfolg): void {
    if ($erfolg) { db()->prepare('DELETE FROM versuche WHERE schluessel = ?')->execute([$schluessel]); return; }
    $z = db()->prepare('SELECT anzahl, bis FROM versuche WHERE schluessel = ?');
    $z->execute([$schluessel]);
    $v = $z->fetch();
    $n = ($v && (int)$v['bis'] > time()) ? (int)$v['anzahl'] + 1 : 1;
    db()->prepare('DELETE FROM versuche WHERE schluessel = ?')->execute([$schluessel]);
    db()->prepare('INSERT INTO versuche (schluessel, anzahl, bis) VALUES (?,?,?)')->execute([$schluessel, $n, time() + SPERRE_SEKUNDEN]);
}

function passwortPruefen(array $profil, mixed $pw, string $profilId): void {
    if ($profil['pw_hash'] === null) return;
    $s = sperrePruefen($profilId);
    $ok = is_string($pw) && password_verify($pw, $profil['pw_hash']);
    versuchZaehlen($s, $ok);
    if (!$ok) fehler(403, 'Falsches Passwort.');
}
function passwortGueltig(mixed $pw): string {
    if (!is_string($pw) || mb_strlen($pw) < 6 || mb_strlen($pw) > 200) fehler(400, 'Passwort: mindestens 6 Zeichen.');
    return $pw;
}
function profilHolen(string $id): array {
    $z = db()->prepare('SELECT * FROM profile WHERE id = ?');
    $z->execute([$id]);
    return $z->fetch() ?: fehler(404, 'Profil nicht gefunden.');
}

$a = $_GET['a'] ?? '';
$methode = $_SERVER['REQUEST_METHOD'];
if ($methode !== 'GET' && $methode !== 'POST') fehler(405, 'Nur GET und POST.');
// CSRF-Schutz: Fremdseiten koennen diese Kopfzeile nicht ohne Vorabfrage setzen.
if ($methode === 'POST' && ($_SERVER['HTTP_X_LERNPROGRAMM'] ?? '') !== '1') fehler(400, 'Kopfzeile X-Lernprogramm fehlt.');

try {
    switch ($a) {
        case 'profile': // oeffentlich: Anmeldebildschirm
            $z = db()->query('SELECT id, name, avatar, stufe, xp, (pw_hash IS NOT NULL) AS pw, aktiv FROM profile ORDER BY aktiv DESC');
            antwort(200, ['profile' => array_map(fn($p) => [
                'id' => $p['id'], 'name' => $p['name'], 'avatar' => $p['avatar'],
                'stufe' => (int)$p['stufe'], 'xp' => (int)$p['xp'], 'passwort' => (bool)$p['pw'], 'aktiv' => (int)$p['aktiv'],
            ], $z->fetchAll())]);

        case 'anlegen':
            $d = eingabe();
            $id = profilId($d['id'] ?? bin2hex(random_bytes(16)));
            $name = profilName($d['name'] ?? null);
            $avatar = avatarName($d['avatar'] ?? '01-haus');
            $pw = (array_key_exists('passwort', $d) && $d['passwort'] !== null) ? password_hash(passwortGueltig($d['passwort']), PASSWORD_DEFAULT) : null;
            $z = db()->prepare('SELECT 1 FROM profile WHERE id = ? OR LOWER(name) = LOWER(?)');
            $z->execute([$id, $name]);
            if ($z->fetch()) fehler(409, 'Profil oder Name gibt es schon.');
            db()->prepare('INSERT INTO profile (id, name, avatar, pw_hash, erstellt, aktiv) VALUES (?,?,?,?,?,?)')
                ->execute([$id, $name, $avatar, $pw, time(), time()]);
            antwort(200, ['id' => $id, 'token' => neuerToken($id, geraetId($d['geraet'] ?? null))]);

        case 'anmelden':
            $d = eingabe();
            $id = profilId($d['id'] ?? null);
            $p = profilHolen($id);
            passwortPruefen($p, $d['passwort'] ?? null, $id);
            antwort(200, ['token' => neuerToken($id, geraetId($d['geraet'] ?? null))]);

        case 'abmelden':
            [, $h] = angemeldet();
            db()->prepare('DELETE FROM tokens WHERE hash = ?')->execute([$h]);
            antwort(200, ['ok' => true]);

        case 'meta': // Name, Bild und Level aktualisieren (Level kommt vom Geraet)
            [$id] = angemeldet();
            $d = eingabe();
            if (isset($d['stufe'], $d['xp'])) {
                db()->prepare('UPDATE profile SET stufe = ?, xp = ? WHERE id = ?')->execute([max(1, min(999, (int)$d['stufe'])), max(0, (int)$d['xp']), $id]);
            }
            if (isset($d['avatar'])) db()->prepare('UPDATE profile SET avatar = ? WHERE id = ?')->execute([avatarName($d['avatar']), $id]);
            if (isset($d['name'])) {
                $n = profilName($d['name']);
                $z = db()->prepare('SELECT 1 FROM profile WHERE LOWER(name) = LOWER(?) AND id <> ?');
                $z->execute([$n, $id]);
                if ($z->fetch()) fehler(409, 'Diesen Namen gibt es schon.');
                db()->prepare('UPDATE profile SET name = ? WHERE id = ?')->execute([$n, $id]);
            }
            antwort(200, ['ok' => true]);

        case 'passwort': // setzen, aendern (alt noetig, falls vorhanden) oder entfernen (neu = null)
            [$id] = angemeldet();
            $d = eingabe();
            $p = profilHolen($id);
            passwortPruefen($p, $d['alt'] ?? null, $id);
            $neu = ($d['neu'] ?? null) === null ? null : password_hash(passwortGueltig($d['neu']), PASSWORD_DEFAULT);
            db()->prepare('UPDATE profile SET pw_hash = ? WHERE id = ?')->execute([$neu, $id]);
            antwort(200, ['ok' => true, 'passwort' => $neu !== null]);

        case 'dateien': // Abgleich: Liste der Geraetedateien dieses Profils
            [$id] = angemeldet();
            $z = db()->prepare('SELECT geraet, geaendert, groesse FROM dateien WHERE profil_id = ?');
            $z->execute([$id]);
            antwort(200, ['dateien' => $z->fetchAll()]);

        case 'datei':
            [$id] = angemeldet();
            $g = geraetId($_GET['geraet'] ?? null);
            $z = db()->prepare('SELECT inhalt, geaendert FROM dateien WHERE profil_id = ? AND geraet = ?');
            $z->execute([$id, $g]);
            $r = $z->fetch() ?: fehler(404, 'Datei nicht gefunden.');
            antwort(200, ['text' => $r['inhalt'], 'geaendert' => (int)$r['geaendert']]);

        case 'hochladen':
            [$id] = angemeldet();
            $d = eingabe();
            $g = geraetId($d['geraet'] ?? null);
            $text = $d['text'] ?? null;
            if (!is_string($text) || strlen($text) > MAX_DATEI || json_decode($text) === null) fehler(400, 'Datei ungueltig oder zu gross.');
            db()->beginTransaction();
            // Tageskopie: beim ersten Hochladen des Tages den bisherigen Stand (also den
            // von gestern) sichern - ein heutiger Fehler oder "Fortschritt loeschen"
            // kann ihn so nicht mehr erreichen.
            $heute = gmdate('Ymd');
            $z = db()->prepare('SELECT inhalt, groesse FROM dateien WHERE profil_id = ? AND geraet = ?');
            $z->execute([$id, $g]);
            $alt = $z->fetch();
            if ($alt) {
                $z = db()->prepare('SELECT 1 FROM kopien WHERE profil_id = ? AND geraet = ? AND tag = ?');
                $z->execute([$id, $g, $heute]);
                if (!$z->fetch()) {
                    db()->prepare('INSERT INTO kopien (profil_id, geraet, tag, inhalt, groesse) VALUES (?,?,?,?,?)')->execute([$id, $g, $heute, $alt['inhalt'], (int)$alt['groesse']]);
                }
            }
            db()->prepare('DELETE FROM kopien WHERE profil_id = ? AND geraet = ? AND tag < ?')->execute([$id, $g, gmdate('Ymd', time() - KOPIEN_TAGE * 86400)]);
            db()->prepare('DELETE FROM dateien WHERE profil_id = ? AND geraet = ?')->execute([$id, $g]);
            $jetzt = time();
            db()->prepare('INSERT INTO dateien (profil_id, geraet, inhalt, groesse, geaendert) VALUES (?,?,?,?,?)')->execute([$id, $g, $text, strlen($text), $jetzt]);
            db()->commit();
            antwort(200, ['ok' => true, 'geaendert' => $jetzt, 'groesse' => strlen($text)]);

        case 'kopien':
            [$id] = angemeldet();
            $z = db()->prepare('SELECT geraet, tag, groesse FROM kopien WHERE profil_id = ? ORDER BY tag DESC');
            $z->execute([$id]);
            antwort(200, ['kopien' => $z->fetchAll()]);

        case 'kopie':
            [$id] = angemeldet();
            $tag = $_GET['tag'] ?? '';
            if (!preg_match('/^[0-9]{8}$/', $tag)) fehler(400, 'Ungueltiger Tag.');
            $z = db()->prepare('SELECT inhalt FROM kopien WHERE profil_id = ? AND geraet = ? AND tag = ?');
            $z->execute([$id, geraetId($_GET['geraet'] ?? null), $tag]);
            $r = $z->fetch() ?: fehler(404, 'Kopie nicht gefunden.');
            antwort(200, ['text' => $r['inhalt']]);

        case 'dateiLoeschen':
            [$id] = angemeldet();
            $d = eingabe();
            db()->prepare('DELETE FROM dateien WHERE profil_id = ? AND geraet = ?')->execute([$id, geraetId($d['geraet'] ?? null)]);
            antwort(200, ['ok' => true]);

        case 'profilLoeschen':
            [$id] = angemeldet();
            $d = eingabe();
            passwortPruefen(profilHolen($id), $d['passwort'] ?? null, $id);
            foreach (['dateien', 'kopien', 'tokens'] as $t) db()->prepare("DELETE FROM $t WHERE profil_id = ?")->execute([$id]);
            db()->prepare('DELETE FROM profile WHERE id = ?')->execute([$id]);
            antwort(200, ['ok' => true]);

        default:
            fehler(404, 'Unbekannte Aktion.');
    }
} catch (PDOException $e) {
    if (db()->inTransaction()) db()->rollBack();
    error_log('lernprogramm-api: ' . $e->getMessage());
    fehler(500, 'Datenbankfehler.');
}
