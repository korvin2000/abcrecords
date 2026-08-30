# Кодекс Гитаристов · The Guitar Codex

A light-manuscript, RPG-codex-styled catalogue of musicians. Pure renderer:
**all content lives in `../pages/`** (`index.json`, `<slug>.bio.json`,
`<slug>.bio.md`, `photos/`) and is fetched at runtime — no data is compiled
into the bundle.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ (pages/ is copied in as the content root)
```

## Deployment paths

Vite's `base` controls the application itself (for example `/fable/`). Entry
resources are intentionally independent and resolve from the domain root via
`VITE_RESOURCE_BASE_PATH`, which defaults to `/pages`:

```env
VITE_RESOURCE_BASE_PATH=/pages
```

Thus an entry target such as `music/mp/track.mp3` becomes
`/pages/music/mp/track.mp3`, even when the app is built with `--base=/fable/`.
The paths declared by `index.json` continue to use the application base.

One field belongs to neither: `index.json`'s **`pdf` is site-root-relative**.
`magazine/2022/issue.pdf` is always `/magazine/2022/issue.pdf` — the document
archive sits beside the application at the web root, so it needs no
configuration and does not follow the app to `/fable/`.

## How it works

| Layer | Where | Notes |
|---|---|---|
| Content root | `vite.config.ts` `publicDir: ../pages` | `index.json` drives the grid; lightweight `.bio.json` metadata is cached/prefetched while biography Markdown stays lazy until a codex opens. |
| BioMD Lite | `src/lib/biomd/` | Recursive `::: block` parser (`lead/align/image/images/document/columns/column/nav`, unknown blocks render their content per spec) + react-markdown (GFM) + `==highlight==` remark plugin. Image properties: `src/position/size/alt/caption/link/frame`. |
| Metadata | `src/lib/metadata.ts` | `DD.MM.YYYY` parsed explicitly (never `new Date(string)`), comma-lists split on demand, ISO countries localized via `Intl.DisplayNames`, `ranking` → 1–5 renown stars. |
| Search | `src/lib/search/` | `fold` (case/diacritics + bounded Cyrillic↔Latin transliteration: «сеговия» → Segovia) · `docs` (weighted pre-folded corpus) · `scoring` (relevance) · `criteria` (the form state + its compiled form) · `predicates` (index-only vs dossier-backed filters) · `engine` (one pass, cheapest filter first). |
| Advanced search | `src/components/search/` · `src/components/form/` | A refinement panel behind the search bar: language scope, gender, craft, country, given/family name, birth & death year ranges. Controlled view of one `SearchCriteria`; the quick facet chips bind to the same value. |
| Dossier facts | `src/lib/dossier/` | The one crawl of every listed entry's `*.bio.json`, shared by name/year search and the herald. Bounded concurrency, idle-scheduled, throttled notifications, read via `useSyncExternalStore`; shares `catalog.ts`'s per-path cache and never fetches article text. |
| Herald | `src/lib/herald/` · `src/components/herald/` | The dynamic line under the title: the catalogue's own subtitle, then "on this day" (births take precedence over deaths), then a saying from `pages/quotes/quote-<lang>.json`, taking turns every 30 s. Four tones (default/birth/mourning/quote) from one static table. |
| i18n | `src/lib/i18n.tsx` | ru (primary) / en, `Intl.PluralRules`, persisted in localStorage. |
| Sound | `src/lib/audio.ts` | Procedural WebAudio (no audio files): hover/click/page-turn SFX, ambient drone, and a deterministic per-entry theme from `f = f₀·2^(n/12)` seeded by the entry slug. |
| Audio player | `src/lib/playback.ts` · `src/lib/midi.ts` · `src/components/AudioPlayer.tsx` | Built-in player for `media.music` and audio links in biographies. Native `<audio>` (mp3/wav/ogg/…) plus a MIDI synth (`.mid` parsed with the lazily-loaded `@tonejs/midi`, rendered through oscillators — no SoundFont). One source sounds at a time; every player also offers a download. |
| PDF documents | `src/components/pdf/` · `src/lib/pdf/engine.ts` | An index row with `pdf` and no `md` **is** a document: it opens a codex-styled dialog holding a pdf.js reader instead of the article codex — paging, zoom, fit-to-width/page, rotate, download, selectable text. Continuous scroll where every page has a box but only pages near the viewport have pixels. The engine, its ~1 MB worker and its runtime data (cmaps/fonts/wasm, served at `<base>pdfjs/` by `vite/pdfjs-assets.ts`) are all lazy — a session that never opens a PDF downloads none of it. |
| ASCII tablature | `src/lib/asciiTab.ts` · `src/components/AsciiTabViewer.tsx` | `.txt` links open in a lazy codex-styled viewer: lossless source parsing, six-string SVG systems, tuning/notation diagnostics, aligned raw fallback, zoom, download, and explicitly approximate WebAudio playback inferred from source columns. |
| Browse UI | `src/components/` | CodexLegends card/search/grid (3D pointer tilt, cursor glare, shine sweep, ornate frames) re-themed light per `.claude-memory/10-ui-component-decision.md`. |
| Codex modal | `src/components/codex/` | Copendum CharacterDetail base: parchment, double gold/brown border, 3D page-turn open/close, 4 tabs (Летопись · Галерея · Свитки · Атрибуты), `#/slug` deep links, ← → turns entries. `PdfModal` is its sibling for document rows — same room, a PDF instead of an article. |

