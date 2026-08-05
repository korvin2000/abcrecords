# 02 · BioMD Lite Format

**Source of truth:** [`docs/Biography-Markup.md`](../docs/Biography-Markup.md) (v1.5).
Working name `BioMD Lite`, file extension **`.bio.md`**. Stores **article content
and layout only** — metadata belongs in `MetaData.json`.

## Plain Markdown basics

- `#` = article title · `##`/`###` = section headings.
- Blank line = new paragraph. `**bold**`, `*italic*`.
- `==highlight==` = semantic highlight (theme picks the color).
- `---` = visual separator.
- `[text](url)` links; relative links to other entries end in `.bio.md`.
- **Never** encode layout with spaces, repeated line breaks, or invisible chars.

## Custom blocks — `::: name … :::`

Use blocks **only** for layout/embedded media; prefer plain Markdown otherwise.
Keep **one property per line**; use only documented property values.

### `lead` — emphasized intro paragraph
```md
::: lead

Intro sentence, may render larger / with a drop capital.

:::
```

### `align` — aligned group (1.3)
```md
::: align
position: center     # left | center | right  (required)

**Программа концерта** · Bach · Sor · Tárrega

:::
```
Visual alignment of a **bounded** group only; never reorders content. Starts a new
block (ends an earlier image wrap). Missing/unknown `position` → warning + default
alignment, content kept. Not for columns, indentation, or spacing.

### `image` — single image
```md
::: image
src: images/person.jpg
position: right      # left | right | center | full
size: medium         # small | medium | large | full
alt: Accessibility text
caption: Optional caption
link: bigger.jpg     # optional click target
frame: gold          # optional (1.3), see below
:::
```
`src`, `position`, `size` are **required**; `alt`, `caption`, `link`, `frame` optional.
`left`/`right` wrap text (wide screens); on narrow screens floats become centered blocks.
`alt` is the accessible name (renderer falls back to `caption`); `link` retargets the
click (image → viewer, `*.bio.md` → in-codex navigation, else a normal anchor).

**`frame:` (1.3)** — theme-named picture frame, **never a literal colour**:
`curl` (default) · `none` · `mat` · `black` · `white` · `red` · `gold`
(the four colour borders are broad, not hairlines).
Also valid on `::: images`, where it is the default for children that omit it
(a child value wins). Unknown value → warning + default frame. Note: the image
property `frame:` and the callout block `::: frame` are unrelated.

### `images` — a row of images
```md
::: images
columns: 3           # 2 | 3 | 4

::: image
src: images/a.jpg
caption: A
:::

::: image
src: images/b.jpg
caption: B
:::

:::
```
Stacks vertically on narrow screens.

### `document` — attached file (PDF/audio/scan/BioMD)
```md
::: document
src: documents/file.pdf
title: Display Title
mode: link           # link | embed  (embed MUST fall back to link)
:::
```

### `nav` — horizontal menu bar
```md
::: nav
title: Дискография       # optional visible label
active: 1995–2002        # optional: exact label of the current item

- [1995–2002](williams_cd1.bio.md)
- [Официальный сайт](https://example.org)
:::
```
Body is a bullet list with **one link per item** — except that the current item
MAY be plain text instead of a link (1.5); the renderer marks it current exactly
as `active` does. Rendered as one centered pill bar
(codex tab-strip look) of real links — the `active` item becomes a non-clickable
`aria-current="page"` item. Items should be page links: audio/image/tab targets stay
plain links (no player/viewer widgets inside a menu). A `*.bio.md` target must exist
in `index.json`, otherwise the click silently does nothing (`App.navigateByMdPath`).

### `columns` / `column` — a parallel grid
```md
::: columns
columns: 2          # optional (1.5): 2 | 3 | 4 explicit tracks
divider: true       # optional: meaningful vertical rule

::: column
Left content.
:::
::: column
Right content or an image.
:::
:::
```
Without `columns:` the grid has as many tracks as there are `::: column`
children (2–3) — the pre-1.5 rule. **With** `columns: N` a single block may hold
any number of cells: they flow in source order and wrap into a new row after
every N, so a whole record grid needs one block instead of one per row. On
narrow screens every cell stacks in **source order**, and a `divider` becomes a
horizontal separator.

### `frame` — bordered notice / callout (1.1, retokenized 1.4)
```md
::: frame
frame: black         # gold (default) | black | red | white
title: Объявление    # optional internal heading

**14 августа 2020 года** …

::: image
src: photo/b/breem.jpg
position: center
size: small
:::

:::
```
A frame must wrap the **complete** enclosed region — an image the source border
encloses with the announcement stays inside it. Body: Markdown, `align`, leaf
media. **No** nested `frame`, **no** `nav`. Renderer: `black` restrained
(in memoriam), `red` celebratory, `gold` ceremonial double rule, `white` a
raised ivory card. The block property `frame:` and the image property `frame:`
share tokens but not scope.

### `signature` — closing author/place/credit block
```md
::: signature

*Авторы проекта*\
*Виктор и Сергей Тавровские*

:::
```
Right-aligned (reading-end) and compact on wide screens, ordinary prose on
narrow ones. Not for arbitrary right-aligned text — that is `::: align`.

## Quotations, lists & tables

- Quotations use standard Markdown `>` blocks (with `— Author` line). A `>` block
  may also carry a deliberately subordinate commentary/source credit (1.5 §3.5).
- **Zero-padded ordered lists** (1.5): source markers `01.`, `02.` keep their
  width — the renderer detects the padding and switches the list to
  `decimal-leading-zero`. Never convert explicit source numbers to `1.`.
- Markdown tables **only for real tabular data** (works, recordings, dates,
  awards). Never for layout/margins/image placement. A `columns` record grid is
  not a table: use a table when the cells form a header/row matrix.

## Engine rules (for renderer work)

1. Parse Markdown → 2. parse BioMD blocks → 3. validate required props →
4. resolve relative links/files against the configurable resource base
   (default `/pages`, independent of the app deployment base) → 5. render
   semantic HTML → 6. apply theme.

**Resource targets (1.4, spec §15).** `photo/b/x.jpg` and `/photo/b/x.jpg`
both resolve against the base. Two forms reach *outside* it — `^/main/x.jpg`
(anchored at the resource root, base skipped) and `/../main/x.jpg` (climbs
out). `.`/`..` are collapsed by the app and clamped at the root, never left
to the browser. Prefer `^`: it is independent of how deep the base is.

- **Source order = logical reading order**; visual position must not override it.
- Captions stay attached to images. Embedded docs always keep a link fallback.
- Everything readable **without JavaScript**.
- **Unknown block → render its inner text + warn; never delete content.** The
  same applies to an undeclared property (kept as text / ignored, warned) and to
  a **misplaced** directive: `columns`/`nav` in `align`, `frame`/`nav` in
  `frame`, `columns` in `column` are unwrapped in place, never dropped.
- Raw HTML / CSS / JS are **not** part of BioMD Lite.

## Authoring checklist

- Prefer plain Markdown over custom blocks.
- One property per line; only documented values.
- Natural reading order; no layout-by-whitespace.
- Short, stable file names/paths.
- **Validate** after any manual or LLM edit (title present, balanced `:::`
  fences, no `<script>`/`<style>`, valid UTF-8).
