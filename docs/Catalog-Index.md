# Catalogue Index Format

`pages/index.json` · `pages/index-<lang>.json`

**Version:** 2.1 · **Status:** normative · **Date:** 2026-08-30

This document specifies the two files that make up the catalogue's **identity
and discovery layer**. Together they answer three questions without loading a
single per-entry file:

1. *What entries exist, and what is each one?* → `index.json`
2. *What is each entry called in language X, and what else might a reader type
   to find it?* → `index-<lang>.json`
3. *Where does the content live?* → the `md` / `json` / `pdf` paths in
   `index.json`

The per-entry dossier format is specified separately in
[`MetaData.md`](MetaData.md); the article format in
[`Biography-Markup.md`](Biography-Markup.md).

---

## 1. Field ownership — the rule the model rests on

Every fact in the catalogue lives in exactly one place. Where it lives is
decided by **who needs it and when**, not by what it is about.

| Kind of fact | Lives in | Examples |
|---|---|---|
| Identity & classification, needed **before** any per-entry fetch | `index.json` | `id`, `type`, `gender`, `country`, `lang`, paths |
| **Display name + search aliases**, per language | `index-<lang>.json` | `"Андрес Сеговия"`, `"Сеговия"` |
| **Language-scoped prose** | `pages/<lang>/*.bio.json` | `forename`, `surname`, `birthplace`, `jobs`, … |
| Language-invariant dossier facts | `pages/<lang>/*.bio.json` | `dates`, `ranking`, `url` |

Two consequences worth internalising:

- **A fact lives in exactly one file.** `index.json` carries what the catalogue
  needs to list, route and classify an entry before anything else is fetched —
  and nothing more. **Dates are dossier facts and stay in the dossier**, even
  though a future birth-date filter would read them (see §13).
- **`*.bio.json` is a per-language *edition*, not a translation of a canonical
  original.** Every prose field in it is authored in that edition's language.
  See [`MetaData.md` §Localization](MetaData.md).

---

## 2. `pages/index.json`

A flat JSON **array** of records, in display order.

```jsonc
[
  {
    "id":      "3",
    "title":   "Andres Segovia",
    "lang":    "ru,de",
    "type":    "guitarist",
    "gender":  "m",
    "country": "es",
    "md":      "/andres-segovia.bio.md",
    "json":    "/andres-segovia.bio.json",
    "img":     "photos/andres-segovia.jpg"
  }
]
```

| Field | Req. | Type | Meaning |
|---|:--:|---|---|
| `id` | ● | string | Unique, stable, never reused. §3 |
| `title` | ● | string | **Latin/ASCII** fallback display name + last-resort search key. §5.3 |
| `type` | ● | string | Craft (`guitarist`, `composer`, `conductor`, `luthier`, `musician`, …) **or** `hidden`. §6 |
| `md` | ◐ | string | Root-relative path to the article. Defines the slug and the route. Required unless the row declares `pdf` instead. §4 |
| `pdf` | ◐ | string | **Site-root**-relative path to a PDF. Declared instead of `md`, it makes the row a **document**: opening it shows the file in the PDF viewer. §9 |
| `lang` | ○ | string | Comma-separated ISO 639-1 codes of the **content editions** that exist; first = original. Absent → `"ru"`. §7 |
| `gender` | ○ | `m`\|`f`\|`mixed` | Person's gender; also selects the default portrait. §8 |
| `country` | ○ | string | ISO 3166-1 alpha-2, **lowercase**. §5.2 |
| `json` | ○ | string | Root-relative path to the dossier. **Presence decides biography vs page.** §9 |
| `img` | ○ | string | Bucket-relative portrait. Absent → default by gender. §8 |

A row needs an `id` and one of `md` / `pdf`; without them it can be neither
joined nor routed, and the loader skips it with a warning. Unknown fields are
preserved, never rejected.

`●` required · `◐` one of the pair required · `○` optional.

Dates are **not** here — they are dossier facts (`dates` in `*.bio.json`).

### 2.1 Case

The enum-like fields — `type`, `gender`, `country` and `lang` — are **authored
lowercase** and read **case-insensitively**. The loader normalizes each to one
canonical form exactly once, at the boundary, so no downstream code ever
compares case-insensitively:

