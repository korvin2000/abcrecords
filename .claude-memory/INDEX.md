# .claude-memory — Knowledge Index

Condensed, task-oriented knowledge distilled from the `docs/` directory so future
Claude Code sessions can work efficiently without re-reading every source file.

> **Provenance:** Built by scanning `docs/` (specs), `pages/` (worked
> examples), and `prototypes/` (throwaway UI reference apps), per instruction.
> **Source of truth = the files in `docs/`** for specs; `pages/` is real
> example content that may reveal exceptions to those specs (see file 08);
> `prototypes/` is reference-only UI exploration, not production code (see
> files 09–10). If a note here conflicts with a source file, trust the source
> file and fix the note.

## Files

| File | Read it when you… |
|------|-------------------|
| [`01-project-overview.md`](01-project-overview.md) | Need the big picture: what the product is, who the entries are, data flow. |
| [`02-biomd-lite-format.md`](02-biomd-lite-format.md) | Write or edit a `*.bio.md` biography article. |
| [`03-metadata-schema.md`](03-metadata-schema.md) | Create/edit a `MetaData.json` entry or parse metadata. |
| [`04-biography-card-design.md`](04-biography-card-design.md) | Build/style the codex modal or its tabs. |
| [`05-html-conversion-guide.md`](05-html-conversion-guide.md) | Migrate legacy HTML pages into BioMD Lite. |
| [`06-search-index.md`](06-search-index.md) | Work with `search-list.json` / search & discovery. |
| [`07-conventions.md`](07-conventions.md) | Need the authoring do/don't rules & glossary in one place. |
| [`08-pages-examples.md`](08-pages-examples.md) | Need real worked examples from `pages/`, or want to see where real content deviates from the `docs/` specs. |
| [`09-prototypes.md`](09-prototypes.md) | Need to know what's inside the two `prototypes/` reference apps (`CodexLegends`, `Copendum`). |
| [`10-ui-component-decision.md`](10-ui-component-decision.md) | **Building the real catalogue UI** — read this first: which prototype components were chosen and the dark→light re-theme plan. |
| [`11-index-json.md`](11-index-json.md) | Work with `pages/index.json` — the main-menu/search index, or wire the search page to per-entry `json`/`md`/`img` files. |
| [`12-app-architecture.md`](12-app-architecture.md) | Work on the **production app in `app/`** — data flow, BioMD parser, search/i18n/audio modules, and gotchas (scroll-lock ownership, Cyrillic fonts, country mapping). |

## 30-second orientation

- **Product:** RPG-codex-styled encyclopaedia of people/character profiles;
  current domain = musicians (mostly guitarists).
- **Per entry:** one BioMD Lite article (`*.bio.md`) + one `MetaData.json` +
  media + documents.
- **UI:** full-screen antique "codex" modal, 4 tabs —
  Biography / Gallery / Documents / Lore(Attributes).
- **Tab → data source:** Biography ⇐ `metadata.bio` file · Gallery ⇐
  `media.photos`/`media.music` · Documents ⇐ `documents[]` · Lore ⇐ `metadata` fields.
- **Legacy origin:** migrated from `guitar-times.ru`; index in `search-list.json`.
- **Search/menu index:** `pages/index.json` — the live catalogue list the
  main page searches by `title`, pointing at each entry's `json` (metadata),
  `md` (biography), and `img` (avatar). See
  [`11-index-json.md`](11-index-json.md) for its structure and a few real
  deviations from the `docs/MetaData.md` spec (free-text `country`, no `id`).
- **UI direction (decided):** detail/biography modal ← `Copendum`'s
  `CharacterDetail.tsx`; card + search bar + browse window ←
  `CodexLegends`'s `CharacterCard.tsx`/`SearchBar.tsx`/search screen, but
  **re-themed from dark to light**. Full rationale in
  [`10-ui-component-decision.md`](10-ui-component-decision.md).

## Maintenance

When a `docs/` spec changes, update the matching note here in the same change.
Keep notes condensed — link back to the `docs/` file for the authoritative,
full-length version.
