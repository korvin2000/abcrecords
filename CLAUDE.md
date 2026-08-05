# CLAUDE.md — Project Guide

> Auto-loaded project context for Claude Code. Detailed, indexed knowledge lives
> in [`.claude-memory/`](.claude-memory/INDEX.md). Read that index before doing
> non-trivial work.

## What this project is

A **modern, visually rich catalogue of people / character profiles** — an
encyclopaedia-style knowledge base presented like a **fantasy-RPG codex**. The
current content domain is **musicians** (guitarists, composers, performers,
conductors, luthiers), largely migrated from the legacy site `guitar-times.ru`.

Each entry combines:

- a long-form **biography article** written in **BioMD Lite** (`*.bio.md`),
- structured **metadata** in a per-entry `MetaData.json`,
- **media** (photos, music) and **documents** (transcripts, dossiers, scans),
- rendered inside a **full-screen "codex" modal** with 4 tabs:
  **Biography · Gallery · Documents · Lore/Attributes**.

## Repository layout

| Path            | Purpose                                                              |
|-----------------|---------------------------------------------------------------------|
| `app/`          | **The production catalogue app** (Vite + React + TS). Renders `pages/` content at runtime; see `app/README.md` and [`.claude-memory/12-app-architecture.md`](.claude-memory/12-app-architecture.md) (overview). For real work in `app/` read the deep-dive triad: [`13`](.claude-memory/13-app-code-map.md) code map · [`14`](.claude-memory/14-app-patterns-and-gotchas.md) patterns/gotchas/recipes · [`15`](.claude-memory/15-app-critique.md) critique/backlog. |
| `docs/`         | Source specifications & guides (the source of truth — see below).   |
| `pages/`        | Content pages / migrated entries. `index.json` + `index-<lang>.json` at the root are the catalogue index ([`docs/Catalog-Index.md`](docs/Catalog-Index.md)); each entry's article (+ dossier, if it has one) lives in `pages/<iso-lang>/` (`ru/`, `en/`, `de/`, …) per the `lang` field; `pages/photos/` and other media stay at the root and are never localized. `pages/quotes/quote-<lang>.json` holds the localized book of sayings shown in the herald block — one fully localized edition per UI language ([`pages/quotes/README.md`](pages/quotes/README.md); **the shipped texts are placeholder fixtures, not verified quotations**). |
| `prototypes/`   | Two throwaway React reference apps (`CodexLegends`, `Copendum`) exploring the codex UI. Not production code — see below. |
| `.claude-memory/` | Condensed, indexed knowledge distilled from `docs/`, `pages/`, and `prototypes/` for fast recall. |

> **Scope note:** `.claude-memory/` was built by scanning `docs/` (specs),
> `pages/` (worked examples), and `prototypes/` (UI reference apps) — the
> whole repo has been indexed.

## Source documents (`docs/`)

- `Catalog-Index.md` — **the catalogue index format (v2)**: `index.json`
  (identity, classification, paths) + `index-<lang>.json`
  (localized names & search aliases). Read this before touching `pages/`.
- `Biography-Markup.md` — the **BioMD Lite** format spec (v1.5) + HTML migration rules.
- `Biography-Markup-Appendix-1.3.md` — authoring guide for the 1.3 additions
  (`::: align`, image `frame:`, `::: nav`, `alt:`/`link:`): usage, examples,
  anti-patterns, diagnostics.
- `MetaData.md` + `MetaData.json` — per-entry **dossier** schema (v2), example
  & template. Identity/classification are *not* here — they moved to
  `Catalog-Index.md`.
- `Biography_card_Design.md` — visual/UX design of the codex modal and its tabs.
- `HTML-to-BioMD-Lite-Conversion-Guide.md` — practical legacy-HTML → BioMD rules.
- `search-list.json` — legacy search index (~1249 entries) from `guitar-times.ru`.

## Example content (`pages/`)

- `agustin-barrios.bio.md`, `authors.bio.md`, `jovan-jovicic.bio.md`, etc. — real
  worked examples of BioMD Lite (see
  [`.claude-memory/08-pages-examples.md`](.claude-memory/08-pages-examples.md)
  for what each one demonstrates, including a few real deviations from the
  spec worth knowing before you touch this content).
