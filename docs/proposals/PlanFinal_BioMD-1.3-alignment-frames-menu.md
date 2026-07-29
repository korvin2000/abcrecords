# FINAL Implementation Plan — BioMD Lite 1.3
## `::: align` · image `frame:` · `::: nav` (horizontal menu)

**Status:** ✅ **IMPLEMENTED** 2026-07-29 (all phases; Phase 7 keyboard-a11y
deliberately deferred). Author-facing documentation:
[`docs/Biography-Markup-Appendix-1.3.md`](../Biography-Markup-Appendix-1.3.md).
Normative spec is `docs/Biography-Markup.md` v1.3 · **Date:** 2026-07-29
**Supersedes:** `PlanA_BioMD-1.3-alignment-frames-menu.md`, `PlanB_BioMD-1.3-alignment-frames-menu.md`
**Base:** Plan A (format decisions, doc-first sequencing, CSS strategy) + Plan B's
verified code detail, compatibility matrix, CSS specificity analysis and
verification recipe.
**Target code:** `app/src/lib/biomd/{parse.ts,BioArticle.tsx}` ·
`app/src/components/CurlFrame.tsx` · `app/src/index.css`

> **Read before implementing:** `CLAUDE.md` → `.claude-memory/INDEX.md` →
> [`13-app-code-map.md`](../../.claude-memory/13-app-code-map.md) →
> [`14-app-patterns-and-gotchas.md`](../../.claude-memory/14-app-patterns-and-gotchas.md)
> → `docs/Biography-Markup.md` §4 (directive grammar), §6 (image), §10 (nav).

---

## 0. Verdict — what was taken from which plan, and why

**Plan A is the base.** It made the better *format* calls (a semantic `align`
directive instead of four value-shaped directive names; no literal colours; the
`alt`/`link` contract repaired while the image code is open) and the better
*process* call (normative spec before code). Plan B contributed the concrete,
code-level accuracy: exact anchors, the property/body splitter, the modifier-class
implementation, CSS specificity analysis, the compatibility matrix, and a real
verification recipe.

| Decision | Winner | Why |
|---|---|---|
| Alignment syntax `::: align` + `position:` | **A** *(owner-approved)* | Reuses the `position: left\|center\|right` vocabulary authors know from `::: image`; keeps the directive namespace semantic (`lead`/`image`/`nav`/`frame` are concepts, not values); avoids `::: left` reading as an image float; extensible by value. |
| Drop `justify` | **A** | Does not fit a property named `position`; justified Cyrillic without hyphenation reads badly. Addable later as a value or separate property. |
| Drop the `centre` alias | **A** (B had it) | The parser already warns + falls back on a bad value; an alias is spec surface for nothing. |
| Semantic CSS classes `.bio-align-*` | **A** | B's "zero CSS via Tailwind `text-center`" collapses the moment block children must follow the alignment (the user asked for *element* alignment), and B's own `.bio-align.text-center` compound selector was a wart. |
| Align block clears floats (`clear: both`) | **A** | Matches spec §6.2, where a following layout block ends image wrapping. Centering inside a float-narrowed measure is never the author's intent. |
| Frame = optional `frame:` property, theme tokens | **both** | Identical proposals; accepted unchanged. |
| No literal `#rrggbb` | **A** *(owner-approved)* | Colour stays a theme decision (spec §1 priority 5); closed enum keeps validation and the palette safe. `gold`/`burgundy`/`sepia` already deliver "different colours". |
| Frame vocabulary = 7 values | **merge** *(owner-approved)* | A's five + B's `mat` and (renamed) `ornate`. `ornate` is the modal's own double-border motif from `docs/Biography_card_Design.md`. |
| `frame:` inheritable from `::: images` | **B** | ~4 parser lines; removes 4× repetition in the common "one frame for the row" case. Child always wins. |
| Menu = implement existing `::: nav`, no `::: menu` | **both** | Already normative in v1.2 §10; this is renderer catch-up, not a format change. |
| Nav body rendered through the existing `Md` pipeline | **both** | Inherits the whole link-rewiring hub; no second URL classifier. |
| Nav mode suppresses media widgets (audio player / viewers) | **A** | B would have rendered an `InlineAudioPlayer` inside a pill bar. Real reliability catch. |
| Nav is `<nav><ul><li><a>`, **never** `role="tablist"/"tab"` | **A** | Items navigate to pages; they are links, not panel switches. |
| **Drop** B's proposed `align:` property on `nav` | **A** (by omission) | Speculative, and a second way to express alignment. Nav is centered by renderer contract ⇒ **`nav` needs no format change at all**. |
| `alt` + `link` repaired in this change | **A** *(owner-approved)* | `alt:` is authored in **8** existing blocks and silently discarded today; `link:` is used by **0** pages ⇒ implementing it cannot regress anything. |
| Keyboard-a11y refactor of figures deferred | **B** | It rewrites the DOM of *every* existing image — the one thing that could break "existing pages render identically". Ships as its own phase with its own visual pass. |
| Spec/docs updated **before** code | **A** | `CLAUDE.md`: `docs/` is the source of truth; code must not define undocumented syntax. |
| Compatibility matrix, CSS specificity notes, Browser-pane verification, demo fixture, `App.tsx` dead-link finding | **B** | A had none of these; they are what makes the plan executable and safe. |

---

## 1. Verified baseline (both plans contained errors — these are the measured facts)

