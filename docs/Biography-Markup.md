# Simple Music Biography Markup

**Working name:** `BioMD Lite`  
**File extension:** `.bio.md`

BioMD Lite is a small Markdown extension for biographies of guitarists, composers, performers, and other musicians. It stores only article content and layout. Metadata belongs in a separate file.

The format is intended to be:

- easy to edit manually;
- easy for an LLM to read and generate;
- independent of fonts, colors, and themes;
- sufficient for typical encyclopedia articles;
- deliberately limited rather than universally configurable.

---

## 1. Basic Text

Use ordinary Markdown.

```md
# Laurindo Almeida

## Biography

Laurindo Almeida was a Brazilian guitarist and composer.

A blank line starts a new paragraph.

**Bold text**

*Italic text*

==Highlighted text==

[External link](https://example.org)

[Related biography](../people/other-musician.bio.md)
```

### Rules

- `#` is the article title.
- `##` and `###` are section headings.
- A blank line separates paragraphs.
- `**text**` means strong emphasis.
- `*text*` means italic text, such as a composition or book title.
- `==text==` means semantic highlighting. The theme chooses its color.
- `---` creates a visual separator.
- Do not use spaces or repeated line breaks to position content.

---

## 2. Lead Paragraph

Use a lead block for an introductory paragraph that should be visually emphasized.

```md
::: lead

Laurindo Almeida connected classical guitar, Brazilian music,
and jazz throughout a long international career.

:::
```

The engine may render it with larger text or a drop capital. The exact style belongs to the theme.

---

## 3. Quotations

Use standard Markdown quotation syntax.

```md
> Music preserves not only sound, but also the time in which it was created.
>
> — Boris Belsky
```

The engine renders it as a visually separated quotation block.

---

## 4. Single Image

```md
::: image
src: images/laurindo-almeida.jpg
position: right
size: medium
caption: Laurindo Almeida with a classical guitar
:::
```

### Supported positions

- `left` — image on the left; text wraps around it;
- `right` — image on the right; text wraps around it;
- `center` — centered image without text wrapping;
- `full` — image uses the available article width.

### Supported sizes

- `small`
- `medium`
- `large`
- `full`

`caption` is optional. `src`, `position`, and `size` are required.

---

## 5. Several Images in One Row

```md
::: images
columns: 3

::: image
src: images/library-1.jpg
caption: Main library
:::

::: image
src: images/library-2.jpg
caption: Reading room
:::

::: image
src: images/library-3.jpg
caption: Archive
:::

:::
```

`columns` may be `2`, `3`, or `4`.

On narrow screens, the engine places the images below one another.

---

## 6. Links and Documents

Use normal Markdown links for websites and related articles.

```md
[Official website](https://example.org)

[Biography of another guitarist](../people/other-guitarist.bio.md)
```

Use a document block for a PDF, audio file, scanned article, or another BioMD document.

```md
::: document
src: documents/autobiography.pdf
title: Autobiographical Essay
mode: link
:::
```

Supported modes:

- `link` — show a normal document link or card;
- `embed` — display the document inside the article when supported.

If embedding is unavailable, the engine must fall back to a link.

---

## 7. Simple Columns

Use columns only when ordinary paragraphs and image positioning are insufficient.

```md
::: columns

::: column

Text for the left column.

:::

::: column

Text or an image for the right column.

:::

:::
```

Use no more than three columns. On narrow screens, columns are displayed in source order from top to bottom.

---

## 8. Tables

Use ordinary Markdown tables only for real tabular data such as works, recordings, dates, or awards.

```md
| Year | Work | Type |
|---|---|---|
| 1954 | Guitar Concerto | Composition |
| 1958 | Selected Recordings | Album |
```

Do not use tables to create margins, image placement, or general page layout.

---

## 9. Complete Example

