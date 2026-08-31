<?php
/**
 * КОДЕКС ГИТАРИСТОВ — visitor counter & statistics endpoint.
 * =========================================================================
 * One file, no database, no required extensions. Written for PHP 7.3.
 *
 * WHY THERE IS NO DATABASE
 * ------------------------
 * Everything this endpoint reports is an *aggregate*: totals, per-day counts,
 * per-hour counts, tallies per page / tongue / device / referrer. Aggregates
 * are tiny and they are only ever read as a whole, so a relational store would
 * add a connection, a schema and a daily maintenance job to hold ~20 KB of
 * numbers. Instead:
 *
 *   counter-data/state.json   the whole aggregate — read, mutated and written
 *                             back under one lock, replaced atomically.
 *   counter-data/seen.bin     today's visitor keys, 4 raw bytes each, for the
 *                             "unique visitors today" figure.
 *   counter-data/recent.bin   key + timestamp (8 bytes) for the last 30 min:
 *                             drives "online now" *and* sessionization.
 *
 * Per hit that is three small reads, one JSON decode/encode of a file that is
 * bounded by design, and three small writes — well under a millisecond of CPU
 * on any shared host. Nothing grows without a cap: `days` is trimmed to
 * `keep_days`, `pages`/`refs` to their top N, `seen.bin` to `max_seen` keys,
 * `recent.bin` to the session window.
 *
 * APCu, when the server has it, is used for two things and never depended on:
 * a flood guard (one write per visitor per page per `hit_cooldown` seconds)
 * and a short cache of the built statistics payload. Losing it costs speed,
 * never data.
 *
 * PRIVACY
 * -------
 * No cookies, no IP addresses and no user agents are stored. A visitor is
 * identified by the first 4 bytes of sha256(daily salt + IP + UA), which is
 * unlinkable across days because the salt is re-derived from the date. The
 * data files therefore hold no personal data — which is also why keeping them
 * inside the web root is not a leak (see `data_dir` if you prefer otherwise).
 *
 * API (all GET, all JSON, all `Cache-Control: no-store`)
 * -----------------------------------------------------
 *   ?a=hit&p=<slug>&l=<lang>&r=<referrer-host>
 *        Records one page view and returns the compact counter payload.
 *   ?a=pulse
 *        The same payload, recording nothing.
 *   ?a=stats
 *        The full statistics document (cached `cache_ttl` seconds).
 *   ?a=selftest
 *        Diagnostics: permissions, locking, APCu, timings. Run once after
 *        uploading, then leave it alone (it records nothing).
 *
 * INSTALLATION: see README.md next to this file.
 */

declare(strict_types=1);

/* ==========================================================================
   CONFIGURATION — the only part meant to be edited.
   ========================================================================== */

$CONFIG = array(
    /* Where the three data files live. Keep it outside the web root if you
       like ('/home/you/counter-data'); it is created on first run either way. */
    'data_dir' => __DIR__ . '/counter-data',

    /* Any long random string. Change it once, at installation, and then leave
       it alone: it is mixed with the date to produce the per-day visitor salt,
       so changing it later only means one day of slightly inflated uniques. */
    'secret' => 'CHANGE-THIS-TO-A-LONG-RANDOM-STRING-4f8c1e',

    /* The timezone every "day" and "hour" in the statistics is measured in. */
    'timezone' => 'Europe/Berlin',

    /* A visitor unseen for this long starts a new visit (seconds). */
    'session_gap' => 1800,

    /* "Online now" counts visitors seen within this window (seconds). */
    'online_window' => 300,

    /* How many days of history to keep. 90 days ≈ 6 KB of JSON. */
    'keep_days' => 90,

    /* Caps that keep state.json small and bounded. */
    'max_pages' => 150,
    'max_refs'  => 40,
    'max_seen'  => 20000,

    /* Flood guard: the same visitor on the same page is recorded at most once
       per this many seconds. Also the cheapest defence against a reload spree. */
    'hit_cooldown' => 5,

    /* And a hard ceiling per visitor per day, however many pages they open. */
    'per_day_cap' => 400,

    /* Seconds the built statistics document may be served from cache. */
    'cache_ttl' => 20,

    /* Added to the totals on the way out, never stored: use it to carry over
       the count from a previous counter so the odometer does not restart at
       zero. Real growth still shows on top of it. */
    'seed' => array('views' => 0, 'visits' => 0, 'uniques' => 0),

    /* Browsers may read this endpoint from these origins as well as from the
       site itself. The two localhost entries are the Vite dev server; drop
       them once you are done testing. */
    'allow_origins' => array(
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ),

    /* Requests whose User-Agent matches this are counted as crawlers and kept
       out of every other figure. */
    'bot_pattern' => '~bot|crawl|spider|slurp|search|fetch|monitor|preview|headless|'
        . 'curl|wget|python|java/|libwww|httpclient|okhttp|axios|scrapy|phantom|'
        . 'lighthouse|pagespeed|gtmetrix|semrush|ahrefs|mj12|dotbot|petalbot|yandexbot~i',
);

