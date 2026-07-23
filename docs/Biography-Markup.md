# Simple Music Biography Markup

**Working name:** `BioMD Lite`  
**File extension:** `.bio.md`  
**Version:** 1.1 (see the changelog at the end of this document)

BioMD Lite is a small Markdown extension for biographies of guitarists, composers, performers, and other musicians. It stores only article content and layout. Metadata belongs in a separate file.

Although biography is the primary use case, the same format also serves the adjacent encyclopedia pages that surround the biographies — project/about pages, news feeds, and audio/score catalog indexes. Sections 1–14 define the core; the *Format Extensions* part (Sections 15–27) adds the small number of blocks and rules those adjacent pages need (navigation bars, frames, clickable images, and more).

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

### Optional properties (added in v1.1)

- `alt` — accessibility text for screen readers, kept separate from the visible `caption`. If omitted, the engine falls back to the `caption`.
- `link` — makes the image a clickable link to a larger image, a document, or another page. See *Clickable Images*, Section 17.

```md
::: image
src: images/notice-thumb.jpg
position: center
size: large
link: articles/about_us/notice-full.jpg
alt: Newspaper notice about the project
caption: One of the first reviews of the project
:::
```

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
2. Parse BioMD blocks: `lead`, `image`, `images`, `document`, `columns`, `column`, and the v1.1 blocks `nav` and `frame`.
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

---

# Format Extensions (v1.1)

These blocks and rules were added after converting the legacy encyclopedia pages. They cover layout and design elements the core (Sections 1–14) could not express: horizontal navigation/tab bars, framed callout boxes, clickable images, column dividers, and a set of authoring conventions for elements that recur in the source pages.

The design principle is unchanged: **prefer plain Markdown; reach for a block only when plain Markdown cannot express the layout or media.** These extensions add exactly two new fenced blocks (`nav`, `frame`) and a few optional properties — nothing more.

## 15. Navigation bar (`::: nav`)

Use a `nav` block for a compact, horizontal group of links to related pages, rendered as a row of tabs/pills. It replaces the vertical side menus and pagination strips of the legacy pages.

Typical sources:

- a discography side-menu (e.g. a "Дискография" column linking to per-period sub-pages);
- an alphabetical pagination strip (e.g. `[ А – Бартоли ] [ Бах – Г ] [ Д – Л ] …`);
- a short "continuation / next page" link.

```md
::: nav
title: Дискография
- [1995–2002](williams_cd1.bio.md)
- [1989–1994](williams_cd2.bio.md)
- [1979–1988](williams_cd3.bio.md)
- [1971–1979](williams_cd4.bio.md)
- [1958–1970](williams_cd5.bio.md)
:::
```

Properties:

- `title` — optional label shown before the bar (e.g. "Дискография", "Содержание").
- `active` — optional; the label of the current page. The matching entry renders as a highlighted, non-clickable tab. Use it for pagination strips where the current range is not a link.

```md
::: nav
title: Аудио-карта
active: А – Бартоли
- [А – Бартоли](karta.bio.md)
- [Бах – Г](karta2.bio.md)
- [Д – Л](karta3.bio.md)
- [М – О](karta4.bio.md)
- [П – Я](karta5.bio.md)
:::
```

Rules:

- The body is a plain Markdown list of links, one per line.
- On narrow screens the bar wraps to multiple rows or scrolls horizontally; it never forces a horizontal page scroll.
- Do not use `nav` for a single inline link inside running text — keep that as a normal Markdown link.
- Place a `nav` where it belongs in reading order: a side discography menu usually moves to just below the biography or into its own section; a continuation link stays at the end.

---

## 16. Frame / callout (`::: frame`)

Use a `frame` block for content the source visually enclosed in a border or box, and for asides that must stand apart from the running text.

Typical sources:

- memorial / obituary notices (a black-bordered box: date, name, portrait);
- editorial info notes (a bordered, tinted box);
- highlighted announcements.

```md
::: frame
variant: memorial

**14 августа 2020 года** в возрасте 87 лет скончался выдающийся британский гитарист и лютнист

**Джулиан Брим**

::: image
src: images/bream.jpg
position: center
size: medium
:::

:::
```

Properties:

- `variant` — optional visual role; one of:
  - `note` (default) — neutral info / aside box;
  - `memorial` — obituary / in-memoriam notice;
  - `highlight` — emphasized announcement.
- `title` — optional heading rendered inside the frame.

Rules:

- The body is ordinary BioMD content: paragraphs, emphasis, images, lists, links.
- A frame is semantic (an enclosed aside), not a tool for drawing arbitrary rectangles. Do not use it to recreate the legacy page border, spacer cells, or column backgrounds.
- Frames may be nested at most one level deep.
- The exact border, background, and color belong to the theme.

---

## 17. Clickable images (`link`)

Legacy pages often wrapped an image in a link — a thumbnail that opens a full-size scan, or a cover that links to a review page. Represent this with the `link` property on an `image` block (Section 4), not with a separate duplicate link.

```md
::: image
src: images/review-thumb.jpg
position: center
size: medium
link: articles/review-full.jpg
caption: Press review, 2002
:::
```

- `link` may target a local file, another `.bio.md`, or an external URL.
- If a visible "read more" affordance is also wanted, a normal Markdown link beneath the image is acceptable; prefer `link` when the image itself was the click target.

