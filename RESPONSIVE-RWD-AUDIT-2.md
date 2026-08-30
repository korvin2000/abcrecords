# Guitar Codex responsive/RWD audit

**Audit date:** 2026-08-21  
**Scope:** `app/` browse page, search, advanced search, Codex shell, BioMD article rendering, gallery, image viewer, tablature viewer, footer, and shared responsive foundations  
**Basis:** `todo-audit.md`, current repository documentation, current source, and a fresh local capture at six viewport shapes  
**Change policy:** audit and plan only; no application source was changed

## Executive verdict

The application has a strong and coherent desktop identity, good basic width containment, and no horizontal page overflow in any captured state. Its current responsive behavior is nevertheless **width-responsive rather than viewport-responsive**: components fit narrower widths, but the ceremonial heading, herald, search controls, modal chrome, and authored media retain too much vertical or semantic weight. On short laptops and phones, the interface therefore spends most of the first screen on framing rather than useful catalogue or article content.

The central failure is not “mobile needs one column.” Guitar Codex already avoids that simplistic pattern in several places. The problem is that independent components each make locally reasonable width changes while no shared compact-density or low-height policy governs the whole screen. The result is visually handsome containment with weak information density.

The most important observed outcomes are:

- At **1366 × 768**, the first catalogue card begins at `y = 562 px`; only about **50%** of it is visible.
- At **320 × 568**, the first card begins below the viewport at `y = 592 px`; **no catalogue result is visible**.
- At **768 × 1024**, the title jumps from one 90 px line to a **180 px two-line block** because of the discrete `md` font-size breakpoint.
- On a **390 × 844** Codex screen, the document header and tabs occupy roughly **297 px**, and article content begins at `y = 398 px`.
- A BioMD figure authored as `size: small` becomes a nearly full-width image on compact screens because figure size and float classes only start at `sm`.
- The advanced-search panel extends to about `y = 1097 px` and introduces an internal scroll region inside an already scrollable page.
- The application relies almost entirely on width breakpoints. It has no low-height, aspect-ratio, safe-area, dynamic-viewport, container-query, or coarse-pointer responsive policy.

### Recommended direction

Preserve the parchment/burgundy/gold codex aesthetic and the successful desktop reading experience. Add a small, explicit responsive layer with four orthogonal concerns:

1. **Compact width** controls horizontal arrangement.
2. **Low height/aspect** controls vertical ceremony and overlay chrome.
3. **Container size** controls BioMD layout semantics inside the Codex.
4. **Pointer capability** controls target size and hover-only behavior.

This is primarily a CSS/layout task. It does not require a redesign, routing change, data-model change, or broad component rewrite.

## Audit conditions and evidence limits

- Screenshots were captured from the current local Vite build in headless Microsoft Edge.
- Stable captures emulated `prefers-reduced-motion: reduce`; motion behavior was also inspected statically in source, but animation timing is not evaluated by the screenshots.
- The current `pages/index.json` exposes only one catalogue record, so live evidence cannot demonstrate a dense multi-card catalogue or long-language result set. Scaling recommendations are marked conditional where appropriate.
- The available Russian article fixture currently contains project-author content under the Agustin Barrios route and includes missing gallery assets. Those are content/data anomalies, not responsive-layout findings, and are intentionally not treated as RWD defects.
- Contrast values below are calculated from design tokens against the nominal paper token. Text over gradients, imagery, focus visibility, keyboard sequence, and real mobile browser chrome still require hands-on verification.
- The audit does not claim WCAG conformance. It identifies concrete accessibility risks visible in source and captures.

## Current state worth keeping

The following foundations are working and should remain recognizable after responsive work:

- The parchment surfaces, burgundy accents, restrained gold, ornamental corners, serif hierarchy, and double-frame treatment establish the intended scholarly/historical character.
- The wide layout is calm and symmetrical, with a useful reading measure (`max-w-3xl`) inside a broader catalogue shell.
- The card grid already uses two columns on compact screens rather than collapsing immediately to one oversized card.
- Tables and preformatted BioMD content have local horizontal containment, avoiding whole-page overflow.
- The Codex has an inset scrolling region and body-scroll locking instead of turning the entire document into an uncontrolled overlay.
- Native form controls remain in use, providing a sound interaction baseline.
- The gallery’s two-column compact layout is efficient and visually appropriate.
- Reduced-motion handling exists, and card motion is not essential to comprehension.
- Across every captured state, `scrollWidth` equalled `clientWidth`; responsive changes should preserve that result.

