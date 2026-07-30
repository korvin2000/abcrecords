Design Description

A full-screen scrollable modal codex for long musician and composer biographies, styled as an elegant antique historical manuscript with subtle fantasy-RPG influences.

Use a warm ivory/parchment background with fine paper grain, soft aging, and restrained sepia shading. Surround the modal with a thin double border in muted gold and dark brown, including small ornamental corner flourishes. The page should feel refined and archival rather than distressed or medieval.

Place a dark rectangular "✕ Close Codex" button at the upper-left edge. Add a custom narrow vertical scrollbar on the right, using a dark track and gold thumb, always visible when the biography exceeds the viewport.

The content area should be spacious and centered, with generous horizontal margins. Use:

A large uppercase serif name/title in deep burgundy-red, with wide letter spacing.
A smaller italic subtitle for profession, period, nationality, dates, or other brief biographical context.
Thin gold horizontal dividers with a small centered ornamental symbol.
Uppercase section headings in burgundy, separated by subtle rules.
Highly readable dark-brown serif body text with generous line height.
Optional red drop capitals at the beginning of important paragraphs.
Italic quotations with a narrow gold vertical accent line.
Small image galleries or aligned photographs with thin gold borders.
A discreet ornamental footer marking the end of the entry.

The overall appearance should be symmetrical, calm, scholarly, luxurious, and historically inspired, with muted ivory, gold, burgundy, and dark-brown colors. Avoid modern UI styling, strong shadows, bright colors, heavy textures, or excessive decoration.

Required Tabs

Each **biography** card / modal must contain 4 tabs at the top in the same stylish style (see "Codex Modes" below — pages have none):

Biography — main long-form biography text
Gallery — images / portraits / related visual material
Documents — attached documents, sources, scans, references
Lore — structured character/person metadata
Tab Styling
Tabs should appear as a horizontal navigation bar near the top of the modal.
Visual style: light antique UI, softly rounded container, subtle border, muted tones.
Active tab should be clearly highlighted but remain stylistically consistent with the parchment / codex theme.
Labels should be short, elegant, uppercase or small-caps serif.
Lore / Attributes Tab

The Lore tab (or Attributes, if that label is preferred internally) should display structured metadata for the biography, sourced from MetaData.json and MetaData.md.

It should present metadata in a clean dossier-like layout, for example:

The Lore/Attributes section should look more like a scholarly dossier than a generic web form: clean rows, soft separators, serif typography, and the same antique visual language as the rest of the modal.

Avoid bright modern colors, strong shadows, neon accents.

---

## Codex Modes

Not every page in the catalogue is a person. The encyclopaedia also holds
technical and auxiliary pages — *about*, *sources*, *links*, *news*,
discography continuations — which have an article but no dossier. The codex
therefore has **two modes**, chosen by whether the entry declares a metadata
file (`json` in `index.json`; see [`Catalog-Index.md`](Catalog-Index.md) §9).

Everything outside the content area is **identical in both modes**: the
parchment panel, the double border and corner flourishes, the close button, the
prev/next page turns, the per-entry language menu, the scrollbar, the
page-turn animation and the ornamental footer. Only the header and the presence
of the tab bar differ.

### Biography mode — entry declares a dossier

```
        ❖ ENTRY IN THE CODEX ❖
              FORENAME
              SURNAME
     Guitarist · Spain · 1893 — 1987
            ──── ❦ ────
   [ BIOGRAPHY | GALLERY | DOCUMENTS | LORE ]
```

- **Title** — the given name, large uppercase serif in deep burgundy.
- **Second line** — the family name, slightly smaller, omitted when it equals
  the first.
- Both come from the dossier of the **edition currently being read**, so they
  are already in that language and change when the reader switches the codex
  language.
- **Subtitle** — craft · country · life years, italic, muted.
- The four tabs follow.

### Page mode — entry declares no dossier

```
        ❖ ENTRY IN THE CODEX ❖
           ABOUT THE PROJECT
                Ukraine
            ──── ❦ ────
```

- **Title** — the entry's display name for the reader's language
  (`index-<lang>.json`, falling back to the Latin `title`).
- **No second line.** There is no forename/surname to split.
- **Subtitle** — the country alone, and omitted entirely when the entry has
  none. It must never show empty separators, a blank craft, or an em dash
  standing in for absent dates.
- **No tab bar.** Three of the four tabs would have nothing to show, and an
  empty Lore dossier is worse than no dossier.

The governing rule for both: **absent data produces an absent element, never an
empty one.** This is the same principle the Lore tab already follows for its
rows.

### While the dossier is loading

Biography mode has no names until the dossier arrives. Show the display name as
a single title line, with no second line and no subtitle, and let it resolve.
Do not show a spinner in the header — the entry is normally preloaded before
the modal opens, and the body already carries a skeleton.