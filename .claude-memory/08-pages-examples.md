# 08 · `pages/` — Worked Examples

**Source:** [`pages/`](../pages/) — three real `.bio.md` articles plus a
`photos/` folder of real image assets. This is the **first real content** in
the repo (as opposed to `docs/`, which is specification). Treat it as a
worked-example reference for how BioMD Lite is actually used in practice —
including a few real-world deviations from the strict spec worth knowing about.

## Files

| File | What it demonstrates |
|------|----------------------|
| `agustin-barrios.bio.md` | Canonical single-person biography: intro image, body image, footnote, discography via `columns`, real-data media table. |
| `authors.bio.md` | A **multi-person roster page** (project team), not a single biography. |
| `jovan-jovicic.bio.md` | Blockquote-with-attribution, `images` row, discography via `columns` + plain numbered list. |
+ others
| `photos/*.jpg` | real (non-placeholder) photo assets, not yet wired to any `MetaData.json`. |

## `agustin-barrios.bio.md` — pattern notes

- Opening `::: image` (`position: right`, `size: small`) directly under the
  `#` title, **before** any body text — confirms images can precede the lead
  paragraph, not just follow it.
- All images use **`https://placehold.co/WxH?text=...`** placeholder URLs —
  this is the live example of the "temporary placeholder" convention from
  [`05-html-conversion-guide.md`](05-html-conversion-guide.md). These are
  **candidates for replacement** with real assets.
- Footnote pattern confirmed exactly as documented: `---` + `¹ note text`.
- Contains a relative link to a **legacy `.htm` file** (`barrios1.htm`), not a
  `.bio.md` file — i.e. not every relative link has been migrated yet; some
  point at not-yet-converted legacy pages. Don't assume all internal links are
  `.bio.md`.
- "## Избранные записи" (Selected Recordings) uses **two consecutive
  `::: columns` blocks**, each pairing a text column (track list as plain
  prose) with an image column (cover placeholder) — a reusable pattern for
  "album write-up + cover".
- "## Ноты и медиаматериалы" (Scores & media) is a genuine **Markdown table**
  mapping Work → Tablature → Audio/MIDI → Scores/archives, exactly matching
  the real-table example in the conversion guide. Missing cells use `—`.

## `authors.bio.md` — pattern notes (⚠ deviates from the "one person per file" idea)

- One file, **one `#` title, multiple `##` sub-profiles** (4 people: project
  founder, his father/lead maintainer, his brother/developer, and a child
  entry with only a birth date, no career). This is a **team/roster page**,
  structurally different from a biography entry — don't assume every
  `.bio.md` maps 1:1 to a `MetaData.json` catalogue entry.
- Uses a plain Markdown link **directly to a `.jpg`** (`articles/about_us/rg_2002.jpg`)
  instead of an `::: image` block — i.e. "click to view full image" is done
  with an ordinary link, not always wrapped in an image directive.
- Ends with a relative link to a legacy page **one level up**
  (`../about.htm`) — confirms legacy `.htm` cross-links still exist in
  converted content.
- References `www.abc-guitars.com` / `www.abcguitars.com` — the project's own
  domains (hosting since 2007/2008) — distinct from the `guitar-times.ru`
  legacy source seen elsewhere. **Two different legacy source sites exist.**

## `jovan-jovicic.bio.md` — pattern notes

- This is the **concrete source** of the quotation example referenced in
  [`05-html-conversion-guide.md`](05-html-conversion-guide.md) ("the Andres
  Segovia quotation in the Jovan Jovicic biography") — confirmed:
  ```md
  > [quote text]
  >
  > — Андрес Сеговия, 4 августа 1961 года
  ```
- Uses `::: images columns: 2` for two side-by-side portraits with identical
  captions (no per-image distinguishing caption required).
- Discography section mixes a **plain numbered list** (`1. 2. 3. …` track
  listing) inside a `column`, next to an image column with the CD cover — a
  second, simpler alternative to Barrios' table-based media listing. Use a
  numbered list when it's a simple tracklist; use a table when there are
  multiple parallel resource types (tab/MIDI/score) per row.

## `photos/` — real assets awaiting linkage

Five real JPGs (not placeholders), by filename → likely subject surname:

| File | Likely subject | Modified |
|------|----------------|----------|
| `kalanadze.jpg` | Каланадзе / Kalanadze | 2010 |
| `kornishin2.jpg` | Корнишин / Kornishin | 2015 |
| `koshkin.jpg` | Кошкин / Koshkin | 2007 |
| `kozlov_v1.jpg` | Козлов В. / Kozlov V. | 2021 |
| `krutikov.jpg` | Крутиков / Krutikov | 2018 |

None of these five people have a `.bio.md` or `MetaData.json` yet in this
repo. These filenames are strong candidates for cross-referencing against
`search-list.json` (`type: guitarist`) — see
[`06-search-index.md`](06-search-index.md) — when building out new entries;
`media.photos[].target` should point at files here once an entry exists.

## Takeaways for future work

- The strict "one BioMD file = one catalogue entry" mental model from
  `docs/` has at least one real exception (`authors.bio.md`, a roster page).
  Don't build tooling that hard-assumes a 1:1 file↔entry mapping without
  checking for roster-style pages.
- Two legacy source domains exist: **`guitar-times.ru`** (content, per
  `search-list.json`) and **`abc-guitars.com` / `abcguitars.com`** (the
  project's own historical hosting, per `authors.bio.md`).
- Placeholder images (`placehold.co`) in existing `.bio.md` files are a
  to-do list of real photos still needed — cross-check against `photos/`
  and `search-list.json` before generating new placeholders.
- No `MetaData.json` exists yet for any of these three `pages/` articles —
  metadata authoring is still outstanding even for already-converted text.
