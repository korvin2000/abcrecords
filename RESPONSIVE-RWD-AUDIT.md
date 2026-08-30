# Responsive Web Design Audit — `app/` (Guitar Codex · Кодекс Гитаристов)

**Composite edition.** Merged from four independent audits (A1–A4) of the same
codebase, reconciled against each other, with conflicts resolved or flagged.

> **Brief:** make the app substantially more usable and information-dense on
> phones, tablets, narrow windows and low-height displays **without changing its
> visual language, desktop appearance, content model or architecture**.
>
> **Status:** analysis and planning only. No application file was changed.
> see also '\AWD-RWD-Guide.md' Guide and FAQ

---

## 0 · How to read this document

### Provenance legend

| Tag | Meaning |
|---|---|
| **⬤⬤⬤⬤** | Measured independently by all four audits, numbers agree |
| **⬤⬤⬤** | Three audits agree |
| **⬤⬤** | Two audits agree |
| **⬤** | Single-source finding, uncorroborated — verify before acting |
| **⚠ conflict** | Audits disagree; resolution given inline |
| **✎ validated** | Fix was simulated live in the DOM and re-measured |
| **✎ projected** | Effect is derived from the baseline, not simulated |

Source audits are cited as `[A1]`…`[A4]`. Where a number differs between
sources, the reconciled value is given with the reasoning.

### What each source contributed

| | Strength harvested |
|---|---|
| **A4** | Runtime/interaction evidence: 16 routes opened, keyboard pass, 20px width scan 280–1920, 125/150/200% zoom. Three functional P0 bugs. The most coherent baseline table. WCAG precision. |
| **A1** | Implementation craft: drop-in diffs with before/after class strings, exact line deletions, validated simulations, the CSS-layering blocker, sequencing constraints, the drag-test protocol. |
| **A3** | Micro-correctness: the `container-type` stacking-context footgun, the `.btn-rpg` `position` footgun, the inert table scroller, the `47.999rem` polarity flip, `cqi`-based type. |
| **A2** | Accessibility beyond layout: focus lifecycle, dialog inertness, contrast token table, the per-viewport validation matrix, explicit evidence-limit discipline. |

---
## 0. Introduction
A modern production approach is almost never “pure AWD” or “pure RWD.” In practice, a fluid/intrinsic RWD as the base layer + local discrete switch transitions + container queries is more stable.


## 1 · Executive summary

The app has a coherent, well-documented visual system and an effective wide
composition. It is not broken in the ordinary sense — there is no document-level
horizontal overflow at any viewport ≥ 320px. Three defect classes dominate:

**A. Vertical economics.** The furniture is a fixed-size object the content must
fit around. The distance from the top of the document to the first catalogue
card is **≈ 597–692px at every viewport tested**, from a 280px phone to a 1920px
desktop. It never compresses. At 360×640 and below, **zero cards intersect the
viewport**. Inside the codex the same pattern repeats: at 844×390 the article
begins at y≈373 inside a pane that ends at y≈354 — **the reader opens a
biography and sees no words of it**.

**B. Two functional bugs that outrank density.** Fixed header controls extend
past the viewport below ~315px, and modal dialogs neither take focus, trap it,
nor make the covered page inert — 40 background controls stay tabbable behind an
open codex, and the arrow keys expected to move between tabs instead turn
catalogue entries.

**C. Architectural preconditions.** ~1500 lines of unlayered component CSS
outrank every Tailwind utility, including every responsive one; there is no
fluid scale, no container query, no height query, no pointer query, and no
`dvh`/`svh` anywhere.

The correct intervention is a CSS-first compression pass plus narrowly scoped
interaction-accessibility corrections. No redesign, no routing change, no
content-model change, no new dependency, no JavaScript-driven layout.

---

## 2 · Evidence reconciliation

The four audits measured the same repository and disagree. Most of the
divergence is explained; the rest must be settled before any acceptance target
is frozen.

### 2.1 Corroborated facts

| Fact | A1 | A2 | A3 | A4 | Confidence |
|---|---|---|---|---|---|
| Codex @390×844: plate `180` / tabs `73` (2 rows) / article top `y=398` | tabs 72 @375 | 180/73/398 | 180/73/398 | 180/73/398 | ⬤⬤⬤⬤ |
| Codex @844×390: article top `y≈373`, zero lines visible | y=373 | — | chrome 301 = 95 % of pane | y≈373, pane ends 354 | ⬤⬤⬤ |
| `.form-ink` computes to **15.2px** across **7** controls → iOS focus zoom | ✓ | ✓ | ✓ | ✓ | ⬤⬤⬤⬤ |
| `viewport-fit=cover` declared, `env(safe-area-inset-*)` used **zero** times | ✓ | ✓ | ✓ | ✓ | ⬤⬤⬤⬤ |
| `vh` used for all full-height surfaces; `dvh`/`svh` used **zero** times | 5 sites | ✓ | 6 sites | ✓ | ⬤⬤⬤⬤ |
| Footer ≈ **880px** on a 320–375px phone | 881 @375 | — | 882 @320 | qualitative | ⬤⬤ |
| **81 ×** `sm:`, 1 real `md:`, 5 `lg:`, 0 `xl:` | ✓ | — | ✓ | ✓ (prose) | ⬤⬤ |
| Ad-hoc CSS breakpoints at `index.css:274, 584, 755, 1351` (+ `1338`) | ✓ | — | ✓ | ✓ | ⬤⬤⬤ |
| `clamp()` count in `index.css` = **0**; container queries = **0** | ✓ | ✓ | ✓ | ✓ (prose) | ⬤⬤⬤⬤ |
| `index.css` ≈ **1642 lines** | ✓ | ✓ | ✓ | — | ⬤⬤⬤ |

### 2.2 Reconciled baseline — distance from document top to first card

| Viewport | A1 | A2 | A3 | A4 | **Adopted** |
|---|---:|---:|---:|---:|---:|
| 280 × 568 | — | — | — | 692 | **692** |
| 320 × 568 | 833 | 592 | 692 | 692 | **692** |
| 360 × 640 | — | — | — | 642 | **642** |
| 375 × 812 | 770 | — | 597 | — | ~597 |
| 390 × 844 | — | 592 | 642 | 597 | **597** |
| 768 × 1024 | 768 | 652 | 597 | — | ~597–650 |
| 844 × 390 (landscape) | 680 | — | 597 | — | ~597 |
| 1024 × 768 | 678 | — | 617 | — | ~617 |
| 1366 × 768 | — | 562 | — | 597 | **597** |
| 1440 × 900 | — | 562 | 617 | — | ~597–617 |
| 1920 × 1080 | — | — | 597 | — | 597 |

**Why they diverge.** The chip facet row's height is a function of how many
distinct facet values the catalogue produces. A2 measured against a **1-entry**
catalogue (smallest chip row, hence a constant 592 at both 320 and 390). A1
measured against a synthetic **24-entry fixture** (largest chip row, hence
770–833). A3 and A4 measured **16 entries** and agree on the anchor values
692 / 642 / 597. A1 additionally counts the 53px fixed header *in addition to*
`main`'s `pt-20`, which double-counts, since `pt-20` exists precisely to clear
that fixed header — subtracting it brings A1's 375px figure from 770 to ~717.

**A4's sequence is the only monotone one** (692 → 692 → 642 → 597 as width
grows) and is adopted. A3's table assigns 642 to 390px and 597 to 375px, which
is non-monotone and inconsistent with its own explanation; treat A3's labels as
noisy and its values as correct.

### 2.3 Open conflicts — settle these first

| # | Conflict | Positions | How to settle |
|---|---|---|---|
| **X1** | **Catalogue size** | A1, A2: `pages/index.json` holds **one** record (A1 adds: the localized name maps already carry 15 ids). A3, A4: **16** entries; A4 enumerates 12 dossiers + About/Sources/Links/News, all opening without error. | `jq 'length' pages/index.json` and `ls pages/*/`. If 16 is right, A1's density numbers came from a stale `dist/` and its chrome figures are ~140px high. All acceptance targets depend on this. |
| **X2** | **Horizontal overflow** | A1, A2, A3 all report none, "verified". A4 reports fixed header controls reaching **x≈314 at a 280px viewport**, failing at 300px, clean at 320px. | **A4 is right and the others' method was invalid.** Fixed-position elements do not contribute to `documentElement.scrollWidth`, and `body { overflow-x: hidden }` (`index.css:80`) hides the rest. A1's own self-review reached the same conclusion ("the actual 320px overflow is not proven" — correct, because it starts below 320). Verify with per-element `getBoundingClientRect().right > innerWidth` at 280/300/320, not `scrollWidth`. |
| **X3** | **Do tables scroll?** | A1, A2, A4 list local table scrolling as an existing strength. A3 measured it inert. | **A3 is right.** `ScrollableTable` wraps in `overflow-x:auto`, but `index.css:1035` sets `table { width: 100% }`, so the table can never exceed the scroller and there is nothing to scroll. Measured at 390×844: 317px table in a 317px scroller, `scrolls: false`, every row 75px tall from 3–4-line cell wrapping. |
| **X4** | **Are container queries needed?** | A1, A2, A3: yes, the article column is decoupled from the viewport. A4: "not in the first pass — components live in stable page-level containers." | **A4 is wrong on this specific point.** The article column is `min(768px, pane − padding)`: 318px at a 390px viewport, 556px at 700px, 684px at 844px, and 768px at *every* viewport from ~1150px up. Figure sizing gated on `sm:` (640px *viewport*) therefore produces a **3.2× size cliff across one pixel** (measured: 567px at 639, 175px at 700). The quantity being queried is simply the wrong one. |
| **X5** | **Source paths and line numbers** | A1, A2 use flat paths (`components/CodexShell.tsx`); A3, A4 use nested (`components/codex/CodexShell.tsx`). A3's TSX **line numbers** diverge widely from the other three (`AnimatedTitle.tsx:336–413` vs `33–110`; three separate files all cited at line 336). | Adopt **A3/A4's nested paths** and **A1/A2/A4's line numbers**. Re-resolve every A3-only line reference before use. |

### 2.4 Method notes worth preserving

- Verification must be done by **dragging** the viewport, not by jumping between
  named sizes — every size discontinuity found was located *between*
  breakpoints, not at them. [A1]
- Scan continuously (e.g. every 20px) from **280px**, not 320px. The header bug
  lives below 315px. [A4]
- Test **zoom**: at 200% on 1280×720 the first card moves y≈597 → **y≈1374**.
  Fixed hero spacing becomes proportionally more expensive under magnification,
  which makes hero compression a WCAG 1.4.10 reflow concern, not only a density
  preference. [A4]
- DOM geometry takes precedence over screenshot estimates where they conflict. [A4]
- Label every projected number as projected. Only A1 and A3 simulated fixes and
  re-measured; everything else in this document marked ✎ projected is arithmetic
  from the baseline.

---

## 3 · Current state — what is right and must survive

Corrected and deduplicated across all four audits. **Item 12 of the original
"strengths" lists has been removed** — see conflict X3.

**Architecture**
1. The content/renderer boundary: catalogue data in `pages/`, renderer in the
   bundle (`vite.config.ts:8-30`). Hash routes are deep-linkable and
   back-button compatible (`lib/hooks.ts:64-99`). [A4]
2. Lazy codex / image-viewer / ASCII-viewer / playback / MIDI chunks; production
   build passes `tsc -b && vite build` at 825 modules. [A4]
3. **One stylesheet, one `@theme` token block** (`index.css:17–61`). Every fluid
   scale proposed below is additive to it. [A3]
4. **Semantic component classes, not utility soup** — `.herald`, `.parchment`,
   `.search-panel`, `.bio-*`, `.footer-*` are real named components. Responsive
   rules attach to one selector instead of being hunted across JSX. This is the
   single highest-leverage property of the codebase. [A3]
5. **Exceptional inline documentation.** Nearly every non-obvious rule explains
   *why*. Preserve the convention in every change below. [A3]

