# Server layer — `server/`

Everything the site runs on the server side: three small PHP scripts and two
`.htaccess` snippets. No database, no framework, no required extensions.
Written for **PHP 7.3** and the live host (Apache, PHP 7.3.33, APCu present).

---

## Overview

| File | Uploaded to | What it is | The app needs it? |
|---|---|---|---|
| `counter.php` | `/counter/counter.php` | The visitor counter and statistics behind the header's odometer. | For the odometer only — `COUNTER.endpoint` |
| `facts.php` | `/api/facts.php` | One response with every dossier's four searchable fields for a language, instead of one request per `*.bio.json`. | **No** — an accelerator; `DOSSIER.endpoint` |
| `log.php` | `/api/log.php` | A sink for client error reports, so failures on browsers nobody here owns become visible. | **No** — `DIAGNOSTICS.endpoint` |
| `htaccess/root.htaccess` | merged **into** the site root's existing `.htaccess` | Compression for JSON/Markdown/SVG, cache headers for JSON, Markdown, photos and PDFs. | No — speed only |
| `htaccess/immutable.htaccess` | `/assets/.htaccess`, `/pdfjs/.htaccess` (copied by the build) | One-year immutable caching for hashed / version-pinned files. | No — speed only |

The endpoints are configured in `apps/guitar-codex/src/config.ts`:
`COUNTER.endpoint`, `DOSSIER.endpoint` and `DIAGNOSTICS.endpoint`. All three are
resolved against the **site root**, not the application base, so a
`--base=/fable/` build still finds them. One caveat for `facts.php`: a copy
serves **one** content tree — by default the site root's `<lang>/` folders. A
second deployment with its own content under `/fable/<lang>/` needs its own
copy (e.g. `/fable/api/facts.php`, whose default `content_dir` is then
`/fable/`) or a `content_dir` pointed at that tree; otherwise it would be
answered with the root deployment's facts.

**The app works without `facts.php` and `log.php`.** They are accelerators with
a client-side fallback, never dependencies: when `facts.php` is missing, slow or
broken, the browser reads the dossiers one by one as it always did; when
`log.php` is missing, a failure is simply not reported. Both endpoints are set
to `""` in development (`npm run dev` has no PHP), and an empty string switches
the feature off. A static mirror or a staging copy without PHP keeps working.

Ground rules every script here follows (`docs/performance-analysis.md` §10.6):
one configuration block at the top, every input whitelisted, never a file path
taken from the request, never a filesystem path in a response, data
directories created on first use with a deny `.htaccess` and an empty
`index.html`, writes made atomic with a temp file + `rename()` or serialized
with `flock`, APCu used when present and never depended on, and a `?a=selftest`
action to run once after uploading.

---

## A. Visitor counter — `counter.php`

The server half of the header's odometer and the visitors' chronicle behind it.
One PHP file, no database, no extensions required. Written for **PHP 7.3** and
tested against the live host (7.3.33, APCu present).

### 1. What it is

| | |
|---|---|
| **Endpoint** | `https://www.abc-guitars.com/counter/counter.php` |
| **The app calls it as** | `/counter/counter.php` — site-root-relative (`COUNTER.endpoint` in `apps/guitar-codex/src/config.ts`) |
| **Method** | GET only |
| **Answers** | JSON, always `Cache-Control: no-store` |
| **Writes** | three small files in `counter-data/`, created on first run |
| **Needs** | a writable directory. Nothing else. |

#### The four actions

| URL | What it does |
|---|---|
| `?a=hit&p=<slug>&l=<lang>&r=<host>` | Records one page view, answers with the counter figures. |
| `?a=pulse` | The same figures, **records nothing**. |
| `?a=stats` | The full statistics document (cached 20 s). |
| `?a=selftest` | Diagnostics: permissions, locking, APCu, timings. Records nothing. |

Every parameter is optional and every one is length-capped and stripped of
anything unexpected before it is used. `p` is the entry slug (so the panel can
show "most-read entries"), `l` is the UI language the reader had chosen, `r` is
the **host only** of `document.referrer` — the app never sends a full URL.

### 2. Install

1. **Upload** `counter.php` to `https://www.abc-guitars.com/counter/counter.php`
   (the directory the app already expects).