## Captured flow and visual findings

### Measurement summary

| Step | State | Key measurement | Health |
|---:|---|---|---|
| 1 | Browse, 1440 × 900 | Grid starts `y 562`; card `262 × 413`; 82% visible | Good desktop foundation; density needs work |
| 2 | Browse, 1366 × 768 | Grid starts `y 562`; only 50% of first card visible | Critical low-height issue |
| 3 | Browse, 768 × 1024 | Title height jumps to `180`; grid starts `y 652` | Needs work |
| 4 | Browse, 390 × 844 | Grid starts `y 592`; 82% of card visible | Needs work |
| 5 | Browse, 320 × 568 | Grid starts `y 592`; 0% of card visible | Critical compact/short issue |
| 6 | Advanced search, 390 × 844 | Panel bottom `y 1097`; `606 px` client / `728 px` scroll | Critical nested-scroll issue |
| 7 | Codex article, 390 × 844 | Header `180`; tabs `73`; article starts `y 398` | Needs work |
| 8 | BioMD content, 390 × 844 | Authored-small figure expands to article width | Critical semantic-layout issue |
| 9 | Scrolled Codex, 844 × 390 | Full close label and arrows occupy low-height reading area | Critical low-height overlay issue |
| 10 | Gallery, 390 × 844 | Efficient two-column media grid below heavy chrome | Mixed; grid is good |
| 11 | Image viewer, 390 × 844 | Toolbar `373 px` wide; seven `36 × 36` controls | Needs work |

All measurements are stored in `audit-evidence/responsive-rwd/measurements.json`.

### 1. Wide browse — good visual baseline, excessive pre-result stack

![Wide browse at 1440 by 900](audit-evidence/responsive-rwd/01-browse-wide-1440x900.png)

The visual balance, palette, card scale, and grid rhythm are strong. However, title, herald, search, result count, and surrounding margins place the first card at `y = 562 px`, so even a 900 px-high desktop does not show one complete card. This is acceptable as a ceremonial landing treatment only if it collapses after the first visit or adapts to height; it is too costly as the persistent catalogue state.

### 2. Short laptop browse — critical information-density failure

![Laptop browse at 1366 by 768](audit-evidence/responsive-rwd/02-browse-laptop-1366x768.png)

The page looks composed and does not overflow, but only half a result is visible. The viewport is wide enough for four cards and therefore receives the full desktop ceremony, even though its height is insufficient. This is the clearest evidence that width breakpoints alone cannot describe the layout.

### 3. Tablet portrait browse — breakpoint-induced title regression

![Tablet browse at 768 by 1024](audit-evidence/responsive-rwd/03-browse-tablet-768x1024.png)

At the `md` boundary, the title becomes `text-7xl`; its two words wrap into two 90 px lines. The resulting 180 px title block pushes the catalogue below `y = 652 px`. A fluid title would be both more stable and more elegant than the current discrete jump.

### 4. Standard phone browse — fits, but spends too much of the screen on framing

![Phone browse at 390 by 844](audit-evidence/responsive-rwd/04-browse-phone-390x844.png)

The two-column card grid is the right choice and does not overflow. The first result nevertheless begins around 70% down the viewport. Search chips are visually compact but fall below robust coarse-pointer target guidance.

### 5. Short phone browse — no result visible

![Short phone browse at 320 by 568](audit-evidence/responsive-rwd/05-browse-phone-short-320x568.png)

The complete first screen is title, herald, and search. A user who has already arrived at a one-result catalogue receives no visible confirmation of that result. This must be treated as a P0 functional-density problem, not merely a preference about whitespace.

### 6. Advanced search — contained horizontally, fragmented vertically

![Advanced search on a 390 by 844 phone](audit-evidence/responsive-rwd/06-advanced-phone-390x844.png)

The panel remains readable and uses one-column fields appropriately. Its absolute dropdown model, `72vh` cap, and internal overflow create a second scroll owner; the bottom of the panel is far below the current viewport. On a device with a soft keyboard, this will become more fragile. Compact screens need either an in-flow disclosure or a true visual-viewport sheet with one explicit scroll owner.

### 7. Initial Codex article — attractive shell, oversized chrome

![Codex article on a 390 by 844 phone](audit-evidence/responsive-rwd/07-codex-phone-390x844.png)

