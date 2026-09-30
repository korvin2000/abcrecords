<?php
/**
 * КОДЕКС ГИТАРИСТОВ — client error sink.
 * =========================================================================
 * One file, no database, no required extensions. Written for PHP 7.3.
 * Uploaded to /api/log.php.
 *
 * WHY IT EXISTS
 * -------------
 * The failures worth hearing about happen in browsers nobody on the project
 * owns: an old phone whose engine lacks a built-in the PDF viewer needs, a
 * chunk that will not load behind some proxy. The app reports such a failure
 * with one small POST (`navigator.sendBeacon`, a JSON string as text/plain);
 * this script keeps it as one JSON line in `log-data/client-errors.log`.
 *
 * PRIVACY
 * -------
 * No cookies and no IP addresses are stored. A line holds the server time,
 * the report's own fields (what failed, the engine's message, the page's
 * hash, the UI language) and the browser's User-Agent string — which is the
 * point: it names the engine that failed. For rate limiting only, a visitor
 * is keyed in APCu by the first 8 hex digits of
 * sha256(secret + date + IP); that key is never written anywhere.
 *
 * API
 * ---
 *   POST (any Content-Type), body = a JSON object of at most 4096 bytes:
 *        {"where":…, "name":…, "message":…, "page":…, "lang":…,
 *         "extra":{ up to 8 short scalar values }}
 *        204 stored · 400 not a report · 413 too large · 429 too many
 *   GET ?a=selftest
 *        Diagnostics: permissions, locking, APCu. Records nothing.
 *
 * INSTALLATION: see README.md next to this file.
 */

declare(strict_types=1);

/* ==========================================================================
   CONFIGURATION — the only part meant to be edited.
   ========================================================================== */

$CONFIG = array(
    /* Where the log lives. Keep it outside the web root if you like
       ('/home/you/log-data'); it is created on first use either way. */
    'data_dir' => __DIR__ . '/log-data',

    /* Any long random string. Used only to derive the in-memory rate-limit
       key; nothing derived from it is written to disk. */
    'secret' => 'CHANGE-THIS-TO-A-LONG-RANDOM-STRING-7b3d90',

    /* The timezone of the timestamp on each line. */
    'timezone' => 'Europe/Berlin',

    /* Largest accepted request body (bytes). */
    'max_body' => 4096,

    /* Reports accepted per visitor per minute, and from everyone together per
       minute. Both need APCu; without it only the size caps apply. */
    'per_visitor_per_minute' => 10,
    'global_per_minute' => 120,

    /* Leave this false unless the site sits behind a proxy or CDN you control
       (Cloudflare, a load balancer): only then do X-Forwarded-For and its
       kin say anything true. Trusted from an ordinary client they are a way
       to claim a fresh allowance with every request. With false, the limit
       keys on the connecting address alone. */
    'trust_proxy_headers' => false,

    /* When the log grows past this many bytes it is renamed to
       client-errors.log.1 (replacing the previous one) and a new one begins.
       At most twice this is ever kept. */
    'rotate_bytes' => 524288,

    /* Browsers may post from these origins as well as from the site itself.
       The two localhost entries are the Vite dev server; drop them once you
       are done testing. */
    'allow_origins' => array(
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ),
);

/* ==========================================================================
   Everything below is the implementation.
   ========================================================================== */

final class ClientErrorLog
{
    const LOG_NAME = 'client-errors.log';

    /** Accepted report fields and their length caps, in characters. */
    const FIELDS = array(
        'where' => 40,
        'name' => 80,
        'message' => 300,
        'page' => 200,
        'lang' => 8,
    );

    const EXTRA_MAX_KEYS = 8;
    const EXTRA_KEY_LEN = 24;
    const EXTRA_VALUE_LEN = 80;
    const UA_LEN = 300;