2. **Set your own secret.** Open the file and edit one line in the
   configuration block at the top:

   ```php
   'secret' => 'CHANGE-THIS-TO-A-LONG-RANDOM-STRING-4f8c1e',
   ```

   Any long random string. It is mixed with the date to derive the per-day
   visitor salt; changing it later costs one day of slightly inflated uniques
   and nothing else.

3. **Check the timezone** — `'timezone' => 'Europe/Berlin'`. Every "day" and
   "hour" in the statistics is measured in it.

4. **Optionally carry over an older count.** `'seed'` is added to the lifetime
   totals on the way out and never stored, so the odometer can start from the
   old site's figure and still show real growth on top of it:

   ```php
   'seed' => array('views' => 120000, 'visits' => 0, 'uniques' => 0),
   ```

5. **Run the self-test once**, in a browser or with curl:

   ```bash
   curl -s "https://www.abc-guitars.com/counter/counter.php?a=selftest"
   ```

   Every check should be `true` and `advice` should end with
   `Installation looks healthy.` The checks that matter are
   `data_dir_writable`, `flock`, `atomic_rename` and `secret_changed`.

6. **Drop the development origins** when you are done testing — the two
   `localhost:5173` entries in `'allow_origins'`. They only matter for a
   browser reading the endpoint directly from a dev server; the production app
   is same-origin and needs no entry at all.

That is the whole installation. The `counter-data/` directory, its `.htaccess`
and its `index.html` guard are created on the first request.

### 3. Verify it works

Run these in order against the live URL. The figures should move exactly as the
comments say — this is the same sequence used to test the endpoint.

```bash
U="https://www.abc-guitars.com/counter/counter.php"
A="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"

# 1. a recorded view — "status":"counted", views +1
curl -s -A "$A" "$U?a=hit&p=aguado1&l=de&r=google.com"

# 2. the same visitor, the same page, at once — "status":"throttled", nothing moves
curl -s -A "$A" "$U?a=hit&p=aguado1&l=de&r=google.com"

# 3. the same visitor, another page — "status":"counted", views +1, visits unchanged
curl -s -A "$A" "$U?a=hit&p=albeniz1&l=de"

# 4. a crawler — "status":"crawler", only the bot tally moves
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1)" "$U?a=hit&p=aguado1"

# 5. read without recording
curl -s "$U?a=pulse"

# 6. the whole document
curl -s "$U?a=stats"
```

### 4. How it keeps the figures without a database

Everything reported is an **aggregate**, and aggregates are tiny and only ever
read whole — so a relational store would add a connection, a schema and a daily
maintenance job to hold about 20 KB of numbers. Instead, `counter-data/` holds:

| File | Holds | Size |
|---|---|---|
| `state.json` | the whole aggregate: totals, 90 days of history, today's 24 hours, all-time weekdays, tallies per page / tongue / referrer / device / browser / system, peaks | ~10–40 KB, bounded |
| `seen.bin` | today's visitor keys, 4 raw bytes each — the "unique visitors today" figure | 4 bytes × uniques today |
| `recent.bin` | visitor key + timestamp (8 bytes) for the last 30 minutes — drives both "online now" and sessionization | 8 bytes × visitors in the last half hour |

One recorded view costs three small reads, one JSON decode/encode and three
small writes, all inside one `flock` on a separate lock file. `state.json` is
replaced by writing a temporary file and `rename()`ing it over the old one, so
the `?a=stats` path — which takes **no** lock — can never read a half-written
document.

Nothing grows without a ceiling: `keep_days` (90) trims the history, `max_pages`
(150) and `max_refs` (40) cap the tally maps, `max_seen` (20 000) caps the daily
key file, and `recent.bin` is pruned to the session window on every write.
Beyond a cap, existing keys keep counting and new ones fall into a single
`"*"` bucket the panel shows as "other".

**APCu**, when present, is used for two things and depended on for neither: a
flood guard (one recorded write per visitor per page per `hit_cooldown` seconds)
and a 20-second cache of the built statistics document. Without it everything
still works, a little slower, and the per-visitor daily ceiling does not apply.

#### What it costs

From the live host's own `?a=selftest`: building the full statistics document
takes **0.8 ms**, the whole request **1.4 ms**. A recorded hit is the same order
of magnitude. The design serializes writes on one lock, which is what keeps two
simultaneous visitors from losing a count; it is comfortable into the tens of
requests per second, which is far above what this site sees.