The shell preserves the visual identity successfully. The 180 px header, two-row 73 px tab strip, controls, and inset offsets delay article content until `y = 398 px`. Several tab and navigation controls are also below a 44 px coarse-pointer target.

### 8. Scrolled BioMD article — authored media intent is lost

![BioMD content on a 390 by 844 phone](audit-evidence/responsive-rwd/08-biomd-content-phone-390x844.png)

The source declares the opening figure as `size: small` and `position: right`, but compact CSS removes both constraints and `Figure` adds `w-full`. The image therefore dominates the reading viewport. Responsive design may cancel an unsafe float; it should not erase an author’s size intent.

### 9. Scrolled low-height landscape Codex — controls compete with content

![Scrolled Codex in 844 by 390 landscape](audit-evidence/responsive-rwd/09-codex-landscape-844x390.png)

This is a scrolled reading state, not the initial top of the document. Width rules select the full “close Codex” label because 844 px is wide, while the viewport is only 390 px high. Persistent arrows and top controls occupy or overlap the already constrained reading area. Low-height/aspect rules should switch this shell to an icon-only, opaque control shelf and reduce top/bottom insets.

### 10. Gallery — compact grid works; shared Codex chrome remains the bottleneck

![Gallery on a 390 by 844 phone](audit-evidence/responsive-rwd/10-gallery-phone-390x844.png)

The two-column gallery is a successful compact pattern and should be retained. The main issue is inherited shell density above it. Blank image states in this fixture are missing-content behavior, not a grid defect.

### 11. Image viewer — usable composition, fragile control strip

![Image viewer on a 390 by 844 phone](audit-evidence/responsive-rwd/11-image-viewer-phone-390x844.png)

The image and caption are well framed. Seven 36 px controls consume 373 of 390 px, leaving almost no tolerance for a narrower viewport, safe-area inset, localization, or zoom. `touch-none` suppresses native gestures, while the implementation does not provide two-pointer pinch; figures and viewer controls also need keyboard/focus work.

## Detailed findings and recommended solutions

### F01 — The browse page has no shared vertical-density budget

**Severity:** P0  
**Affected:** `app/src/App.tsx:218`, `app/src/App.tsx:260-299`, `app/src/components/AnimatedTitle.tsx:33-109`, `app/src/components/SearchBar.tsx:62-148`, `.herald-banner` and related rules in `app/src/index.css:402-588`

The fixed header offset, title block, divider, herald margins/minimum height, search margin/padding, filter rows, result count, and `mt-10` before the grid accumulate independently. None is egregious alone; together they place useful content below the first screen.

Introduce shared section-gap and compact-density tokens rather than shaving arbitrary pixels from isolated components:

```css
:root {
  --catalogue-section-gap: clamp(1rem, 2.5dvh, 2.25rem);
  --catalogue-ceremony-scale: 1;
}

@media (max-width: 40rem), (max-height: 55rem) {
  :root {
    --catalogue-section-gap: clamp(0.65rem, 1.7dvh, 1rem);
    --catalogue-ceremony-scale: 0.78;
  }
}
```

Apply these values to the title-to-herald, herald-to-search, and search-to-grid relationships. Keep separate component styling, but make the page own the overall budget.

**Acceptance targets:**

- At 320 × 568, start the first card at or above `y = 500 px`, showing at least a meaningful portion of a result.
- At 390 × 844, show one complete card without scrolling.
- At 1366 × 768, show at least one complete card; target grid start around `y = 330-380 px`.
- Preserve the existing 1440 × 900 desktop character rather than flattening the ceremony everywhere.

### F02 — Discrete title typography creates an unstable tablet boundary

**Severity:** P0  
**Affected:** `app/src/components/AnimatedTitle.tsx:55-109`

`text-4xl sm:text-6xl md:text-7xl` jumps sharply at 768 px, while each word is `whitespace-nowrap`. The exact tablet breakpoint becomes worse than the narrower phone.

Use a fluid cap and a compact line-height instead of a three-step jump:

```css
.catalogue-title {
  font-size: clamp(2.35rem, 6.2vw, 4.5rem);
  line-height: 0.94;
  letter-spacing: clamp(0.02em, 0.35vw, 0.06em);
}

@media (max-height: 42rem) {
  .catalogue-title { font-size: clamp(2rem, 7.5vh, 3.25rem); }
}
```