**Correct responsive foundations**
6. `min-width: 0` is applied correctly on flex/grid children carrying dynamic
   text (`DocumentsTab.tsx:65,125`, `GalleryTab.tsx:84`, `SiteFooter.tsx:132`,
   `LoreTab.tsx:105`, `index.css:1335`). The most common responsive bug in React
   codebases is absent here. [A1]
7. **The `::: nav` bar is genuinely intrinsic** — `width: max-content;
   max-width: 100%; flex-wrap: wrap` with a deliberate refusal of `nowrap`
   (`index.css:1249–1273`). No breakpoints, and none needed. This is the pattern
   the rest of the app should imitate. [A1]
8. `pre` scrolls in its own box (`index.css:951`); `.search-panel` and the codex
   reading pane own their scroll. [A1, A3]
9. The two-column compact catalogue grid is the right density-preserving
   structure — do **not** collapse it to one card. [A2, A4]
10. The codex has exactly one reader scroll owner; `absolute inset-[11px]` keeps
    the pane inside the double frame; body scroll locks on open. [A4]
11. Country choice stays a native `<select>` (`SelectField.tsx:8-15`) — correct
    for a list heading toward "a hundred". [A4]
12. Portraits sit in a declared `aspect-[3/4]` box, reserving card geometry
    despite the `<img>` having no intrinsic dimensions. Intrinsic sizing is
    later CLS hardening, not an RWD blocker. [A4]

**Visual and performance discipline**
13. Palette, Cormorant families, `--font-music` fallback chain with its measured
    `--fx-clef-*` compensation, manuscript gradients, gold rules, corner
    ornaments, the double-frame system. [A1, A3, A4]
14. Background is static CSS/SVG grain, not canvas or particles
    (`Background.tsx:8-15`). Keep it. [A4]
15. `will-change` promoted only on hover (`index.css:1145`), `contain: layout
    paint style` on the drift layer, literal keyframe values to stay on the
    compositor, the 4-eager-portrait rule, `memo`'d cards. Density raises node
    counts; this headroom is what makes that affordable. [A1, A3]
16. The **reduced-motion policy** including the three-axis separation (hardware
    grade × reader switch × OS hint) and the `--fx-dur` custom-property trick
    that lets an opted-in ornament survive the blanket `!important` clamp
    (`index.css:1624–1641`). Subtle, correct, easy to break by accident. [A1, A3]
17. The main search input is already **18px** (`SearchBar.tsx:79` `text-lg`) —
    the one control immune to iOS focus zoom. Do not shrink it. [A1]
18. `text-wrap: balance` on the herald line, `text-wrap: pretty` on verse,
    `aspect-ratio` on portraits and gallery cells, `mask-image` fades on rules. [A1]
19. **The wide composition is the reference.** At 1440–1512px the article sits at
    ≈ 85 characters in a serif at 1.75 leading; the symmetry, parchment, double
    gold border and ornaments read exactly as intended. Nothing below should
    alter what a 1440–1600px reader sees, except where explicitly flagged. [A1, A3]

---

## 4 · Findings

Format: **Problem → Evidence → Root cause → Fix → Acceptance.**
Severity: 🔴 blocking/high · 🟠 medium · 🟡 polish.
`I` = impact, `E` = effort, `R` = regression risk.

---

### Group P — Correctness and access (must precede visual work)

---

#### P1 🔴 Fixed header controls leave the viewport below ~315px
**I: very high · E: low–med · R: med** · ⬤ [A4] · **refutes A1/A2/A3**

**Problem.** One `justify-between` row holds a non-shrinking brand group and a
non-shrinking control group. The language trigger is ≈81px and `shrink-0`; each
icon control is a fixed `w-9` (36px); gaps accumulate.

**Evidence.** At 280px the final control occupies **x≈278–314**. Still failing at
300px; clean by 320px. Root `scrollWidth` stays equal to the viewport because
fixed-position elements do not enlarge normal flow, and `body { overflow-x:
hidden }` (`index.css:80-87`) absorbs the rest — which is exactly why three
other audits certified "no overflow".

**Affected.** `App.tsx:218-252`, `App.tsx:341-365` (`CtrlButton`),
`components/LanguageMenu.tsx:57-102`, `index.css:80-87`.

**Fix.** Preserve every unique control — Effects, ambience and sound have no
duplicate settings surface, so hiding any one is not a valid cutover.

1. **Preferred:** below the content-fit threshold, swap the visible `CODEX`
   wordmark for the existing star/emblem while keeping the full brand as
   visually-hidden accessible text; reduce only group gaps and padding. Restore
   the wordmark with a mobile-first `min-width` rule once it fits.
2. If 44px hit boxes plus all controls still cannot share one line, use a
   declared two-tier/wrapping header and bind `main`'s top inset to the **same**
   header-height token, so content can never slide behind an implicitly taller
   bar.

```css
:root { --header-h: 3.25rem; }   /* measured 53px; single source of truth */
header.app-bar {
  min-block-size: var(--header-h);
  padding-top: max(0.5rem, env(safe-area-inset-top));
  padding-inline: max(0.5rem, env(safe-area-inset-left))
                  max(0.5rem, env(safe-area-inset-right));
}
```

Do **not** solve this by shrinking targets. Compact visuals can sit inside 44px
hit boxes (see P3).

**Acceptance.** Every control box lies inside 280, 300, 320, 360, 390 and 430px
viewports; all controls keyboard- and touch-reachable; no clipping at 200% zoom.
Verify per-element with `getBoundingClientRect().right > innerWidth`, never with
`scrollWidth`.

---

#### P2 🔴 Modal focus, inertness and tab semantics are functionally broken
**I: very high · E: med · R: med** · ⬤⬤ [A4 runtime, A2 static]

**Problem.** `aria-modal="true"` declares modality but implements none of it.

**Evidence.** After opening `#/agustin-barrios`: focus remains on `<body>`;
**40 controls behind the visible codex remain tabbable**; Tab walks the covered
header, search and filter controls instead of the dialog. The nested Image
Viewer creates the correct visual stacking tier while the parent dialog and page
stay keyboard-reachable. All four `role="tab"` buttons carry `tabIndex=0` and the
tablist has no roving focus or Arrow/Home/End handling — and ArrowLeft/ArrowRight
bubble to the shell's global entry-turn listener, so **the keys expected to move
between tabs turn catalogue entries instead**.

**Affected.** `components/codex/CodexShell.tsx:108-137`,
`components/codex/CodexTabs.tsx:29-51`, `components/ImageViewer.tsx:150-166`,
`components/AsciiTabViewer.tsx:98-120`, modal providers in `src/lib/`.
Interactive figures: `BioArticle.tsx:196-208, 334-358`, `GalleryTab.tsx:46-64`.

**Fix.** One reusable modal-focus primitive, not three partial fixes:
record the invoker → focus a stable dialog control on open → make all lower
layers `inert` → contain Tab/Shift+Tab in the topmost dialog → Escape closes only
the topmost layer → remove inertness and restore focus on close.

For `CodexTabs`, implement the ARIA tab pattern properly: selected tab
`tabIndex=0`, others `-1`; Arrow/Home/End move and select within the strip and
**call `stopPropagation()`**. If that behaviour is unwanted, drop the tab roles
and expose ordinary buttons — but a correct tab pattern matches the existing UI.

Additionally: wrap interactive thumbnails and figures in real buttons while
preserving `figure`/`figcaption` semantics, and add a `:focus-visible` treatment
in the codex visual language. Swipe/pan enhancements stay supplementary — every
operation must remain available by button and keyboard. [A2]

**Acceptance.** Keyboard focus never enters covered content; nested viewer
containment works; Escape unwinds exactly one layer; focus returns to the
invoking card/tab/figure; arrow keys inside the tablist never turn entries;
screen-reader virtual navigation does not expose inert layers.

---

#### P3 🔴 iOS Safari zooms the page whenever any refinement field is focused
**I: high · E: trivial · R: none** · ⬤⬤⬤⬤

**Problem.** All seven inputs and selects in the refinement panel compute to
**15.2px** (`.form-ink { font-size: 0.95rem }`, `index.css:290`). Safari zooms
the viewport on focus for any control under 16px and does not zoom back out — the
reader is left in a zoomed, horizontally scrolled page mid-search.

**Fix.** One declaration; the visual change is 0.8px.

```css
.form-ink { font-size: max(16px, 0.95rem); }
```

---

#### P4 🔴 Project CSS is unlayered, so it beats every Tailwind utility — including every responsive one
**I: very high (as an enabler) · E: low–med · R: low** · ⬤ [A1]

**Problem.** `index.css` imports Tailwind (which layers its utilities) and then
declares ~1500 lines of component rules **outside any layer**. Unlayered rules
win over layered ones regardless of specificity. Consequence: you **cannot** add
`sm:px-*`, `md:text-*` or any responsive utility to an element carrying
`.herald`, `.search-panel`, `.form-ink`, `.btn-rpg`, `.form-segments`, `.fx-clef`
or `.fx-drift`.

**Evidence.** Four separate comments in the file warn about it
(`index.css:200–203, 232–236, 396–399, 1518–1522`), and the codebase pays for it
with **16 `!important` overrides** across 8 TSX files, 15 of them `!px-3`
fighting `.btn-rpg`'s fixed `padding: 0.45rem 1.1rem` —
`CodexShell.tsx:181,184`, `AdvancedSearchPanel.tsx:171`,
`DocumentsTab.tsx:87,100,113`, `GalleryTab.tsx:86,132`, `AudioPlayer.tsx:86`,
`AsciiTabViewer.tsx:230,238,242`, `ImageViewer.tsx:166`, `LanguageMenu.tsx`.

> A4 argues against "a second styling system". This is not one — `@layer
> components` is a precedence declaration over the rules that already exist, and
> it is what makes several fixes below expressible as utilities at all.

**Fix.**

```css
@import "tailwindcss";
@layer components {
  /* everything from `.parchment` (index.css:154) to the end of the component
     rules. Tokens in @theme and the prefers-reduced-motion block at the foot
     stay outside. */
}
```

Then give `.btn-rpg` a custom-property API so size becomes a variable rather than
a fight, and delete all 16 `!important`s:

```css
.btn-rpg {
  padding: var(--btn-py, 0.45rem) var(--btn-px, 1.1rem);
  font-size: var(--btn-fs, 0.8rem);
}
```
```diff
- className="btn-rpg !px-3 !py-1 !text-[0.65rem]"
+ className="btn-rpg [--btn-px:0.75rem] [--btn-py:0.25rem] [--btn-fs:0.65rem]"
```

**Do this before P3-adjacent touch work (T1)** — without it those rules need
`!important` too.

---

### Group V — Vertical budget and density

---

#### V1 🔴 The pre-grid stack is a fixed additive tower that never compresses
**I: very high · E: low · R: low–med** · ⬤⬤⬤⬤ · ✎ validated by A1 and A3

**Problem.** 597–692px of chrome stands between the top of the document and the
first card at *every* viewport. Zero cards intersect the viewport at 280, 320 and
360px; at 390×844 two cards intersect but neither is complete; at 1366×768 four
card tops appear and none is complete. At 200% zoom on 1280×720 the first card
sits at **y≈1374**.

**Evidence.** §2.2. Per-band budget measured at 320×568 (bands sum to 692):

| Band | px | Source |
|---|---:|---|
| `main` top padding `pt-20` | 80 | `App.tsx:260` — header is **53px**, so 27px is pure surplus |
| `AnimatedTitle` (kicker 34 + `mt-3` 12 + h1 90 + divider 48) | 184 | `AnimatedTitle.tsx:33–110` |
| Herald wrapper `mt-5` | 20 | `HeraldBanner.tsx:38-45` |
| Herald plaque (`min-height: 3.5rem` + `1.15rem/2.1rem` padding) | 107 | `index.css:400–460` |
| SearchBar wrapper `mt-9` | 36 | `SearchBar.tsx:62` |
| Search input box | 54 | `SearchBar.tsx:70` |
| `mt-4` + **quick facet chip rows** | 16 + **127** | `SearchBar.tsx:128` |
| `mt-3` + result count line | 12 + 16 | `SearchBar.tsx:148` |
| Grid wrapper `mt-10` | 40 | `App.tsx:295` |
| **Grid starts** | **692** | |