### 5. Privacy

No cookies. No IP address and no user agent is ever stored. A visitor is
identified for one day only, by the first four bytes of

```
sha256(secret + today's date + IP + User-Agent)
```

The date inside the hash is what makes yesterday's key unrelatable to today's.
The data files therefore contain no personal data — which is also why keeping
`counter-data/` inside the web root is not a leak. Move it out anyway if you
prefer (`'data_dir' => '/home/you/counter-data'`); it is created wherever you
point it.

Referrers are stored as a bare host (`google.com`), never a full URL, and the
site's own host is dropped.

### 6. Maintenance

**Reset the counter.** Delete the three files in `counter-data/`. The next
request starts a fresh `state.json` with today as `since`. Keep `seed` if you
want the displayed total to survive the reset.

**Back it up.** `state.json` is the only file worth keeping; the other two are
today's working set.

**Hand-edit it.** You can, carefully, with the site quiet: the loader
normalizes what it reads and falls back to a fresh state rather than crashing on
a malformed file. Bumping `totals.views` by hand works; so does deleting a row
from `pages`.

**Turn the whole feature off in the app.** `COUNTER.enabled = false` in
`apps/guitar-codex/src/config.ts` removes the widget, the panel and every
request; the header goes back to the plain `✦ CODEX` wordmark.

### 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `"error":"internal error"` | An exception; the reason is in the PHP error log. | Check the log; run `?a=selftest`. |
| `data_dir_writable: false` | The web server user cannot write beside the script. | Create `counter-data/` by hand and give it write permission, or point `data_dir` somewhere writable. |
| Figures never move | The app is reading, not recording. | `COUNTER.record` in `apps/guitar-codex/src/config.ts` is `import.meta.env.PROD` — development reads with `?a=pulse` on purpose. A production build records. |
| `"status":"throttled"` on every hit | Two views of the same page by the same visitor inside `hit_cooldown` (5 s). | Expected. Raise or lower `hit_cooldown`. |
| `"status":"crawler"` from a real browser | The User-Agent matched `bot_pattern`. | Narrow the pattern. |
| Uniques look high | Each device *and* browser is its own visitor (the key includes the User-Agent), and a shared IP behind a proxy is split by UA rather than merged. | By design — it is the price of using no cookies. |
| `online` is always 0 | Nobody has loaded a page in the last `online_window` (300 s). | Expected on a quiet site. |
| A JSON file appears in a search engine | `counter-data/` is inside the web root on a server that ignores `.htaccess` (nginx). | Move `data_dir` outside the web root. Nothing in it is personal data. |

---

## B. Dossier facts aggregator — `facts.php`

The name and year search and the herald's "on this day" need four fields from
every dossier of a language. Without this endpoint the browser reads them one
`<lang>/*.bio.json` at a time — 736 requests (~910 KB) for Russian alone. With
it: one request, ~53 KB raw / ~18 KB gzip. Design and measurements:
`docs/performance-analysis.md` §10.3.

### 1. Contract

| | |
|---|---|
| **Endpoint** | `https://www.abc-guitars.com/api/facts.php` |
| **The app calls it as** | `/api/facts.php?lang=<xx>` — site-root-relative (`DOSSIER.endpoint` in `apps/guitar-codex/src/config.ts`) |
| **Method** | GET (HEAD answered as GET; OPTIONS for CORS preflight; anything else 405) |
| **Input** | `lang` only — must match `^[a-z]{2}$` **and** be an existing directory under `content_dir`, else `404 {"error":"unknown language"}`. No other input; no path ever comes from the request. |
| **Answers** | `200 application/json; charset=utf-8`, gzip when the client accepts it · `304` when `If-None-Match` matches |
| **Headers** | `ETag: "f1-<lang>-<count>-<fingerprint>"`, `Cache-Control: no-cache`, `Vary: Accept-Encoding`, `X-Content-Type-Options: nosniff` |
| **Writes** | `facts-cache/facts-<lang>.json`, created on first use; safe to delete at any time |

