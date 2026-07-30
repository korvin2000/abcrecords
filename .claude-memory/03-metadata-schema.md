# 03 · MetaData.json Schema (dossier, v2)

**Source of truth:** [`docs/MetaData.md`](../docs/MetaData.md) (guide) +
[`docs/MetaData.json`](../docs/MetaData.json) (template). Identity and
classification are **not** here — see
[`docs/Catalog-Index.md`](../docs/Catalog-Index.md) /
[`11-index-json.md`](11-index-json.md).

On disk: `pages/<lang>/<slug>.bio.json`, **one per language edition**.
"MetaData.json" names the *format*, not the file. Feeds the
**Lore/Attributes, Gallery and Documents** tabs; the Biography tab uses the
sibling `<slug>.bio.md`.

> ⚠ **Migration status (2026-07-31).** Spec is v2; the 12 files under `pages/`
> are still v1 (they still carry the 7 removed fields, and their prose is
> largely untranslated across editions). See the Step-2 plan.

## Two rules that govern everything else

1. **A dossier is a per-language *edition*, not a translation of an original.**
   Every prose field is authored in its directory's language: `forename`,
   `surname`, `birthname`, `birthplace`, `deathplace`, `relatives`,
   `instruments`, `genres`, `bands`, `awards`, `teachers`, `disciples`, `jobs`
   — plus every `label` in `media.*` and `documents` (their `target`s are
   shared and never localized).
   `pages/ru/…` holds `"forename": "Андрес"`; `pages/de/…` holds `"Andrés"`.
   There is no runtime translation layer, and there must not be one.
   Proper nouns (band names, work titles) keep their own spelling everywhere.
2. **Nothing is required.** Identity comes from `index.json`; the dossier is
   additive detail, and the whole file may be absent (→ the entry is a *page*,
   not a biography).

## Top-level shape

```json
{
  "metadata":  { /* names, places, dates, career, url */ },
  "media":     { "photos": [], "music": [] },
  "documents": []
}
```

## `metadata` fields

**Names & places** (language-scoped): `forename` (codex `<h1>`), `surname`
(codex `<h2>`), `birthname`, `birthplace`, `deathplace`.

**`dates`** (all `DD.MM.YYYY`, all optional): `born`, `died`, `activeFrom`,
`activeTo`. A parser must **not** assume any date exists. Language-invariant.
**This is the only home for dates** — `index.json` carries none, and a date
field in an index row is a validation error (owner's call, 2026-07-31).

**Relationships & career** (strings; comma-separated = list; language-scoped):
`relatives`, `instruments`, `genres`, `bands`, `awards`, `teachers`,
`disciples`, `jobs`.

**Language-invariant:** `ranking` (number, ~0–100), `url` (canonical source).

**Removed in v2 — moved to `index.json`, rejected by lint:** `id`, `title`,
`gender`, `type`, `country`, `bio`, `dataStatus`.

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
4. **Write every prose field in the directory's language.** Never copy an
   edition and leave it untranslated.
5. Dates `DD.MM.YYYY`. Keep `dates`/`ranking`/`url` identical across editions.
6. File refs = relative project paths when possible.
7. **Preserve Unicode names** (no transliteration) — the Latin form belongs in
   `index.json`'s `title`.
8. Comma-separated fields are lists-in-a-string; don't split names containing
   commas unless commas are the explicit separator. A roster entry may carry a
   comma list in `forename` — that is a supported convention.
9. **Preserve unknown fields** when editing.
10. Never add `id`/`title`/`gender`/`type`/`country`/`bio`/`dataStatus`.

## Parsing rules (consumer)

- Root must be an object. **Require nothing else** — every field, and the file
  itself, may be absent.
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
`type`, `gender` and `country` come from `index.json`, not from here; `url` is
presented separately as the Documents tab's source row. Present as a scholarly
dossier (clean rows, soft separators, serif type).

An entry with **no** dossier gets no tabs at all — header + article only
([`04-biography-card-design.md`](04-biography-card-design.md)).

## Future direction

Arrays are preferred later for `genres`, `instruments`, `bands`, `awards`,
`teachers`, `disciples`, `jobs`, `relatives`. Any such change should be
**versioned** or supported alongside the current string form.
