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

The repository is an **npm workspace** holding three React projects — one
deployable app and two lazy-loaded feature packages it composes at runtime.
The architecture is specified in
[`docs/react-modular-architecture.md`](docs/react-modular-architecture.md);
read [`.claude-memory/17-workspace-and-features.md`](.claude-memory/17-workspace-and-features.md)
before touching the boundary between them.

```text
guitar-codex-workspace/          npm workspaces: apps/* + packages/*
├─ apps/
│  ├─ guitar-codex/              the one deployable product — the host
│  └─ demoscene-dev-host/        runs the demoscene alone; never deployed
├─ packages/
│  ├─ guestbook/                 @guitar-codex/guestbook  → footer VI
│  └─ demoscene/                 @site/demoscene          → top bar "I"
└─ pages/ docs/ server/ .claude-memory/
```

One `npm install`, one `npm run build`, one `dist/`. Both feature packages are
**source-exported** (no build step of their own) and reach the reader only
through a dynamic `import()`, so neither is in the initial bundle.

| Path            | Purpose                                                              |
|-----------------|---------------------------------------------------------------------|
| `apps/guitar-codex/`          | **The production catalogue app** (Vite + React + TS). Renders `pages/` content at runtime; see `apps/guitar-codex/README.md` and [`.claude-memory/12-app-architecture.md`](.claude-memory/12-app-architecture.md) (overview). For real work in `apps/guitar-codex/` read the deep-dive triad: [`13`](.claude-memory/13-app-code-map.md) code map · [`14`](.claude-memory/14-app-patterns-and-gotchas.md) patterns/gotchas/recipes · [`15`](.claude-memory/15-app-critique.md) critique/backlog. |
| `docs/`         | Source specifications & guides (the source of truth — see below).   |
| `pages/`        | Content pages / migrated entries. (PDFs are **not** here — the document archive, e.g. `magazine/<year>/*.pdf`, sits at the site root; see `pdf` in `docs/Catalog-Index.md` §9.1.) `index.json` + `index-<lang>.json` at the root are the catalogue index ([`docs/Catalog-Index.md`](docs/Catalog-Index.md)); each entry's article (+ dossier, if it has one) lives in `pages/<iso-lang>/` (`ru/`, `en/`, `de/`, …) per the `lang` field; `pages/photos/` and other media stay at the root and are never localized. `pages/quotes/quote-<lang>.json` holds the localized book of sayings shown in the herald block — one fully localized edition per UI language ([`pages/quotes/README.md`](pages/quotes/README.md); **the shipped texts are placeholder fixtures, not verified quotations**). |
| `server/`       | **The one server-side script the project has**: `counter.php`, the visitor counter and statistics endpoint behind the header's odometer (no database — three flat files; see `server/README.md`). Uploaded to the site at `/counter/counter.php`; the app reads it site-root-relative, like `pdf`. |
| `packages/guestbook/` | **The visitors' book** — `@guitar-codex/guestbook`, a private, source-exported React feature package. Opened from the footer's "VI · Guestbook" at the reserved route `#/guestbook`; talks to the legacy PHP REST API under `/gbook/api`. Contract: [`docs/guestbook-integration.md`](docs/guestbook-integration.md). Also runs standalone (`npm run dev:guestbook`). |
| `packages/demoscene/` | **The About/credits demoscene** — `@site/demoscene`, likewise private and source-exported. Opened from the `I` button in the top bar. Renders into its own **shadow root**, synthesises everything it draws and plays, and releases every side effect on unmount. Contract: [`docs/demoscene-integration.md`](docs/demoscene-integration.md). |
| `apps/demoscene-dev-host/` | A throwaway React app standing in for the host so the demoscene can be run and reviewed alone (`npm run dev:demoscene`), plus the pencil-study plate viewers (`npm run plates`). **Never deployed**; it is the one sanctioned place that deep-imports demoscene internals. |
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
  absent ⟺ a **page** (article only); **`pdf` in place of `md` ⟺ a document**,
  which opens in the PDF viewer (`apps/guitar-codex/src/components/pdf/`) instead of the
  codex — no tabs, no header, no dossier. `type: "hidden"` keeps an entry
  routable but out of the grid, search and facets.
- **Three path bases, not two.** `md`/`json`/`img` resolve against the
  application base; media/documents written *inside* an entry resolve against
  the resource base (`/pages`); **`pdf` is site-root-relative** — the document
  archive lives beside the app, so it survives a `--base=/fable/` deploy.
- **`id` is a stable string, assigned once, never renumbered or reused** — it
  is the join key to `index-<lang>.json`, not a position and not a route. The
  route is `#/{slug}`, where slug = the basename of `md` — or of `pdf` when a
  row has no `md` — minus `.bio.md`/`.md`/`.pdf`.
- BioMD blocks use `::: name … :::` fences: `lead`, `align`, `image`, `images`,
  `document`, `columns`, `column`, `nav`, `frame`, `signature`, `anchor`. Prefer
  plain Markdown; use blocks only for layout/media. Image properties: `src`,
  `position`, `size`, `alt`, `caption`, `link`, `frame` (theme tokens only —
  never a literal colour). `::: columns` takes an optional `columns: 2|3|4`
  (v1.5): one block then holds a whole record grid, cells wrapping row by row.