```json
{ "v": 1, "lang": "ru", "count": 736,
  "entries": { "abiton": ["Жерар", "Абитон", "1954", ""],
               "abreu":  ["Зекинья", "де Абреу", "19.09.1880", "22.01.1935"] } }
```

- Keyed by the dossier's basename (the file name minus `.bio.json`) — what
  `index.json`'s `json` field names — sorted, so the output is stable.
- Each value is `[forename, surname, dates.born, dates.died]` from the file's
  `metadata`, **raw**: trimmed, cut to 120 characters, anything that is not a
  string becomes `""`. Folding and date parsing stay in the browser
  (`lib/dossier/facts.ts`), so there is still one folding rule in the project.
- A file that is unreadable, not JSON, or has no `metadata` object is left out;
  `count` is the number of entries actually in the document.
- `f1` in the ETag and `v` in the body are the schema version; they change
  together.

### 2. Freshness — why this is not a precomputed file

The project rule is that cross-entry metadata is never frozen into a generated
file, because a build-time `facts-<lang>.json` once kept an edited birth year
out of the search until the next rebuild. This endpoint does not do that:

- On **every** request it lists the language directory and `stat()`s every
  `*.bio.json`. Their **count** and a **fingerprint of every file's name,
  mtime and size** are the validator — the ETag.
- A built document is reused (from APCu, keyed by language, or from the cache
  file, whose first line is the ETag it was built for) **only while that
  validator is unchanged**. A copy built for another validator is never
  served.
- So an edited, added or removed dossier shows on the very next request.
  `pages/` stays the only home of a fact.

The stat pass is the whole per-request cost when nothing changed (see
`stat_ms` in the self-test); a rebuild after an edit costs `build_ms` once.

The fingerprint covers **every** dossier's own mtime and size, not just the
newest one, and that is deliberate. An upload tool that *preserves the source
file's timestamp* can replace a dossier with an edited copy whose mtime is
older than the newest already on the server; "count + newest mtime" would not
notice, and a one-digit correction (`1954` → `1955`) does not change the size
either. The edited file's own mtime has still changed, so the fingerprint has.
The only edit that stays invisible is one that leaves a file's name, mtime
*and* size all exactly as they were — which no ordinary upload does.

### 3. Install

1. **Upload** `facts.php` to `https://www.abc-guitars.com/api/facts.php`.
2. **Check `content_dir`.** The default, `dirname(__DIR__)`, is the directory
   above `/api/` — the site root, where the deployed dossiers live
   (`/ru/abiton.bio.json`). Change it only if the content lives elsewhere.
3. **Run the self-test once:**

   ```bash
   curl -s "https://www.abc-guitars.com/api/facts.php?a=selftest"
   ```

   `ok` should be `true`, `languages` should list every language with its
   dossier count, and `advice` should read `Installation looks healthy.` Worth
   reading: `stat_ms` (the per-request cost), `build_ms` (the cost of one
   rebuild), `largest_bytes` / `largest_gzip_bytes`, `cache_atomic_rename`.
   The self-test reports no filesystem paths.
4. **Drop the development origins** in `'allow_origins'` when you are done
   testing, as for the counter.

The self-test also reports three probes nothing uses yet — `imagick`,
`imagick_pdf` (`Imagick::queryFormats('PDF')` is non-empty) and `exec` — for
the decision on rendering PDF pages to images on the server
(`docs/performance-analysis.md` §10.5). `imagick_pdf: true` means ImageMagick
knows the format; it still needs Ghostscript to actually render one.

### 4. Verify it works

```bash
U="https://www.abc-guitars.com/api/facts.php"

# 1. the document — 200, JSON with "v":1,"lang":"ru"
curl -s --compressed "$U?lang=ru" | head -c 300; echo

# 2. compressed on the wire — must print "Content-Encoding: gzip"
curl -s -o /dev/null -D - -H "Accept-Encoding: gzip" "$U?lang=ru" | grep -i '^content-encoding'

# 3. conditional request — must print 304
ETAG=$(curl -s -o /dev/null -D - "$U?lang=ru" | tr -d '\r' | sed -n 's/^[Ee][Tt][Aa][Gg]: //p')
echo "$ETAG"
curl -s -o /dev/null -w "%{http_code}\n" -H "If-None-Match: $ETAG" "$U?lang=ru"

# 4. unknown or malformed language — 404 {"error":"unknown language"}
curl -s "$U?lang=xx"; echo
curl -s "$U?lang=../ru"; echo

# 5. wrong method — 405
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$U?lang=ru"
```