Retain non-breaking individual words, but allow the title container and spacing to interpolate smoothly. The volume label’s `0.5em` tracking should also reduce on compact widths.

### F03 — The card grid responds to width but not to useful viewport area

**Severity:** P0 for short desktop; P2 for catalogue-scale rendering  
**Affected:** `app/src/components/CharacterGrid.tsx:50-74`, `app/src/components/CharacterCard.tsx:121-189`, `app/src/App.tsx:370`

The fixed `2 / 3 / 4` column model is reasonable by width, but a 1366 × 768 screen receives four portrait cards around 413 px tall and cannot show one fully. Use height only as a modifier, not as a second breakpoint matrix:

```css
.catalogue-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(0.75rem, 2vw, 1.5rem);
}

@media (min-width: 40rem) {
  .catalogue-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 64rem) {
  .catalogue-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (min-width: 64rem) and (max-height: 55rem) {
  .catalogue-grid {
    max-width: 80rem;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 1rem;
  }
}
```

Do not shorten cards by arbitrarily cropping portraits. First reduce the pre-grid stack, then add a low-height wide-grid mode. If production returns to the intended large catalogue, render an initial batch (roughly 24-40 cards) and reveal more with `IntersectionObserver`; do not add virtualization until measured.

### F04 — Search facets trade density for undersized interactions

**Severity:** P1  
**Affected:** `app/src/components/SearchBar.tsx:62-148`, `app/src/components/Chip.tsx:33`, `app/src/components/AdvancedSearchPanel.tsx:65`

Quick facets wrap into additional lines, yet individual chips remain smaller than robust touch targets. Compressing the text further would worsen accessibility.

On compact screens, keep the primary query field full width and turn optional facets into a single horizontal rail or a compact disclosure. Preserve every filter rather than hiding functionality:

```css
.quick-facets {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  scroll-snap-type: inline proximity;
}

@media (pointer: coarse) {
  .chip,
  .advanced-toggle { min-height: 2.75rem; }
}
```

Use a visual fade/edge cue so the rail does not look accidentally clipped. At medium widths the current wrapped layout can remain.

### F05 — Advanced search has two competing scroll owners

**Severity:** P0  
**Affected:** `app/src/components/SearchBar.tsx:109-121`, `.search-panel` in `app/src/index.css:237-276`, `app/src/components/AdvancedSearchPanel.tsx`

The absolute panel is capped at `min(72vh, 40rem)` and internally scrolls. On the captured phone it begins at `y = 489 px`, extends below `y = 1096 px`, and has more scrollable content than its own client box. A software keyboard reduces the usable visual viewport again.

Recommended behavior:

- Below 40rem, render advanced controls **in normal document flow** beneath the basic search, using the page as the single scroll owner.
- If product behavior requires a sheet, make it a real fixed sheet anchored to the visual viewport, with its own heading, close action, focus management, and body inertness.
- Provide a `vh` fallback followed by `dvh`; subtract safe-area and keyboard-sensitive chrome.

```css
.search-panel { max-height: min(72vh, 40rem); }
@supports (height: 100dvh) {
  .search-panel { max-height: min(72dvh, 40rem); }
}

@media (max-width: 40rem) {
  .search-panel {
    position: static;
    max-height: none;
    overflow: visible;
  }
}
```

### F06 — Header controls lack safe-area and input-capability rules

**Severity:** P0  
**Affected:** `app/index.html`, `app/src/App.tsx:218-365`, `app/src/components/LanguageMenu.tsx:70-141`, `app/src/index.css:86`

The document opts into `viewport-fit=cover`, but no CSS consumes `env(safe-area-inset-*)`. Header controls are 36 px square and language-menu rows are approximately 32 px high. `overflow-x: hidden` prevents a symptom from appearing but would also conceal future header overflow.

```css
:root { --app-header-height: 3.5rem; }

.app-header {
  min-height: var(--app-header-height);
  padding-top: env(safe-area-inset-top, 0px);
  padding-inline:
    max(0.5rem, env(safe-area-inset-left, 0px))
    max(0.5rem, env(safe-area-inset-right, 0px));
}

@media (pointer: coarse) {
  .header-control,
  .language-option { min-width: 2.75rem; min-height: 2.75rem; }
}
```

At widths below roughly 22rem, truncate or hide the decorative header brand before compressing core controls. Derive main padding from the header token so header height and content offset cannot drift apart.

### F07 — Codex chrome is positioned independently of readable content