| Fact | Value | Note |
|---|---|---|
| `*.bio.md` files | **13** (`ru` 9, `en` 3, `de` 1) | Plan A correct; **Plan B's "22 pages" was wrong** (it counted `.bio.json` pairs). |
| `index.json` rows | 9 (two pairs point at alternate md for the same person) | |
| Directives in use | `image` 36 · `column` 18 · `columns` 9 · `lead` 7 · `images` 5 | No `align`, no `nav`, no `document`, no `frame`, no `signature`. |
| Image properties in use | `src` 36 · `caption` 28 · `size` 26 · `position` 26 · **`alt` 8** · `columns` 5 | **`link:` = 0 occurrences.** |
| `alt:` handling today | parsed by `parseProps`, **dropped** by `parseImage` (`parse.ts:146-159`); renderer uses `alt={node.caption ?? ""}` | 8 authored values are lost. |
| Unknown-key validation | not implemented (spec §4 requires a warning) | **Out of scope** — enabling it now would spam DEV warnings for existing content. |

Key anchors (line numbers drift; treat as anchors):

| Concern | Location |
|---|---|
| Fence/property grammar | `parse.ts:76-78` (`FENCE_OPEN`, `FENCE_CLOSE`, `PROP_LINE`) |
| Segmenter (md runs vs blocks, nesting depth) | `parse.ts:88-125` |
| `parseProps` (warns on non-property lines) | `parse.ts:128-137` |
| Block dispatch | `parse.ts:161-231`; unknown fallback `227-230` |
| `BioNode` union | `parse.ts:60-67` |
| `Md` + link-rewiring hub | `BioArticle.tsx:33-134` |
| `Figure` | `BioArticle.tsx:154-182` |
| `renderNode` switch | `BioArticle.tsx:184-244` |
| `CurlFrame` markup | `app/src/components/CurlFrame.tsx` |
| Article CSS / `.fx-curl` | `app/src/index.css:485-675` |
| Codex tab bar (visual reference for nav) | `codex/CodexModal.tsx:210-228` |
| **Nav dead-link limitation** | `App.tsx:90-96` — `navigateByMdPath` no-ops when the slug is absent from `index.json` |

### 1.1 Engine invariants this change must not break

- **Fail-soft, never delete content**: bad value → warn + safe default; unknown
  directive → render body; unclosed fence → keep to EOF + warn. Never throw
  (there is no error boundary).
- `:::` fences are matched before Markdown and must start at column 0.
- Source order = reading/focus order.
- No `rehype-raw`; content never supplies HTML, CSS, class names or inline styles.
- **`index.css` is unlayered** ⇒ its selectors beat Tailwind utilities. Scope new
  rules under `.bio-article` / `.fx-curl`, append-only, no `!important`.
- i18n is compiler-policed — **this change adds no message key** (all labels come
  from content).

---

## 2. Locked format decisions (owner-approved)

1. **Alignment** — new directive `::: align` with **required** `position: left | center | right`.
   No `justify`, no `centre` alias.
2. **Frames** — new **optional** property `frame:` on `::: image` (and on
   `::: images`, inherited by children that omit it). Closed enum, **no literal
   colours**:
   `curl` (default) · `none` · `gold` · `burgundy` · `sepia` · `mat` · `ornate`.
3. **Menu** — implement the **existing** `::: nav` (v1.2 §10) unchanged. No new
   property, no `::: menu`. Centered by renderer contract.
4. **Adjacent repairs in scope** — parse and honour `image.alt` and `image.link`
   (with a mandatory safe-scheme guard). Figure keyboard-a11y is a separate
   later phase.

---

## 3. Format spec delta — exact text for `docs/Biography-Markup.md` (bump 1.2 → 1.3)

> This is the whole author-facing contract change. **No existing `.bio.md` file
> needs editing.** Apply this *before* writing code (Phase 1).

### 3.1 §4.1 content-model table — one new row, one new property

| Directive | Required | Optional | Body |
|---|---|---|---|
| `align` **(new)** | `position` | — | Markdown and leaf media directives |
| `image` (standalone) | `src`, `position`, `size` | `alt`, `caption`, `link`, **`frame`** | none |
| `image` inside `images` | `src` | `alt`, `caption`, `link`, **`frame`** | none |
| `images` | `columns` | **`frame`** | two or more `image` children |
| `nav` | *(unchanged)* | *(unchanged)* | *(unchanged)* |

Nesting constraints to add:

- an `align` block MAY contain Markdown and leaf media directives; it MUST NOT
  contain `columns` (use `columns` for a genuine parallel relationship);
- an `align` block MUST NOT be used to simulate columns, indentation, margins or
  spacing;
- `align` MUST NOT wrap a `nav` (a nav is centered by its own contract).

### 3.2 New section — "Alignment (`::: align`)"

> Use `align` when horizontal alignment carries meaning — a centered dedication
> or concert programme, a right-aligned archival dateline. Alignment is a coarse
> presentation hint (§1, priority 4), not structure.
>
> ```md
> ::: align
> position: center
>
> *Посвящается памяти Андреса Сеговии*
>
> :::
> ```
>
> Properties:
>
> - `position` — **required**: `left`, `center`, or `right`.
>
> Rules:
>
> - the block changes visual alignment only; it never changes source, reading,
>   copy or keyboard-focus order;
> - use it for a bounded group — a short paragraph, dedication, small heading
>   group, credit line — not for a whole article and not for long prose (centered
>   or right-aligned body text is harder to read);
> - a child directive's own layout rule wins: `image.position` remains the
>   authoritative placement rule for a standalone image;
> - the renderer treats the block as a new block that ends an earlier
>   left/right image wrap (same rule as §6.2);
> - a missing or unrecognised `position` MUST produce a warning and render the
>   body at the document's default alignment — never delete content;
> - `left`/`right` are physical values, consistent with `image.position`. Logical
>   `start`/`end` may be considered in a later revision if RTL content appears;
> - for a genuine closing author/place/credit block use `::: signature`, not
>   `align`.

