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
| [`11-index-json.md`](11-index-json.md) | **Work with `pages/index.json` or `pages/index-<lang>.json`** — the catalogue index: ids, classification, localized names/aliases, slugs & routing, hidden entries, field ownership & case rules. Spec: [`docs/Catalog-Index.md`](../docs/Catalog-Index.md). |
| [`12-app-architecture.md`](12-app-architecture.md) | Work on the **production app in `app/`** — data flow, BioMD parser, search/i18n/audio modules, and gotchas (scroll-lock ownership, Cyrillic fonts, country mapping). |
| [`13-app-code-map.md`](13-app-code-map.md) | Need to **navigate `app/` fast** — file-by-file map by layer, control/data-flow walkthroughs, and a component-relationship diagram. |
| [`14-app-patterns-and-gotchas.md`](14-app-patterns-and-gotchas.md) | **About to change `app/` code** — the recurring patterns, the landmines to avoid (CSS layering, dates, two bases, audio, search, BioMD), and step-by-step task recipes. |
| [`15-app-critique.md`](15-app-critique.md) | Want the **honest state of `app/`** — strengths, a severity-tagged weakness/risk register, and a prioritized improvement backlog. |

## 30-second orientation

- **Product:** RPG-codex-styled encyclopaedia of people/character profiles;
  current domain = musicians (mostly guitarists).
- **Per entry:** one `index.json` row + one BioMD Lite article per language
  (`pages/<lang>/*.bio.md`), plus — for biographies — a dossier
  (`*.bio.json`), media and documents. **Each edition is fully authored in its
  own language**, names included.
- **UI:** full-screen antique "codex" modal in **two modes** — *biography*
  (header + 4 tabs: Biography / Gallery / Documents / Lore(Attributes)) and
  *page* (header + article, no tabs) for entries with no dossier.
- **Tab → data source:** Biography ⇐ the edition's `.bio.md` · Gallery ⇐
  `media.photos`/`media.music` · Documents ⇐ `documents[]` (+ `url`) · Lore ⇐
  `metadata` fields + `type`/`gender`/`country` from `index.json`.
- **Legacy origin:** migrated from `guitar-times.ru`; index in `docs/search-list.json`.
- **Catalogue index:** `pages/index.json` (identity, classification, search
  facets, paths) joined by `id` to `pages/index-<lang>.json` (localized names
  + search aliases). Route = `#/{slug}`, slug = `md` basename. Spec:
  [`docs/Catalog-Index.md`](../docs/Catalog-Index.md); notes:
  [`11-index-json.md`](11-index-json.md).
  ✅ **v2 spec, data and code have all landed** (Steps 1–6); only the
  guard-rails (Step 7: `lint:content` + Vitest) remain — see
  `docs/proposals/Plan_Catalog-v2-index-ids-localized-names-codex-split.md`.
- **UI direction (decided):** detail/biography modal ← `Copendum`'s
  `CharacterDetail.tsx`; card + search bar + browse window ←
  `CodexLegends`'s `CharacterCard.tsx`/`SearchBar.tsx`/search screen, but
  **re-themed from dark to light**. Full rationale in
  [`10-ui-component-decision.md`](10-ui-component-decision.md).
- **Working on the `app/` code?** Read the deep-dive triad:
  [`13`](13-app-code-map.md) (where everything lives + flow) →
  [`14`](14-app-patterns-and-gotchas.md) (patterns, landmines, task recipes) →
  [`15`](15-app-critique.md) (strengths, risks, backlog).
  [`12`](12-app-architecture.md) remains the high-level overview.

## Maintenance

When a `docs/` spec changes, update the matching note here in the same change.
Keep notes condensed — link back to the `docs/` file for the authoritative,
full-length version.