    /** @var array */
    private $cfg;
    /** @var string */
    private $dir;
    /** @var DateTimeZone */
    private $tz;

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
        $this->dir = rtrim((string) $cfg['data_dir'], '/\\');
        $this->tz = new DateTimeZone((string) $cfg['timezone']);
    }

    /* ---------------------------------------------------------- dispatch */

    public function handle(): void
    {
        try {
            $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';

            if ($method === 'OPTIONS') {
                $this->preflight();
                return;
            }

            $this->sendHeaders();

            if ($method === 'GET' && $this->query('a') === 'selftest') {
                $this->respond(200, $this->actionSelftest());
                return;
            }
            if ($method !== 'POST') {
                header('Allow: POST, OPTIONS');
                $this->respond(405, array('error' => 'method not allowed'));
                return;
            }

            $this->actionReport();
        } catch (Throwable $e) {
            error_log('[log] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            $this->respond(500, array('error' => 'internal error'));
        }
    }

    private function sendHeaders(): void
    {
        header('Cache-Control: no-store, max-age=0');
        header('X-Content-Type-Options: nosniff');

        $origin = $this->allowedOrigin();
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }

    /** CORS preflight: nothing to read, nothing to record. */
    private function preflight(): void
    {
        $origin = $this->allowedOrigin();
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Methods: POST, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type');
            header('Access-Control-Max-Age: 86400');
            header('Vary: Origin');
        }
        header('Allow: POST, OPTIONS');
        http_response_code(204);
    }

    private function allowedOrigin(): string
    {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
        return ($origin !== '' && in_array($origin, $this->cfg['allow_origins'], true)) ? $origin : '';
    }

    private function respond(int $status, array $body): void
    {
        http_response_code($status);
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /* ------------------------------------------------------------ actions */

    /**
     * One report: size first (cheapest), then the rate limits, then the
     * shape. Only a sanitized copy of the known fields is ever written.
     */
    private function actionReport(): void
    {
        $max = (int) $this->cfg['max_body'];

        $declared = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
        if ($declared > $max) {
            $this->respond(413, array('error' => 'too large'));
            return;
        }
        $body = file_get_contents('php://input', false, null, 0, $max + 1);
        if (!is_string($body)) {
            $body = '';
        }
        if (strlen($body) > $max) {
            $this->respond(413, array('error' => 'too large'));
            return;
        }

        $ua = isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
        if ($this->rateLimited($ua)) {
            header('Retry-After: 60');
            $this->respond(429, array('error' => 'too many reports'));
            return;
        }

        $record = $this->sanitize($body, $ua);
        if ($record === null) {
            $this->respond(400, array('error' => 'invalid report'));
            return;
        }

        $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($line === false) {
            throw new RuntimeException('json_encode failed: ' . json_last_error_msg());
        }
        if (!$this->append($line . "\n")) {
            throw new RuntimeException('could not append to the client error log');
        }

        http_response_code(204);
    }

    /**
     * Everything an installation can get wrong, reported as plain values.
     * Writes and removes one probe file; never touches the log. No paths.
     */
    private function actionSelftest(): array
    {
        $c = array();
        $c['php_version'] = PHP_VERSION;
        $c['php_ok'] = version_compare(PHP_VERSION, '7.2.0', '>=');
        $c['secret_changed'] = strpos((string) $this->cfg['secret'], 'CHANGE-THIS') === false;
        $c['timezone'] = (string) $this->cfg['timezone'];
        $c['apcu'] = $this->apcu();
        $c['rate_limit'] = $this->apcu() ? 'per visitor and global' : 'off (no APCu) — size caps only';

        $this->ensureDir();
        $c['data_dir_exists'] = is_dir($this->dir);
        $c['data_dir_writable'] = is_dir($this->dir) && is_writable($this->dir);

        $probe = $this->dir . '/selftest.tmp';
        $wrote = $c['data_dir_exists'] && @file_put_contents($probe, 'probe') !== false;
        $c['write_probe'] = $wrote;
        $handle = $wrote ? @fopen($probe, 'c') : false;
        $c['flock'] = is_resource($handle) && @flock($handle, LOCK_EX | LOCK_NB);
        if (is_resource($handle)) {
            @flock($handle, LOCK_UN);
            fclose($handle);
        }
        // rename() is what rotation relies on.
        $c['atomic_rename'] = $wrote && @rename($probe, $probe . '2') && @unlink($probe . '2');
        @unlink($probe);

        $log = $this->dir . '/' . self::LOG_NAME;
        clearstatcache();
        $c['log_bytes'] = is_file($log) ? (int) filesize($log) : 0;
        $c['log_rotated_exists'] = is_file($log . '.1');
        $c['limits'] = array(
            'max_body' => (int) $this->cfg['max_body'],
            'per_visitor_per_minute' => (int) $this->cfg['per_visitor_per_minute'],
            'global_per_minute' => (int) $this->cfg['global_per_minute'],
            'rotate_bytes' => (int) $this->cfg['rotate_bytes'],
        );

        $fatal = !$c['php_ok'] || !$c['data_dir_writable'] || !$c['write_probe'] || !$c['flock'];
        $advice = array();
        if (!$c['php_ok']) {
            $advice[] = 'PHP 7.2 or newer is required.';
        }
        if (!$c['data_dir_writable'] || !$c['write_probe']) {
            $advice[] = 'The data directory is not writable — create log-data/ beside this script and give the web server write access, or point data_dir elsewhere.';
        }
        if (!$c['secret_changed']) {
            $advice[] = 'Set your own secret in the configuration block.';
        }
        if (!$c['apcu']) {
            $advice[] = 'APCu is not available: reports are not rate limited, only size-capped.';
        }
        if (!$advice) {
            $advice[] = 'Installation looks healthy.';
        }

        return array('ok' => !$fatal, 'action' => 'selftest', 'checks' => $c, 'advice' => $advice);
    }

    /* ----------------------------------------------------------- the report */

    /** The line to store, or null when the body is not a report. */
    private function sanitize(string $body, string $ua)
    {
        if (strncmp($body, "\xEF\xBB\xBF", 3) === 0) {
            $body = substr($body, 3);
        }
        $data = json_decode($body, false, 8);
        if (!is_object($data)) {
            return null;
        }

        $record = array('time' => $this->localTime()->format('c'));
        $any = false;
        foreach (self::FIELDS as $key => $max) {
            $value = isset($data->$key) ? $this->clean($data->$key, $max) : '';
            $record[$key] = $value;
            if ($value !== '') {
                $any = true;
            }
        }
        if (!$any) {
            return null; // an empty object is not a report
        }

        if (isset($data->extra) && is_object($data->extra)) {
            $extra = array();
            foreach ($data->extra as $key => $value) {
                if (count($extra) >= self::EXTRA_MAX_KEYS) {
                    break;
                }
                if (!is_scalar($value) && $value !== null) {
                    continue; // flat values only
                }
                $key = substr((string) preg_replace('~[^A-Za-z0-9_.-]~', '', (string) $key), 0, self::EXTRA_KEY_LEN);
                if ($key === '') {
                    continue;
                }
                $extra[$key] = $this->clean($value, self::EXTRA_VALUE_LEN);
            }
            if ($extra) {
                $record['extra'] = (object) $extra; // an object even for keys "0", "1", …
            }
        }

        $record['ua'] = $this->clean($ua, self::UA_LEN);
        return $record;
    }

    /**
     * Any scalar as a string: control characters (C0, DEL, C1) collapsed to a
     * space, trimmed, cut to $max characters. Arrays and objects become "".
     */
    private function clean($value, int $max): string
    {
        if (is_string($value)) {
            $s = $value;
        } elseif (is_bool($value)) {
            $s = $value ? 'true' : 'false';
        } elseif (is_int($value) || is_float($value)) {
            $s = (string) $value;
        } else {
            return '';
        }

        if (preg_match('//u', $s) !== 1) {
            // Not UTF-8 (only possible for the User-Agent header): keep ASCII.
            $s = (string) preg_replace('~[^\x20-\x7E]~', '', $s);
        }
        $s = trim((string) preg_replace('~[\x00-\x1F\x7F\x{80}-\x{9F}]+~u', ' ', $s));

        if (strlen($s) <= $max) {
            return $s;
        }
        if (preg_match('/^.{0,' . $max . '}/us', $s, $m) === 1) {
            return $m[0];
        }
        return substr($s, 0, $max);
    }

    /* -------------------------------------------------------- rate limiting */

    /**
     * True when this visitor, or everyone together, has sent too much this
     * minute. The visitor key exists only as an APCu slot name. Without APCu
     * there is no limit here; the body cap still applies.
     */
    private function rateLimited(string $ua): bool
    {
        if (!$this->apcu()) {
            return false;
        }
        $minute = (string) intdiv(time(), 60);
        $prefix = 'codex-log:' . substr(md5($this->dir), 0, 8) . ':';

        $visitor = substr(hash(
            'sha256',
            $this->cfg['secret'] . '|' . $this->localTime()->format('Y-m-d') . '|' . $this->clientIp()
        ), 0, 8);
        if ($this->bump($prefix . 'v:' . $visitor . ':' . $minute) > (int) $this->cfg['per_visitor_per_minute']) {
            return true;
        }
        return $this->bump($prefix . 'g:' . $minute) > (int) $this->cfg['global_per_minute'];
    }

    /**
     * Increment a per-minute counter. Two calls, not the four-argument
     * `apcu_inc`: that form needs a newer APCu than every 7.3 host carries.
     */
    private function bump(string $slot): int
    {
        apcu_add($slot, 0, 120);
        $count = apcu_inc($slot);
        return is_int($count) ? $count : 0;
    }

    private function apcu(): bool
    {
        static $has = null;
        if ($has === null) {
            $has = function_exists('apcu_add') && function_exists('apcu_inc')
                && ini_get('apc.enabled') !== '0';
        }
        return $has;
    }

    /**
     * The client address — used only inside the rate-limit hash, never
     * stored. The connecting address by default; a proxy header (its first
     * hop) only when the configuration says the site is behind a proxy it
     * trusts, because from an ordinary client such a header is forgeable and
     * each forged value would be a fresh allowance.
     */
    private function clientIp(): string
    {
        $headers = empty($this->cfg['trust_proxy_headers'])
            ? array()
            : array('HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR');
        foreach ($headers as $header) {
            if (empty($_SERVER[$header])) {
                continue;
            }
            $first = trim(explode(',', (string) $_SERVER[$header])[0]);
            if (filter_var($first, FILTER_VALIDATE_IP) !== false) {
                return $first;
            }
        }
        return isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
    }

    /* ------------------------------------------------------------- on disk */

    /**
     * Append one line. Every writer takes the same lock file first, so the
     * size check, the rotation and the append happen as one step: two
     * requests can neither interleave a line nor rotate the log twice.
     */
    private function append(string $line): bool
    {
        $this->ensureDir();
        if (!is_dir($this->dir)) {
            return false;
        }

        $lock = @fopen($this->dir . '/.lock', 'c');
        if (!is_resource($lock) || !@flock($lock, LOCK_EX)) {
            if (is_resource($lock)) {
                fclose($lock);
            }
            return false;
        }

        try {
            $path = $this->dir . '/' . self::LOG_NAME;
            clearstatcache(true, $path);
            if (is_file($path) && (int) filesize($path) >= (int) $this->cfg['rotate_bytes']) {
                @rename($path, $path . '.1');
            }
            return @file_put_contents($path, $line, FILE_APPEND) !== false;
        } finally {
            @flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /**
     * Create the data directory on first use, and — since the default puts it
     * inside the web root — drop in the two guards that keep Apache from
     * serving its contents.
     */
    private function ensureDir(): void
    {
        static $done = false;
        if ($done) {
            return;
        }
        $done = true;

        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0775, true);
        }
        if (is_dir($this->dir) && !is_file($this->dir . '/.htaccess')) {
            @file_put_contents(
                $this->dir . '/.htaccess',
                "# Client error log — not for the public.\n"
                . "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
                . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
            );
            @file_put_contents($this->dir . '/index.html', '');
        }
    }

    /* ---------------------------------------------------------- small parts */

    private function localTime(): DateTime
    {
        $time = new DateTime('@' . time());
        $time->setTimezone($this->tz);
        return $time;
    }

    private function query(string $name): string
    {
        if (!isset($_GET[$name]) || !is_string($_GET[$name])) {
            return '';
        }
        return (string) preg_replace('~[^a-z]~', '', $_GET[$name]);
    }
}

/* ------------------------------------------------------------------ run it */

$sink = new ClientErrorLog($CONFIG);
$sink->handle();