### 3.3 New subsection — "§6.5 Picture frame (`frame`)"

> `frame` is an optional property of `::: image`. On `::: images` it sets the
> default for children that do not carry their own `frame`; a child value always
> wins. It names a **theme-defined** treatment around the picture:
>
> | Value | Meaning |
> |---|---|
> | *(absent)* | identical to `curl` — the theme's default photographic frame |
> | `curl` | the default treatment, stated explicitly (useful to override an inherited group frame) |
> | `none` | no decorative frame and no frame shadow — a plain image |
> | `gold` | thin muted-gold line |
> | `burgundy` | thin deep-red line |
> | `sepia` | thin dark-brown archival line |
> | `mat` | ivory mount (passe-partout) with a hairline |
> | `ornate` | gold line with an inset darker inner line — the codex double-border motif |
>
> ```md
> ::: image
> src: photo/b/barrios.jpg
> position: center
> size: large
> alt: Агустин Барриос с гитарой
> caption: Агустин Барриос
> frame: ornate
> :::
> ```
>
> Rules:
>
> - exact thickness, shade, radius, mat width and hover treatment remain
>   renderer/theme decisions; `frame` only names the intent;
> - literal colours (hex, `rgb()`, CSS variables, class names, gradients, URLs)
>   are **not** accepted; an unrecognised value MUST warn and fall back to the
>   default;
> - `frame` changes presentation only — never aspect ratio, size, position,
>   caption, `alt`, click target, loading behaviour or source order;
> - it frames the image, not the caption or the surrounding article;
> - an ordinary Markdown image (`![alt](src)`) has no frame property: convert it
>   to `::: image` when a frame is needed. No inline-attribute syntax is added;
> - **`frame` (an image property) and `::: frame` (the bordered notice/callout of
>   §11) are unrelated**: the first draws a picture frame, the second encloses
>   article prose.

### 3.4 §10 `nav` — no syntax change; add two renderer clarifications

> - the renderer presents a `nav` as a single **centered horizontal bar** of
>   links that wraps inside its own container and never causes page-level
>   horizontal overflow;
> - `nav` items are links, not controls: a conforming renderer emits real
>   anchors with `aria-current` on the active item and MUST NOT present them as
>   tabs/panel switches;
> - `nav` items SHOULD target another catalogue entry (`*.bio.md`), a fragment,
>   or an absolute URL. Media targets (audio, images, tablature) are not
>   navigation and are rendered as plain links, without media widgets.

### 3.5 §15.1 HTML-migration table — three new mappings

| HTML source pattern | BioMD |
|---|---|
| `<center>`, `align="center"`, meaningful `text-align` on a block | `align` with `position` |
| horizontal row of page links (table- or `<br>`-based menu) | `nav` |
| `<img border="…">`, coloured/bordered `<td>` wrapping an article image | `image` with `frame` |

*(Add to `docs/HTML-to-BioMD-Lite-Conversion-Guide.md`; keep discarding purely
decorative borders and exact CSS colours. The historical
`docs/html-to-biomd_guide.md` stays historical.)*

### 3.6 Changelog entry

```md
## v1.3

- Added the `::: align` directive with a required `position: left|center|right`
  for meaningful horizontal alignment.
- Added the optional `frame` property to `::: image` and `::: images`
  (theme-named picture frames: curl, none, gold, burgundy, sepia, mat, ornate).
  Literal colours are not accepted.
- Clarified that `frame` (image property) and `::: frame` (callout block) are
  unrelated.
- Clarified `nav` rendering: one centered horizontal bar of real links, wrapping
  inside its own container; media targets stay plain links.
- No change to existing documents: every addition is a new directive or an
  optional property.
```

---

## 4. Rendering contract

### 4.1 Alignment

```html
<div class="bio-align bio-align-center"> … children … </div>
```

- `bio-align` always present (carries `clear: both`); `bio-align-<position>`
  added only when `position` is valid. Malformed → wrapper without the modifier
  ⇒ default alignment preserved, content intact.
- CSS uses `text-align` plus logical margins for intrinsic-width block children
  (figures, document cards). **No** absolute positioning, floats, transforms,
  negative margins or flex/grid reordering.
- Precedence: (1) source order always wins; (2) a child's explicit directive
  semantics win; (3) the surrounding alignment applies to everything else.

### 4.2 Image frames

- Same DOM as today (`span.fx-curl > span.inner > img`), same caption, same
  viewer click, same lazy/async loading, same size/float classes. **Only a
  modifier class is added.**
- `curl` / absent → today's classes verbatim.
- `gold` / `burgundy` / `sepia` / `mat` / `ornate` → suppress the curled-corner
  pseudo-elements, soften the drop shadow, apply the theme border (and mat).
- `none` → no border, no curl corners, no frame shadow.
- Keep the existing ~6 % hover zoom for all variants: it is the click affordance
  for the image viewer, not decoration (see the reduced-motion note in
  `.claude-memory/14`). Revisit only if visual review shows a conflict.

### 4.3 Navigation

```html
<nav class="bio-nav">
  <div class="bio-nav-title">…optional title…</div>
  <ul>
    <li><a href="#/slug">Item</a></li>
    <li><span class="bio-nav-current" aria-current="page">Current</span></li>
  </ul>
</nav>
```

Required behaviour: centered bar and items · flex + wrap (no JS measurement, no
carousel) · `clear: both` · no page-level horizontal overflow · natural tab
order · visible `:focus-visible` ring · `aria-current="page"` on the active item ·
active item non-clickable · `*.bio.md` items go through `onNavigateEntry` ·
external items keep `target="_blank" rel="noopener noreferrer"` · media targets
render as plain links · an empty/malformed nav keeps its readable body and warns.

---

## 5. Implementation — file by file