| Field | Authored | Canonical in memory |
|---|---|---|
| `country` | `es` | `ES` — uppercase, as `Intl.DisplayNames` and the flag set expect |
| `type`, `gender`, `lang` | `guitarist`, `m`, `ru,de` | lowercase |

`"ES"`, `"es"` and `"Es"` are therefore all valid input and indistinguishable
after load; lowercase is the house style and what the validator expects.

---

## 3. `id` — identity

- A **string**, because it is used as an object key in `index-<lang>.json`
  and `"7"` must never be confused with `7` or `"0007"`.
- Plain decimal, no leading zeroes, assigned **sequentially at creation time**.
- **Stable forever.** Assigned once, never renumbered, never reused — not even
  after a row is deleted.

> ⚠ `id` is **not a position**. It looks like one when a fresh index is
> authored top to bottom, and that is a convenience only. Renumbering on insert
> or delete silently breaks every `index-<lang>.json` key that referenced the
> old number, and the breakage is invisible: names simply fall back to `title`.

`id` is the join key to `index-<lang>.json`, and nothing else. It is **not**
the route (§4) and **not** a path component.

---

## 4. Paths, slug and routing

### 4.1 `md` and `json`

Both are written **as if the file sat at the content root**, with a leading
slash:

```
"md":   "/andres-segovia.bio.md"
"json": "/andres-segovia.bio.json"
```

The file physically lives in a per-language directory —
`pages/ru/andres-segovia.bio.md`, `pages/de/andres-segovia.bio.md` — and the
application maps the declared path into the chosen edition at load time. Author
the root-relative form; never write the language directory into `index.json`.

Article extensions: `.bio.md` for biographies, plain `.md` for pages (§9).

**`pdf` follows a different rule and must not be confused with these.** It is
relative to the **site root**, not to the content root and not to the
application base:

```
"pdf": "magazine/2022/IGvL_1-2(28-29)_2022_min.pdf"
      →  https://www.abc-guitars.com/magazine/2022/IGvL_1-2(28-29)_2022_min.pdf
```

A leading slash is allowed and means the same thing; an absolute `https://…`
URL is passed through untouched. The document archive sits *beside* the
application at the web root, so neither the app base (which may be `/fable/`)
nor the resource base (`/pages`) applies — the app can move without the
magazines moving with it. `pdf` is **never localized**: one scan serves every
edition, exactly as `img` and every other media path does.

### 4.2 Slug and route

The **slug** is the basename of whichever file names the row — `md` when there
is one, `pdf` otherwise — with `.bio.md`, `.md` or `.pdf` stripped:

```
/andres-segovia.bio.md                       →  andres-segovia
/about.md                                    →  about
magazine/2022/IGvL_1-2(28-29)_2022_min.pdf   →  IGvL_1-2(28-29)_2022_min
```

It must be **unique across the whole index** and should be Latin/ASCII with
hyphens; word characters, dots, hyphens and round brackets are what the router
accepts (brackets because archive scans are named that way and renaming them
would break the links the archive already publishes). It is the entry's URL:

```
{BASE_URL}#/{slug}

https://www.abc-guitars.com/#/andres-segovia
https://www.abc-guitars.com/fable/#/andres-segovia
```

Links between entries inside articles use the same form (`#/{slug}`) or a
direct `*.bio.md` path, which the renderer rewrites to it. A link to a `hidden`
entry is valid and works.

> Routes are slugs, not ids, deliberately: URLs stay human-readable, existing
> deep links keep working, and migrated content already contains this form.

### 4.3 Dates are not in the index

Birth and death dates live **only** in the dossier (`dates` in `*.bio.json`)
and are read when a codex opens. They are deliberately not mirrored here: one
fact, one file.

The cost is that a future birth-date **filter** cannot be answered from the
index alone — §13 records the two ways forward when that feature arrives.

---

## 5. Names, countries and the Latin fallback

### 5.1 Where the display name comes from

For a given UI language `L` and entry `id`:

```
index-<L>.json[id][0]        →  the display name
    ↓ (file missing, id missing, or empty)
index.json.title             →  the Latin fallback
```

Inside an open codex the biography header instead shows `forename` / `surname`
from the dossier of the **edition currently being read**, which is already in
that language. The two agree by construction; §11 warns if they drift.

### 5.2 `country`

