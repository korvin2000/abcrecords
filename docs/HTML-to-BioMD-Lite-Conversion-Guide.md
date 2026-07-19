# HTML-to-BioMD Lite Conversion Guide

This document records the practical rules used to convert the legacy encyclopedia pages:

- `authors.htm`
- `barrios.htm`
- `jovicic.htm`

into simplified `BioMD Lite` documents.

The goal was not to reproduce the original HTML exactly, but to preserve the article content, reading order, relevant images, media links, and the intended encyclopedia-style layout.

---

## 1. Conversion Scope

Only article-related content was preserved:

- article title;
- biography text;
- meaningful headings;
- portraits and article illustrations;
- image captions;
- quotations;
- related article links;
- PDFs, audio, MIDI, tablature, scores, and archives;
- album and recording information;
- real content tables or structured lists.

The following was removed:

- JavaScript;
- CSS and inline styling;
- top and bottom menus;
- site headers and footers;
- advertisements;
- visitor counters;
- decorative backgrounds;
- spacer tables and empty cells;
- PHP fragments;
- copy-protection handlers;
- layout-only images;
- exact colors, fonts, margins, and pixel coordinates.

---

## 2. Main Article Detection

The legacy pages used nested HTML tables for the whole page layout.

The article was identified by:

1. locating the visible page title;
2. finding the central content cell below the title;
3. preserving the content inside the main biography block;
4. stopping before the bottom menu, counters, and footer scripts.

Repeated site-wide elements were excluded even when they were visually located close to the article.

---

## 3. Text Cleanup

The biography text was converted into ordinary Markdown paragraphs.

### Applied rules

- Repeated `<br>` elements became paragraph breaks.
- Empty paragraphs and `&nbsp;` indentation were removed.
- Words broken only for narrow HTML layout were joined where obvious.
- HTML entities were converted to normal characters.
- Excessive manual spacing was removed.
- Original text order was preserved.
- Meaningful italics and bold text were preserved.
- Typographical punctuation was normalized where useful.

Example:

```html
<p class="t">
First paragraph.<br><br>
Second paragraph.
</p>
```

became:

```md
First paragraph.

Second paragraph.
```

---

## 4. Headings

The visible page title became the main Markdown heading:

```md
# Агустин Барриос
```

Logical article subdivisions were converted into second-level headings:

```md
## Избранные записи
```

Additional small subdivisions used third-level headings:

```md
### Complete Historical Recordings (1913–1942)
```

Decorative site headings were not preserved.

---

## 5. Image Conversion

Meaningful `<img>` elements were converted into `BioMD Lite` image blocks.

Example:

```md
::: image
src: images/person.jpg
position: right
size: medium
caption: Person name
:::
```

### Position mapping

| Legacy HTML | BioMD Lite |
|---|---|
| `align="left"` or `float:left` | `position: left` |
| `align="right"` or `float:right` | `position: right` |
| centered image | `position: center` |
| wide article image | `position: center` or `full` |
| several adjacent images | `::: images` block |
| image beside descriptive text | `::: columns` block when appropriate |

### Size mapping

Exact pixel dimensions were not preserved.

They were converted approximately:

- small portrait or cover → `small`;
- normal portrait → `medium`;
- large standalone image → `large`;
- article-width image → `full`.

### Missing images

The uploaded HTML referenced local image files that were not included.

Such images were replaced with external placeholder images while preserving:

- the image role;
- approximate aspect ratio;
- position;
- caption;
- article structure.

These placeholders are temporary and should later be replaced with real local assets.

---

## 6. Multiple Images

Adjacent images belonging to one visual group were converted into an image row:

```md
::: images
columns: 2

::: image
src: images/photo-1.jpg
caption: First image
:::

::: image
src: images/photo-2.jpg
caption: Second image
:::

:::
```

The original reading order was preserved.

On narrow screens, the rendering engine should stack the images vertically.

---

## 7. Quotations

Quoted speech embedded inside long paragraphs was extracted into standard Markdown block quotes when it represented a meaningful quotation.

Example:

```md
> Quotation text.
>
> — Author, date
```

This was used for the Andres Segovia quotation in the Jovan Jovicic biography.

---

## 8. Layout Tables

Most HTML tables were layout containers rather than data tables.

They were not converted into Markdown tables automatically.

### Conversion rules

- text plus portrait → floating image followed by text;
- text plus album cover → `columns`;
- several image cells → `images`;
- article frame and side borders → removed;
- empty spacer cells → removed.