**Severity:** P0  
**Affected:** `app/src/components/CodexShell.tsx:129-191`, `app/src/components/CodexHeader.tsx:27-47`, `app/src/components/CodexTabs.tsx:31-42`, `app/src/components/BiographyView.tsx:73`

At compact width the Codex header and wrapped tabs use nearly 300 px before the article. In landscape, width-based `sm` behavior expands the close control label even though height is scarce. The absolutely positioned controls also need a visibly opaque shelf so scrolled text never competes with them.

Recommended shell structure:

- Keep the inset scrollbar and body lock.
- Create one top control shelf that owns language, previous/next, and close.
- Make the shelf sticky or fixed inside the dialog with an opaque paper background and explicit stacking context.
- Reserve its height in the scroll pane rather than relying on unrelated `pt-*` values.
- Use icon-only close/navigation at low height, regardless of width.
- Reduce header plate height with fluid typography, not indiscriminate scaling.
- Keep tabs on one horizontal scroll row on very small containers, or use a compact equal-width grid; do not allow an accidental two-line wrap.

```css
@media (max-height: 32rem), (min-aspect-ratio: 3 / 2) and (max-height: 36rem) {
  .codex-control-label { display: none; }
  .codex-header { margin-block-end: 0.65rem; }
  .codex-scroll-pane { padding-block-start: var(--codex-shelf-height); }
}
```

Use `max-height: 94vh; max-height: 94dvh;` for progressive enhancement, and include all four safe-area insets in the outer overlay.

### F08 — BioMD size semantics disappear below `sm`

**Severity:** P0  
**Affected:** `app/src/components/BioArticle.tsx:245-268`, `app/src/components/BioArticle.tsx:334-358`, current source fixture `pages/ru/agustin-barrios.bio.md:1-11`

`SIZE_CLASS` and `FLOAT_CLASS` apply only at `sm`, while every figure receives `w-full`. It is correct to cancel a float when the text column is too narrow, but the declared size should survive.

Separate size from position:

```css
.bio-article { container-type: inline-size; }

.bio-figure[data-size="small"]  { width: min(12.5rem, 55cqi); }
.bio-figure[data-size="medium"] { width: min(20rem, 78cqi); }
.bio-figure[data-size="large"]  { width: min(28.75rem, 100cqi); }
.bio-figure { margin-inline: auto; }

@container (min-width: 32rem) {
  .bio-figure[data-position="right"] {
    float: right;
    margin: 0.25rem 0 1rem 1.5rem;
  }
  .bio-figure[data-position="left"] {
    float: left;
    margin: 0.25rem 1.5rem 1rem 0;
  }
}
```

This preserves source fidelity and lets the actual article container—not the device viewport—decide whether floating is readable.

### F09 — BioMD columns and image groups use viewport thresholds for local layout

**Severity:** P1  
**Affected:** `.bio-columns` in `app/src/index.css:1327-1355`, `app/src/components/BioArticle.tsx:263-268`, `app/src/components/BioArticle.tsx:407`

At 48rem viewport width, authored two-, three-, and four-column blocks all activate simultaneously. A four-column block can therefore receive tracks near 160 px inside the narrower article frame. Image groups use the same `sm`-based 2/3/4 model.

Use container queries with content-driven thresholds:

```css
.bio-columns,
.bio-image-group { container-type: inline-size; }

.bio-image-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(9rem, 100%), 1fr));
}

@container (min-width: 36rem) {
  .bio-columns[data-columns="2"] { grid-template-columns: repeat(2, 1fr); }
}
@container (min-width: 54rem) {
  .bio-columns[data-columns="3"] { grid-template-columns: repeat(3, 1fr); }
}
@container (min-width: 72rem) {
  .bio-columns[data-columns="4"] { grid-template-columns: repeat(4, 1fr); }
}
```

When a four-column source block lacks space, render two columns rather than four unreadable strips. This is graceful adaptation, not a change to document order.

### F10 — Compact article typography remains at desktop measure and rhythm

**Severity:** P1  
**Affected:** `.bio-article` and headings in `app/src/index.css:861-902`, blockquotes/verse in `app/src/index.css:950-980`, frames in `app/src/index.css:1365-1370`

The article keeps `1.13rem / 1.75` body type, a 2rem tracked title, generous block spacing, and `1.1rem 1.4rem` frame padding at every width. It is readable, but it makes compact reading feel slower and compounds the large shell.

