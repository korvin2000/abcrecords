# 09 · `prototypes/` — UI Prototype Survey

**Source:** [`prototypes/`](../prototypes/) — two independent, complete React
single-page prototypes exploring the "codex" UI. Both are throwaway/reference
apps (LLM-generated, per their `info.txt`), not the production app. Use them
as **component/interaction reference**, not as a codebase to build on directly.

## The two prototypes

| | `CodexLegends` | `Copendum` |
|---|---|---|
| Generator (`info.txt`) | `glm-5.2` | `qwen3.7-plus` |
| Theme | Dark fantasy-game UI: void/ink background, gold/arcane-teal/mystic-violet/ember accents | **Antique parchment/ivory** — already close to the target look in [`04-biography-card-design.md`](04-biography-card-design.md) |
| Character model | Flat `CharacterMeta` + `Stat[]` + Markdown `biography` string + `Relation[]` + procedural `ThemeSpec` (`src/types/character.ts`) | OOP `Character` class wrapping `CharacterData` (nested `metadata` + D&D-style ability scores + HTML `biography` string) (`src/engine/Character.ts`) |
| Game-mechanic concepts | **Rarity** (`Common→Mythic`, drives glow/border/star-count), `archetype`, `element`, procedural "Summon a Wanderer" hero generator, full procedural audio engine (`src/lib/audioEngine.ts`, Web Audio synth, no audio files) | RPG ability scores (`strength/dexterity/…`) → `powerRating`, page-turn open/close animation, `EventBus` (`src/engine/EventBus.ts`) for cross-component events |
| Build | Vite 7 + Tailwind 4 (`@theme` tokens in `index.css`) + framer-motion + `vite-plugin-singlefile` (single-file HTML build) + `@/` → `src/` alias | Same stack, plus `react-markdown` + `remark-gfm` (renders Markdown, relevant to BioMD Lite) |

**Neither model matches this project's real `MetaData.json` schema** (see
[`03-metadata-schema.md`](03-metadata-schema.md)) — both invent their own game
stats (rarity, ability scores, elements) that have no `MetaData.json`
equivalent. Any component ported from these prototypes needs a data-adapter
layer, not a drop-in data source.

## `CodexLegends` — key files

- `src/components/CharacterCard.tsx` — grid tile: pointer-driven 3D tilt
  (`framer-motion` `useMotionValue`/`useSpring`), cursor glare, shine-sweep on
  hover, rarity-colored badge + star row (`OrnateFrame`/`RarityStars`), plays
  `audio.hover()`/`audio.click()` **(coupled to `lib/audioEngine.ts`)**.
- `src/components/SearchBar.tsx` — glow-ring-on-focus input + facet `Chip`
  buttons (filter by archetype/element) + live "`N of M` revealed" counter.
  Also calls `audio.hover()/click()/type()`.
- `src/App.tsx` — the **main search window**: fixed header (sound/ambient
  toggles), `AnimatedTitle`, `SearchBar`, a "Summon a Wanderer" procedural-hero
  button, `CharacterGrid` (animated grid of `CharacterCard`s via
  `AnimatePresence`/`layout`), and `CharacterDetail` mounted conditionally.
- `src/components/OrnateFrame.tsx` — reusable four-corner SVG flourish +
  `Divider` + `RarityStars`. Used by `CharacterCard`.
- `src/lib/search.ts` — pure diacritic-insensitive scored search
  (`normalize` → `scoreMatch` → filter by facets → sort by score).
- Colors defined as CSS vars in `src/index.css` `@theme` block: `ink-*` (dark
  bg scale), `gold-*`, `arcane-*`, `mystic-*`, `ember-*`, `parchment`
  (single light token used only as *text* color on dark bg).

## `Copendum` — key files

- `src/components/CharacterDetail.tsx` — the **modal biography/detail view**:
  full-screen backdrop + a "book panel" with a 3D page-turn open/close
  animation (`page-turn-open`/`page-turn-close` keyframes in `index.css`),
  ESC-to-close, body-scroll lock, `EventBus` emit on open/close. Two-column
  layout: left aside = portrait (with accent-colored glow), quote blockquote,
  `StatsPanel`, masteries (rank dots), equipment list, all inside
  `parchment-dark`/`ornate-border` boxes; right column = biography rendered
  via `dangerouslySetInnerHTML` (HTML string, not raw Markdown — would need
  adapting for BioMD Lite). Ornamental corner glyphs (`❧`), a
  **"✕ Close Codex"** button top-right, "❦ End of entry ❦" footer.
- `src/index.css` — `.parchment`, `.parchment-dark`, `.ornate-border`,
  `.rune-title`, `.divider-ornament`, `.btn-rpg`, `.bio-content` (styles for
  the rendered biography HTML: drop caps via `::first-letter`, headings,
  blockquotes, a `.media-gallery` grid) — **this is already an antique
  parchment/gold/crimson light theme**, closely matching the brief in
  [`04-biography-card-design.md`](04-biography-card-design.md) (ornate double
  border via `::before`/`::after` corner brackets, gold scrollbar thumb on
  dark track, drop capitals, gold vertical accent on quotes).
- `src/components/StatsPanel.tsx`, `src/engine/AudioEngine.ts`,
  `src/engine/ParticleSystem.ts` — supporting pieces not currently earmarked
  for reuse (see decision file).

## Shared coupling to be aware of when extracting components

- Both apps' interactive components call into a **procedural audio engine**
  (`audio.hover()/click()/type()/open()`) — either port the engine or strip
  these calls when reusing `CharacterCard`/`SearchBar`.
- Both use the `@/` → `src/` Vite alias and `vite-plugin-singlefile` — the
  real app's build setup will need its own alias/build decision; don't assume
  these configs carry over unchanged.
- Portraits are local prototype assets (`src/assets/portraits/*.jpg` in
  CodexLegends, `public/portraits/*.jpg` in Copendum) — placeholder people,
  unrelated to the real guitarist entries in `pages/`/`docs/`.

See [`10-ui-component-decision.md`](10-ui-component-decision.md) for which
pieces of these two prototypes were chosen for the real app, and why.
