# 11 · Catalogue Index — `index.json` + `index-<lang>.json`

**Source of truth:** [`docs/Catalog-Index.md`](../docs/Catalog-Index.md) (v2.1,
2026-08-30). This note is the condensed version — when they disagree, the spec
wins.

> ✅ **Migration status (2026-07-31).** Spec, data **and all app code** are v2 —
> the app reads `id`, ISO `country` and `index-<lang>.json`; hidden rows are
> out of the grid/search/facets but stay routable; aliases drive ranked
> multilingual search; a dossier-less entry renders as a page. Only Step 7
> (guard-rails) of
> [`the plan`](../docs/proposals/Plan_Catalog-v2-index-ids-localized-names-codex-split.md)
> remains. Live corpus: **15 rows (7 listed, 8 hidden)**, 12 dossiers,
> 5 name indexes (`ru en de zh ja`).

## The two files

`pages/index.json` — flat array, one row per catalogue entry, in display order.

```jsonc
{
  "id": "3",                              // string, stable, never reused/renumbered
  "title": "Andres Segovia",              // LATIN fallback name + last-resort search key
  "lang": "ru,de",                        // content editions; first = original; absent → "ru"
  "type": "guitarist",                    // craft — or "hidden"
  "gender": "m",                          // m | f | mixed → also picks the default portrait
  "country": "es",                        // ISO 3166-1 alpha-2, LOWERCASE (never free text)
  "md": "/andres-segovia.bio.md",         // defines the slug + route; required unless `pdf`
  "json": "/andres-segovia.bio.json",     // OPTIONAL — presence ⟺ biography
  "img": "photos/andres-segovia.jpg"      // OPTIONAL — else photos/default-<gender>.jpg
}
```

A row may declare **`pdf` instead of `md`** — then it *is* a document and opens
in the PDF viewer, not the codex (v2.1):

```jsonc
{
  "id": "737", "title": "Istoriya gitary v litsakh 1-2 (2022)",
  "lang": "ru", "type": "magazine", "country": "ru",
  "pdf": "magazine/2022/IGvL_1-2(28-29)_2022_min.pdf",   // SITE-root-relative!
  "img": "photo/z/zyrjanov.jpg"                          // grid cover
}
```

`pages/index-<lang>.json` — object keyed by `id`, one small file per UI language.

```jsonc
{ "3": ["Андрес Сеговия", "Сеговия", "Андрэс Сеговия"] }
//        ↑ [0] = display name          ↑ [1…] = search-only aliases, never rendered
```

Missing file / missing id / empty array → fall back to `index.json.title`.
**Omit an id when its localized name equals `title` *and* it has no aliases**;
`[0]` may repeat `title` when the entry exists for the sake of its aliases.
Aliases are what make CJK search work — 塞戈维亚 has no romanization path any
generic algorithm will find.

## The six rules worth memorizing

1. **`id` is stable, string, never a position.** Assigned once, never
   renumbered, never reused. Join key to `index-<lang>.json` — *not* the route.
2. **Route = `#/{slug}`**, slug = the basename of `md` (or of `pdf` when there
   is no `md`), minus `.bio.md`/`.md`/`.pdf`. Unique across the index,
   Latin/ASCII — word chars, `.`, `-` and `()` (brackets for archive scan
   names). `md`/`json` are written root-relative and mapped to `pages/<lang>/…`
   at load; `img` and all media are **never** localized.
3. **`json` present ⟺ biography** (4-tab codex). Absent ⟺ page (article only).
   *Declared*, never inferred from a failed fetch — the chrome must not reshape
   mid-load.
4. **`type: "hidden"`** → out of grid, search, facets, counts and ←/→ order;
   still routable and linkable. For `about`/`sources`/`links`/`news`,
   continuation sub-pages, and fixtures.
5. **One fact, one file — and dates are dossier facts.** `index.json` holds
   only what is needed to list, route and classify an entry before anything
   else is fetched. `born`/`died` are **not** mirrored here (owner's call,
   2026-07-31); a future birth-date filter must revisit spec §13.
6. **`pdf` without `md` ⟺ document** — opens the PDF viewer instead of the
   codex (spec §9.1). Also declared, never inferred. **Three bases now, not
   two:** `pdf` is relative to the **site root**, not the app base and not
   `/pages` — the magazine archive sits beside the app, so it survives a
   `--base=/fable/` deploy. A row with *both* `md` and `pdf` is an ordinary
   entry whose article happens to have a scan to link. `json` on a `pdf` row is
   meaningless.

## Field ownership (the model in one table)

| Fact | Lives in |
|---|---|
| identity, classification, paths | `index.json` |
| display name + search aliases, per language | `index-<lang>.json` |
| language-scoped dossier prose (`forename`, `surname`, `birthplace`, `jobs`, …) | `pages/<lang>/*.bio.json` |
| language-invariant dossier facts (`dates`, `ranking`, `url`) | `pages/<lang>/*.bio.json`, identical in every edition |

**Case:** `type`/`gender`/`country`/`lang` are authored **lowercase** and read
case-insensitively. The loader normalizes once at the boundary — `country` to
UPPERCASE (what `Intl.DisplayNames` and `CountryFlag` expect), the rest to
lowercase — so no downstream code compares case-insensitively.

## Two axes that are NOT the same thing

- `lang` = which **content editions** exist (`pages/ru/…`, `pages/de/…`).
- `index-<lang>.json` membership = in which languages the entry can be **named
  and found**.

They are independent by design: a `lang: "ru"` entry with a Chinese name in
`index-zh.json` lets a Chinese reader find it and open the Russian edition.
**The catalogue is searchable in more languages than it is written in.**

Codes are ISO 639-1 from `app/src/lib/languages.ts`. **Chinese is `zh`, not
`ch`** — for `index-zh.json` and for `pages/zh/` alike.

## Portraits

`img` absent → `photos/default-male.svg` / `default-female.svg` /
`default-mixed.svg` by `gender` (`mixed` also covers absent) — engraved SVG,
~1.5 KB each, not photographs. If that 404s, the
app draws a deterministic procedural monogram — a portrait is never broken.
`hidden` rows need no `img`/`gender`.

## Validation

`npm run lint:content` (see spec §11). Errors: duplicate id/slug, a row with
neither `md` nor `pdf`, `json` on a `pdf` row, a slug with characters outside
`[\w.()-]`, bad ISO country, bad gender, a date field present in an index row,
dangling `index-<lang>` key, any of the 7 removed fields still in a
`*.bio.json`. Warnings: display name ≠ `forename + " " + surname`,
`dates`/`ranking`/`url` differing between editions, a lone localized name equal
to `title`, an untranslated-looking edition (Cyrillic-script edition holding pure
ASCII prose, or vice versa).
