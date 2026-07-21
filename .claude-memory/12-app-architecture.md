# 12 · `app/` — The Production Catalogue App (2026-07-19)

**Source:** [`app/`](../app/) — the real, working implementation of the
catalogue (Vite + React 19 + TS + Tailwind 4 + framer-motion), built per the
component decision in [`10-ui-component-decision.md`](10-ui-component-decision.md).
See [`app/README.md`](../app/README.md) for the full layer table.

## Key facts

- **Content stays in `pages/`** — mounted as Vite `publicDir` and fetched
  at runtime. `catalog.ts` idle-prefetches only lightweight JSON metadata;
  biography Markdown remains cached but lazy until its codex opens.
- **Two deployment bases**: `import.meta.env.BASE_URL` locates `index.json`
  and its json/md/img targets under the app (for example `/fable/`), while
  `VITE_RESOURCE_BASE_PATH` locates resources referenced inside BioMD and
  per-entry JSON independently (default `/pages`).
- **BioMD Lite parser**: `src/lib/biomd/parse.ts` (recursive fence parser,
  tolerant per spec: unknown blocks render inner content, unclosed fences
  warn), rendering via react-markdown + remark-gfm + a custom
  `==highlight==` remark plugin → `<mark>`.
- **Search** (`src/lib/search.ts`): diacritic folding + bounded Cyrillic↔Latin
  transliteration variant expansion; the Latin slug doubles as a haystack so
  Latin queries reach Cyrillic-titled entries. One index searches ALL
  languages; `App` orders results native-language-first and `CharacterGrid`
  renders foreign finds behind a burgundy divider as dimmed red-tinted cards
  with flag chips (`CharacterCard foreign` prop).
- **i18n** (`src/lib/i18n.tsx` + `src/lib/messages/*.ts`): TEN UI languages
  (en es ja de fr it pt ru zh ko — registry in `src/lib/languages.ts`), one
  complete dictionary per language typed against the ru key set,
  Intl.PluralRules per locale, fallback lang→en→ru, stored under localStorage
  key `codex-lang`, navigator.languages detection (default ru). Entry `type`
  labels localized via `type.*` keys; unknown types pass through raw.
- **Multi-language content** (2026-07-20): index rows carry `lang: "ru,en"`;
  each entry's json/md pair lives in `pages/<lang>/…`. `loadEntry(entry, lang)`
  caches per (slug, lang); `localizeContentPath` maps the declared root paths
  into the language dir — media paths are never localized. `CodexModal` keeps
  its own `contentLang` (reader's lang if available, else the entry's first
  code) switchable on the fly via the top-center `LanguageMenu`; the header
  hosts the full 10-language menu. Flags are hand-drawn inline SVGs
  (`src/components/Flag.tsx`) because Windows renders flag emoji as letters.
- **Audio** (`src/lib/audio.ts`): ported CodexLegends procedural engine; the
  per-entry theme is seeded deterministically from the slug
  (`themeFromSeed`, FNV-1a → mulberry32 → guitar-ish scales/roots).
- **ASCII tablature** (`src/lib/asciiTab.ts` + lazy `AsciiTabViewer`): `.txt`
  links are decoded losslessly, parsed into six-string systems, and rendered
  as SVG with an aligned raw fallback. Playback is intentionally approximate
  because source columns do not define authoritative rhythm.
- **Rarity decision resolved**: `metadata.ranking` (0–100) → 1–5 "renown"
  stars (`rankStars` in `src/lib/metadata.ts`) on cards + Lore tab. Sound
  effects were kept (user's prompt asked for them explicitly).
- **Deep links**: `#/<slug>` opens the codex modal; ← → turn between entries
  in the current filtered order; body scroll lock is owned by `App` (per-modal
  locking broke during AnimatePresence overlaps — don't move it back).
- Launch config: `.claude/launch.json` → `npm run dev` in `app/`, port 5173.
- Production splitting: `LazyCodexModal.ts` defers the modal and Markdown
  parser, while Vite manual chunks keep React, Motion, and Markdown cacheable.
  Card pointer/focus intent preloads the modal and an actual click starts its
  content request in parallel. First-row portraits are eager; all others lazy.

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