ISO 3166-1 alpha-2, authored **lowercase** (`es`, `py`, `us`) and normalized to
uppercase on load (§2.1). The display name is derived at runtime with
`Intl.DisplayNames`, so it localizes into every UI language for free, and the
code selects the flag.

**Semantics:** the person's **principal national identity**, not necessarily
their birthplace. Django Reinhardt is `fr` although born in Belgium; the
birthplace lives in the dossier. One value only — pick the primary one for
dual nationals.

### 5.3 `title`

The **Latin/ASCII** rendering of the name: `"Andres Segovia"`,
`"Project Authors"`. Two jobs:

1. display fallback when the reader's language has no entry in
   `index-<lang>.json`;
2. last-resort search key, which is what lets a Latin query reach an entry
   whose every localized name is in another script.

Keep it plain ASCII where practical — it is the fallback, not the showcase.

---

## 6. `type` and visibility

`type` carries the entry's **craft** (`guitarist`, `composer`, `conductor`,
`luthier`, `musician`, …) and doubles as the visibility switch through one
reserved value:

**`type: "hidden"`** — the entry is excluded from:

- the catalogue grid,
- search results,
- facet chips,
- result counts,
- the ←/→ page-turn order.

It remains fully **routable and linkable**: `#/about` opens it, cross-links
from other articles resolve to it, and the language menu works on it.

Use it for technical pages (`about`, `sources`, `links`, `news`), for
sub-pages that belong to another entry (a discography continuation), and for
fixtures that should not pollute the catalogue.

> Design note: this deliberately overloads a *craft* taxonomy with a
> *visibility* concept. It is accepted because a technical page has no craft,
> so the field has no other job for exactly the rows that use it. All
> visibility branching in the application goes through a single predicate, so
> promoting visibility to its own field later is a local change.

---

## 7. Languages — two orthogonal axes

| | Declared by | Means |
|---|---|---|
| **Content editions** | `lang` in `index.json` | which `pages/<lang>/…` article + dossier pairs exist |
| **Name translations** | which `index-<lang>.json` files contain the `id` | in which languages the entry can be *named and found* |

These are independent, and that is the point. An entry with
`lang: "ru"` may still have a Chinese name in `index-zh.json` — a Chinese
reader finds 安德烈斯·塞戈维亚 by name and opens the Russian edition. The
catalogue is searchable in more languages than it is written in.

Language codes are ISO 639-1 and must be one of the codes the application
supports. **Chinese is `zh`, not `ch`** — this applies to the index filename
(`index-zh.json`) and to the content directory (`pages/zh/`) alike. Likewise,
**Ukrainian is `uk`, not `ua`** — `ua` is the ISO 3166-1 *country* code
(already in use for Ukraine in `index.json` `country` and in `CountryFlag`),
not the ISO 639-1 *language* code; the index filename is `index-uk.json` and
the content directory is `pages/uk/`.

---

## 8. Portraits

`img` is bucket-relative and **not** localized — media is shared by all
editions:

```
"img": "photos/andres-segovia.jpg"
```

When `img` is absent the portrait falls back by gender:

| `gender` | Portrait |
|---|---|
| `m` | `photos/default-male.svg` |
| `f` | `photos/default-female.svg` |
| `mixed`, absent | `photos/default-mixed.svg` |

The defaults are **SVG**, not photographs: ~1.5 KB each, sharp at any card
size, no binary blobs in the repository, and drawn in the same engraved
paper/gold/burgundy language as the procedural placeholder.

If that file is missing too, the application renders a deterministic
procedural monogram — so a missing portrait is never a broken image.

`hidden` entries need no portrait; omit `img` and `gender` for them.

---

## 9. Biography, page or document

A row declares which of three things it is, and the application reads that
declaration **before** it fetches anything:

| The row declares | It is a | Opening it shows |
|---|---|---|
| `md` + `json` | **biography** | the codex: header + 4 tabs (Biography · Gallery · Documents · Lore) |
| `md`, no `json` | **page** | the codex: header + article only |
| `pdf`, no `md` | **document** | the PDF viewer: the file itself, with paging/zoom/fit/rotate/download |

**`json` present ⟺ biography. `pdf` without `md` ⟺ document.**

Both are **declared** properties, never inferred from whether a fetch happened
to succeed. A dossier that fails to load leaves a biography as a biography with
empty tabs; a PDF that fails to load leaves the viewer showing an error and a
download link. Neither silently reshapes into something else mid-load.

