# Visitor counter — `counter.php`

The server half of the header's odometer and the visitors' chronicle behind it.
One PHP file, no database, no extensions required. Written for **PHP 7.3** and
tested against the live host (7.3.33, APCu present).

---

## 1. What it is

| | |
|---|---|
| **Endpoint** | `https://www.abc-guitars.com/counter/counter.php` |
| **The app calls it as** | `/counter/counter.php` — site-root-relative (`COUNTER.endpoint` in `app/src/config.ts`) |
| **Method** | GET only |
| **Answers** | JSON, always `Cache-Control: no-store` |
| **Writes** | three small files in `counter-data/`, created on first run |
| **Needs** | a writable directory. Nothing else. |

### The four actions

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

---

## 2. Install

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

---

## 3. Verify it works

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

---

## 4. How it keeps the figures without a database

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

### What it costs

From the live host's own `?a=selftest`: building the full statistics document
takes **0.8 ms**, the whole request **1.4 ms**. A recorded hit is the same order
of magnitude. The design serializes writes on one lock, which is what keeps two
simultaneous visitors from losing a count; it is comfortable into the tens of
requests per second, which is far above what this site sees.

---

## 5. Privacy

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

---

## 6. Maintenance

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
`app/src/config.ts` removes the widget, the panel and every request; the header
goes back to the plain `✦ CODEX` wordmark.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `"error":"internal error"` | An exception; the reason is in the PHP error log. | Check the log; run `?a=selftest`. |
| `data_dir_writable: false` | The web server user cannot write beside the script. | Create `counter-data/` by hand and give it write permission, or point `data_dir` somewhere writable. |
| Figures never move | The app is reading, not recording. | `COUNTER.record` in `app/src/config.ts` is `import.meta.env.PROD` — development reads with `?a=pulse` on purpose. A production build records. |
| `"status":"throttled"` on every hit | Two views of the same page by the same visitor inside `hit_cooldown` (5 s). | Expected. Raise or lower `hit_cooldown`. |
| `"status":"crawler"` from a real browser | The User-Agent matched `bot_pattern`. | Narrow the pattern. |
| Uniques look high | Each device *and* browser is its own visitor (the key includes the User-Agent), and a shared IP behind a proxy is split by UA rather than merged. | By design — it is the price of using no cookies. |
| `online` is always 0 | Nobody has loaded a page in the last `online_window` (300 s). | Expected on a quiet site. |
| A JSON file appears in a search engine | `counter-data/` is inside the web root on a server that ignores `.htaccess` (nginx). | Move `data_dir` outside the web root. Nothing in it is personal data. |
