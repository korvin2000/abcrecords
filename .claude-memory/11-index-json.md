# 11 · `pages/index.json` — Search / Main-Menu Index

**Source:** [`pages/index.json`](../pages/index.json) — a flat JSON **array**,
currently **7 entries**. This is the **live search/browse index**: the main
page/menu searches it by `title` and shows a preview card (`img`) that links
out to the full metadata (`json`) and biography (`md`) for that entry. It is
**not** the same thing as `docs/search-list.json` (that's the legacy
`guitar-times.ru` index, unrelated schema — see
[`06-search-index.md`](06-search-index.md)) and **not** the same thing as
`docs/MetaData.json` (that's the full per-entry metadata schema — see
[`03-metadata-schema.md`](03-metadata-schema.md)). Think of `index.json` as a
**lightweight catalogue/summary layer that points at the two per-entry files**.

## Record shape

```json
{
  "title":    "Full display name",
  "type":     "guitarist | composer | musician | …",
  "forename": "Forename",
  "surname":  "Surname",
  "country":  "Nationality (free-text country name)",
  "json":     "/slug.bio.json",   // relative path to the full metadata file
  "md":       "/slug.bio.md",     // relative path to the biography (BioMD Lite)
  "img":      "photos/slug.jpg"   // relative path to the preview/avatar image
}
```

## Role in the UI (maps onto the codex modal's tabs — see [`04-biography-card-design.md`](04-biography-card-design.md))

| index.json field | Used for |
|---|---|
| `title` | **Search key** on the main menu/search page. |
| `img` | **Preview/avatar** shown on the search result card (≈ `CharacterCard` primary portrait). |
| `json` | Path to the entry's full structured metadata (feeds Lore/Attributes, Gallery, Documents tabs). |
| `md` | Path to the entry's `BioMD Lite` biography (feeds the Biography tab). |
| `type`, `forename`, `surname`, `country` | Extra facets/labels available without loading `json` — cheap enough to show directly on the card or use as search/filter facets. |

## Observed real content (as of this scan)

7 entries; only **3 correspond to existing files** already surveyed in
[`08-pages-examples.md`](08-pages-examples.md) — `agustin-barrios`,
`authors`, `jovan-jovicic`. The other **4 reference `.bio.md`/`.bio.json`
files that do not exist yet** in `pages/` (`andres-segovia`,
`django-reinhardt`, `jimi-hendrix`, `paco-de-lucia`) — i.e. `index.json` is
ahead of the content; treat these four as **planned/placeholder entries**,
not broken links to fix.

The `authors` entry (the multi-person roster page) is squeezed into the
single-person index shape with an **invented pseudo-identity**:
`forename: "Коллектив"` ("Collective"), `surname: "Тавровские"`
("the Tavrovskys"), `type: "musician"` (generic, not `guitarist`). This is
the concrete, present-day answer to the open question raised in
[`08-pages-examples.md`](08-pages-examples.md) about how roster-style pages
fit the one-entry-per-file model: **they get one synthetic index row**.

## ⚠ Deviations from the `docs/` conventions — do not silently "fix" these without asking

- **`country` is a free-text nationality string** (`"Paraguay"`, `"Spain"`,
  `"United States"`, `"Serbia"`, `"Ukraine"`), **not an ISO 3166-1 alpha-2
  code** as `docs/MetaData.md` specifies for `metadata.country`
  (`RU`/`DE`/`ES`/`BR`). `index.json` and the eventual per-entry
  `MetaData.json`/`.bio.json` may end up with two different representations
  of country — reconcile deliberately, don't assume one is simply wrong.
- **No `id` field.** `docs/MetaData.md` treats `metadata.id` (with
  significant leading zeroes) as the stable unique key. `index.json` instead
  keys records by `title` (for search) and by the `json`/`md` file paths (for
  identity/linking). If code needs a stable id, it isn't here yet.
- **Per-entry metadata file is named `<slug>.bio.json`, flat in `pages/`** —
  not literally `MetaData.json` in a per-entry folder as the example in
  `docs/MetaData.json` suggests. The real layout convention appears to be:
  `pages/<slug>.bio.md` + `pages/<slug>.bio.json` as sibling flat files (none
  of the `.bio.json` files exist yet to confirm their internal shape — assume
  the field semantics from `docs/MetaData.md` still apply until one is seen).
- **Inconsistent leading slash.** `json` and `md` paths are root-relative
  (leading `/`), but `img` is bucket-relative (`photos/slug.jpg`, no leading
  slash). Resolve each according to its own convention — don't apply one
  path-joining rule to all three fields.
- Slugs (`jovan-jovicic`, etc.) are **Latin-transliterated filenames** even
  when `title`/`forename`/`surname` are Cyrillic — consistent with the
  existing `pages/*.bio.md` filenames, so this part is *not* a deviation, just
  confirmation of the existing pattern.

## Open items (flag to the user, don't assume)

- Whether `country` will be normalized to ISO alpha-2 to match
  `docs/MetaData.md`, or whether `MetaData.md` should instead be updated to
  allow free-text nationality (the working agreement in `CLAUDE.md` says
  `docs/` is source of truth for specs — but this is real, current data
  contradicting that spec, worth raising rather than silently picking a side).
- Whether the four not-yet-created entries (`andres-segovia`,
  `django-reinhardt`, `jimi-hendrix`, `paco-de-lucia`) are next up for
  content creation.
- The internal shape of `<slug>.bio.json` is still unconfirmed — no example
  exists yet in the repo.