`pt-20 · mt-5 · mt-9 · mt-4 · mt-3 · mt-10` alone are **204px of whitespace
identical on a 568px phone and a 1080px desktop**. `grep -c "clamp(" index.css`
→ **0**.

Note also that the mobile title block (184px) is *taller* than the desktop one
(167px), because `text-4xl` wraps the localized title onto two lines. Smaller
type bought no space — the thesis of this audit in miniature. Width steps also
produce abrupt title-height changes: ≈90px through 360px, ≈45px around 380px,
then 75/90px after the `sm:`/`md:` jumps.

**Root cause.** Every gap is a fixed Tailwind rem step chosen to look right in
the widescreen composition. None knows anything about available height. `pt-20`
is additionally a magic number for a 53px header.

**Fix.** Make the vertical rhythm fluid on the short axis and anchor the header
offset to the header token from P1. Horizontal padding and the plaques' visual
design stay untouched.

```css
/* index.css @theme — the fluid scale the project currently lacks */
--space-2xs: clamp(0.25rem, 0.18rem + 0.35vw, 0.5rem);
--space-xs:  clamp(0.4rem,  0.28rem + 0.6vw,  0.75rem);
--space-sm:  clamp(0.6rem,  0.4rem  + 1vw,    1.25rem);
--space-md:  clamp(0.9rem,  0.55rem + 1.75vw, 2.25rem);
--space-lg:  clamp(1.25rem, 0.7rem  + 2.75vw, 3rem);

/* the two vertical tokens that do the compressing */
--gap-section: clamp(0.75rem, 2.2vh, 2.25rem);
--gap-tight:   clamp(0.35rem, 1.2vh, 0.75rem);
--pad-inline:  clamp(0.4rem, 2vw, 1.25rem);
```

```diff
- <main className="relative z-20 px-1 pb-16 pt-20 sm:px-2">
+ <main className="relative z-20 px-1 pb-[var(--gap-section)] sm:px-2"
+       style={{ paddingTop: "calc(var(--header-h) + var(--gap-section) + env(safe-area-inset-top))" }}>
```

Replace `mt-5` / `mt-9` / `mt-10` / `mt-3` on the four stacked blocks with
`mt-[var(--gap-section)]` / `mt-[var(--gap-tight)]`, and make the herald fluid:

```css
.herald        { padding: clamp(0.6rem, 1.4vh, 1.15rem) clamp(1rem, 3vw, 2.1rem); }
.herald-body   { min-height: clamp(2.25rem, 4vh, 3.5rem); }   /* was flat 3.5rem */
.herald::before{ top:    clamp(0.3rem, 0.8vh, 0.5rem); }
.herald::after { bottom: clamp(0.3rem, 0.8vh, 0.5rem); }
```

And make the headline fluid on both axes instead of stepping at 640/768:

```diff
- className="… text-4xl … sm:text-6xl md:text-7xl"
+ className="… text-[clamp(2rem,1.2rem+3.4vw,4.5rem)] …"
```

Test the unbreakable localized words (`whitespace-nowrap` per word) at the
clamp's lower bound before shipping.