Freshness check: edit (or `touch`) any `ru/*.bio.json` on the server, then
repeat step 3 with the **old** ETag — it must now answer `200` with a new ETag.

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `404 unknown language` for a real language | `content_dir` does not point at the directory holding `<lang>/`. | Check `content_dir`; the self-test's `languages` must list it. |
| `"error":"internal error"` | An exception; the reason is in the PHP error log (`[facts] …`). | Check the log; run `?a=selftest`. |
| No `Content-Encoding: gzip` | zlib missing, or `zlib.output_compression` on (then PHP compresses — look for the header anyway). | Self-test: `zlib`, `gzip_by_script`. `root.htaccess` lets mod_deflate compress instead. |
| `cache_atomic_rename: false` | The script cannot write `facts-cache/`. | Create it by hand with write access. The endpoint still works — it rebuilds whenever APCu has no copy. |
| The app still makes hundreds of `*.bio.json` requests | The endpoint failed or timed out and the app fell back to the crawl — by design. | Open the endpoint in a browser; check `DOSSIER.endpoint`. |

---

## C. Client error sink — `log.php`

When the app hits a failure it cannot recover from — a document that will not
open, a chunk that will not load — it sends one small report here. The
failures worth hearing about happen on phones nobody on the project owns; this
makes them visible.

### 1. Contract

| | |
|---|---|
| **Endpoint** | `https://www.abc-guitars.com/api/log.php` |
| **The app calls it as** | `/api/log.php` — site-root-relative (`DIAGNOSTICS.endpoint` in `apps/guitar-codex/src/config.ts`), via `navigator.sendBeacon` |
| **Method** | POST (OPTIONS for CORS preflight; `GET ?a=selftest`; anything else 405) |
| **Body** | raw request body, any Content-Type (`sendBeacon` with a string sends `text/plain`), **at most 4096 bytes**, one JSON object |
| **Answers** | `204` stored · `400` not a report · `413` too large · `429` too many (`Retry-After: 60`) · `500` could not write |
| **Writes** | `log-data/client-errors.log` (+ `client-errors.log.1`), created on first use |

```json
{ "where": "pdf", "name": "TypeError", "message": "…toHex is not a function",
  "page": "#/magazine-2017-1", "lang": "de",
  "extra": { "tier": "low", "bytes": 61234567 } }
```

| Field | Cap (characters) |
|---|---|
| `where` — which part of the app | 40 |
| `name` — the error's name | 80 |
| `message` — the engine's message | 300 |
| `page` — the location hash/path | 200 |
| `lang` — the UI language | 8 |
| `extra` — optional flat object | ≤ 8 keys (`A-Za-z0-9_.-`, ≤ 24 chars), scalar values ≤ 80 chars |

Unknown keys are dropped, nested values in `extra` are dropped, every value is
coerced to a string, control characters are replaced by a space, and every
field is cut to its cap. A body that is not a JSON object, or that has none of
the five fields filled in, is rejected with `400`.

Each stored line is one JSON object:

```json
{"time":"2026-09-30T14:02:11+02:00","where":"pdf","name":"TypeError","message":"…","page":"#/magazine-2017-1","lang":"de","extra":{"tier":"low","bytes":"61234567"},"ua":"Mozilla/5.0 (Linux; Android 9; …)"}
```

### 2. Privacy

No cookies. **No IP address is stored.** A line holds the server time, the
sanitized report and the browser's User-Agent string (cut to 300 characters) —
the User-Agent is the point, because it names the engine that failed.

Rate limiting needs to tell visitors apart for one minute. It does so in APCu
only, under the key `sha256(secret + date + IP)` cut to 8 hex digits; that key
is never written to disk, and APCu forgets it within two minutes. The IP is the
connecting address — nothing the client sends (a User-Agent, an
`X-Forwarded-For`) takes part, or changing it would buy a fresh allowance.
Behind a proxy or CDN you control, set `'trust_proxy_headers' => true` so
visitors are not all counted as the proxy. Limits: 10 reports per visitor per minute, 120 per minute from
everyone together. Without APCu there is no rate limit — only the size caps
and the rotation below bound the log.

