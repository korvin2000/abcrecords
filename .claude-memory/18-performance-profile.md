# 18 · Performance profile — tiers, paint, PDF readers, server layer (2026-09-30)

> What the performance work changed and the rules it left behind. Source of
> truth: [`docs/performance-analysis.md`](../docs/performance-analysis.md)
> (§1a = what was implemented) and the code. Notes 12–15 were written before
> it; where they disagree with this note, this note and the code win.

## The one mechanism: grade × switch → two attributes → one stylesheet

| Piece | Where | What it does |
|---|---|---|
| Grade | `lib/fx/tier.ts` | `low`/`mid`/`high`. Static guess (cores, `deviceMemory`, Save-Data; **touch-only + reported ≤ 4 GB ⇒ `low`**), corrected by a CPU + rAF probe, cached per tab in `sessionStorage` (`codex-fx-tier`) |
| Switch | `lib/fx/store.ts` | The ✨ button. Default: off under reduced motion **and off on `low`**; a stored choice always wins |
| Attributes | `store.ts` `publish()` | `<html data-perf="…" data-fx="on\|off" data-lite="on\|off">`, written synchronously at module load — App no longer writes `data-fx`. `data-fx` = what moves; `data-lite` = a weak machine **or an explicit** ✨ off (not the reduced-motion default) = what is painted |
| Stylesheet | `styles/perf.css` (imported **last**) | Every paint reduction. "Lite" = `html[data-lite="on"] …`; motion rules key on `data-fx="off"`; "not high" = `html:not([data-perf="high"]) …` |
| JS readers | `perfTier()`, `isLite()`, `touchOnly()` from `@/lib/fx` | For decisions made outside CSS (PDF budgets, audio room, crawl policy, article deferral) |

Rules:

- A new blur / filter / blend / infinite animation needs its lite rule in
  `perf.css`. **No `backdrop-filter` on full-screen scrims** (they are plain
  `bg-ink-950/70` now); the top bar and search box blur only on `high` + fx on
  — their background lives in `perf.css` (`.topbar`, `.search-box`), not in a
  Tailwind utility.
- Animate `transform`/`opacity` only. The page turn and `leaf-in` carry no
  `filter`; below `high` they are a fade-and-rise (`page-in-lite`).
- Card hooks: `.card-portrait` (+ `--foreign`), `.card-grade`, `.card-frame`.
- DEV: `window.__fx.state`, `__fx.set(bool)`; pin a grade with `EFFECTS.tier`
  or `sessionStorage.setItem("codex-fx-tier","low")` + reload.

## Document viewer

```
PdfModal → PdfViewer (chooser, asks lib/pdf/pages for a manifest)
             ├─ PdfImageView      page JPEGs from <file>.pages/ — no engine at all
             └─ PdfDocumentView   pdf.js, loaded lazily from PdfViewer
                  └─ PdfPage (memo) → lib/pdf/queue (RenderQueue) → lib/pdf/engine
```

- **`lib/pdf/engine.ts` is the only importer of pdf.js, and it imports
  `pdfjs-dist/legacy/build/…`.** The modern build needs Chromium ≥ 145; older
  engines show "could not be opened" (128–139), blank pages (140–144) or a
  spinner (< 128). `manualChunks.pdf` names the legacy path; the version is
  pinned; `scripts/verify-pdf-build.mjs` (in `npm run verify`) checks the
  emitted worker is byte-identical to the legacy one.
- pdf.js's runtime data (cmaps, fonts, wasm) is served under
  `<base>pdfjs/<pdf.js version>/` — versioned because `pdfjs/` is cached
  immutably for a year (`vite/pdfjs-assets.ts` writes it, `engine.ts` reads
  `version` from the package to address it).
- **Images are chosen** when a manifest exists and (grade `low` **or** file >
  `PDF.liteOverBytes` **or** pdf.js failed). Made by `npm run prerender:pdf`
  (`scripts/prerender-pdf.mjs`, pdf.js + `@napi-rs/canvas`, no system tools).
  In dev a missing manifest comes back as the SPA's HTML — treated as "none".
- **Budgets** are `PDF` in `config.ts`, per grade: canvas pixels, DPR, render
  margin (fraction of the pane), concurrency, text layer, dwell, range chunk.
