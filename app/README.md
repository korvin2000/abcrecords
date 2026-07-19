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

## How it works

| Layer | Where | Notes |
|---|---|---|
| Content root | `vite.config.ts` `publicDir: ../pages` | `index.json` drives the grid; per-entry `.bio.json` + `.bio.md` are fetched on demand and cached (`src/lib/catalog.ts`), prefetched during idle time. |
| BioMD Lite | `src/lib/biomd/` | Recursive `::: block` parser (`lead/image/images/document/columns/column`, unknown blocks render their content per spec) + react-markdown (GFM) + `==highlight==` remark plugin. |
| Metadata | `src/lib/metadata.ts` | `DD.MM.YYYY` parsed explicitly (never `new Date(string)`), comma-lists split on demand, ISO countries localized via `Intl.DisplayNames`, `ranking` → 1–5 renown stars. |
| Search | `src/lib/search.ts` | Case/diacritic folding + bounded Cyrillic↔Latin transliteration variants («сеговия» → Segovia; "jovan" → Јован via the Latin slug). |
| i18n | `src/lib/i18n.tsx` | ru (primary) / en, `Intl.PluralRules`, persisted in localStorage. |
| Sound | `src/lib/audio.ts` | Procedural WebAudio (no audio files): hover/click/page-turn SFX, ambient drone, and a deterministic per-entry theme from `f = f₀·2^(n/12)` seeded by the entry slug. |
| Browse UI | `src/components/` | CodexLegends card/search/grid (3D pointer tilt, cursor glare, shine sweep, ornate frames) re-themed light per `.claude-memory/10-ui-component-decision.md`. |
| Codex modal | `src/components/codex/` | Copendum CharacterDetail base: parchment, double gold/brown border, 3D page-turn open/close, 4 tabs (Летопись · Галерея · Свитки · Атрибуты), `#/slug` deep links, ← → turns entries. |

## Performance choices

- No canvas/particle engines; static gradient + SVG-grain background.
- `LazyMotion` (framer-motion slim runtime); tilt/glare disabled under
  `prefers-reduced-motion`; lazy images with procedural SVG fallbacks.
- Fonts self-hosted (@fontsource Cormorant) with `unicode-range` subsets —
  Cyrillic loads only when shown.
- Production build ≈ 158 KB gzip JS + 11 KB CSS.
