# 03 · MetaData.json Schema

**Source of truth:** [`docs/MetaData.md`](../docs/MetaData.md) (guide) +
[`docs/MetaData.json`](../docs/MetaData.json) (example). One `MetaData.json` per
biography entry. Feeds the **Lore/Attributes, Gallery, and Documents** tabs; the
Biography tab uses the Markdown file at `metadata.bio`.

## Top-level shape

```json
{
  "metadata":  { /* identity, dates, career, bio path, url */ },
  "media":     { "photos": [], "music": [] },
  "documents": []
}
```

## `metadata` fields

**Identity:** `id` (string, unique/stable, **leading zeroes significant**),
`title` (display name), `birthname`, `gender` (`m`/`f`/project code),
`type` (`guitarist`, `composer`, `conductor`, `luthier`, …),
`surname`, `forename`, `country` (**ISO 3166-1 alpha-2**: `RU`,`DE`,`ES`,`BR`),
`birthplace`, `deathplace`.

**`dates`** (all `DD.MM.YYYY`, all optional): `born`, `died`, `activeFrom`,
`activeTo`. A parser must **not** assume any date exists.

**Relationships & career** (currently strings; comma-separated = list):
`relatives`, `instruments`, `genres`, `bands`, `awards`, `teachers`,
`disciples`, `jobs`, `ranking` (number, ~0–100), `bio` (relative path to `.md`),
`url` (external/canonical source).

## `media`

```json
"photos": [{ "label": "Main portrait", "target": "/images/person/main.jpg" }],
"music":  [{ "label": "Recording title", "target": "/music/track.mp3" }]
```
- `label` = caption/role · `target` = relative path or URL.
- First photo = primary portrait when no explicit `primary` flag.
- Determine audio playback from extension/MIME, not from `label`.

## `documents`

```json
[{ "label": "Expulsion hearing", "type": "TRANSCRIPT", "target": "embedded" }]
```
- `type` = uppercase symbolic (observed: `TRANSCRIPT`, `DOSSIER`) — **do not
  hard-code**; unknown types → generic icon/label.
- `target` interpretation: `embedded` = rendered inside entry · relative path =
  local file · absolute URL = external · slug/id = resolve via doc registry.

## Authoring rules (LLM)

1. Valid UTF-8 JSON only; double quotes; **no comments / trailing commas**.
2. Keep the three top-level sections.
3. **Do not invent facts** — omit optional fields or use `null` if supported.
4. `id` unique & stable, leading zeroes preserved.
5. Dates `DD.MM.YYYY`; countries ISO alpha-2.
6. File refs = relative project paths when possible.
7. **Preserve Unicode names** (no transliteration unless a separate field exists).
8. Comma-separated fields are lists-in-a-string; don't split names containing
   commas unless commas are the explicit separator.
9. **Preserve unknown fields** when editing.

## Parsing rules (consumer)

- Root must be an object; validate app-required `metadata.id`, `.title`, `.bio`.
- Parse dates **explicitly as `DD.MM.YYYY`** — do NOT pass to JS `Date` directly
  (day/month order would break).
- Normalize lists only when the UI needs arrays:
  `split(",") → trim → drop empties`.
- Resolve per-entry media/document paths against the configurable resource
  base (default `/pages`), independently of Vite's application base;
  `index.json` is explicitly excluded.
- Missing optional value → render as an **absent row**, not an empty label.
- Ignore/preserve unknown fields rather than reject the document.

## Lore/Attributes tab

Generate rows **dynamically** from present metadata (don't rely on a fixed set).
Hide/segregate technical fields (`id`, `bio`, `url`). Present as a scholarly
dossier (clean rows, soft separators, serif type).

## Future direction

Arrays are preferred later for `genres`, `instruments`, `bands`, `awards`,
`teachers`, `disciples`, `jobs`, `relatives`. Any such change should be
**versioned** or supported alongside the current string form.
