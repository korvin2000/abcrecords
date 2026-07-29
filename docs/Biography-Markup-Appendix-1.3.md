# BioMD Lite — Appendix A: the 1.3 extensions

**Companion to:** [`Biography-Markup.md`](Biography-Markup.md) (normative specification, v1.3)
**Covers:** `::: align` · the image `frame:` property · `::: nav` · the repaired `alt:` / `link:` image properties
**Status:** implemented in the production renderer (`app/src/lib/biomd/`)
**Audience:** anyone — human or LLM — authoring or converting `*.bio.md` content

This appendix is the practical guide to everything that changed in BioMD Lite 1.3.
The normative rules live in `Biography-Markup.md` (sections 6.1, 6.5, 10, 13); this
document explains **what each feature does, how to use it correctly, what the
renderer actually produces, and what happens when you get it wrong** — with
examples of both good and bad usage.

Nothing here is required. Every 1.3 feature is either a **new directive** or an
**optional property**: a document written for 1.2 remains valid, renders
identically, and needs no migration.

---

## Contents

1. [At a glance](#1-at-a-glance)
2. [`::: align` — aligned groups](#2--align--aligned-groups)
3. [`frame:` — picture frames](#3-frame--picture-frames)
4. [`::: nav` — horizontal menu bar](#4--nav--horizontal-menu-bar)
5. [`alt:` and `link:` — now honoured](#5-alt-and-link--now-honoured)
6. [Diagnostics reference](#6-diagnostics-reference)
7. [Interaction rules between directives](#7-interaction-rules-between-directives)
8. [Authoring checklist](#8-authoring-checklist)
9. [Compatibility notes](#9-compatibility-notes)
10. [Conformance fixture](#10-conformance-fixture)

---

## 1. At a glance

| Feature | Form | Required | Optional | Purpose |
|---|---|---|---|---|
| `::: align` | block directive | `position` | — | Align a bounded group left / centre / right |
| `frame:` | property of `::: image`, `::: images` | — | one of 7 tokens | Choose the frame drawn around a picture |
| `::: nav` | block directive (existed in 1.2, now rendered) | a link list | `title`, `active` | A centred horizontal menu of page links |
| `alt:` | property of `::: image` | — | free text | The image's accessible name |
| `link:` | property of `::: image` | — | a target | Where clicking the image leads |

```md
::: align
position: center

**Программа концерта** · Bach · Sor · Tárrega

:::

::: image
src: photo/b/barrios.jpg
position: right
size: small
alt: Агустин Барриос с гитарой
caption: Агустин Барриос
frame: black
:::

::: nav
title: Дискография
active: 1995–2002

- [1995–2002](williams_cd1.bio.md)
- [1989–1994](williams_cd2.bio.md)
:::
```

---

## 2. `::: align` — aligned groups

### 2.1 What it does

Wraps a bounded group of content and aligns its **inline content** — paragraph
text, headings, list text, captions — to the left, centre, or right. Intrinsic-width
block children (a figure, a document card) are moved to that side as well.

It is a *coarse presentation hint* (specification section 1, priority 4): use it
when the source's alignment carries meaning, not to decorate.

### 2.2 Syntax

```md
::: align
position: center

Content in ordinary Markdown.

:::
```

| Property | Required | Values | Default |
|---|---|---|---|
| `position` | **yes** | `left`, `center`, `right` | none — omitting it is a diagnostic |

The body accepts ordinary Markdown and leaf media directives (`image`,
`images`, `document`).

### 2.3 What the renderer does

- emits one block wrapper (`<div class="bio-align bio-align-center">`);
- sets `text-align` on the group;
- **ends an earlier left/right image wrap** (`clear: both`) — the same rule that
  already applies to a following centred image, image group, columns block, nav,
  or frame (specification 6.2). A centred line is therefore centred on the
  article measure, not inside the narrow gap beside a floated portrait;
- moves intrinsic-width block children to the aligned side;
- never changes source, reading, copy, or keyboard-focus order.

### 2.4 Correct use

A dedication or a concert programme:

```md
::: align
position: center

**Программа концерта**

Bach · Sor · Tárrega

:::
```

An archival dateline or a place-and-date note:

```md
::: align
position: right

*Харьков, 12 мая 1998 года*

:::
```

Resetting alignment for one group inside an otherwise aligned context:

```md
::: align
position: left

**Примечание архива:** дата записи остаётся неустановленной.

:::
```

### 2.5 Incorrect use

| Don't | Why | Instead |
|---|---|---|
| Wrap a whole article, or long body prose | Centred/right-aligned long prose is measurably harder to read | Leave body text at the default alignment |
| Use it to indent, pad, or add spacing | Alignment is not spacing; the renderer owns rhythm | Ordinary paragraphs, `---`, or a heading |
| Place two `align` blocks side by side to fake columns | Not a layout mechanism; it stacks | `::: columns` with `::: column` children |
| Wrap a `::: nav` | A nav is centred by its own contract | Use `::: nav` on its own |
| Use it for a closing author/place/credit block | That has its own semantic directive | `::: signature` |
| Move a standalone image with it | The image owns its placement | `position:` on the `::: image` |

```md
<!-- WRONG: alignment used as layout -->
::: align
position: left

Левая колонка.

:::

::: align
position: right

Правая колонка.

:::
```

```md
<!-- RIGHT -->
::: columns

::: column

Левая колонка.

:::

::: column

Правая колонка.

:::

:::
```

### 2.6 Error handling

A missing or unknown `position` **never deletes content**: the body renders at the
document's default alignment and a warning is emitted (see section 6).

```md
::: align

Отобразится обычным образом + предупреждение в консоли.

:::
```

---

## 3. `frame:` — picture frames

### 3.1 What it does

Selects the frame treatment drawn around a picture. Without it, images keep the
theme's default photographic frame, so **adding `frame:` is the only way an image's
appearance changes**.

`frame` names an *intent*, not a colour value: exact thickness, shade, radius, mat
width, and hover behaviour remain theme decisions. Literal colours (`#8b2635`,
`rgb()`, CSS variables, class names, gradients, URLs) are **not accepted** — this
keeps every entry inside the codex palette and keeps content free of styling.

### 3.2 Syntax

```md
::: image
src: photo/b/barrios.jpg
position: center
size: large
alt: Агустин Барриос с гитарой
caption: Агустин Барриос
frame: black
:::
```

| Value | Appearance in this theme | Typical use |
|---|---|---|
| *(absent)* | the default — an ivory print with curled-corner shadows | ordinary article photographs |
| `curl` | the default, stated explicitly | overriding an inherited group frame |
| `none` | no frame, no shadow | logos, stamps, diagrams, scans already on white |
| `mat` | ivory mount (passe-partout) with a hairline | a small photograph that needs presence |
| `black` | broad dark-ink border | portraits and covers that need a firm edge against the parchment |
| `white` | broad ivory-white border | dark or busy pictures that need separating from the page |
| `red` | broad deep-red border | an emphasised or accented picture |
| `gold` | broad muted-gold border | ceremonial portraits, title images |

The four colour borders (`black`, `white`, `red`, `gold`) are deliberately
**substantial**, not hairlines: at a hairline width the frame reads as a stray
outline rather than as part of the picture.

Framed variants intentionally drop the default curled-corner shadows — a framed
picture reads as *hung*, not as a loose print. The gentle hover zoom is kept for
all variants: it is the affordance that the picture opens in the image viewer.

### 3.3 Group default and per-child override

On `::: images`, `frame:` becomes the default for every child that does not set its
own — a child value always wins. Property order inside the group does not matter.

```md
::: images
columns: 3
frame: mat

::: image
src: photo/archive/a.jpg
caption: Наследует mat
:::

::: image
src: photo/archive/b.jpg
caption: Своё значение
frame: red
:::

::: image
src: photo/archive/c.jpg
caption: Обычная рамка
frame: curl
:::

:::
```

### 3.4 Correct use

```md
<!-- A ceremonial portrait in the codex's double border -->
::: image
src: photo/s/segovia.jpg
position: right
size: medium
alt: Андрес Сеговия с гитарой Рамирес
caption: Андрес Сеговия
frame: gold
:::

<!-- An archival newspaper clipping -->
::: image
src: articles/1936/clipping.jpg
position: center
size: large
alt: Вырезка из мадридской газеты, 1936 год
caption: Мадрид, 1936
frame: black
:::

<!-- A logo that should not look like a photograph -->
::: image
src: photo/logo/gfa.png
position: center
size: small
alt: Эмблема Guitar Foundation of America
frame: none
:::
```

### 3.5 Incorrect use

| Don't | Why |
|---|---|
| `frame: #b8902a` / `frame: crimson` / `frame: 6px solid gold` | Only the seven tokens are valid; content must not carry styling |
| Give every image a different frame | The page becomes noisy; frames should mark a distinction that matters |
| Use `frame:` to signal importance instead of `==highlight==` or a heading | Frames are presentation, not semantics |
| Expect a frame on an ordinary Markdown image (`![alt](src)`) | There is no place for a property — convert it to `::: image` |

### 3.6 Error handling

An unknown token keeps the **default** frame (nothing is dropped) and warns:

```md
frame: neon        → warning, renders with the default frame
```

### 3.7 Not to be confused with `::: frame`

| | Meaning |
|---|---|
| `frame:` — a **property** inside `::: image` / `::: images` | draws a frame around a picture |
| `::: frame` — a **block directive** (specification 11) | encloses an article-specific notice, memorial, or highlighted announcement |

They are unrelated. A bordered *notice* is `::: frame`; a bordered *photograph* is
`::: image` with `frame:`.

---

## 4. `::: nav` — horizontal menu bar

`::: nav` has been part of the specification since 1.2; 1.3 is where the renderer
implements it. The syntax is unchanged — existing documents that already contain a
`nav` simply start rendering as a menu.

### 4.1 What it does

Presents a compact group of links as **one centred horizontal bar**, styled in the
same visual language as the codex tab strip: a paper pill row with a gold hairline
and a burgundy current item. Use it for page-level or section-level navigation that
belongs to the article.

### 4.2 Syntax

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

| Property | Required | Meaning |
|---|---|---|
| `title` | no | A small visible label above the bar |
| `active` | no | The **exact plain-text label** of the current item; it renders as current and is not clickable |

The body is a Markdown bullet list with **one link per item**. A blank line between
the properties and the list is recommended and is what the specification describes;
the parser also accepts the list immediately after the last property.

### 4.3 What the renderer does

- emits real navigation markup — `<nav>` → optional title → `<ul>` → `<li>` → `<a>`;
- centres the bar and its items; wraps onto more rows on narrow screens and never
  causes page-level horizontal scrolling;
- ends an earlier image wrap (`clear: both`);
- renders the `active` item as a non-clickable current item carrying
  `aria-current="page"`;
- keeps every link behaviour the article already has: a `*.bio.md` target turns the
  page inside the codex, an `http(s)` target opens in a new tab with
  `rel="noopener noreferrer"`, a fragment stays a fragment;
- keeps keyboard tab order natural and shows a visible focus ring;
- **does not** use tab/tablist roles: these items navigate to pages, they do not
  switch a panel in place.

### 4.4 Correct use

A page series (a discography split over several pages):

```md
::: nav
title: Дискография
active: 1995–2002

- [1995–2002](williams_cd1.bio.md)
- [1989–1994](williams_cd2.bio.md)
- [1979–1988](williams_cd3.bio.md)
:::
```

Related entries, placed directly below the title or lead when the menu applies to
the whole page; place it immediately before a section when it belongs to that
section only:

```md
::: nav
title: Смотрите также

- [Андрес Сеговия](andres-segovia.bio.md)
- [Пако де Лусия](paco-de-lucia.bio.md)
- [Официальный сайт проекта](https://www.abc-guitars.com)
:::
```

### 4.5 Incorrect use

| Don't | Why | Instead |
|---|---|---|
| Collect unrelated inline links in a nav | A nav means "navigation", not "links I have" | Ordinary Markdown links in prose |
| Put audio, MIDI, tablature, or image files in a nav | They are resources, not pages. They stay **plain links** in a menu — no player, no viewer | Markdown links, a resource table, or `::: document` |
| Use a nav for a single continuation link | Overkill | An ordinary Markdown link |
| Repeat the same label twice while using `active` | The current item becomes ambiguous | Make labels unique |
| Reproduce the site's global menu | Global chrome is not article content | Omit it |

### 4.6 Link targets that resolve

A `*.bio.md` item opens the target **only if that entry exists in
`pages/index.json`**. A file that is not in the catalogue produces an item that
looks clickable but does nothing.

So: point nav items at catalogue entries, fragments, or absolute URLs — and when you
migrate a multi-page series, add its pages to `index.json` at the same time.

### 4.7 Error handling

A `nav` with no link list is skipped with a warning (nothing else in the document is
affected). An unknown `active` label simply matches nothing: every item stays a
link.

---

## 5. `alt:` and `link:` — now honoured

Both properties are specified in 1.2 (sections 6.1 and 6.4), but the renderer used
to discard them. They now work as written. **Adding either is optional; existing
values start being used automatically.**

### 5.1 `alt:` — the accessible name

```md
::: image
src: photo/b/barrios.jpg
position: right
size: small
alt: Агустин Барриос с концертной гитарой в студии
caption: Агустин Барриос
:::
```

- `alt` describes the image for someone who cannot see it; `caption` is visible
  editorial context. They serve different purposes and are usually worded
  differently.
- Fallback chain: `alt` → `caption` → empty. An image with neither is announced as
  decorative.
- Never use a filename as alternative text, and do not invent a description you
  cannot verify from the source.

### 5.2 `link:` — where a click leads

```md
::: image
src: photo/t/tavrovsky_rg2002_thumb.jpg
position: center
size: large
link: articles/about_us/rg_2002.jpg
alt: Заметка о проекте в альманахе «Ренессанс гитары — 2002»
caption: Один из первых печатных отзывов о проекте
:::
```

| `link:` value | Click behaviour |
|---|---|
| *(absent)* | opens `src` in the image viewer — the default |
| an image (`.jpg`, `.png`, …) | opens **that** image in the viewer (thumbnail → full resolution) |
| a `*.bio.md` file | turns to that catalogue entry inside the codex |
| anything else (article page, external URL, `mailto:`) | a real link, opened in a new tab |

**Safety:** a target whose scheme is not relative, `#`, `http(s)`, or `mailto:` is
rejected with a warning and the image falls back to the viewer. `javascript:` and
similar schemes can never reach the page.

Do not add a duplicate "open image" link next to a linked image unless a visible
fallback is genuinely required.

---

## 6. Diagnostics reference

Warnings appear in the browser console in development, prefixed `[BioMD]`. Every
diagnostic is **non-destructive**: content is preserved and rendering continues.

| Message | Cause | Result |
|---|---|---|
| `::: align without required position — rendered at default alignment.` | `position` missing | Body renders unaligned |
| `::: align has unknown position "X" — rendered at default alignment.` | Not `left`/`center`/`right` | Body renders unaligned |
| `Unknown frame "X" — using the default frame.` | Not one of the seven tokens | Default frame |
| `Unsafe link target — ignored: "X"` | `link:` uses a disallowed scheme | `link` dropped; viewer opens `src` |
| `::: nav without a link list — skipped.` | Empty nav body | Nav omitted |
| `Unknown block ::: X — rendering its inner content.` | Misspelled directive name | Body still renders |
| `Ignored non-property line in ::: image: "…"` | Prose inside a leaf block | That line is dropped |
| `Unclosed ::: X block — content kept to end of file.` | Missing closing `:::` | Content preserved |

Property **values** are matched case-insensitively (`position: Center` works), but
lowercase is the documented form. Directive and property **names** are lowercase
ASCII.

---

## 7. Interaction rules between directives

| Combination | Behaviour |
|---|---|
| `align` containing an `image` | Allowed. The image's own `position` still governs its placement; the alignment moves intrinsic-width children of the block |
| `align` containing `columns` | **Invalid.** Use `columns` alone for parallel content |
| `align` wrapping `nav` | **Invalid.** A nav is already centred |
| `align` inside `column`, `lead`, or `frame` | Allowed |
| `align` after a floated (`position: left/right`) image | The alignment block ends the wrap; the group aligns on the full measure |
| `frame:` on a child inside `images` | Allowed; overrides the group's `frame` |
| `frame:` + `link:` on the same image | Allowed and independent: one is the frame, the other the click target |
| `nav` inside `frame` | **Invalid** (pre-existing rule, specification 4.1) |
| Table inside `align` | Cell text follows the alignment; table header cells stay left-aligned by theme rule |

---

## 8. Authoring checklist

Before accepting a document that uses the 1.3 features:

- [ ] every `::: align` has a valid `position`, and wraps a **bounded** group — not the whole article, not long prose;
- [ ] no `align` block is used for spacing, indentation, or side-by-side layout;
- [ ] every `frame:` value is one of the seven tokens; no hex, `rgb()`, or CSS;
- [ ] frames mark a real distinction rather than decorating every image;
- [ ] a group `frame:` is used where a whole row shares one frame, instead of repeating it per child;
- [ ] every `::: nav` body is a bullet list with exactly one link per item;
- [ ] `active`, if present, matches one item's rendered label exactly, and labels are unique;
- [ ] nav items point at catalogue entries, fragments, or absolute URLs — no media files, no global site menu;
- [ ] `*.bio.md` nav targets exist in `pages/index.json`;
- [ ] meaningful images have an `alt` that is not the caption reworded and not a filename;
- [ ] `link:` targets are relative paths, `#…`, `http(s)`, or `mailto:`;
- [ ] the development console shows no unexpected `[BioMD]` warnings for the page;
- [ ] the page is readable at phone width, and nothing scrolls horizontally.

---

## 9. Compatibility notes

- **Existing documents need no changes.** The 1.3 directives are new names that no
  1.2 document contains, and `frame:` is optional; an image without it renders
  exactly as before.
- **One deliberate improvement affects existing content:** images that already
  carried an `alt:` property now use it as their accessible name instead of falling
  back to the caption. This is invisible on screen and improves accessibility.
- **Forward compatibility:** a renderer that predates 1.3 treats `::: align` as an
  unknown directive — it preserves and renders the body (and may show the
  `position: center` line as text) rather than dropping content.
- **Ordinary Markdown images** (`![alt](src)`) support neither `frame:` nor `link:`.
  Convert them to `::: image` when either is needed. No inline-attribute syntax
  exists, by design.
- **Still not implemented by the renderer** (specified, but rendered as plain
  content for now): `::: frame` callouts, `::: signature`, and `columns`'
  `divider:` property. Avoid relying on their visual effect.

---

## 10. Conformance fixture

[`pages/ru/biomd-demo.bio.md`](../pages/ru/biomd-demo.bio.md) exercises every 1.3
feature and every diagnostic in one page: all three alignments plus a missing and an
invalid `position`; all seven frame tokens; a group frame with a child override; an
unknown frame token; the three `link:` behaviours plus a rejected unsafe scheme; a
nav with and without a title, with an `active` item, with internal, external, and
media targets; and 1.2 blocks (`lead`, `columns`, `images`, an unknown block) beside
the new ones to show they are unaffected.

Open it via the catalogue (it is listed in `pages/index.json` as
"BioMD 1.3 Conformance") and compare the console warnings with section 6 — the page
is expected to produce exactly five of them.
