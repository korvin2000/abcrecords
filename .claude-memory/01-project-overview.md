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

## An entry = 4 parts

1. **Biography article** — long-form text + layout, authored in **BioMD Lite**
   (`*.bio.md`). See [`02-biomd-lite-format.md`](02-biomd-lite-format.md).
2. **Metadata** — identity, dates, career, relationships, media & document
   references, in a per-entry **`MetaData.json`**. See
   [`03-metadata-schema.md`](03-metadata-schema.md).
3. **Media** — photos and music/audio (`media.photos`, `media.music`).
4. **Documents** — transcripts, dossiers, scans, references (`documents[]`),
   possibly `embedded`.

## Presentation: the "codex" modal

A full-screen scrollable modal styled as an **antique historical manuscript with
subtle fantasy-RPG influences**. It has **4 tabs**:

| Tab | Content | Data source |
|-----|---------|-------------|
| **Biography** | Main long-form article | Markdown file at `metadata.bio` |
| **Gallery** | Portraits / images / visual material | `media.photos` (+ `media.music`) |
| **Documents** | Attached docs, sources, scans, references | `documents[]` |
| **Lore** *(a.k.a. Attributes)* | Structured character/person metadata | fields inside `metadata` |

Full styling brief in [`04-biography-card-design.md`](04-biography-card-design.md).

## Data flow (mental model)

```
guitar-times.ru (legacy HTML)  ──convert──▶  *.bio.md (BioMD Lite)  ─┐
                                                                     ├─▶  Codex modal
                              MetaData.json (identity + media + docs) ┘        (4 tabs)

pages/index.json  ──▶  main-menu / search index (live)  ──▶  links to each entry's
                        {title, type, forename, surname, country, img}          json / md / img
search-list.json  ──▶  search / discovery index (legacy, guitar-times.ru)
```

`pages/index.json` is the entry point the real app actually searches today —
see [`11-index-json.md`](11-index-json.md). It is distinct from the legacy
`search-list.json` and from the full per-entry `MetaData.json` schema.

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
