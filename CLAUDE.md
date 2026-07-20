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
| `app/`          | **The production catalogue app** (Vite + React + TS). Renders `pages/` content at runtime; see `app/README.md` and [`.claude-memory/12-app-architecture.md`](.claude-memory/12-app-architecture.md). |
| `docs/`         | Source specifications & guides (the source of truth — see below).   |
| `pages/`        | Content pages / migrated entries. Per-language layout: each entry's `*.bio.md` + `*.bio.json` pair lives in `pages/<iso-lang>/` (`ru/`, `en/`, `de/`, …) per the `lang` field in `index.json`; `pages/photos/` (shared image assets) stays at the root and is never localized. |
| `prototypes/`   | Two throwaway React reference apps (`CodexLegends`, `Copendum`) exploring the codex UI. Not production code — see below. |
| `.claude-memory/` | Condensed, indexed knowledge distilled from `docs/`, `pages/`, and `prototypes/` for fast recall. |

> **Scope note:** `.claude-memory/` was built by scanning `docs/` (specs),
> `pages/` (worked examples), and `prototypes/` (UI reference apps) — the
> whole repo has been indexed.

## Source documents (`docs/`)

- `Biography-Markup.md` — the **BioMD Lite** format spec + HTML migration rules.
- `MetaData.md` + `MetaData.json` — per-entry metadata schema, example & template.
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
- `pages/index.json` — the **live main-menu/search index** (7 entries): search
  by `title`, preview via `img`, link out to full metadata (`json`) and
  biography (`md`) per entry; the `lang` field ("ru" / "ru,en") lists which
  `pages/<lang>/` editions exist (first code = original language). See
  [`.claude-memory/11-index-json.md`](.claude-memory/11-index-json.md) — it
  has a few real deviations from the `MetaData.md` spec (free-text `country`,
  no `id`) that should be raised with the user, not silently "corrected".

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

- Biography **text + layout** → `*.bio.md` (BioMD Lite). **Metadata never goes
  in the article**; it lives in `MetaData.json`.
- BioMD blocks use `::: name … :::` fences: `lead`, `image`, `images`,
  `document`, `columns`, `column`. Prefer plain Markdown; use blocks only for
  layout/media.
- **No raw HTML / CSS / JS** in BioMD Lite. No layout-by-whitespace.
- Metadata dates are **`DD.MM.YYYY`** — do **not** feed them straight to JS
  `Date`. Countries are ISO 3166-1 alpha-2 (`RU`, `DE`, `ES`, `BR`).
- Multi-value metadata fields are **comma-separated strings** today
  (`"rock,pop"`), parsed to arrays on demand. Preserve leading zeroes in `id`.
  Preserve Unicode names (no transliteration).
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
