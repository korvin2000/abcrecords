# 04 · Biography Card / Codex Modal Design

**Source of truth:** [`docs/Biography_card_Design.md`](../docs/Biography_card_Design.md).

## Concept

Full-screen, scrollable **modal "codex"** for long musician/composer biographies,
styled as an **elegant antique historical manuscript with subtle fantasy-RPG
influences**. Feel: refined, archival, scholarly — **not** distressed or medieval.

## Visual language

- **Palette:** warm ivory / parchment background (fine paper grain, soft aging,
  restrained sepia), muted **gold**, deep **burgundy-red**, dark **brown**.
- **Frame:** thin **double border** (muted gold + dark brown) with small
  ornamental corner flourishes.
- **Typography:** serif throughout, generous line height, highly readable
  dark-brown body text.
- **Controls:** dark rectangular **"Close Codex"** button at the upper-left edge;
  custom narrow **vertical scrollbar** on the right (dark track, gold thumb),
  always visible when content exceeds the viewport.

## Content layout

- Spacious, centered, generous horizontal margins.
- Large **uppercase serif name/title** in deep burgundy, wide letter spacing.
- Smaller **italic subtitle** (profession, period, nationality, dates, context).
- Thin **gold horizontal dividers** with a small centered ornamental symbol.
- **Uppercase section headings** in burgundy, separated by subtle rules.
- Optional **red drop capitals** at the start of important paragraphs.
- Italic **quotations** with a narrow gold vertical accent line.
- Small image galleries / aligned photos with **thin gold borders**.
- A discreet ornamental **footer** marking the end of the entry.
- Overall: symmetrical, calm, scholarly, luxurious, historically inspired.

## Two codex modes

Not every catalogue page is a person. Which mode applies is **declared** by
whether the entry has a dossier (`json` in `index.json` — see
[`11-index-json.md`](11-index-json.md)), never inferred from a failed fetch.

Everything outside the content area is **identical** in both modes: parchment
panel, double border + corner flourishes, close button, prev/next page turns,
per-entry language menu, scrollbar, page-turn animation, ornamental footer.
Only the header and the presence of the tab bar differ.

| | Biography mode (`json` present) | Page mode (`json` absent) |
|---|---|---|
| `<h1>` | `forename` from the **edition being read** | display name (`index-<lang>` → `title`) |
| `<h2>` | `surname`, omitted when equal to `<h1>` | — none — |
| Subtitle | craft · country · life years | country alone; omitted when absent |
| Tabs | all 4 | none |

Governing rule, same as the Lore rows: **absent data → absent element, never an
empty one.** No blank craft, no separator with nothing around it, no em dash
standing in for missing dates.

**While the dossier loads** (biography mode has no names yet): show the display
name as a single title line, no `<h2>`, no subtitle, then let it resolve. No
header spinner — the entry is normally preloaded before the modal opens and the
body already has a skeleton.

## The 4 tabs (biography mode only)

Horizontal navigation bar near the top; **same** codex styling. Labels short,
elegant, uppercase/small-caps serif. Active tab clearly highlighted yet
consistent with the parchment theme. Container softly rounded, subtle border,
muted tones (light antique UI).

| Tab | Purpose | Source |
|-----|---------|--------|
| **Biography** | Main long-form biography text | the edition's `.bio.md` |
| **Gallery** | Images / portraits / visual material | `media.photos` (+ `media.music`) |
| **Documents** | Attached documents, sources, scans, references | `documents[]` (+ `url` as the source row) |
| **Lore** *(or Attributes)* | Structured person metadata | `metadata` fields + `type`/`gender`/`country` from `index.json` |

**Lore/Attributes tab:** dossier-like layout — clean rows, soft separators,
serif type; scholarly, not a generic web form.

## Hard "avoid" list

Modern UI styling · strong shadows · bright/neon colors · heavy textures ·
excessive decoration.