---

## 18. Column dividers

`::: columns` may carry an optional `divider` property to request a visible vertical rule between columns. The default is no divider.

```md
::: columns
divider: true

::: column
Left column text.
:::

::: column
Right column text.
:::

:::
```

On narrow screens columns stack vertically and the vertical divider is dropped (or shown as a horizontal rule); this is a theme decision.

---

## 19. Subtitles

When the source title has a secondary line (a subtitle or descriptive parenthetical under the main heading), keep the main line as the `#` title and put the subtitle on the next line as an italic paragraph (or as a `::: lead`).

```md
# Аудио-карта

*Сводный каталог аудио, нот и табулатур*
```

There is exactly one article title — do not create a second `#`.

---

## 20. Lists (bullet, numbered, works lists)

- Real HTML lists (`<ul>`, `<ol>`, `<ul type="square">`) and "fake" lists built from `•` / `&#8226;` + `<br>` both become ordinary Markdown lists.
- Track listings become numbered lists (`1.`, `2.`, …) when the source numbered them or the order is meaningful; otherwise a bullet list.
- A short works / compositions enumeration that the source ran as inline text separated by semicolons may stay a single paragraph; convert it to a list only when the source presented it as a list.

---

## 21. Drop caps and decorative first letters

Some pages render the first letter of each paragraph as a small decorative image (e.g. `main/c1.gif` followed by the text `ловарь`, meaning "**С**ловарь").

- Reconstruct the whole word and write it as plain text — decode the letter from the image (filename / `alt`) or infer it from the truncated word.
- Do not keep the image or mark up the drop cap. A theme may add a drop capital through the `::: lead` block; it is never encoded per paragraph.

---

## 22. Typographic emphasis (small caps, colors)

- `font-variant: small-caps`, colored `<font>`, and letter-spacing are presentation. Drop the styling and keep the plain text.
- Use `==highlight==` only when the emphasis is semantically important (e.g. a warning word the author clearly meant to stress) — not for every colored span.
- Purple / `#800080` names, gray / `#575757` links, and Times-New-Roman work titles are pure styling: keep the text, drop the color.

---

## 23. Signature and closing blocks

Right-aligned italic author signatures, place lines, and hosting / credit notes become normal paragraphs — usually italic, placed after a `---` separator at the end of the article.

```md
---

*Авторы проекта «Гитаристы и композиторы»*  
*Виктор и Сергей Тавровские*  
*Кишинёв — Киев — Харьков*
```

---

## 24. Footnotes

Bidirectional HTML footnote anchors (`<sup><a name="1" href="#2">1</a></sup>` … `<a name="2" href="#1">`) become:

- a superscript marker at the reference point — a Unicode superscript (`¹`, `²`, …) attached to the word;
- the note text at the end of the article, below a `---` separator, prefixed with the same marker.

```md
**Барриос¹ (Мангори) Агустин** …

---

¹ Другая транскрипция фамилии — Баррьос.
```

---

## 25. Multi-page articles and series

Legacy articles are frequently split across pages (`williams1` → `williams2`; `barrios` → `barrios1`; a separate `dyens2` discography page) and cross-linked to related articles.

- Convert each source page to its own `.bio.md`, keeping the file-name stem.
- Represent a group of sub-pages or a "continuation / next page" link with a `::: nav` block (Section 15); a lone continuation may be a plain Markdown link.
- Convert cross-links to other articles (`manhattan.htm`, `ponce_alb.htm`) to Markdown links, pointing at the converted `.bio.md` when it exists, otherwise the original target.

---

## 26. News datelines

For dated news entries: lead each entry with the bold date, keep newest-first order, and separate entries with `---`. Wrap obituary entries in `::: frame variant: memorial` (Section 16).

```md
**23 ноября 2022.** Опубликованы новые номера журнала…

---
```

---

## 27. Migration additions (v1.1)

These rows extend the conversion table in Section 11.

| HTML content | BioMD Lite |
|---|---|
| vertical side menu of page links | `::: nav` |
| alphabetical pagination strip | `::: nav` with `active` |
| "continuation / next page" link | `::: nav` or plain link |
| bordered / boxed notice, obituary | `::: frame` (+ `variant`) |
| `<a><img></a>` (linked image) | `image` block with `link` |
| decorative first-letter image + text | plain text (reconstruct the word) |
| `font-variant: small-caps`, colored `<font>` | plain text (drop the styling) |
| right-aligned italic signature | italic paragraph after `---` |
| `<sup>` + anchor footnotes | superscript marker + note after `---` |
| `<ul>`, `<ul type="square">`, `•` + `<br>` | Markdown list |
| side column repurposed to hold a badge / menu | move it into flow (`image` or `nav`) |

---

# Changelog

## v1.1

- Added `::: nav` (horizontal navigation / tab bar).
- Added `::: frame` (framed callout, with `note` / `memorial` / `highlight` variants).
- Added `link` and `alt` properties to `::: image`.
- Added `divider` property to `::: columns`.
- Documented conventions for subtitles, lists, drop caps, typographic emphasis, signatures, footnotes, multi-page series, and news datelines.
- Clarified that the format also covers adjacent encyclopedia pages (about, news, catalog).

## v1.0

- Initial BioMD Lite specification (Sections 1–14).