Pages are ordinary BioMD Lite articles named `<slug>.md` (no `.bio.` infix) and
placed in the same per-language directories.

### 9.1 Documents

A document row is the whole entry: there is no article, no dossier and no
per-language edition, so the codex has nothing to arrange and is not used.
What the reader gets instead is a dialog with the same parchment, border,
corner filigree and page-turn as the codex — and a PDF where the article would
be. It has no tabs, no header, no metadata and no ←/→ leafing between entries,
because those arrow keys belong to the pages of the open document.

Consequences worth knowing before authoring one:

- **`lang` still classifies it, but nothing is translated.** One file serves
  every reader; declare the language the document is *written in*, so the
  language-scope filter shelves it correctly.
- **`title`, `type`, `gender`, `country` and `img` work as they do everywhere
  else** — a document appears in the grid as a card like any other entry, with
  its own portrait or cover and its own facet chips. Give it a `type` that
  reads as one (`magazine`, `score`, `programme`) and add its localized name to
  `index-<lang>.json` as usual.
- **`json` on a document row is meaningless** and should be omitted: there is
  no codex to put a dossier in.
- **A row may carry both `md` and `pdf`.** That is *not* a document: the
  article wins, and the PDF is simply another archive file for the article to
  link. Use it when a scan accompanies a written entry.

Example:

```jsonc
{
  "id":      "737",
  "title":   "Istoriya gitary v litsakh 1-2 (2022)",
  "lang":    "ru",
  "type":    "magazine",
  "country": "ru",
  "pdf":     "magazine/2022/IGvL_1-2(28-29)_2022_min.pdf",
  "img":     "photo/z/zyrjanov.jpg"
}
```

---

## 10. `pages/index-<lang>.json`

A JSON **object** keyed by `id`. One small file per UI language, fetched once.

```jsonc
// pages/index-ru.json
{
  "3": ["Андрес Сеговия", "Сеговия", "Андрэс Сеговия"],
  "5": ["Джанго Рейнхардт", "Рейнхардт", "Джанго Райнхардт"],
  "6": ["Джими Хендрикс", "Хендрикс", "Хендрих"]
}
```

```jsonc
// pages/index-zh.json
{
  "3": ["安德烈斯·塞戈维亚", "塞戈维亚"],
  "6": ["吉米·亨德里克斯"]
}
```

**Contract**

- Key = the `id` from `index.json`. Value = a non-empty array of strings.
- **`[0]` is the display name** in that language — the string that is rendered.
- **`[1…]` are aliases: search-only, never displayed.** Surname alone,
  inverted name order, common misspellings, maiden and stage names, alternate
  romanizations.
- **Omit an `id` entirely when its localized name equals the Latin `title`
  *and* it carries no aliases** — a lone `["Django Reinhardt"]` under a row
  already titled `Django Reinhardt` is dead weight and warns.
  `["Django Reinhardt", "Reinhardt", "Jean Reinhardt"]` is correct and does
  **not** warn: `[0]` may repeat `title` when the entry exists for the sake of
  its aliases. `index-en.json` is therefore short, not empty.
- A missing file, a missing `id`, or an empty array falls back to `title`.
  None of these is an error — a language with no name index simply shows Latin
  names.

Aliases are the mechanism that makes multilingual search work **without**
transliteration, which is what CJK requires: 塞戈维亚 has no romanization path
back to "Segovia" that any generic algorithm will find.

---

## 11. Validation

Enforced by `npm run lint:content`.

**Errors** — the catalogue is inconsistent:

- duplicate `id`; duplicate slug; a row with no `id`, or with neither `md`
  nor `pdf`
- `md` (and `json`, when declared) missing for any declared `lang`
- a `pdf` row that also declares `json` — a document has no codex to put a
  dossier in (§9.1)
- a slug containing anything but word characters, dots, hyphens and round
  brackets (§4.2)
- `country` not a known ISO 3166-1 alpha-2 region (compared case-insensitively)
- `gender` outside `m` | `f` | `mixed`
- `born` / `died` / `dates` present in an `index.json` row — dates belong to
  the dossier (§4.3)
- an `index-<lang>.json` key with no matching `id`, or an empty name array
- any of `id`, `title`, `gender`, `type`, `country`, `bio`, `dataStatus` still
  present in a `*.bio.json` (they moved here in v2)

