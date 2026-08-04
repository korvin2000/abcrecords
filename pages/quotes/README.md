# pages/quotes — the book of sayings

One file per UI language, named `quote-<iso-lang>.json`, holding a flat array
of sayings shown in the herald block on the main page (see
`app/src/lib/herald/`).

## Format

```json
[
  { "author": "Андрес Сеговия", "quote": "Гитара — небольшой оркестр…" }
]
```

| Field    | Required | Notes |
|----------|----------|-------|
| `author` | yes      | Authored in this file's language, exactly as it should be rendered. |
| `quote`  | yes      | One saying, plain text — no Markdown, no HTML. |

Rules that match the rest of the content tree:

- **Fully localized editions, not translations.** `quote-ja.json` is the
  Japanese book of sayings; the entries need not correspond one-to-one with
  `quote-ru.json`.
- A **missing file is normal** — the loader fails soft and the herald simply
  keeps showing the default line. There is no cross-language fallback: a
  Japanese reader is better served by no quote than by a Russian one.
- Rows with an empty `author` or `quote` are dropped at load time; a file that
  is not an array is ignored entirely.
- These files live in `pages/`, so editing them changes the served content
  with **no rebuild** (`publicDir = ../pages`).

## ⚠ The current contents are placeholder fixtures

The texts shipped today were **written for this project as layout test data**.
They are *not* verified quotations and must not be treated as such — the
attributions exist only so the block can be styled and localized against
realistic data. Replace them with sourced material before release.