```md
# Laurindo Almeida

::: lead

Laurindo Almeida was a Brazilian guitarist, composer, and arranger.

:::

::: image
src: images/laurindo-almeida.jpg
position: right
size: medium
caption: Laurindo Almeida
:::

## Biography

Laurindo Almeida was born in Santos, Brazil, in 1917. He grew up
in a large musical family and began studying music at an early age.

At the age of fifteen, he became active in local musical life.
His later career combined classical guitar, Brazilian traditions,
film music, and jazz.

> The guitar was not a boundary between musical traditions,
> but a bridge between them.

## Selected Albums

::: images
columns: 2

::: image
src: images/album-1.jpg
caption: Classical Guitar Collection
:::

::: image
src: images/album-2.jpg
caption: The Guitar Artistry of Laurindo Almeida
:::

:::

## Documents

::: document
src: documents/almeida-discography.pdf
title: Selected Discography
mode: link
:::

[Related article: Brazilian classical guitar](../articles/brazilian-guitar.bio.md)
```

---

# HTML Migration Rules

## 10. Content to Preserve

Preserve:

- article title and section headings;
- paragraphs and their original order;
- bold and italic text;
- quotations;
- meaningful images and captions;
- links;
- downloadable and embedded documents;
- real data tables.

Remove:

- menus, counters, advertisements, headers, and footers;
- JavaScript and inline event handlers;
- decorative spacer images;
- empty elements;
- font declarations, colors, backgrounds, and exact pixel spacing.

---

## 11. HTML Conversion

| HTML content | BioMD Lite |
|---|---|
| `<h1>`–`<h3>` | `#`, `##`, `###` |
| `<p>` | paragraph separated by a blank line |
| `<strong>`, `<b>` | `**text**` |
| `<em>`, `<i>` | `*text*` |
| `<blockquote>` | `>` quotation |
| `<a>` | Markdown link |
| single `<img>` | `image` block |
| adjacent images | `images` block |
| PDF or file link | `document` block |
| real data table | Markdown table |
| layout table | normal flow, image placement, or `columns` |
| repeated `<br>` | paragraph boundary |
| inline color | `==highlighted text==` only when semantically important |

### Image alignment conversion

- `align="left"` or CSS `float:left` → `position: left`
- `align="right"` or CSS `float:right` → `position: right`
- centered image → `position: center`
- full-width image → `position: full`

Do not preserve exact margins or coordinates.

---

# Engine Interpretation

## 12. Parsing Order

1. Parse ordinary Markdown.
2. Parse BioMD blocks: `lead`, `image`, `images`, `document`, `columns`, and `column`.
3. Validate required properties.
4. Resolve relative links and files.
5. Render semantic HTML.
6. Apply the selected visual theme.

Relative image, media, document, and ordinary file-link targets resolve
against the application's configurable resource base (default: `/pages`),
not against the deployment path of the application itself. For example, when
the app is deployed at `/fable/`, `music/mp/track.mp3` still resolves to
`/pages/music/mp/track.mp3`. Absolute URLs and fragment links remain unchanged.

---

## 13. Rendering Rules

- Keep the source order as the logical reading order.
- Left and right images allow text wrapping on wide screens.
- On narrow screens, floating images become normal centered blocks.
- Image rows and columns stack vertically on narrow screens.
- Captions stay attached to their images.
- Embedded documents must always have a link fallback.
- Headings, paragraphs, links, quotations, and tables must remain readable without JavaScript.
- Unknown blocks must not delete their content; render the inner text and report a warning.
- Raw HTML, CSS, and JavaScript are not part of BioMD Lite.

---

## 14. Authoring Rules

- Prefer normal Markdown over a custom block.
- Use custom blocks only for layout or embedded media.
- Keep one property per line.
- Use only the documented property values.
- Write content in its natural reading order.
- Do not encode layout with spaces, empty lines, or invisible characters.
- Keep file names and paths short and stable.
- Validate the document after manual or LLM-based editing.