Use modest fluid values:

```css
.bio-article {
  font-size: clamp(1.02rem, 0.98rem + 0.25cqi, 1.13rem);
  line-height: clamp(1.58, 1.52 + 0.12cqi, 1.75);
}

.bio-title {
  font-size: clamp(1.55rem, 1.25rem + 2cqi, 2rem);
  letter-spacing: clamp(0.07em, 0.4cqi, 0.14em);
}

.bio-frame { padding: clamp(0.75rem, 2.5cqi, 1.1rem) clamp(0.8rem, 3cqi, 1.4rem); }
```

Do not reduce the wide reading measure or desktop font size; compact the rhythm only where the container requires it.

### F11 — Several content rows have fixed horizontal assumptions

**Severity:** P1  
**Affected:** `app/src/components/GalleryTab.tsx`, `app/src/components/DocumentsTab.tsx`, `app/src/components/LoreTab.tsx:104`, document cards in `app/src/components/BioArticle.tsx:484`

Document/media rows place icon, metadata, and actions on one horizontal line. Lore rows reserve a fixed `w-32` (128 px) label inside an article content width near 318 px. These layouts do not overflow today but leave weak space for long German/Russian labels and values.

- Replace fixed lore widths with `grid-template-columns: minmax(5.5rem, 35%) minmax(0, 1fr)` at medium containers, and stack label above value below about 20rem.
- Let document metadata use `min-width: 0`, wrap deliberately, and move the secondary action below or make the whole row the primary activation target on compact screens.
- Preserve the gallery’s successful two-column compact layout.

### F12 — Viewer and tablature controls are too dense for touch and low height

**Severity:** P1  
**Affected:** `app/src/components/ImageViewer.tsx:152-257`, `app/src/components/AsciiTabViewer.tsx:100-205`, `app/src/components/AsciiTabViewer.tsx:510`

The image viewer uses seven 36 px controls in a nearly full-width row. It sets `touch-none`, but implements one-pointer pan and double-click rather than true pinch. Tablature controls are as small as 28 px and can wrap into a tall toolbar within a `96vh` dialog.

- Use `44 px` minimum targets under `(pointer: coarse)`; visual glyphs may remain smaller.
- Allow the image toolbar to form a deliberate 4+3 grid, a horizontally scrollable control rail, or grouped rows below about 24rem.
- Either implement a real two-pointer pinch recognizer or permit the native gesture where it does not conflict with panning.
- In the tablature viewer, group secondary controls into a menu or horizontal rail in low-height mode rather than letting wrapping consume the reading pane.
- Replace `vh` caps with `vh` + `dvh` progressive enhancement and safe-area padding.

### F13 — Dialog and media interactions have keyboard/focus gaps

**Severity:** P1  
**Affected:** `app/src/components/CodexShell.tsx`, `app/src/components/ImageViewer.tsx`, `app/src/components/AsciiTabViewer.tsx`, interactive figures in `app/src/components/BioArticle.tsx:196-208` and `334-358`, `app/src/components/GalleryTab.tsx:46-64`

The overlays declare dialog semantics but do not establish a complete focus lifecycle in the inspected source: initial focus, focus containment, background inertness, and focus restoration need explicit handling. Figures are clickable through mouse handlers but do not consistently provide a semantic button, keyboard activation, or focus style.

- Use real buttons around interactive thumbnails/figures, preserving `figure` and caption semantics.
- On open, focus a meaningful dialog control; trap focus inside; set the background inert; restore focus to the invoker on close.
- Keep Escape support and add visible `:focus-visible` treatment that meets the codex visual language.
- Make swipe/pan enhancements supplementary; every operation must remain available by button and keyboard.

### F14 — Some small-text color pairings are marginal

**Severity:** P1 verification item  
**Affected:** compact labels, metadata, chips, decorative navigation using sepia/gold tokens

Calculated token-pair contrast against nominal `paper-100`:

| Pair | Approximate ratio | Interpretation |
|---|---:|---|
| `ink-900` / `paper-100` | 14.41:1 | Strong |
| `sepia-600` / `paper-100` | 6.75:1 | Strong for normal text |
| `sepia-500` / `paper-100` | 3.99:1 | Too weak for normal small text |
| `gold-700` / `paper-100` | 4.28:1 | Marginal below 4.5:1 |
| `gold-600` / `paper-100` | 2.52:1 | Decorative only unless large/nonessential |
| `burgundy-600` / `paper-100` | 8.66:1 | Strong |