**✎ Validated.** A1 measured chrome 770 → **602** at 375×812 and 680 → **571** at
1512×982, taking 6 cards above the fold from 0. A3 measured grid top 642 →
**412** at 390×844, preamble share 76 % → **49 %**, cards above the fold 0 → **2**.
(A3's figure includes hiding the chip row; see V2 — this composite keeps the row.)

**Acceptance.** First card top ≤ 480px at 360×640 and 390×844 with ≥ 35–40 % of
the first card visible; ≤ 500px at 1366×768; ≥ meaningful portion of a result at
320×568; the 1440–1920 composition unchanged within an agreed screenshot
tolerance.

---

#### V2 🔴 The quick facet chip row is unbounded and is the largest single item in the mobile chrome
**I: high · E: low–med · R: low** · ⬤⬤ [A1, A3] · ✎ validated

**Problem.** 127px at 320px (A3), 158px at 375px / 223px at 320px against a
24-entry fixture (A1) — for a control set with no height ceiling that grows with
the catalogue. `TokenSelect.tsx:11` states countries will reach "a hundred". The
same `ChipGroup`, bound to the same criteria, is **fully duplicated** inside
`AdvancedSearchPanel` (`SearchBar.tsx:129` vs `AdvancedSearchPanel.tsx:246–266`).

**Root cause.** `flex flex-wrap` with no cap: an unbounded set of controls
rendered as an unbounded block, in the scarcest space on the page.

**⚠ Resolution of a disagreement.** A3 recommends `display: none` below 34rem,
which is where most of its headline −230px comes from. A2 explicitly forbids
hiding functionality; A3's own §2.9 shows the panel that would host the exiled
chips opens off-screen. **Adopt A1's rail instead** — the controls stay visible
and one-tap, they simply stop stealing vertical space.

```css
.facet-rail { display: flex; flex-wrap: wrap; justify-content: center;
              align-items: center; column-gap: 1rem; row-gap: 0.5rem; }

@media (max-width: 40rem) {
  .facet-rail {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: inline proximity;
    scrollbar-width: none;                     /* the fade is the affordance */
    padding-block: 0.15rem;
    mask-image: linear-gradient(90deg, transparent, #000 1.25rem,
                                #000 calc(100% - 1.25rem), transparent);
  }
  .facet-rail::-webkit-scrollbar { display: none; }
  .facet-rail > [role="group"] { flex-wrap: nowrap; }
  .facet-rail button { flex: none; }
}
```

Two smaller wins in the same block: keep the `|` separator `hidden sm:inline`
(already correct), and fold the result count into the search row instead of
giving it its own 16px line plus a 12px margin.

**✎ Validated.** Chip row **158 → 48px** at 375px. Combined with V1: chrome
**770 → 492px** and **2 full cards above the fold** (was 0), with *larger* cards
and a *shorter* document (5470 → 5354px). [A1]

---

#### V3 🔴 The card grid has a fixed column count, a 4-column ceiling and 27–38 % size discontinuities
**I: very high · E: low–med · R: med** · ⬤⬤ [A1, A3] · ✎ validated

**Problem.** Three hard-coded column counts at two Tailwind breakpoints, in two
places that must stay in sync (`CharacterGrid.tsx:47-50` and the skeleton at
`App.tsx:368-374`):

```
mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-10 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4
```

Dragging across a breakpoint makes the card *jump*:

| At width | Columns | Card width | Row pitch |
|---|---|---|---|
| 639 px | 2 | 268 px | 466 px |
| **640 px** | 3 | **167 px (−38 %)** | 354 px |
| 1023 px | 3 | 281 px | 495 px |
| **1024 px** | 4 | **206 px (−27 %)** | 385 px |

At 640px the chrome simultaneously *grows* by 100px because `sm:` also fires on
the title and paddings — the layout gains a column and loses a screen at the same
pixel. And the grid never exceeds 4 columns: `max-w-6xl` caps content at 1152px,
so a 1920px display shows 4 cards inside **384px of empty gutter per side (40 %
of the screen)** and a 2560px display wastes 55 %.

> A4 records the wide grid as "already effective" and does not measure the
> gutter. A1 and A3 both measure it; adopt their finding.

**Fix.** One `auto-fill` track list with a banded fluid minimum, fluid gap and
fluid padding. Delete all three column breakpoints and de-duplicate the skeleton.

```diff
  <m.div layout
-   className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-10 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4"
+   className="card-grid mx-auto"
  >
```

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(var(--card-min), 100%), 1fr));
  gap: clamp(0.65rem, 2vw, 1.5rem);
  padding-inline: var(--pad-inline);
  max-width: 96rem;                /* was 72rem */
  margin-inline: auto;
  --card-min: 8.75rem;
}
@media (min-width: 30rem) { .card-grid { --card-min: 9.5rem;  } }
@media (min-width: 56rem) { .card-grid { --card-min: 11rem;   } }
@media (min-width: 80rem) { .card-grid { --card-min: 13rem;   } }
```

**The "other tongues" divider must span the row explicitly**, since the column
count is no longer statically known (`CharacterGrid.tsx:62`):

```diff
- className="col-span-2 flex items-center justify-center gap-3 py-3 sm:col-span-3 lg:col-span-4"
+ className="col-span-full flex items-center justify-center gap-3 py-2"
```

Apply the same class substitution to `GridSkeleton` (`App.tsx:370`) so the
loading state cannot diverge from the real grid.

**✎ Validated / verified for monotonicity** (column count must never fall as the
viewport grows — checked across 22 widths):

| Viewport | Today | Proposed | Density |
|---|---|---|---|
| 320 | 2 × 132 | 2 × 134–145 | — |
| 375 | 2 × 160 | 2 × 162–172 | — |
| 540 | 2 × 242 | 3 × 159 | **+50 %** |
| 768 | 3 × 224 | 4 × 169–171 | **+33 %** |
| 1024 | 4 × 226 | 5 × 179 | **+25 %** |
| 1440 | 4 × 262 | 6 × 212 | **+50 %** |
| 1920 | 4 × 262 | 6 × 236 | **+50 %** |

Card widths stay in the 134–244px band: never narrower than today's phone card,
never wider than today's desktop card. **The 1280px reference view gains a
column and loses ~43px of card width.** If that is judged too large a change to
the canonical composition, raise the `80rem` band to `--card-min: 15rem`, which
holds 4 columns to 1440 and gives 5 above it. **Drag-test 280 → 2560px** and
retune the bands by a few tenths if any width shows a non-monotone step.

---

#### V4 🟠 The footer costs more than a full screen on a phone
**I: med–high · E: low · R: low** · ⬤⬤⬤

**Problem.** 881–882px at 320–375px = **109 % / 1.55 screens**, and 21–22 % of
the whole document (desktop: 517–536px, 55 %). Nine menu items in 2 columns =
5 rows at `min-height: 4.25rem` = 344px, plus a 175px colophon and two
decorative rule blocks. Six of the nine items are placeholders.

**Evidence.** `SiteFooter.tsx:65-183` `grid-cols-2 sm:grid-cols-3 lg:grid-cols-9`;
`index.css:655/659` `.footer-menu-item { min-height: 4.25rem }`; `index.css:755`
already patches the item at `max-width: 420px`, treating the symptom.

**Fix.** One intrinsic track list — which also deletes the 420px query — plus a
fluid item height.

```diff
- className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-9"
+ className="footer-menu m-0 grid list-none p-0"
```

```css
.footer-menu {
  grid-template-columns: repeat(auto-fit, minmax(min(6.5rem, 100%), 1fr));
  gap: clamp(0.4rem, 1vw, 0.75rem);
}
.footer-menu-item {
  min-height: clamp(2.75rem, 7vw, 4.25rem);
  padding: clamp(0.7rem, 2vw, 1.2rem) 0.45rem clamp(0.45rem, 1.4vw, 0.8rem);
  font-size: clamp(0.64rem, 0.6rem + 0.2vw, 0.72rem);
}
@media (max-width: 30rem) {
  .footer-menu-numeral, .footer-menu-flourish { display: none; }
}
.footer-colophon { padding-block: clamp(0.6rem, 2.5vw, 1rem); }
```

Then **delete `index.css:755–762`**. At 320–375px this yields ~150px of nav
instead of 344px, and footer height ≈ 882 → ~500px, while 1024+ still reaches
9 across.

⚠ A4 cautions against dropping to a smaller `min-height` before reviewing
filtered/empty states, and against hiding placeholder items without a product
decision (they carry translated feedback and signal navigation intent). Both
cautions are adopted: the clamp keeps the desktop value, and nothing is hidden
except pure ornament below 30rem.

---

#### V5 🟡 Three stacked bottom spacers = 96–136px of nothing
**I: low · E: trivial · R: none** · ⬤ [A1]

`main` `pb-16` (64px) + `footer` `mt-8` (32px) + `CharacterGrid` `pb-10` (40px)
all stack between the last card and the colophon (`App.tsx:260`,
`SiteFooter.tsx:67`, `CharacterGrid.tsx:50`). Keep one, make it
`var(--gap-section)`, drop the other two.

---

#### V6 🟡 Card internals waste ~19 % of card height on a phone
**I: med · E: low · R: low (crop: med)** · ⬤⬤ [A3, A4] · ✎ validated

**Measured at 390×844:** card 167 × 322px — portrait 223px, name plate **81px**
for an 18px name and a 12px subtitle (`CharacterCard.tsx:112-210`:
`px-3 pb-3 pt-1.5` + `text-lg sm:text-xl` + `mt-0.5` + `mt-1.5` hover flourish).
The hover flourish is dead weight on a touch device.

```css
@media (max-width: 30rem) {
  .card-plate { padding: 0.25rem 0.5rem 0.5rem; }
  .card-name  { font-size: 1rem; }
  .card-flourish { margin-top: 0.25rem; }
}
@media (hover: none) { .card-flourish { display: none; } }
```

**⚠ The 3:4 → 4:5 portrait crop is DECLINED.** A3 measured it as worth
322 → 262px (−19 %) and +50 % steady-state density, and flagged it as a
visual-identity call. A1 evaluated and rejected it as "the one change that would
make the grid read as a generic app". A4 independently ranks it last: *"cropping
faces is a higher regression risk than spacing changes; do not change the card
crop before hero compression proves it is still necessary."* **Three-way
agreement to defer.** Revisit only if V1–V3 still miss the density target, and
then only as an A/B against real portraits.

---

### Group L — Breakpoint architecture

---

#### L1 🔴 There is effectively one breakpoint, at five thresholds, in three unit conventions
**I: med · E: low · R: low** · ⬤⬤⬤

**Problem.** 81 × `sm:` against **1** real `md:` and 5 `lg:`; zero `xl:`/`2xl:`.
`sm:` is being used as a synonym for "not a phone", so everything from 640px to
2560px receives one identical set of desktop values. Hand-written CSS adds
420px, 480px ×2, 640px, `40rem` (= 640px again, different unit), `48rem` and
`47.999rem` — the last a fractional edge that can be missed by both queries or
matched by both under zoom or sub-pixel rounding.

**Evidence.** `index.css:274, 482, 584, 755, 1338, 1351, 1427, 1624`.
*(A naive `grep -o 'md:'` reports 10 — nine are TypeScript property annotations.)*

**Fix.**
1. Declare the scale once so Tailwind and hand-written CSS cannot disagree:
   ```css
   @theme {
     --breakpoint-sm: 30rem;   /* 480 — compact/medium boundary */
     --breakpoint-md: 40rem;   /* 640 */
     --breakpoint-lg: 64rem;   /* 1024 */
   }
   ```
   Retuning `sm` touches 81 call sites' behaviour — treat it as a separate,
   drag-tested change, not part of this fix.
2. **Delete** the 420px query (V4) and the 480px queries (`index.css:274`, `:584`)
   by making the affected paddings `clamp()`s:
   `.search-panel { padding: clamp(0.85rem, 2.5vw, 1.35rem) }`.
3. **Delete** the `48rem` / `47.999rem` pair via the polarity flip in R4.
4. Replace the lone `@media (min-width: 640px)` font bump on `.herald-line`
   (`index.css:482`) with `font-size: clamp(0.95rem, 0.9rem + 0.45vw, 1.12rem)`.

**Target: three width thresholds plus one height threshold, all content-derived.**
Never add `xl:`/`2xl:` — use `auto-fill` instead.

---

#### L2 🔴 No height-aware rule anywhere
**I: high · E: low · R: low** · ⬤⬤⬤⬤

**Problem.** Every responsive decision is a function of width alone, so phone
landscape (844×390) receives the *widescreen* treatment: `sm:` has fired, the
title is 60px, the codex plate is 196px, and the chrome is 153–174 % of the
viewport height.

**Fix.** One height tier, applied to **ornament only** — nothing informational is
removed. (A1 and A3 propose 34rem; A4 proposes 44rem. Adopt **34rem** for
ornament suppression and **44rem** for gentler spacing compression, since 44rem
= 704px would otherwise fire on ordinary 768px-tall laptops.)

```css
@media (max-height: 44rem) {
  :root { --gap-section: clamp(0.6rem, 1.6vh, 1.4rem); }
}
@media (max-height: 34rem) {
  :root { --gap-section: 0.5rem; --gap-tight: 0.25rem; }
  .title-kicker, .title-rule, .herald-wrap { display: none; }
  .divider-ornament { display: none; }
  .codex-plate { --plate-scale: 0.62; }
}
```

With V1–V3 applied this takes the 844×390 chrome from ~680px to ~240px. Phone
landscape stays a scrolling experience — a 3:4 portrait card is 87 % of a 390px
viewport by construction — but the reader reaches content immediately instead of
after 1.7 screens.

**Never infer landscape from width.** Test both orientations explicitly.

---

#### L3 🟠 Zero container queries, and the codex article demonstrably needs them
**I: med–high · E: med · R: med** · ⬤⬤⬤ [A1, A2, A3] · ⚠ A4 dissents — see X4

**Problem.** The codex article column is **768px wide at every viewport from
~1150px up** (`CodexArticle.tsx` `max-w-3xl`), 318px at a 390px viewport, 556px at
700px, 684px at 844px. Yet everything inside it responds to *viewport* width. At
1600px the article is 768px wide while a `sm:`-gated rule fired at 640px puts
four images across it. The component's own box and the query driving it are
unrelated quantities.

**Fix — and the critical footgun.** Put `container-type` on the **wrapper**, not
on `.bio-article` itself:

```tsx
// components/codex/CodexArticle.tsx — the only JSX change strictly required here
<div className="mx-auto max-w-3xl [container-type:inline-size] [container-name:article]">
```

> **Why the wrapper.** `container-type: inline-size` implies `contain: layout
> style`, which would make `.bio-article` a containing block **and a stacking
> context** for its descendants — and `.fx-curl:hover { z-index: 20 }` would then
> be trapped inside it. A1 and A2 both place the declaration directly on
> `.bio-article` and would hit this. **A3 caught it; adopt A3's placement.**

Second candidate: the catalogue card. Once V3 makes its width continuous, its
internal type and badge sizes should follow its own `cqi`, not the viewport.

**Browser support:** container queries are Baseline since 2023 and
`vite.config.ts:36` already targets `baseline-widely-available`. No fallback
needed; the un-queried default (stacked) is a correct degradation.

---

### Group R — The codex reading experience

---

#### R1 🔴 The codex plate does not compress; in landscape the article starts below the pane
**I: very high · E: low–med · R: low–med** · ⬤⬤⬤⬤

**Problem.** The plate is 180–196px + 20px margin at every viewport ≥ 640px wide.

**Evidence** (three-way corroborated):

| | 390 × 844 | 844 × 390 | 280 × 568 |
|---|---|---|---|
| Reading pane | 350 × 769 | y 36–354 (317 tall) | 240 × 510 |
| `.codex-scroll` padding-top | 64 | 56 | — |
| Plate | **180** | **196** | — |
| Tab strip | **73 (2 rows)** | 41 | **4 rows** |
| Chrome before prose | 317 (41 %) | **301 (95 %)** | 472 |
| Article begins at y | **398** | **373** *(pane ends 354)* | 472 *(pane ends 539)* |
| Lines of biography visible on open | few | **0** | ~1 |

Plate composition at 844×390: kicker 16 + 8 → h1 **48px** (`sm:text-5xl`, on a
390px-tall screen) → h2 36px → subtitle 28 → ornament 28 + `mb-5` 20.

**Root causes.**
1. `CodexShell.tsx` `pt-16 sm:pt-14` — **the mobile value is larger than the
   desktop value** (64 vs 56px), which is backwards; the control row it clears is
   `top-4` + 36px = 52px at both sizes.
2. `CodexHeader.tsx` steps type at `sm:` — a width threshold applied to a
   height-constrained problem.
3. The divider ornament is an unconditional ~44px block.

**Fix.**

```css
/* 1 — correct the inversion, derive the value from the control row */
.codex-scroll { padding-top: calc(1rem + 2.25rem + 0.5rem); }   /* 3.75rem, both sizes */
.codex-scroll { padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); }

/* 2 — fluid plate with a scale hook the height tier can turn down */
.codex-plate { --plate-scale: 1; }
.codex-plate h1 { font-size: calc(var(--plate-scale) * clamp(1.7rem, 1.1rem + 2.6vw, 3rem));
                  line-height: 1.05; text-wrap: balance; }
.codex-plate h2 { font-size: calc(var(--plate-scale) * clamp(1.35rem, 0.9rem + 1.9vw, 2.25rem)); }
.codex-plate p  { font-size: calc(var(--plate-scale) * clamp(0.95rem, 0.9rem + 0.3vw, 1.125rem)); }

/* 3 — low-height compaction (see L2) */
@media (max-height: 34rem) {
  .codex-plate { margin-bottom: 0.5rem; }
  .codex-plate .kicker, .codex-plate .divider-ornament { display: none; }
  .codex-scroll { padding-top: 3.25rem; }
  [role="tablist"] { margin-bottom: 0.6rem; }
}
```

Preserve the existing long-title branch. Use icon-only close/navigation at low
height regardless of width, on a visibly **opaque** control shelf with an
explicit stacking context, and reserve its height in the scroll pane rather than
relying on unrelated `pt-*` values. [A2, A4]

**Measurable invariant:** the first article heading or at least two body lines
must be visible when a tab is selected at **844×390** and **667×375**.

**✎ Projected:** chrome 301 → ~150px at 844×390, ~5 lines of prose visible on
open instead of none.

---

#### R2 🔴 The four-item tab strip wraps to two rows (four at 280px)
**I: med–high · E: low · R: low** · ⬤⬤⬤

**Problem.** `flex flex-wrap` with intrinsic-width items and fixed padding. The
four buttons total 419px in a 318px row at 390px; measured strip height **73px**
instead of 41px, and the wrap breaks the plaque's symmetry — the visual signature
of the codex. At 280px it becomes four rows.

**⚠ Two candidate fixes.** A1 proposes four equal non-wrapping tracks; A3 and A4
propose a one-line horizontal scroll strip. **Adopt the grid on compact widths**
(all four tabs stay visible and one-tap, no hidden affordance) **with the scroll
strip as the fallback** below the width where four 44px targets fit:

```diff
- className="mb-6 flex flex-wrap justify-center gap-1 rounded-md border border-gold-600/40 bg-paper-100/60 p-1 sm:gap-2"
+ className="codex-tabs mb-[clamp(0.6rem,2vh,1.5rem)] rounded-md border border-gold-600/40 bg-paper-100/60 p-1"
```
```css
.codex-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(0.15rem, 0.5vw, 0.5rem);
}
.codex-tabs > button {
  min-width: 0;
  min-block-size: 2.75rem;                       /* 44px target */
  padding-inline: clamp(0.35rem, 1.5vw, 1.25rem);
  font-size: clamp(0.6rem, 0.55rem + 0.35vw, 0.8rem);
  letter-spacing: clamp(0.06em, 0.18em, 0.18em);
  overflow-wrap: anywhere;                       /* a long label breaks, never overflows */
}
@media (max-width: 20rem) {                      /* 280–320px: scroll instead of squeeze */
  .codex-tabs { display: flex; flex-wrap: nowrap; overflow-x: auto;
                scroll-snap-type: inline mandatory; scrollbar-width: none; }
  .codex-tabs > button { flex: none; scroll-snap-align: start; }
}
```

Verify with the longest localized labels — Russian «Летопись · Галерея · Свитки ·
Атрибуты» and German are the stress cases. The **selected tab must always be
scrolled into view**. Do **not** move tabs to bottom navigation or collapse them
into a `<select>`; both are redesigns with worse nesting semantics.

---

#### R3 🔴 Article figures ignore their declared size below 640px — a 3.2× cliff across one pixel
**I: high · E: med · R: low–med** · ⬤⬤⬤ [A1, A2, A3] · missed by A4

**Problem.** `SIZE_CLASS` and `FLOAT_CLASS` are `sm:`-prefixed *only*
(`lib/biomd/BioArticle.tsx:245–260`):

```ts
const SIZE_CLASS = { small: "sm:max-w-[200px]", medium: "sm:max-w-[320px]",
                     large: "sm:max-w-[460px]", full: "" };
