# 01 · Project Overview

## Concept

A **modern, visually impressive catalogue of people / character profiles** with
rich descriptions, characteristics, photos and media. It is fundamentally an
**encyclopaedia**, but presented with a **modern RPG-style game aesthetic** — each
profile is displayed as a fantasy-style **"codex" entry**.

The current, concrete content domain is **musicians**: guitarists, composers,
performers, conductors, luthiers, historians. The bulk of the material is
migrated from the legacy Russian site **`guitar-times.ru`** (see
[`06-search-index.md`](06-search-index.md)).

## An entry = 1 index row + N language editions

1. **Index row** — identity and classification in
   `pages/index.json`, plus the localized name and search aliases in
   `pages/index-<lang>.json`. See [`11-index-json.md`](11-index-json.md).
2. **Article** — long-form text + layout, authored in **BioMD Lite**
   (`pages/<lang>/*.bio.md`). See [`02-biomd-lite-format.md`](02-biomd-lite-format.md).
3. **Dossier** *(biographies only)* — names, places, dates, career,
   relationships, media & document references, in
   `pages/<lang>/*.bio.json`. See [`03-metadata-schema.md`](03-metadata-schema.md).
4. **Media & documents** — photos, music (`media.*`), transcripts, scans,
   references (`documents[]`, possibly `embedded`). Shared by all editions,
   never localized.

Article + dossier exist **once per language edition**, fully authored in that
language. Not every entry is a person: technical and continuation pages have an
article and no dossier.

## Presentation: the "codex" modal

A full-screen scrollable modal styled as an **antique historical manuscript with
subtle fantasy-RPG influences**, in **two modes** — see
[`04-biography-card-design.md`](04-biography-card-design.md).

**Biography mode** (the entry declares a dossier) — header + **4 tabs**:

| Tab | Content | Data source |
|-----|---------|-------------|
| **Biography** | Main long-form article | the edition's `*.bio.md` |
| **Gallery** | Portraits / images / visual material | `media.photos` (+ `media.music`) |
| **Documents** | Attached docs, sources, scans, references | `documents[]` (+ `url`) |
| **Lore** *(a.k.a. Attributes)* | Structured person metadata | `metadata` + `type`/`gender`/`country` from `index.json` |

**Page mode** (no dossier) — header + article, no tab bar.

## Data flow (mental model)

```
pages/index.json        ──▶  catalogue grid + search + routing
  {id, title, type, gender, country, lang, md, json?, img?}
        │  join on id
pages/index-<lang>.json ──▶  localized display name + search aliases
  { "3": ["Андрес Сеговия", "Сеговия", …] }
        │  md / json, resolved into pages/<lang>/
        ▼
pages/<lang>/*.bio.md   ──▶  Codex · Biography tab      ┐
pages/<lang>/*.bio.json ──▶  Codex · Gallery/Docs/Lore  ┘  (tabs only if json exists)

guitar-times.ru (legacy HTML)  ──convert──▶  *.bio.md
docs/search-list.json          ──▶  legacy discovery index (guitar-times.ru), not live
```

`pages/index.json` is what the app loads at boot and searches — see
[`11-index-json.md`](11-index-json.md). It is distinct from the legacy
`docs/search-list.json` and from the per-entry dossier schema.

**One fact, one file.** `index.json` holds only what is needed to list, route
and classify before anything else is fetched — dates stay in the dossier.

## Design goals of the formats

- Easy to **edit by hand** and easy for an **LLM to read & generate**.
- **Theme-independent** (no fonts/colors/layout baked into content).
- Deliberately **limited**, not universally configurable.
- Content stays understandable as **plain Markdown / JSON** even without the engine.

## Real example content (`pages/`)

`pages/` holds the first real (non-spec) content: multiple `.bio.md` articles
(`agustin-barrios`, `authors`, `jovan-jovicic` and others) and a `photos/` folder with multiple
real (non-placeholder) JPGs. It confirms most of the `docs/` specs in
practice, but also shows a few real-world exceptions (e.g. a multi-person
"roster" `.bio.md` file, links to not-yet-migrated legacy `.htm` pages, and a
second legacy domain, `abc-guitars.com`/`abcguitars.com`, distinct from
`guitar-times.ru`). Full notes in
[`08-pages-examples.md`](08-pages-examples.md).

## UI prototypes (`prototypes/`)

Two throwaway, LLM-generated React reference apps explore the "codex" UI:
`CodexLegends` (dark fantasy-game theme) and `Copendum` (already antique
parchment/light theme). Neither is production code — they're reference for
interaction/animation quality and layout. Full survey in
[`09-prototypes.md`](09-prototypes.md).

**The user has already decided** which pieces to build the real UI from —
see [`10-ui-component-decision.md`](10-ui-component-decision.md) before
writing any catalogue/search/detail UI code.

## Fully scanned

`docs/`, `pages/`, and `prototypes/` have all been scanned into this memory.