- **Invariants** (each one was a bug): `PdfPage` is `memo` with a *stable* ref
  callback; the render-window `Set` is republished only when membership
  changes (an inline ref + fresh Set re-rendered every page 60×/s); `scale` is
  derived during render (`fit` ? fitted : manual), never chased by an effect;
  canvases are zeroed when a page leaves the window; the text layer exists on
  the current page only (unasked for a mouse on `mid`/`high`, on a long press
  elsewhere); failures are shown with the engine's reason and
  reported (`lib/diagnostics`).
- Testing in the built-in browser pane while it is **hidden**: no frames are
  produced, so pdf.js (rAF) and IntersectionObserver stall. Shim rAF with
  `setTimeout` and take a screenshot to pump a frame.

## Dossier facts

`FactsIndex.start("idle" | "demand")`. It asks `server/facts.php`
(`DOSSIER.endpoint`, production only, site-root-relative) first; anything short
of a well-formed answer falls back to the crawl. An **idle** read (the herald)
starts `DOSSIER.warmDelayMs` after the catalogue, and does *not* crawl on
`low`, Save-Data or 2g/3g — it leaves the index unstarted so a later
`"demand"` (a name/year criterion) reads it. Crawl sockets: 6 on `high`, 3
below. The aggregate's rows are fed through the same `factsFrom`, so folding
and date parsing stay in one place.

## Startup and render scope

- Dictionaries: `ru` + `en` static, nine lazy (`messages/index.ts` `loadDict`);
  `main.tsx` awaits the opening one (bounded at 4 s) before the first render;
  `setLang` loads before it switches.
- `lib/fontPreload.ts` preloads two faces by script at entry.
- `memo`: `AnimatedTitle`, `CharacterGrid`, `SiteFooter`, `HeraldBanner`,
  `CharacterCard`. Keep the props handed to them stable (`canOpenSection`).
- **There is no animation library.** `framer-motion` was removed entirely:
  every fade/rise/pop is CSS (`styles/motion.css` = overlays, `mo-*` classes;
  the rest beside its component's styles). `lib/motion.ts` gives the two
  things CSS cannot: `useLinger(value, ms)` keeps an element mounted through a
  CSS exit (`data-leaving`), `useReducedMotion()`. The card's pointer tilt is
  a hand-integrated spring (`lib/spring.ts`, attached by `lib/tilt.ts`) that
  runs a frame loop only while it is moving. Entrances use `backwards` fill so
  no transform lingers; exits use `forwards`.
- `CodexArticle` defers the article (`useDeferredValue(doc, null)`) below
  `high` and shows `CodexSkeleton` until it lands.
- Audio (`lib/audio.ts`): no `AudioContext` before a gesture; the room is
  lazy and skipped on `low`; the context suspends after ~10 s of silence and
  when the tab is hidden; schedulers tick at 100 ms.

## Server layer (`server/`)

| File | Deployed at | Note |
|---|---|---|
| `counter.php` | `/counter/counter.php` | unchanged |
| `facts.php` | `/api/facts.php` | request-time aggregate; validator = count + fingerprint of every file's name/mtime/size; ETag/304; self-gzips. **Optional** |
| `log.php` | `/api/log.php` | client error sink → `log-data/client-errors.log`; no IP stored. **Optional** |
| `htaccess/root.htaccess` | merged into the root `.htaccess` by hand | gzip for JSON/MD, `no-cache` for JSON/MD, 30 d for media |
| `htaccess/immutable.htaccess` | `dist/assets/` + `dist/pdfjs/` via `vite/immutable-headers.ts` | one-year immutable |

Neither PHP script could be run locally when written (no PHP binary) — run
`?a=selftest` on the host. Walkthrough: `docs/server-setup-guide.md`.

## Budgets (checked by `npm run verify`)

Initial JS ≤ 115 KB gzip (see `scripts/verify-pdf-build.mjs` for the current figure); legacy pdf.js worker
and engine; `.htaccess` emitted; lazy boundary intact. `vite.config.ts` `manualChunks` is a
**function, per package** — the object form swept React into the Markdown chunk
and the entry imported it. By hand: idle lite home
page = 0 infinite animations and 0 `backdrop-filter`; PDF idle = 0
`IntersectionObserver.observe` calls.
