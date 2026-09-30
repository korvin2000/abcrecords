<?php
/**
 * КОДЕКС ГИТАРИСТОВ — dossier facts aggregator.
 * =========================================================================
 * One file, no database, no required extensions. Written for PHP 7.3.
 * Uploaded to /api/facts.php.
 *
 * WHAT IT REPLACES
 * ----------------
 * The app's name and year search, and the herald's "on this day", need four
 * fields from every dossier of a language: forename, surname, born, died.
 * Without this endpoint the browser reads them one `<lang>/*.bio.json` at a
 * time — ~736 requests for Russian alone. This script answers the same
 * question in one response:
 *
 *   {"v":1,"lang":"ru","count":N,
 *    "entries":{"abiton":["Жерар","Абитон","1954",""], ...}}
 *
 * The values are raw. Folding and date parsing stay in the browser, so there
 * is still exactly one folding rule in the project.
 *
 * FRESHNESS — WHY THIS IS NOT A PRECOMPUTED FILE
 * ----------------------------------------------
 * On *every* request the language directory is listed and every `*.bio.json`
 * is stat()ed. Their count and a fingerprint of every file's name, mtime and
 * size form the validator (the ETag). A
 * built document is reused — from APCu, or from a cache file that carries the
 * validator it was built for — only while that validator is unchanged. An
 * edited, added or removed dossier therefore shows on the very next request.
 * `pages/` stays the only home of a fact; this is a cache that cannot go
 * stale, not a second copy.
 *
 * The app does not depend on this script. When it is missing, slow or broken
 * the browser falls back to reading the dossiers one by one.
 *
 * API (GET only; OPTIONS answered for CORS preflight)
 * ---------------------------------------------------
 *   ?lang=<xx>     The document for one language. 404 for an unknown one.
 *                  `If-None-Match` is honoured (304).
 *   ?a=selftest    Diagnostics: extensions, per-language counts, timings.
 *
 * INSTALLATION: see README.md next to this file.
 */

declare(strict_types=1);

/* ==========================================================================
   CONFIGURATION — the only part meant to be edited.
   ========================================================================== */

$CONFIG = array(
    /* The directory that holds `<lang>/*.bio.json` — the site root, which is
       where the deployed `pages/` content lands (`/ru/abiton.bio.json`). The
       default assumes this file sits one level below it, at /api/facts.php. */
    'content_dir' => dirname(__DIR__),

    /* Where built documents are kept between requests. Created on first use,
       with the same two guards as the counter's data directory. Deleting it at
       any time is safe: the next request rebuilds. */
    'cache_dir' => __DIR__ . '/facts-cache',

    /* Each value is trimmed and cut to this many characters. */
    'max_len' => 120,

    /* How long APCu may hold a built document (seconds). It is revalidated on
       every request regardless; this only bounds memory held by an idle one. */
    'apcu_ttl' => 86400,

    /* gzip level for the response body when the client accepts it. */
    'gzip_level' => 6,

    /* Browsers may read this endpoint from these origins as well as from the
       site itself. The two localhost entries are the Vite dev server; drop
       them once you are done testing. */
    'allow_origins' => array(
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ),
);

/* ==========================================================================
   Everything below is the implementation.
   ========================================================================== */

final class FactsEndpoint
{
    /** `v` in the document. Bump together with ETAG_PREFIX. */
    const SCHEMA = 1;
    const ETAG_PREFIX = 'f1';
    const SUFFIX = '.bio.json';
    /** strlen(SUFFIX) */
    const SUFFIX_LEN = 9;

    /** @var array */
    private $cfg;
    /** @var string */
    private $root;
    /** @var string */
    private $cacheDir;
    /** @var string Fingerprint of the dossiers seen by the last listDossiers(). */
    private $fingerprint = '';

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
        $this->root = rtrim((string) $cfg['content_dir'], '/\\');
        $this->cacheDir = rtrim((string) $cfg['cache_dir'], '/\\');
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

            // HEAD is answered as GET (the server drops the body), so that
            // `curl -I` works for checking headers.
            if ($method !== 'GET' && $method !== 'HEAD') {
                header('Allow: GET, HEAD, OPTIONS');
                $this->fail(405, 'method not allowed');
                return;
            }

            if (isset($_GET['a'])) {
                if ($this->query('a', '~^selftest\z~') === 'selftest') {
                    $this->actionSelftest();
                } else {
                    $this->fail(400, 'unknown action');
                }
                return;
            }

