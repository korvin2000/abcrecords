# 10 · UI Component Decision (2026-07-19)

**Status: decided by the user.** This is the chosen direction for building the
real catalogue UI out of the two throwaway prototypes surveyed in
[`09-prototypes.md`](09-prototypes.md). Treat this as the standing plan until
the user says otherwise.

## The decision

| Real-app piece | Take as prototype from | Notes |
|---|---|---|
| **Character detail / biography view** (the codex modal, see [`04-biography-card-design.md`](04-biography-card-design.md)) | **`Copendum/src/components/CharacterDetail.tsx`** | Use it **slightly modified/tuned**, not verbatim. |
| **Character card** (catalogue grid tile) | **`CodexLegends/src/components/CharacterCard.tsx`** | Needs dark → light re-theme (see below). |
| **Search bar** | **`CodexLegends/src/components/SearchBar.tsx`** | Needs dark → light re-theme. |
| **Main search / browse window** | **`CodexLegends`'s main search screen** (`src/App.tsx` search section + `CharacterGrid.tsx`) | Needs dark → light re-theme. |

## Why this split (user's own words, paraphrased)

- `Copendum`'s `CharacterDetail` was picked for the **detail/biography view**
  specifically — its `index.css` (`.parchment`, `.ornate-border`,
  `.rune-title`, drop capitals, gold accents) is **already** an antique
  ivory/gold/burgundy light theme, i.e. already close to the target look in
  the design brief. Low re-theming effort.
- `CodexLegends`'s card/search/grid were picked **despite being dark** and
  despite "the color scheme isn't quite right" — because, in the user's
  judgement, they **"look more technically cool and nice looking"**: the
  pointer-tilt 3D card, cursor glare/shine sweep, glow rings, ornate corner
  frame, animated facet chips, and live result-count line are a stronger
  interaction/animation quality bar than Copendum's equivalents. The **visual
  effects and interaction design are the reason to reuse them**, not the
  color palette.

## Required re-theme: dark → light

`CodexLegends`'s dark palette (`src/index.css` `@theme`: `ink-950…700`
near-black backgrounds, `parchment` used only as light *text* on dark bg) must
become a **light** ivory/parchment scheme to match
[`04-biography-card-design.md`](04-biography-card-design.md) and the
already-light `Copendum` detail view it will sit alongside. Concretely:

- Replace the `ink-*` scale (currently near-black backgrounds) with an
  **ivory/parchment background scale** — reuse Copendum's parchment values
  (`#e8d9b0` parchment, `#c9b488` parchment-dark, `#1a0f08` ink-as-text) as a
  starting palette so the card and the detail view feel like one system.
  `Copendum`'s tokens (`--color-parchment`, `--color-gold`, `--color-crimson`,
  `--color-blood`, `--color-shadow`) are the closer match to the design brief
  than `CodexLegends`'s `gold-*`/`arcane-*`/`mystic-*`/`ember-*` set.
- Body/heading/accent text goes from **light-on-dark** (parchment text, gold
  glow) to **dark-on-light** (dark-brown/burgundy body text, burgundy
  headings, gold used only for borders/dividers/accents — per the design
  brief, not for glowing text).
- Keep the **effects**, re-skin the **colors**: 3D tilt, cursor glare, shine
  sweep, glow rings, ornate corner SVG frame, facet chip active-state glow,
  animated grid entrance — all of these are palette-driven via CSS
  vars/inline `style` accent colors, so they carry over once the color inputs
  change. This is a re-theme, not a rewrite of the interaction logic.
- `rarity` (`Common→Mythic`) has no equivalent in the real `MetaData.json`
  schema (see [`03-metadata-schema.md`](03-metadata-schema.md)). When wiring
  real data, either drop the rarity-driven glow/star system or repurpose it
  from `metadata.ranking` (0–100) — this hasn't been decided yet, flag it to
  the user when the card is actually wired to real data.
- Strip or replace the `audio.hover()/click()/type()` calls in `CharacterCard`
  / `SearchBar` unless the user wants to keep the procedural sound design
  (not discussed yet — ask before porting the 467-line `audioEngine.ts`
  wholesale).

## Open items (not yet decided — ask before assuming)

- Whether to keep procedural audio feedback (hover/click/type sounds).
- How/whether to map `rarity` and other game-stat concepts (ability scores,
  archetype/element) onto real `MetaData.json` fields, or drop them entirely
  for the musician-biography domain.
- Which project (`CodexLegends` or `Copendum`) supplies the base build
  tooling/alias setup, if either — the real app's scaffold hasn't been
  decided.