/* ==========================================================================
   Everything below is the implementation.
   ========================================================================== */

final class VisitorCounter
{
    const STATE_VERSION = 1;

    /** @var array */
    private $cfg;
    /** @var string */
    private $dir;
    /** @var int Unix timestamp of this request. */
    private $now;
    /** @var DateTimeZone */
    private $tz;
    /** @var resource|null Held only for the duration of a recorded hit. */
    private $lock;

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
        $this->dir = rtrim($cfg['data_dir'], '/\\');
        $this->now = time();
        $this->tz = new DateTimeZone($cfg['timezone']);
        $this->lock = null;
    }

    /* ---------------------------------------------------------- dispatch */

    public function handle(string $action): void
    {
        $this->sendHeaders();

        try {
            switch ($action) {
                case 'hit':
                    $out = $this->actionHit();
                    break;
                case 'pulse':
                    $out = $this->actionPulse();
                    break;
                case 'stats':
                    $out = $this->actionStats();
                    break;
                case 'selftest':
                    $out = $this->actionSelftest();
                    break;
                default:
                    http_response_code(400);
                    $out = array('ok' => false, 'error' => 'unknown action');
            }
        } catch (Throwable $e) {
            $this->unlock();
            http_response_code(500);
            error_log('[counter] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            $out = array('ok' => false, 'error' => 'internal error');
        }

        echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function sendHeaders(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, max-age=0');
        header('X-Content-Type-Options: nosniff');

        $origin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
        if ($origin !== '' && in_array($origin, $this->cfg['allow_origins'], true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
    }

    /* ------------------------------------------------------------ actions */

    /**
     * Record one page view. Three cheap rejections come first — a crawler, a
     * visitor still inside the cooldown, a visitor over the daily ceiling —
     * and each of them returns the current figures without taking the lock.
     */
    private function actionHit(): array
    {
        $ua = isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
        $key = $this->visitorKey($ua);

        if ($ua === '' || preg_match($this->cfg['bot_pattern'], $ua) === 1) {
            $this->recordBot();
            return $this->pulsePayload($this->readState(), 'crawler');
        }

        $page = $this->param('p', 80, '~[^A-Za-z0-9._/-]~');
        if (!$this->passCooldown($key, $page)) {
            return $this->pulsePayload($this->readState(), 'throttled');
        }
        if ($this->overDailyCap($key)) {
            return $this->pulsePayload($this->readState(), 'capped');
        }

        $this->lock();
        try {
            $state = $this->rollDay($this->readState());

            $seen = $this->seenToday($key);
            $last = $this->touchRecent($key);
            $newVisit = ($last === null) || (($this->now - $last) > (int) $this->cfg['session_gap']);

            $this->applyHit($state, $page, $newVisit, !$seen, $ua);
            $this->writeState($state);
        } finally {
            $this->unlock();
        }

        return $this->pulsePayload($state, 'counted');
    }

    private function actionPulse(): array
    {
        return $this->pulsePayload($this->readState(), 'read');
    }

    private function actionStats(): array
    {
        $cached = $this->cacheGet('stats');
        if (is_array($cached)) {
            $cached['cached'] = true;
            return $cached;
        }

        $payload = $this->statsPayload($this->readState());
        $this->cacheSet('stats', $payload, (int) $this->cfg['cache_ttl']);
        return $payload;
    }

    /**
     * Everything an installation can get wrong, checked in order and reported
     * as plain booleans. Records nothing and never touches state.json.
     */
    private function actionSelftest(): array
    {
        $t0 = microtime(true);
        $checks = array();

        $checks['php_version'] = PHP_VERSION;
        $checks['php_ok'] = version_compare(PHP_VERSION, '7.2.0', '>=');
        $checks['data_dir'] = $this->dir;
        $checks['secret_changed'] = strpos($this->cfg['secret'], 'CHANGE-THIS') === false;
        $checks['timezone'] = $this->cfg['timezone'];
        $checks['apcu'] = function_exists('apcu_fetch') && ini_get('apc.enabled') !== '0';

        // A real lock/write/read/delete round trip on a throwaway file. Asking
        // for a path is also what creates the directory on a fresh install, so
        // the two checks below come after it, not before.
        $probe = $this->file('selftest.tmp');
        $checks['data_dir_exists'] = is_dir($this->dir);
        $checks['data_dir_writable'] = is_dir($this->dir) && is_writable($this->dir);
        $wrote = @file_put_contents($probe, 'probe') !== false;
        $checks['write_probe'] = $wrote;
        $checks['read_probe'] = $wrote && @file_get_contents($probe) === 'probe';
        $handle = @fopen($probe, 'c');
        $checks['flock'] = is_resource($handle) && @flock($handle, LOCK_EX | LOCK_NB);
        if (is_resource($handle)) {
            @flock($handle, LOCK_UN);
            fclose($handle);
        }
        // rename() over an existing file is what makes a state write atomic.
        $checks['atomic_rename'] = $wrote && @rename($probe, $probe . '2') && @unlink($probe . '2');
        @unlink($probe);

        $state = $this->readState();
        $checks['state_file'] = $this->file('state.json');
        $checks['state_exists'] = is_file($this->file('state.json'));
        $checks['state_bytes'] = $checks['state_exists'] ? (int) filesize($this->file('state.json')) : 0;
        $checks['state_since'] = $state['since'];
        $checks['recorded_views'] = $state['totals']['views'];

        // What one recorded hit will cost, measured rather than guessed.
        $t1 = microtime(true);
        $this->statsPayload($state);
        $checks['stats_build_ms'] = round((microtime(true) - $t1) * 1000, 2);
        $checks['total_ms'] = round((microtime(true) - $t0) * 1000, 2);

        $checks['visitor_key_sample'] = bin2hex($this->visitorKey('selftest'));
        $checks['client_ip_seen'] = $this->clientIp() !== '' ? 'yes' : 'no';

        $fatal = !$checks['php_ok'] || !$checks['data_dir_writable'] || !$checks['write_probe']
            || !$checks['flock'] || !$checks['atomic_rename'];

        return array(
            'ok' => !$fatal,
            'action' => 'selftest',
            'checks' => $checks,
            'advice' => $this->selftestAdvice($checks, $fatal),
        );
    }

    private function selftestAdvice(array $c, bool $fatal): array
    {
        $advice = array();
        if (!$c['php_ok']) {
            $advice[] = 'PHP 7.2 or newer is required.';
        }
        if (!$c['data_dir_exists']) {
            $advice[] = 'The data directory could not be created — create ' . $this->dir
                . ' by hand and give the web server write access.';
        } elseif (!$c['data_dir_writable']) {
            $advice[] = 'The data directory exists but is not writable by the web server user.';
        }
        if (!$c['secret_changed']) {
            $advice[] = 'Set your own value for "secret" in the configuration block.';
        }
        if (!$c['apcu']) {
            $advice[] = 'APCu is not active. Everything works; the flood guard and the '
                . 'statistics cache simply fall back to the data files.';
        }
        if (!$fatal && $c['secret_changed']) {
            $advice[] = 'Installation looks healthy.';
        }
        return $advice;
    }

    /* -------------------------------------------------------- the payloads */

    /** The compact document every page view gets back. */
    private function pulsePayload(array $s, string $status): array
    {
        $seed = $this->cfg['seed'];
        return array(
            'ok' => true,
            'status' => $status,
            'views' => $s['totals']['views'] + (int) $seed['views'],
            'visits' => $s['totals']['visits'] + (int) $seed['visits'],
            'uniques' => $s['totals']['uniques'] + (int) $seed['uniques'],
            'today' => array(
                'views' => $s['today']['views'],
                'visits' => $s['today']['visits'],
                'uniques' => $s['today']['uniques'],
            ),
            'online' => $this->onlineCount(),
            'since' => $s['since'],
            'time' => $this->now,
        );
    }

    /**
     * The full document, built from state.json alone. Every figure here is a
     * direct read or a sum over at most `keep_days` entries — there is no
     * scan of anything that grows with traffic.
     */
    private function statsPayload(array $s): array
    {
        $today = $this->dayKey();
        $days = $s['days'];
        $days[$today] = array($s['today']['views'], $s['today']['visits'], $s['today']['uniques']);
        krsort($days);

        $series = array();
        foreach (array_slice($days, 0, 30, true) as $date => $row) {
            $series[] = array('date' => $date, 'views' => $row[0], 'visits' => $row[1], 'uniques' => $row[2]);
        }
        $series = array_reverse($series);

        $sinceDays = $this->daysBetween($s['since'], $today) + 1;
        $out = $this->pulsePayload($s, 'stats');

        return array_merge($out, array(
            'action' => 'stats',
            'cached' => false,
            'daysRunning' => $sinceDays,
            'yesterday' => $this->dayRow($days, $this->dayKey($this->now - 86400)),
            'windows' => array(
                'd7' => $this->windowSum($days, 7),
                'd30' => $this->windowSum($days, 30),
            ),
            'avg' => array(
                'viewsPerDay' => $this->ratio($s['totals']['views'], $sinceDays),
                'viewsPerVisit' => $this->ratio($s['totals']['views'], $s['totals']['visits']),
            ),
            'peak' => $s['peak'],
            'streak' => $this->streak($days),
            'hours' => $s['hours'],
            'series' => $series,
            'weekdays' => $s['dow'],
            'pages' => $this->topList($s['pages'], 10),
            'langs' => $this->topList($s['langs'], 12),
            'referrers' => $this->topList($s['refs'], 8),
            'tech' => array(
                'device' => $this->topList($s['tech']['device'], 4),
                'browser' => $this->topList($s['tech']['browser'], 6),
                'os' => $this->topList($s['tech']['os'], 6),
            ),
            'bots' => $s['totals']['bots'],
        ));
    }

    /* ----------------------------------------------------- recording a hit */

    /**
     * Fold one page view into the aggregate. Views are counted per view;
     * everything that describes *who* is reading (tongue, device, browser,
     * operating system, where they came from) is counted per visit, so those
     * tallies stay comparable with the visit total instead of being weighted
     * by how many pages one reader happened to open.
     */
    private function applyHit(array &$s, string $page, bool $newVisit, bool $newVisitor, string $ua): void
    {
        $hour = (int) $this->localTime()->format('G');
        $dow = (int) $this->localTime()->format('N') - 1; // 0 = Monday

        $s['totals']['views']++;
        $s['today']['views']++;
        $s['hours'][$hour]++;
        $s['dow'][$dow]++;

        if ($page !== '') {
            $this->bump($s['pages'], $page, (int) $this->cfg['max_pages']);
        }

        if ($newVisit) {
            $s['totals']['visits']++;
            $s['today']['visits']++;

            $lang = strtolower($this->param('l', 8, '~[^a-zA-Z-]~'));
            if ($lang !== '') {
                $this->bump($s['langs'], substr($lang, 0, 5), 24);
            }

            $ref = $this->referrerHost();
            if ($ref !== '') {
                $this->bump($s['refs'], $ref, (int) $this->cfg['max_refs']);
            }

            $this->bump($s['tech']['device'], $this->device($ua), 8);
            $this->bump($s['tech']['browser'], $this->browser($ua), 16);
            $this->bump($s['tech']['os'], $this->os($ua), 12);
        }

        if ($newVisitor) {
            $s['totals']['uniques']++;
            $s['today']['uniques']++;
        }

        if ($s['today']['views'] > $s['peak']['day']['views']) {
            $s['peak']['day'] = array('date' => $s['today']['date'], 'views' => $s['today']['views']);
        }
        if ($s['hours'][$hour] > $s['peak']['hour']['views']) {
            $s['peak']['hour'] = array(
                'hour' => $hour,
                'views' => $s['hours'][$hour],
                'date' => $s['today']['date'],
            );
        }

        $s['updated'] = $this->now;
    }

    /** Crawlers are tallied and excluded from everything else. */
    private function recordBot(): void
    {
        if (!$this->passCooldown('bot' . $this->visitorKey('bot'), 'bot')) {
            return;
        }
        $this->lock();
        try {
            $state = $this->rollDay($this->readState());
            $state['totals']['bots']++;
            $state['updated'] = $this->now;
            $this->writeState($state);
        } finally {
            $this->unlock();
        }
    }

    /**
     * Midnight: today's row joins the history, the hour histogram is cleared
     * and today's visitor keys are forgotten. Called inside the lock, so the
     * first hit after midnight performs it and the rest see it done.
     */
    private function rollDay(array $s): array
    {
        $today = $this->dayKey();
        if ($s['today']['date'] === $today) {
            return $s;
        }

        if ($s['today']['views'] > 0) {
            $s['days'][$s['today']['date']] = array(
                $s['today']['views'], $s['today']['visits'], $s['today']['uniques'],
            );
            krsort($s['days']);
            $s['days'] = array_slice($s['days'], 0, (int) $this->cfg['keep_days'], true);
        }

        $s['today'] = array('date' => $today, 'views' => 0, 'visits' => 0, 'uniques' => 0);
        $s['hours'] = array_fill(0, 24, 0);
        @unlink($this->file('seen.bin'));

        return $s;
    }

    /**
     * True once the visitor has spent their daily allowance of views. The
     * tally lives in APCu — a per-visitor counter on disk would cost more than
     * the abuse it prevents — so without APCu the ceiling does not apply and
     * `hit_cooldown` is the only guard. Checked before the lock is taken.
     */
    private function overDailyCap(string $key): bool
    {
        $cap = (int) $this->cfg['per_day_cap'];
        if ($cap <= 0 || !$this->apcu()) {
            return false;
        }
        $slot = $this->cacheKey('cnt:' . $this->dayKey() . ':' . bin2hex($key));
        // Two calls, not `apcu_inc($k, 1, $ok, $ttl)`: the four-argument form
        // needs a newer APCu than every 7.3 host is guaranteed to carry.
        apcu_add($slot, 0, 172800);
        $count = apcu_inc($slot);
        return is_int($count) && $count > $cap;
    }

    /* --------------------------------------------- visitors: the two files */

    /**
     * Today's unique-visitor set: 4 raw bytes per visitor, appended once.
     * Membership is a C-level `strpos` over a file that is at most
     * `max_seen * 4` bytes, stepped so a key can only match on a record
     * boundary. Returns true when the visitor was already here today.
     */
    private function seenToday(string $key): bool
    {
        $path = $this->file('seen.bin');
        $blob = is_file($path) ? (string) @file_get_contents($path) : '';

        $offset = 0;
        while (($at = strpos($blob, $key, $offset)) !== false) {
            if ($at % 4 === 0) {
                return true;
            }
            $offset = $at + 1;
        }

        if (strlen($blob) < (int) $this->cfg['max_seen'] * 4) {
            @file_put_contents($path, $key, FILE_APPEND);
        }
        return false;
    }

    /**
     * The rolling window of recent visitors — key + timestamp, 8 bytes each,
     * pruned to the session window on every write. It answers both "how many
     * are reading right now" and "is this a new visit", and it stays the size
     * of your traffic in the last half hour, not of your traffic.
     *
     * Returns the visitor's previous timestamp, or null if they are new to
     * the window.
     */
    private function touchRecent(string $key)
    {
        $path = $this->file('recent.bin');
        $window = (int) $this->cfg['session_gap'];
        $cutoff = $this->now - $window;

        $blob = is_file($path) ? (string) @file_get_contents($path) : '';
        $previous = null;
        $kept = '';

        for ($i = 0, $n = strlen($blob) - 8; $i <= $n; $i += 8) {
            $record = substr($blob, $i, 8);
            $stamp = unpack('N', substr($record, 4, 4));
            $stamp = (int) $stamp[1];
            if ($stamp < $cutoff) {
                continue; // expired — dropped by not being kept
            }
            if (substr($record, 0, 4) === $key) {
                $previous = $stamp;
                continue; // rewritten below with the current time
            }
            $kept .= $record;
        }

        @file_put_contents($path, $kept . $key . pack('N', $this->now), LOCK_EX);
        return $previous;
    }

    /** Visitors seen within `online_window`. Read-only; no lock needed. */
    private function onlineCount(): int
    {
        $path = $this->file('recent.bin');
        if (!is_file($path)) {
            return 0;
        }
        $blob = (string) @file_get_contents($path);
        $cutoff = $this->now - (int) $this->cfg['online_window'];
        $online = 0;
        for ($i = 0, $n = strlen($blob) - 8; $i <= $n; $i += 8) {
            $stamp = unpack('N', substr($blob, $i + 4, 4));
            if ((int) $stamp[1] >= $cutoff) {
                $online++;
            }
        }
        return $online;
    }

    /**
     * Who the visitor is, for one day only: the first four bytes of
     * sha256(secret + date + IP + User-Agent). The date in the hash is what
     * makes yesterday's key un-relatable to today's.
     */
    private function visitorKey(string $ua): string
    {
        $material = $this->cfg['secret'] . '|' . $this->dayKey() . '|' . $this->clientIp() . '|' . $ua;
        return (string) hex2bin(substr(hash('sha256', $material), 0, 8));
    }

    /**
     * The client address as the front end sees it. A proxy header is trusted
     * only for its *first* hop and only to spread visitors apart — it never
     * grants anything, so a forged one can at worst inflate uniques.
     */
    private function clientIp(): string
    {
        foreach (array('HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR') as $header) {
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

    /* ------------------------------------------------------ state on disk */

    /** The aggregate, or a freshly minted one. Never throws. */
    private function readState(): array
    {
        $raw = @file_get_contents($this->file('state.json'));
        $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

        if (!is_array($data) || !isset($data['v']) || (int) $data['v'] !== self::STATE_VERSION) {
            return $this->freshState();
        }
        return $this->normalizeState($data);
    }

    private function freshState(): array
    {
        return array(
            'v' => self::STATE_VERSION,
            'since' => $this->dayKey(),
            'totals' => array('views' => 0, 'visits' => 0, 'uniques' => 0, 'bots' => 0),
            'today' => array('date' => $this->dayKey(), 'views' => 0, 'visits' => 0, 'uniques' => 0),
            'hours' => array_fill(0, 24, 0),
            'dow' => array_fill(0, 7, 0),
            'days' => array(),
            'pages' => array(),
            'langs' => array(),
            'refs' => array(),
            'tech' => array('device' => array(), 'browser' => array(), 'os' => array()),
            'peak' => array(
                'day' => array('date' => $this->dayKey(), 'views' => 0),
                'hour' => array('hour' => 0, 'views' => 0, 'date' => $this->dayKey()),
            ),
            'updated' => $this->now,
        );
    }

    /** A hand-edited or half-written file must not be able to crash a hit. */
    private function normalizeState(array $d): array
    {
        $fresh = $this->freshState();
        $out = array_merge($fresh, $d);

        foreach (array('totals', 'today', 'peak', 'tech') as $branch) {
            $out[$branch] = is_array($out[$branch])
                ? array_merge($fresh[$branch], $out[$branch])
                : $fresh[$branch];
        }
        foreach (array('hours' => 24, 'dow' => 7) as $field => $size) {
            $list = is_array($out[$field]) ? array_values($out[$field]) : array();
            for ($i = 0; $i < $size; $i++) {
                $list[$i] = isset($list[$i]) ? (int) $list[$i] : 0;
            }
            $out[$field] = array_slice($list, 0, $size);
        }
        foreach (array('days', 'pages', 'langs', 'refs') as $field) {
            $out[$field] = is_array($out[$field]) ? $out[$field] : array();
        }
        foreach (array('device', 'browser', 'os') as $field) {
            $out['tech'][$field] = isset($out['tech'][$field]) && is_array($out['tech'][$field])
                ? $out['tech'][$field]
                : array();
        }
        foreach (array('day', 'hour') as $field) {
            $out['peak'][$field] = isset($out['peak'][$field]) && is_array($out['peak'][$field])
                ? array_merge($fresh['peak'][$field], $out['peak'][$field])
                : $fresh['peak'][$field];
        }
        // `strict_types` means a hand-edited "views": 5.0 would otherwise
        // reach a float where an int is declared.
        foreach (array('views', 'visits', 'uniques', 'bots') as $field) {
            $out['totals'][$field] = (int) $out['totals'][$field];
        }
        foreach (array('views', 'visits', 'uniques') as $field) {
            $out['today'][$field] = (int) $out['today'][$field];
        }
        $out['peak']['day']['views'] = (int) $out['peak']['day']['views'];
        $out['peak']['hour']['views'] = (int) $out['peak']['hour']['views'];
        $out['peak']['hour']['hour'] = (int) $out['peak']['hour']['hour'];
        $out['since'] = (string) $out['since'];
        $out['today']['date'] = (string) $out['today']['date'];

        return $out;
    }

    /**
     * Replace the state in one step: write a temporary file, then rename it
     * over the old one. A reader (the statistics path takes no lock) therefore
     * always sees one complete document — never a half-written one.
     */
    private function writeState(array $state): void
    {
        $path = $this->file('state.json');
        $tmp = $path . '.' . getmypid() . '.tmp';
        $json = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if ($json === false || @file_put_contents($tmp, $json) === false) {
            @unlink($tmp);
            return;
        }
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
        }
        $this->cacheDelete('stats');
    }

    private function lock(): void
    {
        $this->ensureDir();
        $handle = @fopen($this->dir . '/.lock', 'c');
        if (is_resource($handle) && @flock($handle, LOCK_EX)) {
            $this->lock = $handle;
        } elseif (is_resource($handle)) {
            fclose($handle);
        }
    }

    private function unlock(): void
    {
        if (is_resource($this->lock)) {
            @flock($this->lock, LOCK_UN);
            fclose($this->lock);
        }
        $this->lock = null;
    }

    private function file(string $name): string
    {
        $this->ensureDir();
        return $this->dir . '/' . $name;
    }

    /**
     * Create the data directory on first use, and — since the default puts it
     * inside the web root — drop in the two guards that keep Apache from
     * serving its contents. (The files hold no personal data either way.)
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
                "# Counter data — not for the public.\n"
                . "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n"
                . "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n"
            );
            @file_put_contents($this->dir . '/index.html', '');
        }
    }

    /* ------------------------------------------------------- APCu (optional) */

    private function apcu(): bool
    {
        static $has = null;
        if ($has === null) {
            $has = function_exists('apcu_fetch') && function_exists('apcu_inc')
                && ini_get('apc.enabled') !== '0';
        }
        return $has;
    }

    /** One recorded write per visitor per page per `hit_cooldown` seconds. */
    private function passCooldown(string $key, string $page): bool
    {
        $cooldown = (int) $this->cfg['hit_cooldown'];
        if ($cooldown <= 0 || !$this->apcu()) {
            return true;
        }
        return apcu_add('hit:' . bin2hex($key) . ':' . md5($page), 1, $cooldown);
    }

    private function cacheGet(string $name)
    {
        if (!$this->apcu()) {
            return null;
        }
        $value = apcu_fetch($this->cacheKey($name), $ok);
        return $ok ? $value : null;
    }

    private function cacheSet(string $name, $value, int $ttl): void
    {
        if ($this->apcu()) {
            apcu_store($this->cacheKey($name), $value, $ttl);
        }
    }

    private function cacheDelete(string $name): void
    {
        if ($this->apcu()) {
            apcu_delete($this->cacheKey($name));
        }
    }

    /** Namespaced by data directory, so two installations cannot share a slot. */
    private function cacheKey(string $name): string
    {
        return 'codex-counter:' . substr(md5($this->dir), 0, 8) . ':' . $name;
    }

    /* ---------------------------------------------------------- small parts */

    private function localTime(): DateTime
    {
        $time = new DateTime('@' . $this->now);
        $time->setTimezone($this->tz);
        return $time;
    }

    private function dayKey(?int $stamp = null): string
    {
        $time = new DateTime('@' . ($stamp === null ? $this->now : $stamp));
        $time->setTimezone($this->tz);
        return $time->format('Y-m-d');
    }

    /** A query parameter, length-capped and stripped of anything unexpected. */
    private function param(string $name, int $max, string $strip): string
    {
        if (!isset($_GET[$name]) || !is_string($_GET[$name])) {
            return '';
        }
        return substr(preg_replace($strip, '', $_GET[$name]), 0, $max);
    }

    /**
     * Where the visit came from. The browser's own `Referer` on a same-origin
     * fetch is the page itself, so the app sends the host it saw in
     * `document.referrer`; this only sanitizes it and drops our own domain.
     */
    private function referrerHost(): string
    {
        $host = strtolower($this->param('r', 60, '~[^A-Za-z0-9.:-]~'));
        $host = preg_replace('~^www\.~', '', $host);
        $self = isset($_SERVER['HTTP_HOST']) ? strtolower((string) $_SERVER['HTTP_HOST']) : '';

        if ($host === '' || $host === $self || $host === preg_replace('~^www\.~', '', $self)) {
            return '';
        }
        return $host;
    }

    private function device(string $ua): string
    {
        if (preg_match('~ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))~i', $ua) === 1) {
            return 'tablet';
        }
        if (preg_match('~mobi|iphone|ipod|android|windows phone|blackberry~i', $ua) === 1) {
            return 'mobile';
        }
        return 'desktop';
    }

    /** Order matters: every Chromium browser also claims to be Chrome. */
    private function browser(string $ua): string
    {
        $tests = array(
            'Yandex' => '~yabrowser~i',
            'Edge' => '~edg[ea]?/~i',
            'Opera' => '~opr/|opera~i',
            'Samsung' => '~samsungbrowser~i',
            'Vivaldi' => '~vivaldi~i',
            'Firefox' => '~firefox|fxios~i',
            'Chrome' => '~chrome|crios|chromium~i',
            'Safari' => '~safari~i',
        );
        foreach ($tests as $name => $pattern) {
            if (preg_match($pattern, $ua) === 1) {
                return $name;
            }
        }
        return 'Other';
    }

    private function os(string $ua): string
    {
        $tests = array(
            'iOS' => '~iphone|ipad|ipod|ios~i',
            'Android' => '~android~i',
            'Windows' => '~windows~i',
            'macOS' => '~macintosh|mac os x~i',
            'Linux' => '~linux|ubuntu|fedora|debian~i',
        );
        foreach ($tests as $name => $pattern) {
            if (preg_match($pattern, $ua) === 1) {
                return $name;
            }
        }
        return 'Other';
    }

    /**
     * Increment one tally and keep the map bounded: once it is full, only keys
     * already in it grow. Trimming to the top N would let a burst of new keys
     * evict the leaders, so the cap is a doorway rather than an eviction.
     */
    private function bump(array &$map, string $key, int $cap): void
    {
        if (isset($map[$key])) {
            $map[$key]++;
            return;
        }
        if (count($map) < $cap) {
            $map[$key] = 1;
            return;
        }
        $map['*'] = isset($map['*']) ? $map['*'] + 1 : 1;
    }

    /** A tally map as a sorted list of the N largest entries. */
    private function topList(array $map, int $limit): array
    {
        arsort($map);
        $out = array();
        foreach (array_slice($map, 0, $limit, true) as $key => $count) {
            $out[] = array('key' => (string) $key, 'count' => (int) $count);
        }
        return $out;
    }

    private function dayRow(array $days, string $date): array
    {
        $row = isset($days[$date]) ? $days[$date] : array(0, 0, 0);
        return array('date' => $date, 'views' => (int) $row[0], 'visits' => (int) $row[1], 'uniques' => (int) $row[2]);
    }

    /** Sum the last N calendar days, today included. */
    private function windowSum(array $days, int $count): array
    {
        $views = 0;
        $visits = 0;
        $uniques = 0;
        for ($i = 0; $i < $count; $i++) {
            $row = isset($days[$this->dayKey($this->now - $i * 86400)])
                ? $days[$this->dayKey($this->now - $i * 86400)]
                : null;
            if ($row === null) {
                continue;
            }
            $views += (int) $row[0];
            $visits += (int) $row[1];
            $uniques += (int) $row[2];
        }
        return array('views' => $views, 'visits' => $visits, 'uniques' => $uniques);
    }

    /** Consecutive days with at least one view, counting back from today. */
    private function streak(array $days): int
    {
        $streak = 0;
        for ($i = 0; $i < (int) $this->cfg['keep_days'] + 1; $i++) {
            $date = $this->dayKey($this->now - $i * 86400);
            $views = isset($days[$date]) ? (int) $days[$date][0] : 0;
            if ($views > 0) {
                $streak++;
            } elseif ($i > 0) {
                break; // today may still be empty without breaking the streak
            }
        }
        return $streak;
    }

    private function daysBetween(string $from, string $to): int
    {
        $a = DateTime::createFromFormat('Y-m-d|', $from, $this->tz);
        $b = DateTime::createFromFormat('Y-m-d|', $to, $this->tz);
        if (!$a || !$b) {
            return 0;
        }
        return (int) $a->diff($b)->days;
    }

    private function ratio(int $numerator, int $denominator): float
    {
        return $denominator > 0 ? round($numerator / $denominator, 2) : 0.0;
    }
}

/* ------------------------------------------------------------------ run it */

$action = isset($_GET['a']) && is_string($_GET['a']) ? preg_replace('~[^a-z]~', '', $_GET['a']) : 'pulse';

$counter = new VisitorCounter($CONFIG);
$counter->handle($action === '' ? 'pulse' : $action);