**Warnings** — probably a mistake:

- `index-<lang>[id][0]` ≠ `forename + " " + surname` in the same language's
  dossier. Two cases are legitimate and must **not** warn:
  - a **comma-list `forename`** — the roster convention, where the display
    name is a collective title (`Авторы проекта`) rather than a person's name;
  - a **shared dossier** — when two rows point at the same `json`, only one is
    the canonical entry; the others are alternate views whose display names
    distinguish them on purpose (`Агустин Барриос — вариант вёрстки`). Check
    the name only against a dossier the row owns outright.
- `dates`, `ranking` or `url` differing between editions of one entry
- a single-element entry whose only name equals `title` (dead weight — omit
  the whole `id`; an entry that also carries aliases is fine)
- a `hidden` row carrying `img` or `gender`
- a `pdf` value written with the `/pages` resource prefix, or with a `^`
  anchor — `pdf` is site-root-relative and takes neither (§4.1)
- an enum-like field (`type`, `gender`, `country`, `lang`) authored in anything
  other than lowercase — accepted, but not house style
- a non-Latin-script edition (`ru`, `zh`, `ja`, `ko`) whose dossier prose is
  pure ASCII, or a Latin-script edition holding Cyrillic — the signature of an
  edition that was copied rather than translated

---

## 12. Authoring recipes

### Add a biography

1. Append a row to `pages/index.json` with the next unused `id`, a Latin
   `title`, `type`, `gender`, lowercase ISO `country`, `lang`, and the
   `md` / `json` / `img` paths. No dates — those go in the dossier.
2. Create `pages/<lang>/<slug>.bio.md` and `pages/<lang>/<slug>.bio.json` for
   **each** code listed in `lang`, each fully authored in that language.
3. Add the localized name and its aliases to `pages/index-<lang>.json` for
   every language a reader might search in — including languages with no
   content edition (§7).
4. Put media under `pages/` (never inside a language directory).
5. `npm run lint:content`.

### Add a technical page

1. Append a row with `type: "hidden"`, an `id`, a Latin `title`, `lang`, and
   `md` pointing at `/<slug>.md`. No `json`, no `img`, no `gender`, no dates.
2. Create `pages/<lang>/<slug>.md` per declared language.
3. Add its display name to `index-<lang>.json` — hidden entries are not
   searchable, but the codex header still needs a name.

### Add a document (a PDF)

1. Put the file on the site under the archive path it will keep forever
   (`magazine/<year>/<file>.pdf`) — outside `pages/`, which is the content
   tree, not the media archive.
2. Append a row with the next unused `id`, a Latin `title`, a `type` that reads
   as a document (`magazine`, …), lowercase ISO `country`, the `lang` the
   document is *written* in, an `img` cover if there is one, and `pdf` set to
   the site-root-relative path. **No `md`, no `json`.**
3. Add its localized name to `index-<lang>.json` for every language a reader
   might search in — the grid card and the viewer's title bar both read it.
4. `npm run lint:content`.

### Add a language edition to an existing entry

1. Append the code to that row's `lang`.
2. Create the `pages/<newlang>/` article (+ dossier if it is a biography),
   fully translated.
3. Add the localized name to `index-<newlang>.json` if it differs from `title`.

### Add a searchable alias

Append it to the entry's array in `index-<lang>.json`, after `[0]`. No code
change, no rebuild — the file is content.

---

## 13. Version history

### 2.1 — documents (2026-08-30)

Added `pdf`: a row that declares it instead of `md` **is** a PDF and opens in
the document viewer rather than the codex (§9.1). `md` became conditionally
required, the slug may now come from a `pdf` basename, and the slug character
set gained round brackets so archive scan names survive intact. Nothing about
existing rows changed; a catalogue with no `pdf` anywhere behaves exactly as
it did under 2.0.

### Migration from v1 (historical)

Version 1 had no `id`, free-text English country names (`"Spain"`), and carried
`forename` / `surname` in both `index.json` and every dossier. v2 introduced
`id`, `gender`, lowercase ISO countries, optional `json` / `img`, the `hidden`
type, and the `index-<lang>.json` files; it removed `forename` / `surname`
from `index.json` and seven fields from `*.bio.json`.

Content and application ship together from the same repository, so **no
backward compatibility layer exists** — the loader validates and skips bad
rows, but it does not read the v1 shape.
