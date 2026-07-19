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

## The 4 required tabs

Horizontal navigation bar near the top; **same** codex styling. Labels short,
elegant, uppercase/small-caps serif. Active tab clearly highlighted yet
consistent with the parchment theme. Container softly rounded, subtle border,
muted tones (light antique UI).

| Tab | Purpose | Source |
|-----|---------|--------|
| **Biography** | Main long-form biography text | `metadata.bio` (`.bio.md`) |
| **Gallery** | Images / portraits / visual material | `media.photos` (+ `media.music`) |
| **Documents** | Attached documents, sources, scans, references | `documents[]` |
| **Lore** *(or Attributes)* | Structured character/person metadata | `metadata` fields |

**Lore/Attributes tab:** dossier-like layout — clean rows, soft separators,
serif type; scholarly, not a generic web form. Sourced from `MetaData.json`.

## Hard "avoid" list

Modern UI styling · strong shadows · bright/neon colors · heavy textures ·
excessive decoration.