### 5.1 `app/src/lib/biomd/parse.ts`

**(a) Types** — add to the existing exports and to the `BioNode` union:

```ts
export type ContentAlignment = "left" | "center" | "right";
export type ImageFrame = "curl" | "none" | "gold" | "burgundy" | "sepia" | "mat" | "ornate";

export interface AlignNode {
  kind: "align";
  /** null when `position` was missing or invalid — render at default alignment. */
  position: ContentAlignment | null;
  children: BioNode[];
}

export interface NavNode {
  kind: "nav";
  title?: string;
  /** Plain-text label of the current item (rendered non-clickable). */
  active?: string;
  /** Raw Markdown body (the link list) — rendered by the normal Md pipeline. */
  markdown: string;
}
```

Extend `ImageNode` with:

```ts
  /** Accessibility text (spec §6.1). Falls back to `caption` at render time. */
  alt?: string;
  /** Click target for a thumbnail/cover/scan (spec §6.4); safe schemes only. */
  link?: string;
  /** Theme frame treatment; undefined ⇒ the default Lifted Curl. */
  frame?: ImageFrame;
```

**(b) One new helper — property header + Markdown body** (needed by `align` and
`nav`; `image`/`images`/`document` keep using `parseProps` untouched):

```ts
/**
 * Split a directive body into its leading `key: value` header and the remaining
 * Markdown (spec §4: a blank line separates properties from body content).
 * Tolerant: the header also ends at the first line that is not a property, so a
 * body that starts immediately still parses.
 */
function splitPropsAndBody(lines: string[]): { props: Record<string, string>; body: string[] } {
  const props: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      if (Object.keys(props).length) break; // blank line ends the header
      continue;                             // leading blanks before it
    }
    const m = PROP_LINE.exec(lines[i].trim());
    if (!m) break;
    props[m[1].toLowerCase()] = m[2].trim();
    i++;
  }
  return { props, body: lines.slice(i) };
}
```