const FLOAT_CLASS = { left: "sm:float-left sm:mr-6 sm:mb-2", right: "sm:float-right …" };
```

Below 640px neither applies, and every figure carries `w-full`, so a figure the
author declared `size: small` — a deliberate editorial statement that a picture is
a marginal illustration — renders as a full-bleed hero.

**Evidence.** The same `size: small` figure measures **567px at a 639px viewport
and 175px at 700px** — a 3.2× discontinuity across one pixel. At 390px, **12 of
13** figures in the demo article render at full column width (318px). The corpus
uses `size: medium` 27 times and `size: small` 8 times; **all 35 are promoted to
full width on every phone.** This is most of why a mobile biography runs 12.9
screens.

**Root cause.** "Mobile = one column, everything full width" — the assumption the
brief explicitly warned against. A small illustration beside text is *more*
information-dense than the same illustration stacked, not less. And the gate is
on the viewport while the figure lives in a container the viewport does not
determine (L3).

**Fix.** Separate **size** from **position**. Make the size cap unconditional and
fluid; make the float a *container* decision.

```css
/* Applies at every width. The figure is already w-full, so max-width is a cap,
   never a floor. No cliff. */
.bio-figure--small  { max-width: min(100%, clamp(7.5rem, 34cqi, 12.5rem)); }
.bio-figure--medium { max-width: min(100%, clamp(11rem,  52cqi, 20rem));   }
.bio-figure--large  { max-width: min(100%, clamp(14rem,  72cqi, 28.75rem));}
.bio-figure { margin-inline: auto; }

/* A float needs room for a readable column beside it — a fact about the article
   column, not the window. */
