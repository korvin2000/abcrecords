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

## How it works

| Layer | Where | Notes |
|---|---|---|
| Content root | `vite.config.ts` `publicDir: ../pages` | `index.json` drives the grid; lightweight `.bio.json` metadata is cached/prefetched while biography Markdown stays lazy until a codex opens. |
| BioMD Lite | `src/lib/biomd/` | Recursive `::: block` parser (`lead/image/images/document/columns/column`, unknown blocks render their content per spec) + react-markdown (GFM) + `==highlight==` remark plugin. |
| Metadata | `src/lib/metadata.ts` | `DD.MM.YYYY` parsed explicitly (never `new Date(string)`), comma-lists split on demand, ISO countries localized via `Intl.DisplayNames`, `ranking` → 1–5 renown stars. |
| Search | `src/lib/search.ts` | Case/diacritic folding + bounded Cyrillic↔Latin transliteration variants («сеговия» → Segovia; "jovan" → Јован via the Latin slug). |
| i18n | `src/lib/i18n.tsx` | ru (primary) / en, `Intl.PluralRules`, persisted in localStorage. |
| Sound | `src/lib/audio.ts` | Procedural WebAudio (no audio files): hover/click/page-turn SFX, ambient drone, and a deterministic per-entry theme from `f = f₀·2^(n/12)` seeded by the entry slug. |
| Audio player | `src/lib/playback.ts` · `src/lib/midi.ts` · `src/components/AudioPlayer.tsx` | Built-in player for `media.music` and audio links in biographies. Native `<audio>` (mp3/wav/ogg/…) plus a MIDI synth (`.mid` parsed with the lazily-loaded `@tonejs/midi`, rendered through oscillators — no SoundFont). One source sounds at a time; every player also offers a download. |
| ASCII tablature | `src/lib/asciiTab.ts` · `src/components/AsciiTabViewer.tsx` | `.txt` links open in a lazy codex-styled viewer: lossless source parsing, six-string SVG systems, tuning/notation diagnostics, aligned raw fallback, zoom, download, and explicitly approximate WebAudio playback inferred from source columns. |
| Browse UI | `src/components/` | CodexLegends card/search/grid (3D pointer tilt, cursor glare, shine sweep, ornate frames) re-themed light per `.claude-memory/10-ui-component-decision.md`. |
| Codex modal | `src/components/codex/` | Copendum CharacterDetail base: parchment, double gold/brown border, 3D page-turn open/close, 4 tabs (Летопись · Галерея · Свитки · Атрибуты), `#/slug` deep links, ← → turns entries. |

## Performance choices

- No canvas/particle engines; static gradient + SVG-grain background.
- `LazyMotion` plus an on-demand Codex/Markdown chunk; pointer/focus intent
  starts loading it just before selection.
- Only the first four portraits are eager/high-priority; the rest use native
  lazy loading and procedural SVG fallbacks.
- Fonts are self-hosted with `unicode-range`; Garamond uses one variable
  weight file per script instead of several static weights.
- `/fable/` production build: ≈ 121 KB initial gzip JS + 12.6 KB CSS;
  Codex/Markdown adds ≈ 55 KB gzip only when first opened.

## Architecture docs

The layer table above is the quick tour. For depth, the repo keeps a distilled
knowledge base in [`../.claude-memory/`](../.claude-memory/INDEX.md):

- [`13-app-code-map.md`](../.claude-memory/13-app-code-map.md) — file-by-file map, control/data-flow walkthroughs, component-relationship diagram.
- [`14-app-patterns-and-gotchas.md`](../.claude-memory/14-app-patterns-and-gotchas.md) — recurring patterns, landmines (CSS layering, dates, the two deploy bases, audio, search, BioMD), and task recipes (add a language / message key / entry / flag / BioMD block).
- [`15-app-critique.md`](../.claude-memory/15-app-critique.md) — strengths, a severity-tagged risk register, and a prioritized improvement backlog.

## Tooling status

Strict TypeScript (`tsc -b`) is the only automated gate today — **there is no
test runner, ESLint, or Prettier yet**. Highest-value first steps (see the
backlog in `15-app-critique.md`): add Vitest unit tests for the pure logic
(`biomd/parse.ts`, `lib/search.ts`, `lib/metadata.ts`, `lib/paths.ts`), then
ESLint + Prettier + a CI check.