**(c) Safe-target guard** (required because `link` flows into an `href`; block
properties bypass react-markdown's `urlTransform`):

```ts
/** Allow relative paths, fragments, http(s) and mailto; reject javascript:, data:, … */
function isSafeTarget(url: string): boolean {
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url);
  return !scheme || /^(?:https?|mailto)$/i.test(scheme[1]);
}
```

**(d) `parseBlock` — two new cases, placed above `default:`**

```ts
    case "align": {
      const { props, body } = splitPropsAndBody(block.lines);
      const raw = props.position;
      const position = ALIGNMENTS.includes(raw as ContentAlignment)
        ? (raw as ContentAlignment)
        : null;
      if (position === null) {
        warnings.push(
          raw
            ? `::: align has unknown position "${raw}" — rendered at default alignment.`
            : "::: align without required position — rendered at default alignment.",
        );
      }
      return { kind: "align", position, children: parseNodes(body, warnings) };
    }

    case "nav": {
      const { props, body } = splitPropsAndBody(block.lines);
      const markdown = body.join("\n").trim();
      if (!markdown) {
        warnings.push("::: nav without a link list — skipped.");
        return null;
      }
      return {
        kind: "nav",
        title: props.title || undefined,
        active: props.active || undefined,
        markdown,
      };
    }
```

Note: `parseNodes(body, …)` (not `block.lines`) so a stray property line is not
re-rendered as prose. Nested `columns` inside `align` may be warned about but
MUST still render.

**(e) `parseImage` — `alt`, `link`, `frame`**

```ts
  const frameRaw = props.frame?.trim().toLowerCase();
  const frame = FRAMES.includes(frameRaw as ImageFrame) ? (frameRaw as ImageFrame) : undefined;
  if (frameRaw && !frame) warnings.push(`Unknown frame "${props.frame}" in ::: image — using the default frame.`);

  let link = props.link || undefined;
  if (link && !isSafeTarget(link)) {
    warnings.push(`Unsafe link target in ::: image — ignored: "${link}"`);
    link = undefined;
  }
```

Keep `src`/`position`/`size`/`caption` defaults exactly as they are, and do not
touch the `images` column inference.

**(f) `case "images"` — group-level frame inheritance** (order-independent):

```ts
      // read alongside the existing `props.columns` handling
      if (props.frame) groupFrame = parseFrameValue(props.frame, warnings);
      …
      const framed = groupFrame ? images.map((im) => (im.frame ? im : { ...im, frame: groupFrame })) : images;
      return { kind: "images", columns: cols, images: framed };
```

*(Factor the 4 lines from (e) into `parseFrameValue(raw, warnings): ImageFrame | undefined` and call it from both places.)*

**(g) Do not change** column-zero fence recognition, nesting depth, unclosed-block
recovery, unknown-directive body preservation, title extraction, or source-order
traversal. Do **not** add unknown-key warnings (§1 note).

### 5.2 `app/src/lib/biomd/BioArticle.tsx`

**(a) `Md` gains one optional prop** — nav mode, which does two things and is
inert when absent:

```tsx
/** Set when this Markdown island is a ::: nav body. */
interface NavContext {
  /** Exact plain-text label of the current item. */
  active?: string;
}

function Md({ text, onNavigateEntry, nav }: {
  text: string;
  onNavigateEntry?: (p: string) => void;
  nav?: NavContext;
}) { … }
```

Inside the `a` renderer, add the active check first and gate the three media
branches on `!nav` (a menu must not sprout an audio player or a viewer link):

```tsx
        a: ({ href, children }) => {
          const url = href ?? "";
          if (nav?.active && linkText(children).trim() === nav.active.trim()) {
            // spec §10: the current item is presented as current, not clickable
            return <span className="bio-nav-current" aria-current="page">{children}</span>;
          }
          if (/\.bio\.md$/i.test(url) && !isExternalUrl(url) && onNavigateEntry) { …unchanged… }
          const kind = audioKind(url);
          if (kind && !nav) { …unchanged… }
          if (isAsciiTabUrl(url) && !nav) { …unchanged… }
          if (isImageUrl(url) && !nav) { …unchanged… }
          …external / archival branches unchanged…
        },
```

With `nav` undefined (every existing call site) the function is behaviourally
identical to today's.

**(b) `renderNode` — two new cases**

```tsx
    case "align":
      return (
        <div key={key} className={clsx("bio-align", node.position && `bio-align-${node.position}`)}>
          {node.children.map((c, i) => renderNode(c, i, onNavigateEntry))}
        </div>
      );

    case "nav":
      return <BioNav key={key} node={node} onNavigateEntry={onNavigateEntry} />;
```

**(c) `BioNav`** — keep it in this file (small, and tied to `Md`):

```tsx
/**
 * In-article horizontal menu (::: nav). The link list is rendered by the normal
 * Markdown pipeline so every item keeps the article's link rewiring (bio.md →
 * in-app navigation, external → new tab); `.bio-nav` CSS turns the <ul> into the
 * same pill bar as the codex tab strip. Real links, never role="tab".
 */
function BioNav({ node, onNavigateEntry }: { node: NavNode; onNavigateEntry?: (p: string) => void }) {
  const navCtx = useMemo(() => ({ active: node.active }), [node.active]);
  return (
    <nav className="bio-nav">
      {node.title && <div className="bio-nav-title">{node.title}</div>}
      <Md text={node.markdown} onNavigateEntry={onNavigateEntry} nav={navCtx} />
    </nav>
  );
}
```

**(d) `Figure` — `alt`, `link`, `frame`** (this is the only existing-markup
change, and it is gated on properties no current page uses except `alt`):

```tsx
function Figure({ node, onNavigateEntry }: { node: ImageNode; onNavigateEntry?: (p: string) => void }) {
  const openImage = useImageViewer();
  const src = resolveResourcePath(node.src);
  const alt = node.alt ?? node.caption ?? "";          // spec §6.1 fallback order
  …float/size classes unchanged…
```

Click/target resolution — **absent `link` keeps today's behaviour exactly**:

| `link` | Behaviour |
|---|---|
| absent | `<figure onClick>` → image viewer on `src` *(unchanged)* |
| an image URL | image viewer opens the **linked** (full-resolution) image, `alt`/caption from the node |
| `*.bio.md` (local) | in-codex navigation via `onNavigateEntry`; render `<a href="#/slug">` around the frame so it is a real link |
| anything else (external / legacy relative) | render a real `<a href={resolveResourcePath(link)} target="_blank" rel="noopener noreferrer">` around the frame |

Only the two anchor cases add an element, and only for images that carry
`link:` — i.e. **zero existing images**. Give that anchor one scoped reset class
so it cannot change the image width, background or frame.

**(e) Frame variant** — `<CurlFrame variant={node.frame}>`; captions stay outside
the frame. Ordinary Markdown `img` nodes pass no variant ⇒ default curl.

**(f) Unchanged**: module-level `REMARK_PLUGINS`, `memo(BioArticle)`,
`useMemo(parseBioMd)`, the `table` overflow wrapper, the DEV warning dump. No new
state, effect or context.

### 5.3 `app/src/components/CurlFrame.tsx`

Extend in place — do not rename or split:

```tsx
const FRAME_CLASS: Partial<Record<ImageFrame, string>> = {
  none: "fx-curl--framed fx-curl--none",
  gold: "fx-curl--framed fx-curl--gold",
  burgundy: "fx-curl--framed fx-curl--burgundy",
  sepia: "fx-curl--framed fx-curl--sepia",
  mat: "fx-curl--framed fx-curl--mat",
  ornate: "fx-curl--framed fx-curl--ornate",
  // `curl` (and undefined) intentionally absent → today's markup verbatim
};

export function CurlFrame({ className, variant, children }: {
  className?: string;
  /** Optional theme frame from `::: image frame:`. Omitted ⇒ Lifted Curl. */
  variant?: ImageFrame;
  children: ReactNode;
}) {
  return (
    <span className={clsx("fx-curl", variant && FRAME_CLASS[variant], className)}>
      <span className="inner">{children}</span>
    </span>
  );
}
```

Static map — never an interpolated, content-derived class string.
`import type { ImageFrame } from "@/lib/biomd/parse"` (`verbatimModuleSyntax`).
`GalleryTab` and the Markdown `img` path omit `variant` ⇒ byte-identical markup.

### 5.4 `app/src/index.css` (append-only; never edit an existing rule)

```css
/* ============================================================
   Alignment blocks (::: align) — a bounded aligned group. It starts a
   new block, so it ends an earlier left/right image wrap (spec §6.2);
   intrinsic-width block children follow the alignment as well.
   ============================================================ */
.bio-article .bio-align { clear: both; }
.bio-article .bio-align-left   { text-align: left; }
.bio-article .bio-align-center { text-align: center; }
.bio-article .bio-align-right  { text-align: right; }
.bio-article .bio-align-center > figure { margin-inline: auto; }
.bio-article .bio-align-right  > figure { margin-inline: auto 0; }
.bio-article .bio-align-left   > figure { margin-inline: 0 auto; }

/* ============================================================
   In-article navigation bar (::: nav) — the codex tab strip's visual
   language: paper pill row, gold hairline, burgundy current item.
   Centered by contract; wraps on narrow screens (no JS measurement).
   ============================================================ */
.bio-article .bio-nav { clear: both; margin: 1.4em 0; }
.bio-article .bio-nav-title {
  font-family: var(--font-heading);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: var(--color-sepia-600);
  text-align: center;
  margin-bottom: 0.45rem;
}
.bio-article .bio-nav ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
  width: max-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 0.25rem;
  border: 1px solid rgba(184, 144, 42, 0.4);
  border-radius: 6px;
  background: rgba(244, 236, 214, 0.6);
}
.bio-article .bio-nav li { margin: 0; }
.bio-article .bio-nav a,
.bio-article .bio-nav .bio-nav-current {
  display: block;
  padding: 0.35rem 0.9rem;
  border-radius: 4px;
  font-family: var(--font-heading);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  text-decoration: none;
  white-space: nowrap;
  color: var(--color-sepia-600);
  transition: background-color 0.2s, color 0.2s;
}
.bio-article .bio-nav a:hover {
  background: rgba(236, 223, 192, 0.8);
  color: var(--color-ink-800);
}
.bio-article .bio-nav a:focus-visible {
  outline: 2px solid var(--color-gold-600);
  outline-offset: 2px;
}
.bio-article .bio-nav .bio-nav-current {
  background: var(--color-burgundy-600);
  color: var(--color-paper-50);
  box-shadow: 0 2px 10px rgba(122, 31, 43, 0.35);
  cursor: default;
}

/* ============================================================
   Optional picture frames (::: image → frame:). A framed print reads as a
   hung picture rather than a loose photo, so the curled-corner shadows are
   dropped; the hover zoom stays (it is the image-viewer click affordance).
   ============================================================ */
.fx-curl--framed::before,
.fx-curl--framed::after { display: none; }
.fx-curl--framed { box-shadow: 0 1px 5px rgba(51, 34, 15, 0.28); }

.fx-curl--gold > .inner     { border: 1.5px solid var(--color-gold-600); }
.fx-curl--burgundy > .inner { border: 2px solid var(--color-burgundy-600); }
.fx-curl--sepia > .inner    { border: 1.5px solid var(--color-sepia-600); }
.fx-curl--ornate > .inner   {
  border: 1.5px solid rgba(184, 144, 42, 0.85);
  outline: 1px solid rgba(84, 56, 30, 0.45);
  outline-offset: -4px;
}
.fx-curl--mat > .inner      {
  border: 1px solid rgba(184, 144, 42, 0.55);
  padding: 10px;
  background: var(--color-paper-100);
}
.fx-curl--none { box-shadow: none; }
```

**Specificity notes (the documented `index.css` footgun):**

- `.bio-article ul` (index.css:565) and `.bio-article li::marker` (573) have the
  same weight as a naïve `.bio-nav ul`; every nav/align rule is therefore written
  `.bio-article .bio-nav …` / `.bio-article .bio-align… ` so it wins regardless
  of source order. No `!important`.
- `.bio-article a`'s dotted underline is overridden only inside `.bio-nav`.
- `.bio-align-* > figure` uses **`margin-inline` only** so it never fights the
  figure's Tailwind `my-4`; it does intentionally beat `mx-auto` (unlayered > utility).
- `width: max-content; max-width: 100%` + `flex-wrap` keeps a long bar inside the
  codex scroll area (`absolute inset-[11px]`) with no page-level overflow.
- Visual QA item: `.fx-curl .inner` has `overflow: hidden`; confirm the `ornate`
  negative `outline-offset` renders as intended and that `mat`'s padding does not
  disturb captions.

### 5.5 Files that must NOT change

`remarkHighlight.ts` · `BiographyTab.tsx` · `CodexModal.tsx` (the article menu is
content, **not** a fifth codex tab) · `catalog.ts` · `paths.ts` ·
`LazyCodexModal.ts` · `vite.config.ts` · providers/global state · any
`lib/messages/*` dictionary · `package.json` (no dependency).

---

## 6. Backward compatibility

### 6.1 Why existing pages cannot change

| Change | Effect on the 13 existing files |
|---|---|
| `align` / `nav` cases | Unreachable — no such fence exists in content |
| `splitPropsAndBody` | Used only by `align`/`nav` |
| `frame` on `ImageNode` | `undefined` everywhere ⇒ `CurlFrame` emits today's classes |
| `link` on `ImageNode` | 0 occurrences ⇒ no anchor is ever added |
| `alt` on `ImageNode` | 8 occurrences ⇒ the `alt` **attribute** changes from the caption to the authored text. Invisible on screen; improves a11y; honours content already written |
| `nav` prop on `Md` | `undefined` at every existing call site ⇒ identical branch order |
| `.bio-align*` / `.bio-nav*` CSS | Selectors cannot match today's DOM |
| `.fx-curl--*` CSS | Selectors cannot match today's DOM; base `.fx-curl` untouched |
| Existing `index.css` rules | Not edited (append-only) |
| i18n / dependencies / bundle graph | Untouched |

The only intentional behavioural delta on existing content is the `alt`
attribute of 8 images. State that in the commit message.

### 6.2 Forward compatibility

An older renderer meets `::: align` as an unknown directive: it preserves the
body and may show the literal `position: center` line as text. That is the
accepted cost of the property form and is noted in the changelog.

### 6.3 Verification (no test runner exists)

**Before implementing** — `npm run dev`, open all 9 index rows, screenshot the
Biography tab of `barrios`, `jovicic`, `authors`, `agustin-barrios` (the pages
exercising `columns`/`images`/`lead`/floats). Note the DEV `[BioMD]` warning
baseline.

**After each phase** — `npx tsc -b` must be clean; re-shoot the same four pages
and diff; no new warnings for existing content.

**New features** — via the demo fixture (Phase 5), in the Browser pane:
`preview_start {name}` → open the entry → `read_page` (structure, `aria-current`,
real anchors) → `read_console_messages` (`[BioMD]` warnings are the expected ones
only) → `resize_window` mobile (nav wraps, no horizontal page scroll) →
screenshot (all 7 frames). Keyboard-tab the menu. **Pane caveat:** compositing is
throttled — CSS transitions do not visibly advance and hover screenshots time
out; verify hover/focus end-states by injecting `* { transition: none }` and
reading computed styles (`.claude-memory/14`, memory note
`browser-pane-transition-verification`).

**Fixture case list** (merged from both plans): `position` left/center/right ·
missing `position` · invalid `position` · align containing a figure · align next
to a floated image · default image (no `frame`) · each of the 7 frame values ·
group `frame` with a child override · `alt` different from `caption` · image with
no `link` · image `link` to a larger image · image `link` to a `.bio.md` entry ·
image `link` with an unsafe scheme (must be dropped + warned) · `nav` with and
without `title` · `nav` with `active` · nav items: local `.bio.md`, external
HTTPS, legacy relative, and a media URL (must stay a plain link) · a nav with
enough items to wrap at 375 px · an unknown directive before and after the new
nodes · an unclosed `::: align` (recovery).

**Optional (recommended, not blocking):** Vitest + a `parseBioMd` snapshot over
all 13 existing `.bio.md` files — the only mechanical guarantee that the parse
tree of existing content is unchanged (backlog item 1 in `.claude-memory/15`).

---

## 7. Phase sequence

**Phase 0 — confirm baseline.** Re-read `parse.ts`/`BioArticle.tsx`; re-run the
inventory greps from §1; take the "before" screenshots.

**Phase 1 — normative contract first.** Apply §3 to `docs/Biography-Markup.md`
(1.2 → 1.3) and `docs/HTML-to-BioMD-Lite-Conversion-Guide.md`. Code must never
define undocumented syntax (`CLAUDE.md`).

**Phase 2 — parser.** §5.1 (a)–(g). `tsc` clean. No renderer change yet: `align`
and `nav` nodes will fall into `renderNode`'s existing branches only after
Phase 3, so land 2 and 3 together if a partial state would confuse review.

**Phase 3 — renderer + image contract.** §5.2 (a)–(f) and §5.3. `tsc` clean.

**Phase 4 — scoped CSS.** §5.4, append-only.

**Phase 5 — demo fixture & verification.** Create `pages/ru/biomd-demo.bio.md`
(+ `.bio.json`, + a temporary `index.json` row) covering the §6.3 case list;
reference existing remote media (e.g. `photo/b/barrios.jpg`) so images resolve
through the dev `/pages` proxy. Run the full verification pass. Decide whether to
keep the row (living conformance fixture) or drop it and keep the file.

**Phase 6 — documentation sync.** `.claude-memory/02-biomd-lite-format.md` (new
authoring forms) · `13-app-code-map.md` (new node kinds + frame variants) ·
`14-app-patterns-and-gotchas.md` (extend the "Add a BioMD block" recipe: scope new
CSS as `.bio-article .x`; note `frame:` vs `::: frame`) · `12-app-architecture.md`
+ `app/README.md` (recognised directives/properties). Mark this proposal
implemented; delete Plan A and Plan B.

**Phase 7 — optional, separate diff:** figure keyboard accessibility (`<button>`
for viewer actions, `<a>` for navigation, scoped reset class, visible focus) with
its own visual regression pass over all existing images.

**Estimated size:** ~110 lines TypeScript, ~95 lines CSS, 0 dependencies, 1 new
component, 1 new directive, 2 new properties.

---

## 8. Performance & risk

| Aspect | Impact |
|---|---|
| Parse | +2 switch cases (O(1) dispatch), one header/body splitter used only by `align`/`nav`, two enum lookups per image. Still linear in source lines; documents without the new syntax do **identical** work. |
| Markdown | The nav body reuses the already-loaded `react-markdown`; no second parser, no new remark/rehype plugin, `REMARK_PLUGINS` unchanged. |
| Render | `align` = one `<div>`; `nav` = one `<nav>` + an existing `Md` island; `frame` = one extra class string. No new state, effect, context or observer. |
| Bundle | No dependency; ~1–2 KB gzip of app code + CSS, inside the already-lazy codex/markdown chunks. Initial load unchanged. |
| CSS | Static, scoped selectors; no layout measurement. |
| Images | Same lazy loading, decoding, aspect ratio, paths and viewer. |
| Mobile | Pure CSS wrapping; no resize listener, carousel or overflow scripting. |

Explicitly avoided: a remark directive plugin, DOM post-processing, style-string
parsing, runtime colour computation, per-item nav state, JS menu measurement, a
generalised style DSL, a directive registry refactor.

| # | Risk | Mitigation |
|---|---|---|
| R1 | Unlayered CSS overriding article rules | All new selectors scoped + append-only + no `!important` (§5.4 notes) |
| R2 | **Nav items pointing outside `index.json` silently do nothing** (`App.tsx:90-96`) | Authoring rule in §3.4 now; optional `canNavigate` predicate (`App` → `CodexModal` → `BioArticle` → `Md`, ~10 lines) as a follow-up that also improves prose cross-links |
| R3 | `frame:` vs `::: frame` confusion | Explicit disambiguation in spec §6.5, memory note, conversion guide |
| R4 | `splitPropsAndBody` eating a body line that looks like a property | Header ends at the first blank or first non-property line; documented; `align`/`nav` bodies are prose/link lists |
| R5 | `image.link` opening an unsafe scheme | `isSafeTarget` at **parse** time → warn + drop; `rel="noopener noreferrer"` on external anchors |
| R6 | The 8 changed `alt` attributes | Intended, invisible, spec-compliant; called out in the commit message |
| R7 | Alignment abused to fake columns/margins | Spec MUST-NOT wording + conversion-guide mapping + `align` may not contain `columns` |
| R8 | No tests ⇒ silent regressions | §6.3 before/after pass; optional Vitest parser snapshot |

---

## 9. Deferred (do **not** bundle without a separate go-ahead)

| Gap | Where | Note |
|---|---|---|
| Figure keyboard a11y (`<button>`/`<a>` instead of `onClick` wrappers) | `BioArticle.tsx:118-127,163-166` | Phase 7 — touches every existing image |
| `::: frame` callout (`note`/`memorial`/`highlight`) | `parse.ts` `default:` | ~15 lines + CSS; `splitPropsAndBody` is already what it needs |
| `::: signature` | same | ~10 lines + CSS |
| `columns.divider` (spec §9) | `parse.ts:204-221` | Parsed then discarded |
| Silent `columns.slice(0, 3)` truncation | `parse.ts:220` | Contradicts "never delete content" — add a warning |
| Unknown-property warnings (spec §4) | `parseProps` | Would flood DEV for existing content until audited |
| Block-derived `src` scheme sanitisation | `Figure`, `DocumentCard` | `isSafeTarget` from §5.1(c) can be reused; do it as a security pass |
| Search/i18n/audio items from `.claude-memory/15` | — | Unrelated backlog |

---

## 10. Ideas explicitly rejected (from either plan or earlier drafts)

| Idea | Source | Why rejected |
|---|---|---|
| `::: center` / `::: right` / `::: left` as directive names | Plan B | Value-shaped names pollute a semantic namespace; `::: left` collides conceptually with image `position: left`; owner chose the property form |
| `::: align center` (positional argument) | Plan B appendix | Would widen `FENCE_OPEN`, changing open-fence detection and nesting depth for **every** directive — highest-risk change for cosmetic gain |
| `justify` value / `centre` alias | Plan B | Does not fit `position:`; poor for unhyphenated Cyrillic; alias is surface for nothing |
| Literal `frame: #rrggbb` | Plan B | Colour stays a theme decision; closed enum keeps palette and validation safe (owner decision) |
| Tailwind `text-center` utilities instead of semantic classes | Plan B | Cannot carry `clear`/child-margin rules cleanly; compound `.bio-align.text-center` selector was a wart |
| `align:` property on `::: nav` | Plan B | Speculative second way to express alignment; nav is centered by contract |
| Nav hover SFX | Plan B | Needs event delegation guesswork in the render path; add later if wanted |
| `role="tablist"` / `role="tab"` styling of nav | — | Items navigate to pages; they are links (Plan A's correct call) |
| Raw HTML (`<div style="text-align:center">`) | both | Forbidden by BioMD; would require `rehype-raw` and open XSS |
| Markdown attribute syntax (`{.center}`, `{align=center}`) | both | Not in the GFM pipeline; needs a plugin; exposes implementation classes |
| `::: menu` | both | `::: nav` already normative |
| `align:` on every existing directive | both | Duplicates rules across `lead`/`document`/`columns`/`frame`/`signature` and still cannot align a bare paragraph |
| Replacing the parser with a remark-directive plugin | both | High-risk refactor unrelated to the request |
| JS-measured single-line / carousel menu | both | Flex wrap is faster, more accessible, more robust on phones |
| Bundling the whole spec-drift backlog | both | Scope discipline — see §9 |

---

## 11. Definition of done

- [ ] `docs/Biography-Markup.md` is at **1.3** with §3's text; conversion guide updated.
- [ ] `::: align` renders `left`/`center`/`right`; missing/invalid `position` warns and renders at default alignment with content intact.
- [ ] An `align` block clears a preceding floated image and aligns both text and intrinsic-width block children.
- [ ] All 7 `frame` values render distinctly; absent `frame` produces markup identical to today; an unknown value warns and falls back.
- [ ] Group `frame` on `::: images` is inherited; a child value wins.
- [ ] `alt` is honoured with the `alt → caption → ""` fallback chain; `link` works for image / entry / external targets; an unsafe scheme is dropped with a warning.
- [ ] `::: nav` renders one centered pill bar of real links, `aria-current="page"` on a non-clickable active item, `.bio.md` items navigate in-codex, external items open safely, media targets stay plain links, no `role="tab"`.
- [ ] Nav wraps at 375 px with no page-level horizontal overflow; keyboard tab order and focus ring verified.
- [ ] `npx tsc -b` clean; no new dependency; codex/markdown chunks still lazy.
- [ ] The four float/columns-heavy existing pages are visually unchanged; the only content-facing delta is the 8 `alt` attributes.
- [ ] `.claude-memory/02/12/13/14` and `app/README.md` match the delivered behaviour; Plan A and Plan B deleted.

---

## 12. Author cheat sheet (also the skeleton of the Phase 5 fixture)

```md
# BioMD 1.3 demo

::: align
position: center

**Программа концерта** · Bach · Sor · Tárrega

:::

::: nav
title: Дискография
active: 1995–2002

- [1995–2002](jovan-jovicic.bio.md)
- [1989–1994](paco-de-lucia.bio.md)
- [Официальный сайт](https://example.org)
:::

::: image
src: photo/b/barrios.jpg
position: right
size: small
alt: Агустин Барриос с гитарой
caption: In an ornate frame
frame: ornate
:::

Ordinary prose wraps around the framed portrait exactly as before.

::: images
columns: 3
frame: mat

::: image
src: photo/b/barrios1.jpg
caption: Matted (inherited)
:::

::: image
src: photo/b/barrios2.jpg
frame: burgundy
caption: Overridden
:::

:::

::: align
position: right

*Харьков, 12 мая 1998 года*

:::
```