- **`::: anchor` + `[…](#name)` = a jump inside one document** (v1.6). Also
  written on one line as `:: anchor{#name}`. Not `#/slug` — that is another
  entry's route, and a `#name` link must never change the address.
- **A triple-backtick fence with no language is verse**, not code (v1.6 §3.9):
  a poem, song text, address or programme whose line breaks are content. A fence
  *with* a language stays real code.
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
- **A Unicode sign is not a character — it is a font substitution.** ♀ ♂ ⚥ 𝄞 ♪
  ◀ ▶ ✦ ❖ ✕ are not in the text faces, so the platform draws each of them from
  Segoe UI Symbol / Apple Symbols / Noto — three unrelated designs that disagree
  about ink size, baseline position *and* line-box height. Draw every one of them
  with `<Glyph>` (`apps/guitar-codex/src/components/Glyph.tsx`), take the character from
  `apps/guitar-codex/src/lib/signs.ts`, and give it an **ink height**, never a `font-size`.
  A literal `font-size` or a `translateY` nudge for a sign is a Windows-only
  guess that will be wrong on Android and iOS — this has recurred three times.
  Full rationale and checklist:
  [`.claude-memory/16-cross-platform-glyphs.md`](.claude-memory/16-cross-platform-glyphs.md).
- **Cross-entry metadata is read in the browser, never precomputed into a file.**
  The dossier facts index (`apps/guitar-codex/src/lib/dossier/`) crawls `pages/<lang>/*.bio.json`
  and caches in memory for the session. A generated `facts-<lang>.json` beside the
  index froze the deployed answer at build time, so an edited birth year did not
  reach the search until the next rebuild; `pages/` is the only home for a fact.

## Feature-package rules (the workspace boundary)

The two packages under `packages/` are **not folders in the host** — they are
separate units with their own manifests, their own dependencies and one public
entry each. What keeps them that way:

- **The host reaches a feature only through its package name** —
  `@guitar-codex/guestbook`, `@site/demoscene`. Never a relative path into
  `packages/`, never a deep import: neither package's `exports` map has a
  wildcard, so a deep import fails rather than works quietly.
- **A feature never imports from the host.** Not a component, not a token, not
  `@/lib/…`. Everything it needs crosses as a prop: primitives, plain objects
  and stable callbacks. No store, no router, no context. The two features do
  not import each other either.
- **The `import()` lives in exactly one file per feature**, and that file is
  never in the startup path: `components/about/LazyAboutDemoscene.ts` and
  `components/guestbook/LazyGuestbookOverlay.ts`. A **static** `import` of
  either package from `App.tsx`, `main.tsx` or a barrel one of them reads puts
  the whole feature in the initial bundle and *nothing visibly breaks* — it is
  the single most damaging mistake available here. The barrels beside those
  files re-export only the lazy entry, for exactly that reason.
- **The language is one string prop.** `locale={lang}` — both packages ship the
  same eleven tongues the codex speaks, and both fall back rather than render
  blank on a tag they do not know. The host keeps owning i18n; neither feature
  reads `navigator.language`, the host's dictionaries or the URL.
- **Styles do not cross either way.** The demoscene renders inside a shadow
  root; the guestbook uses hashed CSS Modules with every rule on its own
  `.root` and no global selectors. The host's only lever is the documented
  `--gb-*` tokens, set in `apps/guitar-codex/src/styles/guestbook.css` — with
  the class name written twice, because the feature's stylesheet loads *after*
  `index.css` and would otherwise win the specificity tie. Never write a rule
  against a hashed class inside a package.
- **`#/guestbook` is a reserved route.** No `index.json` row may use
  `guestbook` as its slug; it is the one name in the catalogue's address space
  that is spoken for (`components/guestbook/route.ts`).
- **Turn either feature off in one place:** `FEATURES.guestbook` /
  `FEATURES.demoscene` in `apps/guitar-codex/src/config.ts`. Off removes the
  UI *and* the chunk request.
- **Verify the boundary after touching it:** `npm run verify` (typecheck →
  build → `scripts/verify-lazy-boundary.mjs`). The last step fails the build if
  either feature reaches the entry chunk or gets preloaded from `index.html`.

## Working agreements

- `docs/` is the **source of truth**. If `.claude-memory/` disagrees with a
  `docs/` file, trust `docs/` and update the memory note.
- When you change a spec, update **both** the relevant `docs/` file **and** its
  `.claude-memory/` summary.
- Reply to the user in **English** (their stated preference overrides the
  harness's German default); keep code identifiers and format keywords in
  their original form.
- **Run npm from the workspace root**, not from inside a package: `npm install`,
  `npm run dev`, `npm run build`, `npm run typecheck`. One lockfile, one copy of
  React. A `npm install` inside `apps/guitar-codex/` creates a second one and
  every hook in a linked package then throws "Invalid hook call".
- `docs/react-modular-architecture.md` is the **canonical architecture guide**
  and is upstream — treat it as read-only. The two integration guides beside it
  are the per-feature contracts; keep them in step with the code.