            $this->actionFacts();
        } catch (Throwable $e) {
            error_log('[facts] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            if (!headers_sent()) {
                header_remove('ETag');
                header_remove('Content-Encoding');
                header_remove('Content-Length');
                header('Content-Type: application/json; charset=utf-8');
            }
            $this->fail(500, 'internal error');
        }
    }

    private function sendHeaders(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');

        $vary = 'Accept-Encoding';
        $origin = $this->allowedOrigin();
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            $vary .= ', Origin';
        }
        header('Vary: ' . $vary);
    }

    /** CORS preflight: nothing to read, nothing to record. */
    private function preflight(): void
    {
        $origin = $this->allowedOrigin();
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
            header('Access-Control-Allow-Headers: If-None-Match');
            header('Access-Control-Max-Age: 86400');
            header('Vary: Origin');
        }
        header('Allow: GET, HEAD, OPTIONS');
        http_response_code(204);
    }

    private function allowedOrigin(): string
    {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
        return ($origin !== '' && in_array($origin, $this->cfg['allow_origins'], true)) ? $origin : '';
    }

    private function fail(int $status, string $message): void
    {
        http_response_code($status);
        if (!headers_sent()) {
            header('Cache-Control: no-store, max-age=0');
        }
        echo json_encode(array('error' => $message));
    }

    /* ------------------------------------------------------------ actions */

    /**
     * The document for one language. The directory is stat()ed on every
     * request — that is the freshness guarantee — and the body is built only
     * when no copy exists for exactly this validator.
     */
    private function actionFacts(): void
    {
        $lang = $this->query('lang', '~^[a-z]{2}\z~');
        $dir = $this->root . '/' . $lang;
        if ($lang === '' || !is_dir($dir)) {
            $this->fail(404, 'unknown language');
            return;
        }

        $files = $this->listDossiers($dir);
        $etag = $this->validator($lang, $files);

        header('Cache-Control: no-cache');
        header('ETag: "' . $etag . '"');

        if ($this->notModified($etag)) {
            http_response_code(304);
            return;
        }

        $this->sendBody($this->document($lang, $dir, $files, $etag));
    }

    /**
     * Everything an installation can get wrong, reported as plain values.
     * Builds the largest language once to measure it; writes nothing but a
     * probe file in the cache directory. Reports no filesystem paths.
     */
    private function actionSelftest(): void
    {
        header('Cache-Control: no-store, max-age=0');
        $t0 = microtime(true);
        $c = array();

        $c['php_version'] = PHP_VERSION;
        $c['php_ok'] = version_compare(PHP_VERSION, '7.2.0', '>=');
        $c['apcu'] = $this->apcu();
        $c['zlib'] = function_exists('gzencode');
        $c['zlib_output_compression'] = $this->iniOn('zlib.output_compression');
        $c['gzip_by_script'] = $this->canGzip();
        $c['content_dir_readable'] = is_dir($this->root) && is_readable($this->root);

        // Every two-letter directory that holds at least one dossier.
        $languages = array();
        $largest = '';
        $largestCount = 0;
        $handle = @opendir($this->root);
        if ($handle !== false) {
            while (($name = readdir($handle)) !== false) {
                if (preg_match('~^[a-z]{2}\z~', $name) !== 1 || !is_dir($this->root . '/' . $name)) {
                    continue;
                }
                $n = count($this->listDossiers($this->root . '/' . $name));
                if ($n === 0) {
                    continue;
                }
                $languages[$name] = $n;
                if ($n > $largestCount) {
                    $largest = $name;
                    $largestCount = $n;
                }
            }
            closedir($handle);
        }
        ksort($languages, SORT_STRING);
        $c['languages'] = $languages ? $languages : new stdClass();

        // A real write + rename round trip, the way the cache is written.
        $this->ensureCacheDir();
        $c['cache_dir_exists'] = is_dir($this->cacheDir);
        $c['cache_dir_writable'] = is_dir($this->cacheDir) && is_writable($this->cacheDir);
        $probe = $this->cacheDir . '/selftest.tmp';
        $wrote = $c['cache_dir_exists'] && @file_put_contents($probe, 'probe') !== false;
        $c['cache_write_probe'] = $wrote;
        $c['cache_atomic_rename'] = $wrote && @rename($probe, $probe . '2') && @unlink($probe . '2');
        @unlink($probe);

        // What one request costs, measured on the largest language.
        if ($largest !== '') {
            $dir = $this->root . '/' . $largest;

            $t1 = microtime(true);
            $files = $this->listDossiers($dir);
            $etag = $this->validator($largest, $files);
            $c['stat_ms'] = round((microtime(true) - $t1) * 1000, 2);

            $t2 = microtime(true);
            $doc = $this->buildDocument($largest, $dir, $files);
            $json = $this->encode($doc);
            $c['build_ms'] = round((microtime(true) - $t2) * 1000, 2);

            $c['largest_language'] = $largest;
            $c['largest_files'] = count($files);
            $c['largest_entries'] = $doc['count'];
            $c['largest_etag'] = $etag;
            $c['largest_bytes'] = strlen($json);
            $c['largest_gzip_bytes'] = function_exists('gzencode')
                ? strlen((string) gzencode($json, (int) $this->cfg['gzip_level'])) : 0;
            $c['largest_cached_apcu'] = $this->fromApcu($largest, $etag) !== null;
            $c['largest_cached_file'] = $this->readCacheFile($largest, $etag) !== null;
        }

        // Probes for a later decision: rendering PDF pages to images on the
        // server (docs/performance-analysis.md §10.5). Nothing here uses them.
        $c['imagick'] = extension_loaded('imagick');
        $c['imagick_pdf'] = false;
        if ($c['imagick'] && class_exists('Imagick') && method_exists('Imagick', 'queryFormats')) {
            try {
                $formats = Imagick::queryFormats('PDF');
                $c['imagick_pdf'] = is_array($formats) && count($formats) > 0;
            } catch (Throwable $e) {
                $c['imagick_pdf'] = false;
            }
        }
        $disabled = array_map('trim', explode(',', strtolower((string) ini_get('disable_functions'))));
        $c['exec'] = function_exists('exec') && !in_array('exec', $disabled, true);

        $c['total_ms'] = round((microtime(true) - $t0) * 1000, 2);

        $ok = $c['php_ok'] && $c['content_dir_readable'] && $largest !== '';
        $advice = array();
        if (!$c['php_ok']) {
            $advice[] = 'PHP 7.2 or newer is required.';
        }
        if (!$c['content_dir_readable'] || $largest === '') {
            $advice[] = 'No <lang>/*.bio.json found — check content_dir in the configuration block.';
        }
        if (!$c['cache_atomic_rename']) {
            $advice[] = 'The cache directory is not writable; the endpoint still works but rebuilds '
                . ($c['apcu'] ? 'whenever APCu loses its copy.' : 'on every request that is not answered 304.');
        }
        if (!$c['gzip_by_script'] && !$c['zlib_output_compression']) {
            $advice[] = 'zlib is missing: responses are sent uncompressed unless Apache mod_deflate applies.';
        }
        if (!$advice) {
            $advice[] = 'Installation looks healthy.';
        }

        echo json_encode(
            array('ok' => $ok, 'action' => 'selftest', 'checks' => $c, 'advice' => $advice),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }

    /* ------------------------------------------------------- the document */

    /**
     * `name.bio.json` => mtime, for every dossier in one directory. This is
     * the stat pass that runs on every request.
     */
    private function listDossiers(string $dir): array
    {
        $out = array();
        $parts = array();
        $handle = @opendir($dir);
        if ($handle === false) {
            return $out;
        }
        while (($name = readdir($handle)) !== false) {
            if (strlen($name) <= self::SUFFIX_LEN || substr($name, -self::SUFFIX_LEN) !== self::SUFFIX) {
                continue;
            }
            $path = $dir . '/' . $name;
            $mtime = @filemtime($path);
            if ($mtime === false || !is_file($path)) {
                continue;
            }
            $out[$name] = $mtime;
            $parts[] = $name . ':' . $mtime . ':' . (int) @filesize($path);
        }
        closedir($handle);
        // Directory order is not stable between requests; the fingerprint is.
        sort($parts, SORT_STRING);
        $this->fingerprint = substr(md5(implode('|', $parts)), 0, 16);
        return $out;
    }

    /**
     * The ETag body (without quotes): schema, language, count and a
     * fingerprint of every dossier's own name, mtime and size. Must be called
     * right after listDossiers() for the same directory.
     *
     * Every file's mtime, not the newest one: an upload tool that *preserves*
     * the source file's timestamp can replace a dossier with an edited copy
     * whose mtime is older than the newest already on the server — count and
     * newest-mtime are then both unchanged, and a one-digit correction does
     * not change the size either. The edited file's own mtime has still
     * changed, and that is what is fingerprinted.
     */
    private function validator(string $lang, array $files): string
    {
        return self::ETAG_PREFIX . '-' . $lang . '-' . count($files) . '-' . $this->fingerprint;
    }

    /**
     * Does `If-None-Match` name this validator? Accepts a comma-separated
     * list, `*`, a `W/` prefix, and the `-gzip` suffix Apache's mod_deflate
     * appends inside the quotes when it compressed the response itself.
     */
    private function notModified(string $etag): bool
    {
        $header = isset($_SERVER['HTTP_IF_NONE_MATCH']) ? (string) $_SERVER['HTTP_IF_NONE_MATCH'] : '';
        if ($header === '') {
            return false;
        }
        foreach (explode(',', $header) as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '*') {
                return true;
            }
            if (strncmp($candidate, 'W/', 2) === 0) {
                $candidate = substr($candidate, 2);
            }
            $candidate = trim($candidate, '"');
            if (substr($candidate, -5) === '-gzip') {
                $candidate = substr($candidate, 0, -5);
            }
            if ($candidate === $etag) {
                return true;
            }
        }
        return false;
    }

    /** The JSON for this validator: APCu, then the cache file, then a build. */
    private function document(string $lang, string $dir, array $files, string $etag): string
    {
        $json = $this->fromApcu($lang, $etag);
        if ($json !== null) {
            return $json;
        }

        $json = $this->readCacheFile($lang, $etag);
        if ($json === null) {
            $json = $this->encode($this->buildDocument($lang, $dir, $files));
            $this->writeCacheFile($lang, $etag, $json);
        }

        if ($this->apcu()) {
            apcu_store($this->apcuKey($lang), array($etag, $json), (int) $this->cfg['apcu_ttl']);
        }
        return $json;
    }

    /**
     * Read every dossier and keep four raw strings from each. A file that is
     * unreadable, not JSON, or has no `metadata` object is left out.
     */
    private function buildDocument(string $lang, string $dir, array $files): array
    {
        $max = (int) $this->cfg['max_len'];
        $entries = array();

        foreach ($files as $name => $mtime) {
            $name = (string) $name;
            $slug = substr($name, 0, -self::SUFFIX_LEN);
            if ($slug === '' || preg_match('//u', $slug) !== 1) {
                continue; // not valid UTF-8 — could not be a JSON key
            }
            $raw = @file_get_contents($dir . '/' . $name);
            if (!is_string($raw) || $raw === '') {
                continue;
            }
            if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
                $raw = substr($raw, 3);
            }
            $data = json_decode($raw);
            if (!is_object($data) || !isset($data->metadata) || !is_object($data->metadata)) {
                continue;
            }
            $meta = $data->metadata;
            $dates = (isset($meta->dates) && is_object($meta->dates)) ? $meta->dates : null;

            $entries[$slug] = array(
                $this->field($meta, 'forename', $max),
                $this->field($meta, 'surname', $max),
                $this->field($dates, 'born', $max),
                $this->field($dates, 'died', $max),
            );
        }

        ksort($entries, SORT_STRING);

        return array(
            'v' => self::SCHEMA,
            'lang' => $lang,
            'count' => count($entries),
            // An object even when empty, and even for a numeric basename.
            'entries' => (object) $entries,
        );
    }

    /** One value: a string, trimmed and capped — anything else is "". */
    private function field($source, string $name, int $max): string
    {
        if (!is_object($source) || !isset($source->$name) || !is_string($source->$name)) {
            return '';
        }
        return $this->cap(trim($source->$name), $max);
    }

    /** Cut to $max characters (not bytes), never inside a UTF-8 sequence. */
    private function cap(string $value, int $max): string
    {
        if (strlen($value) <= $max) {
            return $value;
        }
        if (preg_match('/^.{0,' . $max . '}/us', $value, $m) === 1) {
            return $m[0];
        }
        return substr($value, 0, $max);
    }

    private function encode(array $doc): string
    {
        $json = json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('json_encode failed: ' . json_last_error_msg());
        }
        return $json;
    }

    /* ---------------------------------------------------------- response */

    /**
     * Compress here, when the client accepts gzip and PHP is not already
     * compressing its output. A response that leaves PHP with a
     * Content-Encoding is left alone by mod_deflate, so it is never
     * compressed twice.
     */
    private function sendBody(string $json): void
    {
        $body = $json;
        if ($this->acceptsGzip() && $this->canGzip()) {
            $zipped = gzencode($json, (int) $this->cfg['gzip_level']);
            if (is_string($zipped)) {
                $body = $zipped;
                header('Content-Encoding: gzip');
            }
        }
        // Not when PHP itself is compressing the output: a script that sets
        // Content-Length makes PHP switch zlib.output_compression off for the
        // request (the length would be wrong), and the body would then leave
        // uncompressed on exactly the hosts configured to compress it.
        if (!$this->phpCompresses()) {
            header('Content-Length: ' . strlen($body));
        }
        echo $body;
    }

    private function acceptsGzip(): bool
    {
        $header = isset($_SERVER['HTTP_ACCEPT_ENCODING']) ? strtolower((string) $_SERVER['HTTP_ACCEPT_ENCODING']) : '';
        foreach (explode(',', $header) as $part) {
            $bits = explode(';', $part);
            $coding = trim($bits[0]);
            if ($coding !== 'gzip' && $coding !== 'x-gzip') {
                continue;
            }
            $q = 1.0;
            $n = count($bits);
            for ($i = 1; $i < $n; $i++) {
                $pair = explode('=', $bits[$i], 2);
                if (trim($pair[0]) === 'q' && isset($pair[1])) {
                    $q = (float) trim($pair[1]);
                }
            }
            return $q > 0;
        }
        return false;
    }

    private function canGzip(): bool
    {
        return function_exists('gzencode') && !$this->phpCompresses();
    }

    /** PHP is set up to compress whatever this script prints. */
    private function phpCompresses(): bool
    {
        return $this->iniOn('zlib.output_compression')
            || stripos((string) ini_get('output_handler'), 'gzhandler') !== false;
    }

    private function iniOn(string $key): bool
    {
        $value = strtolower(trim((string) ini_get($key)));
        return $value !== '' && $value !== '0' && $value !== 'off' && $value !== 'false' && $value !== 'no';
    }

    /* ------------------------------------------------------------- caches */

    private function apcu(): bool
    {
        static $has = null;
        if ($has === null) {
            $has = function_exists('apcu_fetch') && function_exists('apcu_store')
                && ini_get('apc.enabled') !== '0';
        }
        return $has;
    }

    /** Namespaced by content directory, so two installations cannot share a slot. */
    private function apcuKey(string $lang): string
    {
        return 'codex-facts:' . substr(md5($this->root), 0, 8) . ':' . $lang;
    }

    private function fromApcu(string $lang, string $etag)
    {
        if (!$this->apcu()) {
            return null;
        }
        $hit = apcu_fetch($this->apcuKey($lang), $ok);
        if ($ok && is_array($hit) && isset($hit[0], $hit[1]) && $hit[0] === $etag && is_string($hit[1])) {
            return $hit[1];
        }
        return null;
    }

    /**
     * The cache file holds the validator on its first line and the document
     * after it, so a copy built for another validator is never served.
     */
    private function readCacheFile(string $lang, string $etag)
    {
        $raw = @file_get_contents($this->cacheFile($lang));
        if (!is_string($raw)) {
            return null;
        }
        $nl = strpos($raw, "\n");
        if ($nl === false || substr($raw, 0, $nl) !== $etag) {
            return null;
        }
        $body = substr($raw, $nl + 1);
        return $body !== '' ? $body : null;
    }

    /** Temp file + rename(): a reader sees the old copy or the new, never half. */
    private function writeCacheFile(string $lang, string $etag, string $json): void
    {
        $this->ensureCacheDir();
        if (!is_dir($this->cacheDir)) {
            return;
        }
        $path = $this->cacheFile($lang);
        $tmp = $path . '.' . getmypid() . '-' . mt_rand(0, 0x7fffffff) . '.tmp';
        if (@file_put_contents($tmp, $etag . "\n" . $json) === false) {
            @unlink($tmp);
            return;
        }
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
        }
    }

    private function cacheFile(string $lang): string
    {
        return $this->cacheDir . '/facts-' . $lang . '.json';
    }

    /**
     * Create the cache directory on first use, and — since the default puts it
     * inside the web root — drop in the two guards that keep Apache from
     * serving its contents.
     */
    private function ensureCacheDir(): void
    {
        static $done = false;
        if ($done) {
            return;
        }
        $done = true;

        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0775, true);
        }
        if (is_dir($this->cacheDir) && !is_file($this->cacheDir . '/.htaccess')) {
            @file_put_contents(
                $this->cacheDir . '/.htaccess',
                "# Facts cache — rebuilt on demand, not for the public.\n"
                . "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
                . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
            );
            @file_put_contents($this->cacheDir . '/index.html', '');
        }
    }

    /* ---------------------------------------------------------- small parts */

    /** A query parameter that matches $pattern exactly, or "". */
    private function query(string $name, string $pattern): string
    {
        if (!isset($_GET[$name]) || !is_string($_GET[$name])) {
            return '';
        }
        return preg_match($pattern, $_GET[$name]) === 1 ? $_GET[$name] : '';
    }
}

/* ------------------------------------------------------------------ run it */

$endpoint = new FactsEndpoint($CONFIG);
$endpoint->handle();
