# 12 · `app/` — The Production Catalogue App (2026-07-19)

**Source:** [`app/`](../app/) — the real, working implementation of the
catalogue (Vite + React 19 + TS + Tailwind 4 + framer-motion), built per the
component decision in [`10-ui-component-decision.md`](10-ui-component-decision.md).
See [`app/README.md`](../app/README.md) for the full layer table.

## Key facts

- **Content stays in `pages/`** — mounted as Vite `publicDir`, fetched at
  runtime (`src/lib/catalog.ts`, cached + idle-prefetched). Nothing from
  `pages/` is bundled; the app is a pure renderer.
- **BioMD Lite parser**: `src/lib/biomd/parse.ts` (recursive fence parser,
  tolerant per spec: unknown blocks render inner content, unclosed fences
  warn), rendering via react-markdown + remark-gfm + a custom
  `==highlight==` remark plugin → `<mark>`.
- **Search** (`src/lib/search.ts`): diacritic folding + bounded Cyrillic↔Latin
  transliteration variant expansion; the Latin slug doubles as a haystack so
  Latin queries reach Cyrillic-titled entries.
- **i18n** (`src/lib/i18n.tsx`): ru primary / en secondary, Intl.PluralRules,
  stored under localStorage key `codex-lang`. Entry `type` labels localized
  via `type.*` keys; unknown types pass through raw.
- **Audio** (`src/lib/audio.ts`): ported CodexLegends procedural engine; the
  per-entry theme is seeded deterministically from the slug
  (`themeFromSeed`, FNV-1a → mulberry32 → guitar-ish scales/roots).
- **Rarity decision resolved**: `metadata.ranking` (0–100) → 1–5 "renown"
  stars (`rankStars` in `src/lib/metadata.ts`) on cards + Lore tab. Sound
  effects were kept (user's prompt asked for them explicitly).
- **Deep links**: `#/<slug>` opens the codex modal; ← → turn between entries
  in the current filtered order; body scroll lock is owned by `App` (per-modal
  locking broke during AnimatePresence overlaps — don't move it back).
- Launch config: `.claude/launch.json` → `npm run dev` in `app/`, port 5173.

## Gotchas discovered while building

- `index.json` `country` is free text → mapped to ISO via a small dict in
  `metadata.ts` (`countryDisplay`) so `Intl.DisplayNames` localizes it; the
  per-entry `.bio.json` files use real ISO codes (`PY`, `RS`, …).
- The `authors` roster entry has a comma-list `forename` — the codex header
  wraps/shrinks long names (`longName` branch in `CodexModal`).
- Cormorant (SC + Garamond via @fontsource) chosen because Cinzel/IM Fell
  from the prototypes have **no Cyrillic**.
- npm works via the corporate Nexus mirror (`vvchub…creditreform.de`); a
  transient failure at first try looked like a proxy error but was not.