Small labels around `0.58-0.7rem` should use at least the stronger sepia/burgundy token. Keep lighter gold for ornaments, rules, and non-text decoration. Recheck the actual rendered gradient backgrounds with an accessibility tool before implementation sign-off.

### F15 — Responsive policy is scattered between Tailwind and one large stylesheet

**Severity:** P2  
**Affected:** `app/src/index.css` (currently about 1,642 lines) and component-local Tailwind classes

The issue is not that both techniques exist. The problem is that global shell density, component density, and BioMD content behavior have no named ownership boundary. Avoid a broad stylesheet rewrite. Add a small responsive layer and semantic hooks such as `.catalogue-shell`, `.catalogue-grid`, `.codex-control-shelf`, and data attributes for authored BioMD semantics. Keep local one-off composition in Tailwind.

## Proposed responsive strategy

### Compact containers: below 40rem

- Keep the two-column catalogue grid.
- Reduce ceremonial vertical gaps and fluidly cap the title; do not merely scale the entire UI down.
- Keep the basic search visible and make secondary facets a discoverable rail/disclosure.
- Put advanced search in document flow, or make it a complete modal sheet.
- Preserve authored image size; cancel floats until the article container is wide enough.
- Use compact Codex header typography and one-row tabs.
- Stack only rows that genuinely cannot express their hierarchy horizontally.
- Guarantee 44 px minimum targets for coarse pointers.

### Medium containers: 40rem to 63.999rem

- Use three catalogue columns.
- Keep the title fluid so 768 px does not create a new two-line extreme.
- Use two-column form/media structures where individual controls retain useful width.
- Let article container size—not viewport size—activate floats and columns.
- Preserve more of the ceremonial spacing when height allows it.

### Wide containers: 64rem and above

- Preserve the existing four-column presentation and desktop visual identity by default.
- Add one low-height modifier at approximately `max-height: 55rem`: compress vertical ceremony, consider five catalogue columns, and reduce overlay chrome.
- Keep the wide Codex reading measure and ornamental framing.

### Low-height and landscape, independent of width

- Treat height below roughly 32-36rem as a control-density mode.
- Use icon-only shell controls, a single control shelf, tighter header/footer insets, and `dvh` sizing.
- Do not infer “desktop” from 844 px width when only 390 px of height is available.
- Keep controls opaque and outside the content’s visual path.

### Component containers, not device taxonomies

- Use viewport queries for truly global chrome: application header, page shell, full-screen dialogs.
- Use container queries for BioMD columns, figures, grouped images, document rows, and article typography.
- Use pointer/hover queries for target sizing and hover effects.
- Avoid JavaScript resize state for layout. JavaScript may support interaction mechanics, not duplicate CSS breakpoint logic.

## Prioritized implementation roadmap

| Priority | Work package | Impact | Effort | Risk | Dependencies / notes |
|---|---|---:|---:|---:|---|
| P0.1 | Add fluid title and page-owned vertical spacing tokens | High | Low | Low | Establish measurable grid-start targets first |
| P0.2 | Add the low-height wide catalogue mode | High | Low-Medium | Medium | Tune with 1366 × 768 and 1440 × 900 together |
| P0.3 | Build a Codex control shelf and low-height chrome mode | High | Medium | Medium | Preserve inset scroll/body-lock invariants |
| P0.4 | Preserve BioMD figure size independently from float | High | Medium | Low-Medium | Requires semantic class/data hooks, not parser changes |
| P0.5 | Add safe-area padding and coarse-pointer targets to global header | High | Low | Low | Validate long language labels |
| P0.6 | Remove compact advanced-search nested scrolling | High | Medium | Low-Medium | Choose in-flow disclosure unless a true sheet is required |
| P1.1 | Convert Codex height caps to `vh` + `dvh`; compact header/tabs | High | Medium | Medium | Test phone landscape and soft keyboard |
| P1.2 | Move BioMD columns/groups to container-driven thresholds | Medium-High | Medium | Medium | Test 2/3/4 authored layouts, including nested frames |
| P1.3 | Tune compact article type, frames, verse, and block spacing | Medium | Low | Low | Do not change desktop reading measure |
| P1.4 | Fix media/dialog semantics, focus lifecycle, pinch/touch controls | High | Medium | Medium | Keyboard and real-device validation required |
| P1.5 | Adapt lore, document, and media rows for narrow containers | Medium | Low-Medium | Low | Include RU/DE long-content fixtures |
| P1.6 | Verify and strengthen small-label contrast | Medium | Low | Low | Test rendered gradients, not tokens alone |
| P2.1 | Consolidate new rules into a bounded responsive layer | Medium | Medium | Medium | No wholesale Tailwind/CSS migration |
| P2.2 | Polish footer density and tablature low-height toolbar | Medium | Low-Medium | Low | Keep footer as colophon, not primary navigation |
| P3 | Add incremental card reveal if/when the full catalogue returns | High at scale | Medium | Medium | Current one-record fixture cannot justify virtualization |

