# 02 · BioMD Lite Format

**Source of truth:** [`docs/Biography-Markup.md`](../docs/Biography-Markup.md).
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

### `image` — single image
```md
::: image
src: images/person.jpg
position: right      # left | right | center | full
size: medium         # small | medium | large | full
caption: Optional caption
:::
```
`src`, `position`, `size` are **required**; `caption` optional.
`left`/`right` wrap text (wide screens); on narrow screens floats become centered blocks.

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

### `columns` / `column` — up to 3 columns
```md
::: columns
::: column
Left content.
:::
::: column
Right content or an image.
:::
:::
```
On narrow screens, columns stack in **source order**.

## Quotations & tables

- Quotations use standard Markdown `>` blocks (with `— Author` line).
- Markdown tables **only for real tabular data** (works, recordings, dates,
  awards). Never for layout/margins/image placement.

## Engine rules (for renderer work)

1. Parse Markdown → 2. parse BioMD blocks → 3. validate required props →
4. resolve relative links/files → 5. render semantic HTML → 6. apply theme.

- **Source order = logical reading order**; visual position must not override it.
- Captions stay attached to images. Embedded docs always keep a link fallback.
- Everything readable **without JavaScript**.
- **Unknown block → render its inner text + warn; never delete content.**
- Raw HTML / CSS / JS are **not** part of BioMD Lite.

## Authoring checklist

- Prefer plain Markdown over custom blocks.
- One property per line; only documented values.
- Natural reading order; no layout-by-whitespace.
- Short, stable file names/paths.
- **Validate** after any manual or LLM edit (title present, balanced `:::`
  fences, no `<script>`/`<style>`, valid UTF-8).