## Performance choices

- No canvas/particle engines; static gradient + SVG-grain background.
- `LazyMotion` plus an on-demand Codex/Markdown chunk; pointer/focus intent
  starts loading it just before selection.
- Only the first four portraits are eager/high-priority; the rest use native
  lazy loading and procedural SVG fallbacks.
- Fonts are self-hosted with `unicode-range`; Garamond uses one variable
  weight file per script instead of several static weights.
- `/fable/` production build: ≈ 135 KB initial gzip JS + 15.6 KB CSS;
  Codex/Markdown adds ≈ 59 KB gzip only when first opened, and pdf.js a
  further ≈ 123 KB gzip (plus its worker) only when a PDF is.
- The PDF reader keeps a *box* for every page and *pixels* only for pages near
  the viewport, so a 106-page magazine costs a handful of canvases rather than
  a hundred; a re-render at a new zoom paints into a detached canvas and blits,
  so the page never blanks under the reader.
- The dossier facts crawl is the one many-request feature: bounded concurrency,
  idle-scheduled, throttled notifications, and it reuses the codex's own cache
  rather than competing with it. Tunable (or switchable off) in `src/config.ts`.

## Architecture docs

The layer table above is the quick tour. For depth, the repo keeps a distilled
knowledge base in [`../.claude-memory/`](../.claude-memory/INDEX.md):

- [`13-app-code-map.md`](../.claude-memory/13-app-code-map.md) — file-by-file map, control/data-flow walkthroughs, component-relationship diagram.
- [`14-app-patterns-and-gotchas.md`](../.claude-memory/14-app-patterns-and-gotchas.md) — recurring patterns, landmines (CSS layering, dates, the three deploy bases, audio, search, BioMD), and task recipes (add a language / message key / entry / flag / BioMD block).
- [`15-app-critique.md`](../.claude-memory/15-app-critique.md) — strengths, a severity-tagged risk register, and a prioritized improvement backlog.

## Tooling status

Strict TypeScript (`tsc -b`) is the only automated gate today — **there is no
test runner, ESLint, or Prettier yet**. Highest-value first steps (see the
backlog in `15-app-critique.md`): add Vitest unit tests for the pure logic
(`biomd/parse.ts`, `lib/search.ts`, `lib/metadata.ts`, `lib/paths.ts`), then
ESLint + Prettier + a CI check.
