# 07 · Conventions, Do/Don't & Glossary

A single-page cheat sheet. Details live in the numbered notes and in `docs/`.

## Separation of concerns — one fact, one file

| Fact | File |
|---|---|
| identity, classification, paths | `pages/index.json` |
| localized display name + search aliases | `pages/index-<lang>.json` |
| structured dossier facts (per language edition) | `pages/<lang>/*.bio.json` |
| article text + layout | `pages/<lang>/*.bio.md` (BioMD Lite) |

- **Never** put metadata in the article, or article prose in metadata.
- **Never** duplicate a fact across two of these files.
- `*.bio.json` is a **per-language edition**: `forename`, `surname`,
  `birthplace`, `instruments`, `jobs`, … are authored in that directory's
  language. Only `dates`, `ranking`, `url` are language-invariant.

## Do

- Prefer plain Markdown; reach for `:::` blocks only for layout/media.
- Keep one BioMD property per line; use only documented values.
- Write in natural reading order (source order = reading order).
- Dates `DD.MM.YYYY`, and only in `*.bio.json` `dates` — never in `index.json`.
- Countries ISO 3166-1 alpha-2, authored **lowercase**; `type`/`gender`/`lang`
  too. Read case-insensitively, normalized once by the loader.
- Treat `index.json` `id` as opaque and permanent — assign once, never
  renumber, never reuse.
- Preserve Unicode / Cyrillic names verbatim (no transliteration); the Latin
  form of a name goes in `index.json`'s `title`, nowhere else.
- Reach entries by `#/{slug}` (the `md` basename minus `.bio.md`/`.md`).
- Use `type: "hidden"` for pages that must be reachable but not listed.
- Preserve unknown fields when editing JSON.
- Validate after edits (BioMD: title + balanced fences + no `<script>/<style>`;
  JSON: valid UTF-8, no comments/trailing commas, three top-level sections).
- Replace missing migrated images with clearly-marked temporary placeholders.
- Keep the antique/parchment/gold/burgundy/brown, serif, calm visual language.

## Don't

- No raw HTML / CSS / JS in BioMD Lite.
- No layout via spaces, blank lines, tables, or invisible characters.
- Don't use Markdown tables for layout — only for genuine tabular data.
- Don't invent biographical facts; omit or `null` instead.
- Don't copy a `*.bio.json` into another language directory and leave it
  untranslated — that is what made the current fixtures unusable as examples.
- Don't renumber `id`s, and don't treat an `id` as a position or a route.
- Don't write the language directory into a path (`index.json` paths and
  in-article links are root-relative; editions resolve automatically).
- Don't write `ch` for Chinese — it is `zh`, for both `index-zh.json` and
  `pages/zh/`.
- Don't pass `DD.MM.YYYY` strings straight into JS `Date`.
- Don't hard-code the document `type` enum (unknown types must still render).
- Don't trust `search-list.json` blindly — it contains spam; curate first.
- Avoid modern UI chrome, neon, strong shadows, heavy textures.

## Tab → data-source map

Biography mode only; an entry without a `*.bio.json` shows no tabs at all.

| Tab | Source |
|-----|--------|
| Biography | the edition's `*.bio.md` |
| Gallery | `media.photos` (+ `media.music`) |
| Documents | `documents[]` (+ `metadata.url` as the source row) |
| Lore / Attributes | `metadata` fields + `type`/`gender`/`country` from `index.json` (rows generated dynamically) |

## Glossary

- **BioMD Lite** — the Markdown extension for biographies; extension `.bio.md`.
- **`:::` block / directive** — fenced custom block (`lead`, `image`, `images`,
  `document`, `columns`, `column`).
- **Codex modal** — the full-screen antique biography card UI.
- **Lore / Attributes** — the metadata tab (two names for the same tab).
- **Entry** — one row of `index.json`. A **biography** entry = article +
  dossier + media/docs; a **page** entry = article only (no `json`).
- **Slug** — the `md` basename minus `.bio.md`/`.md`; the entry's route `#/{slug}`.
- **Edition** — one language's copy of an entry's article + dossier, under
  `pages/<lang>/`. Fully authored in that language.
- **Hidden entry** — `type: "hidden"`: routable and linkable, but out of the
  grid, search, facets and page-turn order.
- **`embedded`** — special `documents[].target` meaning "rendered inside the entry".
- **`ranking`** — project-specific numeric score (~0–100).

## Source-of-truth precedence

`docs/` files  ▶  `.claude-memory/` notes  ▶  assumptions.
When specs change, update the `docs/` file **and** its `.claude-memory/` note.