Example:

```html
<table>
  <tr>
    <td>Album description</td>
    <td><img src="cover.jpg"></td>
  </tr>
</table>
```

became:

```md
::: columns

::: column

Album description.

:::

::: column

::: image
src: images/cover.jpg
position: center
size: medium
caption: Album cover
:::

:::

:::
```

---

## 9. Real Tables

Markdown tables were used only when the content was genuinely tabular.

For example, Barrios media resources were represented as:

```md
| Work | Tablature | Audio / MIDI | Scores |
|---|---|---|---|
| La Catedral | [TAB](...) | [MIDI](...) | [Score](...) |
```

This replaced a complex legacy HTML table while preserving the functional links.

---

## 10. Links

### Preserved links

- external websites;
- related encyclopedia pages;
- PDF documents;
- tablature files;
- MIDI files;
- MP3 and WMA files;
- score images;
- ZIP archives.

### Conversion rules

HTML links became standard Markdown links:

```md
[Official website](http://example.org/)
```

Decorative linked icons were removed, but their target link was preserved as readable text.

Relative paths were retained when they represented actual article resources.

---

## 11. Media and Documents

Media files were not embedded as custom players during conversion.

They were preserved as normal Markdown links or organized in tables.

Examples:

```md
[MP3](music/example.mp3)
```

```md
[PDF document](documents/article.pdf)
```

A future engine may convert these links into richer media or document components.

---

## 12. Album and Recording Sections

Album descriptions and track listings were preserved because they are part of the encyclopedia article.

Depending on structure, they were converted into:

- `columns` with cover image and descriptive text;
- numbered lists for tracks;
- headings for album titles;
- Markdown tables for media resources.

Exact original visual spacing was intentionally discarded.

---

## 13. Footnotes and Editorial Notes

Simple footnotes were preserved in readable Markdown form.

Example:

```md
---

¹ Другая транскрипция фамилии — Баррьос.
```

Editorial remarks that were part of the article text were retained as normal paragraphs.

Site-wide legal notices and usage warnings were removed.

---

## 14. Source Order

The final document preserves logical reading order.

This is important because layout may change between desktop and mobile.

The order is generally:

1. title;
2. opening portrait or image;
3. biography paragraphs;
4. quotations;
5. standalone images;
6. recordings or album sections;
7. documents and media links;
8. related article links.

Visual positioning must not override this logical order.

---

## 15. Simplification Principles

The conversion deliberately avoided:

- metadata blocks;
- CSS classes;
- inline styles;
- arbitrary HTML;
- exact pixel widths;
- color definitions;
- font definitions;
- deeply nested directives;
- universal layout abstractions;
- framework-specific syntax.

The documents contain only:

- Markdown text;
- headings;
- paragraphs;
- emphasis;
- quotations;
- links;
- simple tables;
- `image`;
- `images`;
- `columns`;
- `column`.

---

## 16. Validation Performed

Each generated file was checked for:

- a main title;
- valid UTF-8 output;
- absence of `<script>`;
- absence of `<style>`;
- absence of raw HTML tables;
- balanced `:::` directive fences;
- preserved article links;
- preserved article-related media references.

This was a structural validation, not a full semantic or link-availability check.

---

## 17. Recommended Manual Review

After automatic conversion, a human editor should verify:

- spelling and historical transcription;
- incorrectly hyphenated words inherited from the source;
- paragraph boundaries;
- image captions;
- image replacements;
- broken relative links;
- obsolete external links;
- correct album and track titles;
- duplicate or missing media entries;
- whether some long media tables should be shortened.

---

## 18. Recommended Migration Algorithm

```text
1. Parse HTML as a DOM.
2. Remove scripts, styles, menus, counters, ads, and footer blocks.
3. Identify the central article container.
4. Extract the visible article title.
5. Traverse article nodes in source order.
6. Convert text blocks into Markdown paragraphs.
7. Convert meaningful images into image directives.
8. Group adjacent images into images blocks.
9. Convert layout tables into normal flow or columns.
10. Convert real data tables into Markdown tables.
11. Preserve useful links and media targets.
12. Replace missing assets with marked placeholders.
13. Normalize whitespace and character encoding.
14. Write UTF-8 `.bio.md`.
15. Run structural validation.
16. Perform human editorial review.
```

---

## 19. Final Rule

Preserve the meaning and article structure, not the original HTML implementation.

The converted document should remain understandable as plain Markdown, even without the rendering engine.
