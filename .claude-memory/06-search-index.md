# 06 · Legacy Search Index (`search-list.json`)

**Source file:** [`docs/search-list.json`](../docs/search-list.json)
(~337 KB, **1249 entries**). A flat JSON **array** of search records — the legacy
search/discovery index carried over from `guitar-times.ru`.

## Record shape

```json
{
  "title":   "Абреу",              // display title (sometimes empty or truncated)
  "text":    "optional longer text",// optional expanded description
  "type":    "guitarist",           // record category (see below)
  "surname": "Абреу",              // optional
  "forename":"Зекинья",            // optional
  "url":     "http://www.guitar-times.ru/pages/guit/..."  // target link
}
```

Only `title`, `type`, `url` are consistently present; `text`, `surname`,
`forename` are optional. Titles may be truncated (e.g. `"купить новый фольксваге."`)
and content is largely **Cyrillic** — keep UTF-8, no transliteration.

## `type` distribution (as scanned)

| type | count |
|------|------:|
| `guitarist` | 856 |
| `article` | 92 |
| `historian` | 73 |
| `fest` | 70 |
| `links` | 68 |
| `news` | 52 |
| `other` | 20 |
| `publisher` | 17 |
| `social` | 1 |

## Caveats

- **Not clean.** Some `article` records are unrelated web spam (car dealerships:
  `avtoruss-tradein.ru`, `volkswagen-av.ru`, `jaguar-jas.ru`, …) and analytics
  jumps (`top.mail.ru`, `top.list.ru`). Filter/curate before surfacing to users.
- Dominant real domain is `www.guitar-times.ru` (~271 URLs); others include
  `strings.ru`, `lute.ru`, `gnesin.ru`, `abcguitars.com`, etc.
- This index is **legacy** and **not** the same schema as `MetaData.json`. Treat
  it as a migration/reference source, not the live data model.
- Old timestamp (Feb 2020) — the only obviously dated file in `docs/`.

## Likely uses

- Seed list of entries to migrate (guitarists/historians → biography entries).
- Source of legacy URLs for HTML→BioMD conversion (see
  [`05-html-conversion-guide.md`](05-html-conversion-guide.md)).
- Reference for building a new, curated search index for the codex catalogue.