### 3. Install

1. **Upload** `log.php` to `https://www.abc-guitars.com/api/log.php`.
2. **Set your own secret** in the configuration block (any long random
   string); check `timezone` (default `Europe/Berlin`, like the counter).
3. **Run the self-test once:**

   ```bash
   curl -s "https://www.abc-guitars.com/api/log.php?a=selftest"
   ```

   `ok` should be `true`; the checks that matter are `data_dir_writable`,
   `write_probe`, `flock` and `secret_changed`. `apcu: false` is not fatal —
   it only means no rate limit.
4. **Drop the development origins** in `'allow_origins'` when you are done.

Verify:

```bash
L="https://www.abc-guitars.com/api/log.php"

# a report — 204
curl -s -o /dev/null -w "%{http_code}\n" -H "Content-Type: text/plain" \
  --data '{"where":"install","name":"Test","message":"hello from curl","page":"#/","lang":"de"}' "$L"

# not a report — 400
curl -s -o /dev/null -w "%{http_code}\n" --data 'not json' "$L"

# too large — 413
head -c 5000 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -w "%{http_code}\n" --data-binary @- "$L"

# wrong method — 405
curl -s -o /dev/null -w "%{http_code}\n" "$L"
```

### 4. Reading and rotating the log

The log is **not** readable over the web — `log-data/` carries a deny
`.htaccess`. Read it over FTP/SSH:

```bash
tail -n 20 api/log-data/client-errors.log
# one report per line; with jq:
tail -n 50 api/log-data/client-errors.log | jq -c '{time, where, name, message, ua}'
```

Rotation is automatic: when `client-errors.log` passes `rotate_bytes`
(512 KB) it is renamed to `client-errors.log.1`, replacing the previous one,
and a new log begins. At most about 1 MB is ever kept. Size check, rotation and
append all happen under one `flock` on `log-data/.lock`, so two reports can
neither interleave nor rotate twice. To clear it, delete both files; they are
recreated on the next report.

---

## D. `.htaccess` snippets — `htaccess/`

Compression and cache headers are configuration, not code; no PHP should sit in
front of a static file. Every directive is wrapped in `<IfModule>`, so a host
without the module ignores it instead of answering 500.

### `root.htaccess` — merge into the site root

The site root belongs to the **legacy site** and already has its own
`.htaccess`. **Do not overwrite it and do not upload this file as
`.htaccess`.** Open the existing root `.htaccess`, paste the contents of
`root.htaccess` at the end, keep everything that was there.

It compresses `application/json`, `text/markdown`, `text/plain` and
`image/svg+xml` (Apache already compresses JS/CSS/WASM; `index.json` went out
raw at ~223 KB), sets `Cache-Control: no-cache` on `*.json` and `*.md` (the
browser revalidates and gets a cheap `304`, so an edit shows on the next
reload), and lets photos and PDFs be cached for 30 days.

### `immutable.htaccess` — `/assets/` and `/pdfjs/`

`Cache-Control: public, max-age=31536000, immutable` for content-hashed
(`/assets/`) and version-pinned (`/pdfjs/`) files. The build copies it into
`dist/assets/.htaccess` and `dist/pdfjs/.htaccess`, so it is uploaded with the
app; keep the file's name.

### Verify

```bash
S="https://www.abc-guitars.com"

# JSON: Content-Encoding: gzip and Cache-Control: no-cache
curl -sI -H "Accept-Encoding: gzip" "$S/index.json" | grep -iE '^(content-encoding|cache-control)'

# an article: the same
curl -sI -H "Accept-Encoding: gzip" "$S/ru/abiton.bio.md" | grep -iE '^(content-encoding|cache-control)'

# a photo: Cache-Control: public, max-age=2592000
curl -sI "$S/<path-to-any-photo>.jpg" | grep -i '^cache-control'

# a hashed asset: Cache-Control: public, max-age=31536000, immutable
curl -sI "$S/assets/<any-hashed-file>.js" | grep -i '^cache-control'
```

If `Content-Encoding` or `Cache-Control` does not appear, the host is ignoring
`.htaccess` directives for that directory (`AllowOverride`) or lacks the
module; ask the host, and see `docs/performance-analysis.md` §10.4 for the PHP
fallback.