### Recommended sequencing

1. Record the baseline measurements from this audit as manual acceptance targets.
2. Implement P0.1 and P0.2 together; they solve the browse-page density without changing its identity.
3. Implement P0.3, P0.5, and P1.1 as one shell pass so safe areas, dynamic height, and control placement share the same geometry.
4. Implement P0.4 before broader BioMD container work; it repairs source fidelity with limited blast radius.
5. Resolve advanced-search scroll ownership, then tune facets and form density.
6. Add container-driven columns, groups, type, and row adaptations.
7. Complete keyboard/focus/touch and contrast verification across all overlays.
8. Consolidate only the new responsive rules; avoid unrelated restyling.

## Validation matrix and acceptance criteria

### Required viewports

| Viewport | Primary proof |
|---|---|
| 320 × 568 | First result partly visible; no compressed/hidden core controls |
| 390 × 844 | One complete catalogue card; advanced search has one scroll owner |
| 768 × 1024 | No 180 px title regression; three-column grid remains legible |
| 844 × 390 | Codex uses low-height chrome; article is not obscured by controls |
| 1366 × 768 | At least one full catalogue card visible |
| 1440 × 900 | Existing desktop balance and visual identity remain intact |

### Cross-cutting checks

- No whole-page horizontal overflow at any target viewport.
- `viewport-fit=cover` screens respect all relevant safe-area insets.
- Every coarse-pointer primary control has at least a 44 × 44 px activation area.
- Opening advanced search, Codex, image viewer, or tablature viewer yields one intentional scroll owner.
- Dialog focus starts inside, cannot escape to inert background content, and returns to the invoker.
- Every clickable figure is keyboard-operable and has visible focus.
- A source-authored `small` figure remains visually small on compact screens even when its float is cancelled.
- BioMD 2/3/4-column blocks adapt to their actual container and retain source order.
- Tables and preformatted content remain locally scrollable without widening the page.
- Test English, Russian, and German labels, including long names and filter values.
- Test browser zoom at 200%, `prefers-reduced-motion`, keyboard-only navigation, touch/coarse pointer, and at least one real iOS and Android browser.
- Test an on-screen keyboard while using search and advanced filters.

## Things not to change

- Do not replace the parchment, burgundy, restrained gold, serif typography, ornamental corners, or double-border Codex language.
- Do not flatten the wide experience into a generic mobile-first dashboard.
- Do not make “mobile” synonymous with one column or with globally smaller text and controls.
- Do not shrink touch targets to recover density; recover density from ceremonial gaps, wrapping, and control grouping.
- Do not alter BioMD source order or discard authored size/column semantics.
- Do not replace the tolerant BioMD parser as part of this work.
- Do not remove the Codex inset scroll area or its body-scroll lock; make their geometry explicit.
- Do not remove table/pre overflow containment or replace native form controls without a concrete need.
- Do not crop portrait photography to a shorter ratio merely to force a card above the fold.
- Do not introduce a large device-specific breakpoint matrix, JavaScript-driven responsive rendering, or a broad CSS-framework migration.
- Do not hide substantive catalogue, filter, article, or media content merely to satisfy an above-the-fold metric.
- Do not mix the existing content/asset anomalies into the responsive implementation scope.

## Final assessment

Guitar Codex does not need a visual redesign. It needs a responsive composition system that understands height, container context, authored document semantics, safe areas, and input capability. The current implementation supplies a good aesthetic and containment baseline; the proposed P0 work changes where space is spent, not what the product is. If the first pass delivers fluid ceremony, a low-height mode, a coherent Codex control shelf, source-faithful figure sizing, and single-owner compact scrolling, the largest usability failures will be resolved with limited architectural risk.