- `pages/photos/*.jpg` — 5 real photo assets not yet linked to any entry.
- `pages/index.json` + `pages/index-<lang>.json` — the **live catalogue
  index**. `index.json` owns identity (`id`), classification (`type`,
  `gender`, lowercase ISO `country`), the Latin fallback
  `title`, and the `md`/`json`/`img` paths; `index-<lang>.json` maps
  `id → [localized name, …aliases]` per UI language. Spec:
  [`docs/Catalog-Index.md`](docs/Catalog-Index.md); condensed notes in
  [`.claude-memory/11-index-json.md`](.claude-memory/11-index-json.md).

## UI direction (decided — see [`.claude-memory/10-ui-component-decision.md`](.claude-memory/10-ui-component-decision.md))

- **Detail/biography modal** → base it on
  `prototypes/Copendum/src/components/CharacterDetail.tsx` (tuned, not
  verbatim) — its parchment/gold/burgundy theme already matches
  [`04-biography-card-design.md`](.claude-memory/04-biography-card-design.md).
- **Card + search bar + browse window** → base them on
  `prototypes/CodexLegends/src/components/CharacterCard.tsx`,
  `SearchBar.tsx`, and its main search screen (`App.tsx` +
  `CharacterGrid.tsx`) — chosen for the interaction/animation quality (3D
  tilt, glow, ornate frame), **but its dark theme must be re-themed to
  light** to match the rest of the app. Do not port its dark palette as-is.

## Core conventions (quick reference)

- **Three files, one fact each.** Identity/classification →
  `index.json`. Localized display name + search aliases → `index-<lang>.json`.
  Dossier prose → `pages/<lang>/*.bio.json`. Article text + layout →
  `*.bio.md`. Never duplicate a fact across two of them.
- **`*.bio.json` is a per-language *edition*** — `forename`, `surname`,
  `birthplace`, `instruments`, `jobs` … are authored in that directory's
  language. Only `dates`, `ranking`, `url` are language-invariant. **Metadata
  never goes in the article.**
- `index.json` `json` present ⟺ the entry is a **biography** (4-tab codex);
  absent ⟺ a **page** (article only). `type: "hidden"` keeps an entry routable
  but out of the grid, search and facets.
- **`id` is a stable string, assigned once, never renumbered or reused** — it
  is the join key to `index-<lang>.json`, not a position and not a route. The
  route is `#/{slug}`, where slug = the `md` basename minus `.bio.md`/`.md`.
- BioMD blocks use `::: name … :::` fences: `lead`, `align`, `image`, `images`,
  `document`, `columns`, `column`, `nav`, `frame`, `signature`. Prefer plain
  Markdown; use blocks only for layout/media. Image properties: `src`,
  `position`, `size`, `alt`, `caption`, `link`, `frame` (theme tokens only —
  never a literal colour). `::: columns` takes an optional `columns: 2|3|4`
  (v1.5): one block then holds a whole record grid, cells wrapping row by row.
- **No raw HTML / CSS / JS** in BioMD Lite. No layout-by-whitespace.
- Dates are **`DD.MM.YYYY`** everywhere — do **not** feed them straight to JS
  `Date`. They live **only** in `*.bio.json` `dates`, never in `index.json`.
- Countries are ISO 3166-1 alpha-2, authored **lowercase** (`ru`, `de`, `es`,
  `br`), never free text. `type`/`gender`/`lang`/`country` are all authored
  lowercase and read case-insensitively — the loader normalizes once at the
  boundary (`country` → uppercase, the rest lowercase). Chinese is `zh`,
  never `ch`.
- Multi-value metadata fields are **comma-separated strings** today
  (`"rock,pop"`), parsed to arrays on demand.
  Preserve Unicode names (no transliteration) — the Latin form belongs in
  `index.json`'s `title`.
- Visual language: warm ivory/parchment, muted gold, burgundy, dark brown;
  serif type; antique/archival, calm, symmetrical. **Avoid** modern UI chrome,
  neon, strong shadows, heavy textures.

## Working agreements

- `docs/` is the **source of truth**. If `.claude-memory/` disagrees with a
  `docs/` file, trust `docs/` and update the memory note.
- When you change a spec, update **both** the relevant `docs/` file **and** its
  `.claude-memory/` summary.
- Reply to the user in **English** (their stated preference overrides the
  harness's German default); keep code identifiers and format keywords in
  their original form.