@container article (min-width: 26rem) {
  .bio-figure--left  { float: inline-start; margin-inline-end: var(--space-md);
                       margin-block: 0.25rem 0.5rem; }
  .bio-figure--right { float: inline-end;   margin-inline-start: var(--space-md);
                       margin-block: 0.25rem 0.5rem; }
}
```

Replace the `SIZE_CLASS`/`FLOAT_CLASS` Tailwind maps with these static class
names — this *reduces* the JSX and moves the decision into the stylesheet where
the rest of `.bio-*` already lives.

Image groups: replace the four literal track classes (which also carry a
"Tailwind only emits what it sees" caveat at `BioArticle.tsx:262`) with one
intrinsic grid that honours the authored track count when there is room and
degrades one column at a time instead of all at once:

```diff
- className={clsx("my-5 grid grid-cols-1 gap-4 clear-both", IMAGES_TRACK_CLASS[node.tracks])}
+ className="bio-images my-5 clear-both"
+ style={{ "--tracks": node.tracks } as React.CSSProperties}
```
```css
.bio-images {
  display: grid;
  gap: clamp(0.5rem, 1.5vw, 1rem);
  grid-template-columns:
    repeat(auto-fit, minmax(min(100%, calc((100% - (var(--tracks) - 1) * 1rem) / var(--tracks))), 1fr));
}
```

Keep `position: center|full` figures full width — that is what the author asked
for. **This changes the renderer, not the content model:** the `size:`/`position:`
vocabulary keeps its exact current meaning; the fix makes it *work* on phones.

---

#### R4 🟠 `::: columns` stacks until a 768px **viewport**, and needs a fragile exclusive query pair
**I: med · E: med · R: low** · ⬤⬤⬤ [A1, A2, A3]

**Problem.** `.bio-cols-2/3/4` are single-column below `48rem` and full-width
above (`index.css:1327–1356`), with a `max-width: 47.999rem` twin for the divider
rule. At a 700×900 viewport the article column is 556px and all four blocks are
still one 556px track. A two-column record grid — the commonest use — would fit at
a 500px *column*. The corpus contains **55 `::: columns` blocks with 118 cells**,
the most-used layout block after `::: image`.

**Fix — with the polarity flip.** Make the stacked-divider rule the **default**
and the wide rule the override. This removes the `47.999rem` fractional edge
entirely.

```css
/* Replaces both media queries at index.css:1338 and :1351 */
.bio-article .bio-columns--divided > * + * {
  border-block-start: 1px solid rgba(184, 144, 42, 0.4);
  padding-block-start: 0.8em;
}
@container article (min-width: 30rem) { .bio-article .bio-cols-2 { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@container article (min-width: 42rem) { .bio-article .bio-cols-3 { grid-template-columns: repeat(3, minmax(0,1fr)); } }
@container article (min-width: 54rem) { .bio-article .bio-cols-4 { grid-template-columns: repeat(4, minmax(0,1fr)); } }
@container article (min-width: 30rem) {
  .bio-article .bio-columns--divided > * + * { border-block-start: none; padding-block-start: 0; }
  .bio-article .bio-cols-2.bio-columns--divided > *:not(:nth-child(2n+1)),
  .bio-article .bio-cols-3.bio-columns--divided > *:not(:nth-child(3n+1)),
  .bio-article .bio-cols-4.bio-columns--divided > *:not(:nth-child(4n+1)) {
    border-inline-start: 1px solid rgba(184, 144, 42, 0.45);
    padding-inline-start: 2rem;
  }
}
```

When a four-column source block lacks space it renders two columns rather than
four unreadable strips. Document order is never changed. Retain the existing
child `min-width: 0`.

---

#### R5 🟠 Article typography is static; the measure is wrong at both ends
**I: high · E: low · R: low** · ⬤⬤⬤⬤

**Problem.** `.bio-article { font-size: 1.13rem; line-height: 1.75 }`
(`index.css:861`) never changes.

| Viewport | Article width | Measure |
|---|---:|---:|
| 390 | 318 px | **~35 ch** (ideal band 45–75) |
| 700 | 556 px | 62 ch ✅ |
| 844 | 684 px | 76 ch (slightly wide) |
| 1512 | 768 px | ~85 ch (top of comfortable) |

35 characters at 18px with 1.75 leading is the worst possible ratio of ink to
whitespace, and the reason a biography feels endless on a phone. The demo article
measures **12.9 screens** at 390px.

**Fix.** With the container from L3 in place, size the type to the **column**, not
the window — the correct quantity, needing no breakpoints. `clamp()` on
`line-height` is the part usually forgotten: a tight column needs *tighter*
leading, not looser.

```css
.bio-article {
  font-size:   clamp(1rem, 0.92rem + 0.55cqi, 1.13rem);
  line-height: clamp(1.5,  1.42 + 0.22cqi,   1.75);
  text-wrap: pretty;
  hyphens: auto;                     /* ru/de compounds; harmless elsewhere */
}
.bio-article h2 { font-size: clamp(1.15rem, 1rem + 0.9cqi, 1.35rem);
                  margin-block: clamp(1em, 0.8em + 0.8vw, 1.6em) 0.55em; }
.bio-article h3 { font-size: clamp(1.05rem, 0.95rem + 0.6cqi, 1.15rem); }
.bio-article .bio-title         { font-size: clamp(1.4rem,  1rem + 2.4cqi, 2rem); }
.bio-article .bio-title--second { font-size: clamp(1.15rem, 0.85rem + 1.8cqi, 1.6rem); }
.bio-article blockquote { font-size: 1.05em; padding-inline-start: clamp(0.7rem, 3cqi, 1.1rem); }
.bio-article .bio-frame { padding: clamp(0.7rem, 3cqi, 1.2rem) clamp(0.8rem, 4cqi, 1.4rem); }
```

At a 318px column this yields ~16.4px / 1.53 → **~39 ch and ~12 % less vertical
space per paragraph**, with the desktop rendering unchanged (every clamp reaches
its maximum at a 768px column). Reduce compact heading/block margins by ~15–25 %;
do not reduce prose readability. `.bio-article p { margin: 0 0 0.4em }` is already
unusually tight — leave it; the leading is where the savings are.

Apply `overflow-wrap: anywhere` only to URLs, filenames and constrained table
cells — never to ordinary prose. **Validate every BioMD construct** (tables, code,
verse, nav, floats, image groups, 2–4 tracks, frames, signatures, drop caps)
before treating this as a token-only change.

---

#### R6 🟠 The table scroller is inert — tables squash instead of scrolling
**I: med · E: trivial · R: low** · ⬤ [A3] · **refutes a "strength" claimed by A1, A2 and A4**

**Problem.** `ScrollableTable` (`BioArticle.tsx:187-194`) correctly wraps tables in
`overflow-x-auto`, but `index.css:1035` sets `table { width: 100% }`, so the
table can never exceed its scroller and there is never anything to scroll.
`docs/Biography-Markup.md` §3.8 promises "a wide table scrolls inside its own
box, never the page"; today it does neither.

**Evidence.** Measured at 390×844 on `jimi-hendrix`: 317px table in a 317px
scroller, `scrolls: false`, 3 columns at 51/109/158px, **every row 75px tall**
because each cell wraps to three or four lines.

```css
.bio-article .bio-table-scroll { overflow-x: auto; overscroll-behavior-x: contain; }
.bio-article .bio-table-scroll > table { width: 100%; min-width: 26rem; }
.bio-article .bio-table-scroll {
  mask-image: linear-gradient(90deg, #000 calc(100% - 1.5rem), transparent);
}
@container article (min-width: 26rem) {
  .bio-article .bio-table-scroll { mask-image: none; }
}
```

---

#### R7 🟡 Fixed `w-32` label column in the Lore tab
**I: low–med · E: low · R: low** · ⬤⬤⬤

**Measured at 390×844:** `dt` is a hard 128px = **42 % of a 307px row**, leaving
167px for the value; rows with real content wrap to 60px tall. The label renders
at 11.2px and the value at 15.68px — so 42 % of the width goes to the *smaller,
less important* text (`LoreTab.tsx:104/105`, `<dt className="w-32 shrink-0 …">`).

```css
.lore-row { display: grid; grid-template-columns: minmax(5rem, 8rem) minmax(0, 1fr);
            gap: 0.75rem; align-items: baseline; }
@container article (max-width: 24rem) {
  .lore-row { grid-template-columns: 1fr; gap: 0.05rem; }
  .lore-row dt { letter-spacing: 0.14em; }
}
```

The Lore tab's own two-up grid (`sm:grid-cols-2`) should likewise become
`@container article (min-width: 34rem)`.

Also: document/media rows place icon, metadata and actions on one horizontal
line. Give metadata `min-width: 0`, let it wrap deliberately, and on compact
screens move the secondary action below or make the whole row the primary
activation target. Include RU/DE long-content fixtures. [A2]

---

#### R8 🟡 `min-h-[40vh]` reserves 40 % of the viewport for a possibly-empty tab
**I: low · E: trivial · R: low** · ⬤⬤ [A1, A3]

`BiographyView.tsx:73` and `PageView.tsx:43` reserve `min-height: 40vh` to stop a
tab switch from collapsing the pane. Reasonable intent, wrong unit: on a 390px-tall
landscape screen it reserves 156px of a 319px pane. Use
`min-height: min(40svh, 18rem)` — the intent is "don't collapse", not "be tall",
and a *floor* wants the **small** viewport so it never pushes content out of reach.

---

### Group T — Touch, platform and overlays

---

#### T1 🔴 21+ controls are below the touch target minimum
**I: high · E: med · R: med** · ⬤⬤⬤⬤

**Measured at 390×844 / 375×812:**

| Control | Size | Where |
|---|---|---|
| Facet chips (15) | 89 × **26–27** | `components/form/Chip.tsx:23-40` |
| Chips inside the panel (`size="sm"`) | — × **21** | `Chip.tsx:33` |
| `.form-segment` | 54 × **26**, 10.56px label | `index.css:348` |
| `AdvancedToggle` | 54 × **26** | `AdvancedToggle.tsx:41` |
| Codex tabs | 87–112 × **29–31** | `CodexTabs.tsx:29-51` |
| `.btn-rpg` (codex close / ← →) | 40–49 × **36** | `index.css:205` |
| Header sound/fx/ambient | 36 × 36 | `App.tsx:341-365` |
| Language menu option | full × **~30** | `LanguageMenu.tsx:141` |
| Search clear `✕` | 24 × 24 | `SearchBar.tsx:88` |
| Image-viewer toolbar (7–8 actions) | 36 × 36 | `ImageViewer.tsx:161-257` |
| **Inline audio play/stop in prose** | **16 × 16** | `AudioPlayer.tsx:105,116` |

In Advanced Search, **15–16 of 16 controls** fail a 44px product target in at
least one dimension.

**⚠ Standards precision.** WCAG 2.2 AA's normative Target Size (Minimum, 2.5.8)
is **24 × 24 CSS px with exceptions** — 44 × 44 is a *product* target, not the
conformance bar. State it that way in the ticket. [A4]

**Fix — expand the hit area without changing the drawn size.** This is the
pattern that preserves the visual identity exactly, which matters because these
pills and plaques *are* the design. It also sidesteps A4's overflow constraint:
the image toolbar spans x≈18–373 of a 390px viewport, so naively growing eight
boxes to 44px in one row would overflow, whereas a pseudo-element hit box does
not affect layout at all.

```css
@media (pointer: coarse) {
  .chip, .form-segment, [role="tab"], .lang-option, .facet-rail button { position: relative; }
  .chip::after, .form-segment::after, [role="tab"]::after, .lang-option::after {
    content: ""; position: absolute; inset: 50% 0 auto 0;
    height: max(100%, 2.75rem); transform: translateY(-50%);
  }
  .chip, .form-segment { min-block-size: 2rem; }   /* 32px drawn, was 26 */
  .form-segment { font-size: 0.72rem; }            /* 10.56 → 11.5px */
  .icon-btn { min-block-size: 2.75rem; min-inline-size: 2.75rem; }
}
```

> **Footgun.** `.btn-rpg` **must not set `position`** per its own comment at
> `index.css:201–204`. Do **not** add `position: relative` to `.btn-rpg` inside
> the coarse-pointer block — it re-opens that issue for the absolutely positioned
> codex close button. Use a wrapper element, or scope it as
> `.btn-rpg:not(.absolute)`, and **verify the codex close button's placement
> after the change**. [A3]

Apply `.icon-btn` to `App.tsx`'s `CtrlButton`, `ImageViewer`'s `ICON_BTN`,
`AsciiTabViewer`'s `SmallButton` and the search clear button. For the inline
audio controls give the 16px glyph an `::after { inset: -0.75rem }` — they sit in
running prose where a larger drawn button would break the line box.

For chips/segmented groups, a 40–44px row height with adequate separation is
acceptable if a full 44px per pill creates excessive vertical cost. Preserve
visible focus rings; test long translated labels.

**P4 must land first**, or these rules need `!important`.

---

#### T2 🟠 Viewer and tablature toolbars are too dense for touch and low height
**I: med–high · E: med · R: med** · ⬤⬤⬤ [A2, A3, A4]

The image viewer packs 7–8 controls of 36–38px spanning **x≈18–373 of 390px** —
almost no tolerance for a narrower viewport, a safe-area inset, localization or
zoom. It sets `touch-none` but implements one-pointer pan and double-click rather
than true pinch. Tablature controls run as small as 28px and can wrap into a tall
toolbar inside a `96vh` dialog. `AsciiTabViewer.tsx:115` uses `px-14 sm:px-28` to
clear the close button — 56px each side leaves 208px of title at 320px.

- Let the image toolbar form a deliberate 4+3 grid, a horizontally scrollable
  control rail, or grouped rows below ~24rem. Do **not** force eight 44px boxes
  into the existing 355px row.
- Group tablature secondary controls into a menu or rail in low-height mode.
- `AsciiTabViewer` header: `padding-inline: clamp(2.75rem, 12vw, 7rem)`.
- Either implement a real two-pointer pinch recognizer or permit the native
  gesture where it does not conflict with panning.

---

#### T3 🟠 The refinement panel opens off-screen, with two competing scroll owners
**I: high · E: med · R: med** · ⬤⬤⬤⬤

**Problem.** The panel is `position: absolute; top: 100%` under a search bar that
itself sits below the uncompressed hero (`SearchBar.tsx:109-121`;
`index.css:228-276`). `max-height: min(72vh, 40rem)` caps the panel's own height
but knows nothing about how far down the page it starts.

**Evidence.** At 390×844: panel starts y≈443, client 606px against 708–751px of
content, bottom edge ~195px below the viewport. At 280/320×568: starts y≈505–517,
bottom at 926px, **entirely below the fold with no scroll cue**. At 844×390: starts
y≈476 — toggling refinement appears to do nothing. `index.css:232–236` documents
the intent ("a scroll of its own on short screens so it never pushes the grid
around") — but on a phone, pushing the grid is strictly better than hanging off
the screen.

**Fix — in three tiers, cheapest first.**

```css
.search-panel { max-height: min(72vh, 40rem); }
@supports (height: 100dvh) { .search-panel { max-height: min(60dvh, 40rem); } }

/* Below 40rem, put the panel in the flow. It already animates its own entry. */
.search-panel-slot { position: absolute; inset-inline: 0; top: 100%; z-index: 40; }
@media (max-width: 40rem) {
  .search-panel-slot { position: static; }
  .search-panel { max-height: none; overflow-y: visible; }
}
```
```diff
- <div className="absolute inset-x-0 top-full z-40 pt-2">
+ <div className="search-panel-slot pt-2">
```

On open, `scrollIntoView` the search shell (user-triggered only, honouring
reduced motion) so the panel title and first control are always revealed. [A4]

**Re-measure after V1–V2 before doing anything more.** With ~230px reclaimed the
bar sits at ~290px and a 60dvh panel fits under it on most phones. [A3]

**Fork for the designer.** A true bottom sheet (`position: fixed; inset: auto 0 0;
max-height: 85dvh`) with a drag handle is the more modern phone pattern and keeps
the grid still — but it is a *new* interaction idiom for a manuscript-styled app,
and it requires the full focus trap, scrim and inertness from P2 before it is
safe. **Recommendation: the in-flow variant.** It costs six lines and introduces
no new metaphor.

---

#### T4 🟠 `vh` everywhere, `dvh`/`svh` nowhere
**I: med–high · E: trivial · R: none** · ⬤⬤⬤⬤

On iOS and Android `100vh` is the **large** viewport — it excludes the retracted
URL bar. A panel sized `94vh` therefore extends behind the toolbar whenever the
toolbar is showing; its bottom edge, its ornate corner and the last line inside it
are unreachable.

| Value | Where | Replace with |
|---|---|---|
| `max-h-[94vh]` | `components/codex/CodexShell.tsx:145` | `94svh` (stable panel maximum) |
| `max-h-[96vh]` | `components/AsciiTabViewer.tsx:110` | `96svh` |
| `max-h-[60vh]` | `components/LanguageMenu.tsx:130` | `60dvh` |
| `max-height: 70vh` | `index.css:1443` (`.bio-doc-embed iframe`) | `min(70dvh, 30rem)` |
| `min(72vh, 40rem)` | `index.css:239` (`.search-panel`) | `min(60dvh, 40rem)` |
| `min-h-[40vh]` | `BiographyView.tsx:73`, `PageView.tsx:43` | `min(40svh, 18rem)` — see R8 |

**Fallback-first, progressive enhancement:**

```css
.codex-panel { max-height: 94vh; max-height: 94svh; }
```

**Choose the unit by intent:** `svh` for a *stable maximum* that must never be
clipped; `dvh` for a surface that should *track* browser chrome and the soft
keyboard; never bare `vh` for anything sized to "the screen". For the codex
specifically, prefer `min(94svh, 100dvh - 1rem)` so the inset frame is never the
thing that clips.

---

#### T5 🟠 `viewport-fit=cover` is declared and no safe-area inset is ever used
**I: med · E: low · R: none** · ⬤⬤⬤⬤

`index.html:5` opts into drawing under the notch and home indicator; `grep -r
"env(" src/` returns nothing. The fixed header sits partly under the status bar in
portrait and under the notch in landscape; the image-viewer toolbar
(`ImageViewer.tsx:220` `pb-4`) and the codex's bottom frame land under the home
indicator.

```css
header.app-bar  { padding-top: max(0.5rem, env(safe-area-inset-top));
                  padding-inline: max(1rem, env(safe-area-inset-left))
                                  max(1rem, env(safe-area-inset-right)); }
.codex-shell    { padding-inline: max(0.5rem, env(safe-area-inset-left))
                                  max(0.5rem, env(safe-area-inset-right)); }
.codex-scroll   { padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); }
.viewer-toolbar { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
.site-footer    { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
```

Apply each side independently with `max(base, env(...))`. **Test landscape** —
`inset-left`/`inset-right` are the ones usually forgotten, and this app's centred
symmetry makes an asymmetric inset immediately visible.

---

#### T6 🟠 Hover motion is capability-blind
**I: med · E: low · R: low** · ⬤⬤ [A3, A4]

Cards always declare `whileHover={{ y: -8, scale: 1.045 }}`
(`CharacterCard.tsx:87-105`); curl-framed images always scale to 1.06
(`index.css:1124-1191`). On narrow fine-pointer windows the enlarged surfaces can
encroach on adjacent content; touch devices gain nothing.

```css
@media (hover: none) { .card-flourish { display: none; } }
```
Gate the lift/zoom with `(hover: hover) and (pointer: fine)`. Retain restrained
tap/focus feedback without shrinking already-small targets. **Preserve the
existing user-controlled ornament override** and verify both OS reduced-motion
states rather than assuming the blanket rule wins — the `.fx-curl` exemption is
deliberate.

---

#### T7 🟡 Some small-text colour pairings are marginal
**I: med · E: low · R: low** · ⬤ [A2] · verification item

Calculated token-pair contrast against nominal `paper-100`:

| Pair | Ratio | Verdict |
|---|---:|---|
| `ink-900` | 14.41:1 | Strong |
| `burgundy-600` | 8.66:1 | Strong |
| `sepia-600` | 6.75:1 | Strong for normal text |
| `gold-700` | 4.28:1 | **Marginal — below 4.5:1** |
| `sepia-500` | 3.99:1 | **Too weak for normal small text** |
| `gold-600` | 2.52:1 | Decorative only |

Small labels at 0.58–0.7rem should use at least the stronger sepia or burgundy
token. Keep lighter gold for ornaments, rules and non-text decoration. **Recheck
against the actual rendered gradients**, not tokens alone, with an accessibility
tool before sign-off.

---

#### T8 🟡 `body { overflow-x: hidden }` — keep it, but instrument it
**I: low now · E: trivial · R: low** · ⬤⬤⬤

`index.css:80-87` computes to `hidden/auto`, which makes `body` a scroll
container. Two consequences:

1. It **masks fixed-element overflow** (P1) and will silently absorb any future
   overflow instead of surfacing it. Keep it as a safety belt, but add a dev/CI
   assertion — and assert **per element**, not on `scrollWidth`:
   ```js
   // at 280, 300, 320, 390, 768
   [...document.querySelectorAll('*')].filter(el => {
     const r = el.getBoundingClientRect();
     return r.right > innerWidth + 1 || r.left < -1;
   });
   ```
2. **`position: sticky` currently still works** — Chromium propagates the overflow
   to the viewport because `html` is `visible/visible` — but the guarantee is
   fragile across engines. If the search bar ever becomes sticky, change this to
   `overflow-x: clip`, which expresses the same intent without creating a scroll
   container. [A1]

---

### Group S — Smaller findings

| # | Finding | Where | Fix |
|---|---|---|---|
| S1 | Two owners for one horizontal gutter: `main` has `px-1 sm:px-2`, the grid has `px-4` | `App.tsx:260`, `CharacterGrid.tsx:50` | One `--pad-inline` token; remove one of the two |
| S2 | `pt-20` (80px) clears a 53px header — **27px surplus at every viewport** | `App.tsx:260` | Folded into V1 |
| S3 | Gallery grid is a fixed `grid-cols-2 sm:grid-cols-3` | `GalleryTab.tsx:44` | `repeat(auto-fill, minmax(min(7.5rem,100%),1fr))` → 2 up at 390, 3 at 480, 4 at 640. The compact two-column gallery is otherwise a success — retain it |
| S4 | `.divider-ornament::before/after { max-width: 14rem }` is fixed | `index.css:196` | `max-width: clamp(3rem, 18vw, 14rem)` |
| S5 | `.bio-doc-embed iframe { aspect-ratio: 3/4; max-height: 70vh }` — a 424px-tall PDF frame at 390px | `index.css:1439` | `max-height: min(70dvh, 30rem)` |
| S6 | `text-wrap: balance` used on `.herald-line` and `.bio-title` ✅ | `index.css:480, 896` | Extend to `.card-name` and `.codex-plate h1` — cheap legibility win at narrow widths |
| S7 | Some long names create unequal card heights | `CharacterCard.tsx` | CSS Grid already handles the row safely; no action |

---

## 5 · Responsive strategy

### 5.1 The four mechanisms, in strict order of preference

| # | Mechanism | Owns | Rule of thumb |
|---|---|---|---|
| 1 | **Intrinsic** — `auto-fill`/`auto-fit` + `minmax` + `min()`, `min-width: 0`, wrapping | column counts, track lists, nav bars | *if it is a **count**, it is `auto-fill`* |
| 2 | **Fluid** — `clamp()`, `min()`, `max()`, `cqi` | type size, leading, gaps, padding, plate scale, ornament size | *if it is a **size**, it is a `clamp()`* |
| 3 | **Container** — `@container` on the article wrapper (and later the card) | article figures, image groups, `::: columns`, Lore grid, article type | *if the box is set by a component, query the component* |
| 4 | **Media queries last** | header mode, facet rail, panel anchoring, ornament suppression, `pointer`/`hover`, `prefers-reduced-motion` | *only a change of **kind** earns a media query* |

Applied strictly, this removes 6 of the 8 existing layout queries. Keep a small,
**named** set of fluid tokens; avoid scattering unrelated one-off clamps.

### 5.2 The bands — three width regimes plus one height modifier

| | **Compact** `< 30rem` | **Medium** `30–56rem` | **Wide** `≥ 56rem` |
|---|---|---|---|
| Preamble to first card | ~380–420 px | ~450–520 px | ~570–600 px (unchanged) |
| Title `h1` | 2 rem fluid | 2.5–4 rem | 4.5 rem (unchanged) |
| Herald | compact padding, `min-height: 2.25rem` | fluid | unchanged |
| Facet chips | **one-row scroll rail** (never hidden) | wrapping row | wrapping row |
| Card grid | 2 cols | 3–4 cols | 4–6 cols to a 96 rem cap |
| Card portrait | **3:4 (unchanged — crop declined)** | 3:4 | 3:4 |
| Refinement panel | in document flow | drop-down, `60dvh` | drop-down (unchanged) |
| Codex plate | fluid title, ornament kept | fluid | unchanged |
| Codex tabs | 4 equal tracks (scroll strip < 20 rem) | centred row | centred row (unchanged) |
| Article figures | capped by `size:`, no float | float from a **26 rem column** | unchanged |
| `::: columns` | 1 track | 2 from a **30 rem column** | 2–4 by column width |
| Footer nav | `auto-fit`, ~2.75 rem tiles, no numerals | 3–5 across | 9 across (unchanged) |
| Touch targets | 44 px hit boxes (coarse pointer) | as pointer dictates | unchanged |

**Height modifiers, orthogonal to all three widths**
- `max-height: 44rem` — compress preamble gaps only.
- `max-height: 34rem` — additionally suppress **ornament only**: the volume
  kicker, the rule under the title, the herald plaque, the codex divider
  ornament; `--plate-scale: 0.62`; `.codex-scroll` padding to 3.25rem.
  **Nothing informational is removed.** ~15 lines of CSS, and it is what makes
  phone landscape and 768px-tall laptops usable.

### 5.3 Progressive spatial compression — the mechanism in one place

```css
:root {
  --header-h:    3.25rem;
  --gap-section: clamp(0.75rem, 2.2vh, 2.25rem);   /* between page blocks */
  --gap-tight:   clamp(0.35rem, 1.2vh, 0.75rem);   /* within a block */
  --pad-inline:  clamp(0.4rem, 2vw, 1.25rem);      /* page/grid side padding */
}
@media (max-height: 34rem) { :root { --gap-section: .5rem; --gap-tight: .25rem; } }
```

A `vh` term inside a `clamp()` *is* "compresses as space runs out", natively. No
JavaScript, no `ResizeObserver`, no extra breakpoints — and the desktop value is
pinned at today's number by the clamp maximum.

### 5.4 Invariants

- Test portrait and landscape explicitly; **never infer landscape from width**.
- At 200 % zoom every primary action stays reachable, no root horizontal scroll
  appears, and dialog focus stays in the visible top layer.
- Long Russian / German / English labels wrap or scroll within owned containers.
  Unbreakable title words, URLs and filenames are separate cases.
- Safe-area insets on **all four** sides.
- One intentional scroll owner per surface, always.

---

## 6 · Prioritized roadmap

Impact is measured against one metric: **useful information per screen**, at
320×568, 390×844, 844×390, 1366×768 and 1512×982.

### Phase 0 — Correctness, access and unblocking · ≈ 1.5 days

| # | Item | I | E | R | Why first |
|---|---|---|---|---|---|
| P1 | Fixed header fits 280–320px; bind `main` inset to `--header-h` | Very high | S–M | Med | Content is unreachable below 315px |
| P2 | Modal focus primitive: entry, containment, inertness, Escape unwind, restoration. ARIA tab pattern with `stopPropagation` | Very high | M | Med | Keyboard users cannot use the codex at all today |
| P3 | `.form-ink { font-size: max(16px, 0.95rem) }` | High | XS | None | Kills the iOS focus-zoom trap |
| P4 | `@layer components` + `.btn-rpg` custom-property API; delete 16 `!important`s | Enabler | M | Low | Without it most fixes below cannot be written as utilities, and T1 needs `!important` |
| R6 | Table scroller: `min-width: 26rem` | Med | XS | Low | Restores a documented spec guarantee |

**Gate:** 280–430px and 200 % zoom pass reachability with a per-element bounds
check; covered-page controls cannot receive focus; nested dialogs unwind and
restore focus correctly.

### Phase 1 — Recover the first viewport · ≈ 1 day, most of the benefit

| # | Item | I | E | R | Measured / projected effect |
|---|---|---|---|---|---|
| V1 | Fluid preamble tokens + `--header-h` anchoring + fluid title | ★★★★★ | S | Low–Med | ✎ grid top 642 → **412** @390; 770 → **602** @375; 680 → **571** @1512 |
| V3 | `.card-grid` `auto-fill` + fluid gap/padding + 96 rem cap; de-duplicate the skeleton; `col-span-full` divider | ★★★★★ | S–M | **Med** | ✎ 1512: 4 → **6 cols**, 9.4 → **14.6 cards/viewport**; all size discontinuities gone |
| V2 | Facet chips → one-row rail on compact (**not** hidden) | ★★★★☆ | S–M | Low | ✎ chips **158 → 48 px**; with V1, chrome **→ 492 px**, first full card row above the fold |
| L2 | The `34rem` / `44rem` height tiers (ornament only) | ★★★★☆ | S | Low | ✎ 844×390 chrome → ~240 px |
| T4 | `vh` → `svh`/`dvh` sweep (6 sites), fallback-first | ★★★☆☆ | XS | None | Panel bottoms stop hiding behind mobile toolbars |
| T5 | `env(safe-area-inset-*)` on the four fixed edges | ★★☆☆☆ | S | None | Honours the cover viewport already declared |
| R1a | `.codex-scroll` padding: fix the `pt-16 sm:pt-14` inversion | ★★☆☆☆ | XS | None | −8 px and one less magic number |
| V5 | Collapse the three stacked bottom spacers | ★☆☆☆☆ | XS | None | −96 px of dead scroll |

> **Sequencing constraint.** V1 and V3 must ship **together**. Measured: V3 alone
> at 1512×982 gives 6 columns but still 0 fully-visible cards, because 571px of
> chrome plus a 383px row pitch exceeds 982px. Either alone under-delivers. [A1]

**Gate:** first-card acceptance targets pass at 320×568, 360×640, 390×844,
667×375, 844×390 and 1366×768; wide screenshot identity within tolerance.

### Phase 2 — The reading experience · ≈ 1.5 days

| # | Item | I | E | R | Note |
|---|---|---|---|---|---|
| L3 | `container-type` on the **article wrapper** (not `.bio-article`) | ★★★★☆ | M | Med | Verify `.fx-curl` stacking and the `.drop-cap` float |
| R1b | Fluid codex plate + `--plate-scale` + opaque control shelf | ★★★★★ | S | Low–Med | ✎ 844×390 article share 4 % → ~43 % |
| R3 | Figure size unconditional and fluid; float from a 26 rem **column**; intrinsic image groups | ★★★★☆ | M | Low–Med | 35 authored figures stop being full-bleed on every phone |
| R5 | Fluid article type **and leading** in `cqi` | ★★★★☆ | S | Low | mobile measure ~35 → ~39 ch, −12 % vertical per paragraph; desktop unchanged by construction |
| R2 | Codex tabs → 4 non-wrapping tracks (scroll < 20 rem) | ★★★☆☆ | S | Low | strip 73 → ~41 px; symmetry restored |
| R4 | `::: columns` container-driven + polarity flip; delete `48rem`/`47.999rem` | ★★★☆☆ | M | Low | 55 blocks / 118 cells affected |
| T3 | Refinement panel in flow below 40 rem + `scrollIntoView` on open | ★★★★☆ | S–M | Med | **Re-measure after Phase 1 first** |
| T1 | `pointer: coarse` hit expansion | ★★★★☆ | S–M | Med | Drawn sizes unchanged; mind the `.btn-rpg` `position` footgun |

### Phase 3 — Density polish and structural tidy · ≈ 1 day

| # | Item | § |
|---|---|---|
| V4 | Footer `auto-fit` + fluid tile height; **delete** `index.css:755–762` | V4 |
| V6 | Card plate compaction + `hover: none` flourish removal (**crop declined**) | V6 |
| R7 | Lore row grid; Lore two-up as a container query; document/media row wrapping | R7 |
| T2 | Image / ASCII toolbars: wrap or group; `AsciiTabViewer` fluid header padding | T2 |
| T6 | Gate hover lift/zoom on `(hover: hover) and (pointer: fine)` | T6 |
| T7 | Contrast pass on small labels against **rendered** gradients | T7 |
| L1 | Declare `--breakpoint-*`; delete the 420/480/640-raw thresholds | L1 |
| R8 | `min-h-[40vh]` → `min(40svh, 18rem)` | R8 |
| S1–S7 | Gutter token, gallery `auto-fill`, ornament clamps, `text-wrap: balance` | S |

### Phase 4 — Opportunistic and design-gated

- **Dev-time overflow assertion** at 280/300/320/390/768 — per-element bounds,
  not `scrollWidth`. (T8)
- **Intrinsic image dimensions** where content metadata can supply them without
  guessing; responsive `srcset` only after a real local image pipeline exists —
  external placeholders cannot be responsibly converted by CSS alone. [A4]
- **Sticky search bar on medium and up.** High value for a long catalogue;
  requires T8's `overflow-x: clip` and `align-self: start` if the bar ever lands
  in a flex or grid parent — the most common silent sticky failure. Keep it off
  compact, where 56px of permanent chrome is too expensive.
- **Bottom-sheet refinement panel** — the alternative to T3, deferred as
  off-idiom. Raise only if the in-flow variant tests badly, and only after P2.
- **Wide-screen codex.** At 1512px the article uses 768px of a 1128px pane
  (180px of empty parchment each side). Do **not** set the article in two
  columns — a two-column measure inside a vertical scroll container forces the
  reader up and down per screen. In order of safety: (a) leave it, the margin
  *is* the manuscript; (b) a right-hand rail at `min-width: 80rem` holding the
  portrait and the Lore summary, so the Biography tab shows dossier facts without
  a tab switch; (c) narrow the panel. **Recommendation: (a) now, (b) later as a
  designed feature.**
- **Container queries on the catalogue card**, once V3 makes its width continuous.

---

## 7 · Verification

### 7.1 Protocol

**Drag, don't jump.** Every size discontinuity in this document was found
*between* named breakpoints, not at them. Scan continuously from **280px**, not
320px.

1. Drag width **280 → 2560px** with the grid visible. The card must never shrink
   as the window grows. Watch 300, 480, 540, 640, 780, 896, 1020, 1160px.
2. Drag height **300 → 1200px** at a fixed 900px width. Ornament should fade out
   below ~544px; **nothing informational may disappear**.
3. Re-run the §2.2 baseline at the full viewport set and record: grid top,
   preamble %, column count, card height, **cards fully visible in screen 1**,
   codex chrome-before-text, and a per-element horizontal bounds check.
   Regression = any cell worse than baseline.
4. Keep the probe as a small script under `app/vite/` so the gate stays cheap.

### 7.2 Required viewports

`280×568 · 300×568 · 320×568 · 360×640 · 390×844 · 430×932 · 667×375 · 768×1024 ·
844×390 · 1024×768 · 1366×768 · 1440×900 · 1920×1080`

### 7.3 Acceptance matrix

| Area | Required check |
|---|---|
| **Catalogue flow** | Continuous drag 280–1920px; no clipped fixed controls; no root overflow; card top **≤ 480px** at 360×640 / 390×844 with ≥ 35–40 % of the first card visible; **≤ 500px** at 1366×768; ≥ meaningful portion of a result at 320×568 |
| **Header** | 280 / 300 / 320 / 360 / 390 / 430px: all controls visible, 44px targets, full accessible names, no content hidden under a wrapped fixed bar |
| **Grid monotonicity** | Column count never decreases as width grows; card width stays in the 134–244px band; skeleton matches the real grid at every width |
| **Codex** | 280×568 / 320×568 / 390×844 / 667×375 / 844×390 / 1024×768: one reader scroll owner; **first heading or two body lines visible in landscape**; selected tab visible; article text > 40 % of the viewport at 844×390 (today 4 %) |
| **Dialog keyboard** | Open from a card; Tab/Shift+Tab cycle the top layer only; open the nested viewer; Escape closes exactly one layer; focus restores twice; background inert throughout |
| **Tab semantics** | Only the selected tab has `tabIndex=0`; Arrow/Home/End stay in the tablist and **never turn entries**; selection and panel association announced |
| **Advanced search** | Opening at 280×568 / 390×844 / 844×390 reveals the panel title and first control; the final action is reachable; exactly one scrollbar; no page-width expansion |
| **BioMD conformance** | One page exercising headings, table, code, verse, nav, floats, image tracks, 2/3/4 columns, frames, signature, drop cap and document trigger, at compact / medium / wide. A source-authored `small` figure stays visually small on compact even when its float is cancelled. Source order preserved |
| **Media viewers** | Gallery, nested image viewer and a real document-triggered ASCII tab at 320×568 / 390×844 / 844×390; toolbars wrap or group without occluding content |
| **Touch** | `pointer: coarse` emulation: every interactive element ≥ 44 × 44px of **hit area**; **no drawn size may have changed**; real iOS Safari — focus every refinement field, the page must not zoom |
| **Safe area** | Notch and home-indicator insets in **both** orientations; left/right insets verified against the centred symmetry |
| **Zoom** | 125 / 150 / 200 % at 1280×720 and a narrow-window equivalent; focus visible; no two-dimensional page scroll; every primary action reachable |
| **Motion** | `prefers-reduced-motion: reduce` with `data-fx="on"` and `"off"` — the three-axis policy must still hold; hover effects absent under `hover: none` |
| **Localization** | Longest-label pass in ru, de, en (and zh if shipped): codex tabs, facet chips, footer items, codex plate, card names, filter values |
| **Wide identity** | 1440×900 and 1512×982 side-by-side against `main`: the codex, herald, footer and card *appearance* pixel-identical; **only** the grid's column count and outer width may differ |
| **Routes** | Reopen every catalogue route; smoke the article-only pages (About / Sources / Links / News) |

---

## 8 · Things NOT to change

Merged from all four audits, with conflicts resolved.

**Visual identity — untouchable**
1. The palette and every `@theme` token, the two Cormorant families, and the
   `--font-music` fallback chain with its measured `--fx-clef-*` compensation.
   No new colours, no dark mode, no `prefers-color-scheme` branch — the app
   declares `color-scheme: light` deliberately.
2. `.parchment`, `.ornate-border`, the double gold/brown border, `CornerOrnament`
   filigree, `.fx-curl` and its curled-corner shadows, drop capitals,
   `.divider-ornament`, the footer's string rules and rosette. **Scale them with
   `clamp()`; never delete them.** The single exception is the `max-height: 34rem`
   overlay, where the kicker and closing ornament are hidden — a genuinely
   space-starved case, not a general mobile rule.
3. The page-turn choreography (`page-turn-open/close`, `leaf-in`) and the
   `CLOSE_MS = 320` ↔ `.page-turn-close` contract. Documented, measured, and
   unrelated to RWD.
4. **The centred, symmetrical composition.** Do not left-align the title, the
   herald or the codex plate on mobile to save space — the symmetry *is* the
   manuscript, and V1–V3 recover the space without it.
5. **The card's 3:4 portrait crop.** Declined by three-way agreement (V6).
6. The catalogue card's anatomy: portrait, name plate beneath, badge top-left,
   flags top-right, gold hover ring. V3 changes how many cards fit, never what
   one looks like.
7. The 3D pointer tilt, cursor glare and shine sweep, including their
   fine-pointer-only engagement.
8. The static CSS/SVG background grain. No canvas, no particles.

**Structure and behaviour**
9. The content/renderer split, hash routes, lazy viewer boundaries, the catalogue
   data model, and the BioMD parser. **No `*.bio.md`, `*.bio.json` or
   `index.json` edit is implied by any recommendation here.** R3 is a *renderer*
   change; the `size:`/`position:` vocabulary keeps its exact current meaning.
10. **The four codex tabs.** Do not collapse them into a `<select>`, an accordion
    or a "more" menu, and do not move them to bottom navigation. R2 makes all
    four fit.
11. The fixed header as a concept. It carries the brand and the language switch
    and costs 53px. Do not make it scroll away or shrink on scroll. (P1 changes
    only what it contains below ~315px.)
12. The codex's `p-2 sm:p-6` inset and the `absolute inset-[11px]` reading pane.
    The gap between backdrop and panel is what makes it a *book on a desk* rather
    than a full-bleed mobile page. Resist "edge-to-edge on mobile", and never make
    the body the reader's scroll owner.
13. **`max-w-3xl` on the article** (~85 characters). Widen the codex *panel* if
    desired; never the prose column. R5's clamp maximum preserves it exactly.
14. The two-column compact catalogue. Never a one-card list by default.
15. The herald's four tones, its `aria-live` rotation, and the *concept* of a
    settled `min-height` — only the number becomes fluid.
16. The reduced-motion policy including the `--fx-dur` mechanism and the
    `html[data-fx="on"]` opt-in pair.
17. The performance choices responsive work could quietly undo: hover-only
    `will-change`, `contain` on the drift layer, literal keyframe values, the
    4-eager-portrait rule, `memo`'d cards, no canvas.
18. The main search input's 18px font — the one control already immune to iOS
    zoom.
19. `body { overflow-x: hidden }`. Keep it as a safety belt; add the assertion
    (T8) rather than removing it.
20. Native form controls, including the country `<select>`. No custom select, no
    carousel.

**Approaches to avoid**
21. **No JavaScript-driven layout.** No `ResizeObserver` column counting, no
    measured breakpoints, no JS-computed font sizes. `auto-fill` and `clamp()` do
    all of it, and the app's performance philosophy forbids per-frame layout work.
    JavaScript may support interaction mechanics; it must not duplicate CSS
    breakpoint logic.
22. **No new dependencies.** Every fix above is native CSS.
23. **No breakpoint proliferation.** The target is *fewer* thresholds than today
    (5 → 3 + 1 height), not more. Any new query must name the content reason it
    exists. Never add `xl:`/`2xl:`.
24. **No second styling system.** `@layer components` (P4) is a precedence
    declaration over rules that already exist, not a parallel system.
25. **Do not shrink touch targets to recover density.** Recover it from
    ceremonial gaps, wrapping and control grouping.
26. **Do not globally reduce font sizes.** Compress low-value space while
    preserving readable prose.
27. **Do not hide substantive content** — catalogue entries, filters, article
    blocks or media — merely to satisfy an above-the-fold metric. (This is why
    V2 keeps the facet rail instead of hiding it.)
28. Do not hide Effects, ambience or sound to make the header fit; each is a
    unique control with no duplicate surface.
29. Do not remove placeholder footer items without a product decision — they carry
    translated feedback and signal navigation intent.
30. Do not mix the existing content/asset anomalies (missing gallery assets,
    misfiled fixture content, the `index.json` entry-count question) into the
    responsive implementation scope. File them separately.

---

## 9 · Open questions to resolve before Phase 1

| # | Question | Why it blocks | How to answer |
|---|---|---|---|
| **X1** | Does the catalogue ship **1** entry or **16**? | Every chip-row height, "cards visible" figure and acceptance target depends on it. A1's numbers came from a 24-entry fixture; A2's from a single record. | `jq 'length' pages/index.json`; `ls pages/*/`; count rendered cards at 1440×900 |
| **X2** | Confirm the sub-315px header clipping and re-verify "no overflow" with a **per-element** bounds check at 280/300/320 | Determines whether P1 is P0 or a non-issue | See the snippet in T8 |
| **X3** | Confirm the table scroller is inert | Determines whether R6 is a bug fix or a no-op | At 390px on a table-bearing article: `el.scrollWidth > el.clientWidth` on `.bio-table-scroll` |
| **X5** | Re-resolve every A3-only `file:line` reference | Three audits' TSX line numbers agree; A3's diverge. Paths, however, are A3/A4's nested form | `rg -n` the cited symbol in each file |
| **D1** | May the 1280px reference view go from 4 to 5 columns? | Gates V3's band tuning | Design review of a before/after screenshot; opt-out is `--card-min: 15rem` at the `80rem` band |
| **D2** | Is the in-flow refinement panel acceptable, or is a bottom sheet wanted? | Gates T3 and adds a P2 dependency | Design review; the in-flow variant is recommended |

---

*Composite assembled from four independent audits of the same codebase. Where
sources conflicted, the resolution and its reasoning are stated inline rather
than silently averaged. All measurements are observed values from the source
audits, not targets; re-baseline against the live repository before freezing any
acceptance number.*
