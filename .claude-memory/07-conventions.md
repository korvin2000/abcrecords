# 07 · Conventions, Do/Don't & Glossary

A single-page cheat sheet. Details live in the numbered notes and in `docs/`.

## Separation of concerns

- **Article text + layout → `*.bio.md`** (BioMD Lite).
- **Structured facts → `MetaData.json`.**
- **Never** put metadata in the article, and never put article prose in metadata.

## Do

- Prefer plain Markdown; reach for `:::` blocks only for layout/media.
- Keep one BioMD property per line; use only documented values.
- Write in natural reading order (source order = reading order).
- Dates `DD.MM.YYYY`; countries ISO 3166-1 alpha-2; preserve `id` leading zeroes.
- Preserve Unicode / Cyrillic names verbatim (no transliteration).
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
- Don't pass `DD.MM.YYYY` strings straight into JS `Date`.
- Don't hard-code the document `type` enum (unknown types must still render).
- Don't trust `search-list.json` blindly — it contains spam; curate first.
- Avoid modern UI chrome, neon, strong shadows, heavy textures.

## Tab → data-source map

| Tab | Source |
|-----|--------|
| Biography | Markdown file at `metadata.bio` |
| Gallery | `media.photos` (+ `media.music`) |
| Documents | `documents[]` |
| Lore / Attributes | fields inside `metadata` (rows generated dynamically) |

## Glossary

- **BioMD Lite** — the Markdown extension for biographies; extension `.bio.md`.
- **`:::` block / directive** — fenced custom block (`lead`, `image`, `images`,
  `document`, `columns`, `column`).
- **Codex modal** — the full-screen antique biography card UI.
- **Lore / Attributes** — the metadata tab (two names for the same tab).
- **Entry** — one person/character = one `.bio.md` + one `MetaData.json` + media/docs.
- **`embedded`** — special `documents[].target` meaning "rendered inside the entry".
- **`ranking`** — project-specific numeric score (~0–100).

## Source-of-truth precedence

`docs/` files  ▶  `.claude-memory/` notes  ▶  assumptions.
When specs change, update the `docs/` file **and** its `.claude-memory/` note.
