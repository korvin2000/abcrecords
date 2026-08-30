# Responsive Web Design Audit — `app/` (guitar-codex)

**Scope:** the React SPA in [`app/`](app/) — architecture of its styling system, layout,
typography, spacing, navigation, cards, media, the BioMD renderer, and its
existing responsive behaviour.
**Brief:** [`todo-audit.md`](todo-audit.md) — make the app substantially more usable
and information-dense on phones, tablets, laptops, narrow windows and low-height
viewports **without changing its visual language, desktop appearance, content
model or architecture**.
**Method:** source review of all 133 files under `app/src`, plus live measurement
of the running dev server at 12 viewport sizes (320×568 → 1920×1080, including
landscape phone 844×390 and iPad-landscape 1024×768). Every number below marked
*measured* came from the DOM, not from reading CSS.
**Status:** analysis and planning only. **No application files were modified.**

---

## 0 · Executive summary

The app has a genuinely good widescreen composition and a disciplined,
well-documented CSS layer. Its responsive system, however, is effectively
**one breakpoint wide**: 81 uses of Tailwind's `sm:` (640 px) against 1 real
`md:`, 5 `lg:`, and zero `xl:`/`2xl:`. There are no container queries, no
`clamp()` in any layout or type rule, and no `dvh`.

The consequence is not overflow — there is none (verified) — it is that
**the page's furniture is a fixed-size object that the content has to fit
around**.

> **The single defining measurement.** The vertical distance from the top of the
> document to the first catalogue card is **≈ 600–690 px at every viewport
> tested**, from a 320 px phone to a 1920 px desktop. It never compresses.
> As a share of the screen that is 55 % at 1920×1080, 69 % at 414×896,
> 80 % at 1024×768, 122 % at 320×568 and **153 % at 844×390** (landscape phone).
>
> **At 10 of the 12 viewports measured, the number of catalogue cards fully
> visible in the first screen is zero.**

The same pattern repeats inside the codex modal: at 844×390 the reading pane is
317 px tall and 301 px of it (**95 %**) is chrome before the first line of the
biography — the reader must scroll before reading a single word.

Six changes, all small and CSS-local, recover most of it. A live simulation of
just the first one (fluid preamble spacing + suppressing the duplicated facet
chip row on narrow screens) measured **230 px recovered at 390×844**, taking the
preamble from 76 % to 49 % of the viewport and the cards-above-the-fold count
from **0 to 2**. Adding the card compression took steady-state density from
**4 to 6 cards per screen (+50 %)**.

None of this requires touching the palette, the ornament, the fonts, the
component tree, or the desktop layout.

---

## 1 · Current-state assessment — what is good and must stay

These are strengths. Several of them are *why* the fixes below can be small.

| # | What | Where | Why it matters |
|---|---|---|---|
| 1 | **One stylesheet, one token block.** All design tokens (`--color-paper-*`, `--color-gold-*`, `--font-*`) live in a single `@theme` block. | [`index.css:17–61`](app/src/index.css) | Every recommendation below can be expressed as new tokens in the same block. No refactor needed to introduce fluid scales. |
| 2 | **Semantic component classes, not utility soup.** `.herald`, `.parchment`, `.search-panel`, `.bio-*`, `.fx-curl`, `.footer-*` are real named components with rationale comments. | `index.css` throughout | Responsive rules can be attached to *one selector* instead of hunted across JSX. This is the highest-leverage property of the codebase. |
| 3 | **Exceptional inline documentation.** Nearly every non-obvious rule explains *why* (`.btn-rpg` must not set `position`; `.form-segments` uses `inline-flex`; the `will-change` note on `.fx-curl`). | `index.css`, `CodexShell.tsx:25–57` | Prevents the classic audit failure of "fixing" something load-bearing. Preserve this convention in any change. |
| 4 | **No horizontal overflow anywhere.** Verified at 320 px with a full-DOM scan; also verified that `body { overflow-x: hidden }` is *not* masking real overflow (scrollWidth = 320 with it disabled). | [`index.css:86`](app/src/index.css) | The starting point is sound. This audit is about density, not breakage. |
| 5 | **Media escape hatches already exist and are correct in principle.** `pre` scrolls in its own box; `ScrollableTable` wraps tables; `.bio-nav ul` wraps; `.bio-columns > * { min-width: 0 }`; `.form-segments { max-width: 100% }`. | `BioArticle.tsx:188`, `index.css:986, 1266, 1335` | The author already understands the failure modes. Two of these are currently inert (§2.7) but the structure is there. |
| 6 | **Genuinely good performance discipline.** `contain: layout paint style` on the drift layer, hover-only `will-change`, memoized cards, lazy codex chunk, idle neighbour prefetch, compositor-only animations. | `index.css:1536`, `CharacterCard.tsx:123`, `App.tsx:190–208` | Density increases node counts; this headroom is what makes that affordable. |
| 7 | **Reduced-motion is handled deliberately**, including the opt-back-in path for reader-enabled ornaments. | [`index.css:1624–1642`](app/src/index.css) | Keep exactly as is. |
| 8 | **The widescreen composition is correct and attractive.** Symmetrical, calm, generous — it matches [`docs/Biography_card_Design.md`](docs/Biography_card_Design.md). | — | This is the reference. Nothing below should alter what a 1440×900 reader sees, except where explicitly noted as a density gain. |

---

## 2 · Concrete problems, root causes and fixes

Ordered by measured impact. Each carries the affected file/selector, the
measurement that proves it, the root cause, and a concrete fix.

---

### 2.1 🔴 The vertical preamble is a fixed block that never compresses

**The measurement.** Distance from document top to the first card, measured:

| Viewport | Grid top | % of viewport | Cards fully visible in screen 1 | Steady-state cards/screen |
|---|---:|---:|---:|---:|
| 320 × 568 | 692 px | **122 %** | 0 | 4 |
| 375 × 812 | 597 px | 74 % | 0 | 4 |
| 390 × 844 | 642 px | 76 % | 0 | 4 |
| 414 × 896 | 614 px | 69 % | 0 | 4 |
| 768 × 1024 | 597 px | 58 % | 0 | 6 |
| **844 × 390** (landscape) | 597 px | **153 %** | 0 | ~1 row |
| 1024 × 768 | 617 px | 80 % | **0** | **4** |
| 1280 × 1080 | 597 px | 55 % | 4 | 8 |
| 1440 × 900 | 617 px | 69 % | 0 | 8 |
| 1920 × 1080 | 597 px | 55 % | 4 | 8 |

Note row 1024×768: **a laptop shows exactly as many entries per screen as a
320 px phone.**

**Budget, measured at 320×568** (band heights read from the DOM; they sum to the
measured 692 px total, though individual tops can sit ±8 px off during the
entry animation):

| Band | px | Source |
|---|---:|---|
| `main` top padding (`pt-20`) | 80 | [`App.tsx:260`](app/src/App.tsx) — header is only **53 px** tall → 27 px is pure surplus |
| `AnimatedTitle` (kicker 34 + `mt-3` 12 + h1 90 + divider 48) | 184 | [`AnimatedTitle.tsx:336–413`](app/src/components/AnimatedTitle.tsx) |
| Herald wrapper `mt-5` | 20 | [`HeraldBanner.tsx:43`](app/src/components/herald/HeraldBanner.tsx) |
| Herald plaque (`min-height: 3.5rem` + `1.15rem/2.1rem` padding) | 107 | [`index.css:400–460`](app/src/index.css) |
| SearchBar wrapper `mt-9` | 36 | [`SearchBar.tsx:62`](app/src/components/search/SearchBar.tsx) |
| Search input box | 54 | `SearchBar.tsx:70` |
| `mt-4` + **quick facet chip rows** | 16 + **127** | `SearchBar.tsx:128` |
| `mt-3` + result count line | 12 + 16 | `SearchBar.tsx:148` |
| Grid wrapper `mt-10` | 40 | `App.tsx:295` |
| **Grid starts** | **692** | |

**Root cause.** Every one of those gaps is a fixed Tailwind rem step chosen to
look right in the widescreen composition. `pt-20 · mt-5 · mt-9 · mt-4 · mt-3 ·
mt-10` sum to **204 px of pure whitespace** that is identical on a 568 px phone
and a 1080 px desktop. There is no fluid spacing scale anywhere in the project
(`grep -c "clamp(" index.css` → **0**). On top of that, the quick-facet chip row
(127 px at 320 px, four to five wrapped rows) is **fully duplicated** inside
`AdvancedSearchPanel` — the same `ChipGroup` bound to the same criteria
([`SearchBar.tsx:129`](app/src/components/search/SearchBar.tsx) vs
[`AdvancedSearchPanel.tsx:246–266`](app/src/components/search/AdvancedSearchPanel.tsx)) —
so on a phone it costs a fifth of the screen to show a control that is already
one tap away.

**Fix.** Introduce a fluid block-spacing scale as tokens and use it for the
preamble only. This is additive: nothing existing has to be rewritten.

```css
/* index.css — add to @theme */
--space-2xs: clamp(0.25rem, 0.18rem + 0.35vw, 0.5rem);
--space-xs:  clamp(0.4rem,  0.28rem + 0.6vw,  0.75rem);
--space-sm:  clamp(0.6rem,  0.4rem  + 1vw,    1.25rem);
--space-md:  clamp(0.9rem,  0.55rem + 1.75vw, 2.25rem);
--space-lg:  clamp(1.25rem, 0.7rem  + 2.75vw, 3rem);
```

```css
/* Preamble rhythm — one owner instead of six margin utilities */
.page-head       { padding-top: calc(3.5rem + env(safe-area-inset-top)); } /* was pt-20 = 5rem */
.herald-wrap     { margin-top: var(--space-sm); }   /* was mt-5  */
.searchbar-wrap  { margin-top: var(--space-sm); }   /* was mt-9  */
.searchbar-count { margin-top: var(--space-2xs); }  /* was mt-3  */
.grid-wrap       { margin-top: var(--space-md); }   /* was mt-10 */

.herald        { padding: var(--space-xs) var(--space-md); }
.herald-body   { min-height: clamp(2.25rem, 6vh, 3.5rem); } /* was 3.5rem flat */
.herald::before{ top:    clamp(0.3rem, 1vh, 0.5rem); }
.herald::after { bottom: clamp(0.3rem, 1vh, 0.5rem); }

/* The chip row duplicates the panel's own facets — reclaim it on narrow screens.
   The AdvancedToggle badge already signals that refinements are active. */
@media (max-width: 34rem) { .searchbar-facets { display: none; } }
```

**Verified result** (simulated live in the DOM at 390×844, then reverted):

| | Before | After | Δ |
|---|---:|---:|---|
| Grid top | 642 px | **412 px** | **−230 px** |
| Preamble share | 76 % | **49 %** | −27 pp |
| Cards fully visible, screen 1 | **0** | **2** | +2 |

---

### 2.2 🔴 There is effectively only one breakpoint

**The measurement.** Tailwind responsive prefixes across `app/src`:

```
81 × sm:    (640px)
 1 × md:    — a single rule, AnimatedTitle.tsx:363 `md:text-7xl`
 5 × lg:    (1024px)
 0 × xl:  0 × 2xl:
```

(A naive `grep -o 'md:'` reports 10; the other nine are TypeScript property
annotations such as `md: string`. **One** real `md:` layout rule exists.)

Plus six hand-written width queries in `index.css` at **four distinct
thresholds — 420, 480, 640 and 768 px — written in three unit conventions**:

```
@media (max-width: 420px)      @media (min-width: 640px)
@media (max-width: 480px) ×2   @media (min-width: 40rem)     ← 640px again, different unit
@media (min-width: 48rem)      @media (max-width: 47.999rem) ← 768px, fractional edge
```

**Root cause.** `sm:` is being used as a synonym for *"not a phone"*. Everything
from 640 px to 2560 px receives one identical set of desktop values. The
640–1024 band — tablets in portrait, split-screen windows, small laptops, the
half of a 1080p screen a user snaps a browser to — is served a layout designed
for 1440 px, and the 1440–2560 band is served a layout designed for 1280 px.

**This is the structural cause of §2.3, §2.4, §2.6 and §2.9.** It is also why
"just add more breakpoints" is the wrong answer: the fix is to make the three
places that actually need to respond do so *continuously* (auto-fill grids,
`clamp()` type, container queries), and keep the breakpoint count at three.

**Fix.** Adopt the minimal, content-derived scale in §3 and delete the ad-hoc
420/480/47.999 values. Never add `xl:`/`2xl:`; use `auto-fill` instead.

---

### 2.3 🔴 Article figures have a 3× size cliff at exactly 640 px

**The measurement.** The same `size: small` figure in the same article:

| Viewport | Figure width |
|---|---:|
| 639 px | **567 px** |
| 700 px | **175 px** |

A 3.2× discontinuity across one pixel of viewport width. At 390 px, **12 of 13
figures** in the BioMD demo article render at full column width (318 px).

**Root cause.** [`BioArticle.tsx:245–260`](app/src/lib/biomd/BioArticle.tsx):

```ts
const SIZE_CLASS = { small: "sm:max-w-[200px]", medium: "sm:max-w-[320px]",
                     large: "sm:max-w-[460px]", full: "" };
const FLOAT_CLASS = { left: "sm:float-left sm:mr-6 sm:mb-2", right: "sm:float-right …", … };
```

Both the size cap **and** the float are gated behind `sm:`. Below 640 px neither
applies, so the author's `size: small` — a deliberate editorial statement that a
picture is a marginal illustration — becomes a full-bleed hero. The corpus uses
`size: medium` 27 times and `size: small` 8 times; all 35 are promoted to
full-width on every phone.

Worse, the gate is on the **viewport**, but the figure lives inside the codex
reading pane, whose width is `min(768px, pane − padding)` — 318 px at a 390 px
viewport, 556 px at a 700 px viewport, 684 px at 844 px. The viewport is simply
the wrong thing to measure.

**Fix.** Make the size cap unconditional and fluid; make the float a *container*
decision. See §2.4 for the container declaration.

```css
/* Applies at every width; the figure is already `w-full`, so max-width
   is a cap, never a floor. No cliff. */
.bio-figure--small  { max-width: min(100%, clamp(7.5rem, 34cqi, 12.5rem)); }
.bio-figure--medium { max-width: min(100%, clamp(11rem,  52cqi, 20rem));   }
.bio-figure--large  { max-width: min(100%, clamp(14rem,  72cqi, 28.75rem));}

/* A float needs room for a readable text column beside it — that is a fact
   about the article column, not about the window. */
@container article (min-width: 26rem) {
  .bio-figure--left  { float: inline-start; margin-inline-end: var(--space-md); margin-block-end: .5rem; }
  .bio-figure--right { float: inline-end;   margin-inline-start: var(--space-md); margin-block-end: .5rem; }
}
```

Replace the `SIZE_CLASS`/`FLOAT_CLASS` Tailwind maps with these static class
names. This *reduces* the JSX (no more `sm:` string maps) and moves the decision
into the stylesheet where the rest of `.bio-*` already lives.

---

### 2.4 🔴 `::: columns` stacks until 768 px — the article column is never that wide on a phone anyway

**The measurement.** At 700×900 the article column is 556 px wide and all four
`::: columns` blocks are still a single 556 px track. The corpus contains
**55 `::: columns` blocks with 118 cells** — this is the most-used layout block
in the content after `::: image`.

**Root cause.** [`index.css:1338`](app/src/index.css) and `1351`:

```css
@media (min-width: 48rem)     { .bio-cols-2 { grid-template-columns: repeat(2, minmax(0,1fr)); } … }
@media (max-width: 47.999rem) { .bio-columns--divided > * + * { border-block-start: …; } }
```

A viewport media query describing a component constraint. The article column
width and the window width are unrelated: the codex pane is inset from a
`max-w-6xl` panel by 11 px + 16/36 px padding, then capped at `max-w-3xl`
(768 px). A 1024 px window gives a 720 px article; a 700 px window gives 556 px.
The 768 px switch fires on the wrong quantity.

`47.999rem` is additionally fragile: a fractional edge that can, under browser
zoom or sub-pixel rounding, be missed by both queries or matched by both.

**Fix.** One container declaration, then convert the queries. Put the container
on the **wrapper**, not on `.bio-article` itself — `container-type: inline-size`
implies `contain: layout style`, which would make `.bio-article` a containing
block and stacking context for its descendants, and `.fx-curl:hover { z-index: 20 }`
would then be trapped inside it.

```tsx
// CodexArticle.tsx:336 — the only JSX change required
<div className="mx-auto max-w-3xl [container-type:inline-size] [container-name:article]">
```

```css
/* Replaces both media queries at index.css:1338 and :1351 */
.bio-article .bio-columns--divided > * + * {
  border-block-start: 1px solid rgba(184, 144, 42, 0.4);
  padding-block-start: 0.8em;
}
@container article (min-width: 30rem) {
  .bio-article .bio-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container article (min-width: 42rem) {
  .bio-article .bio-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@container article (min-width: 54rem) {
  .bio-article .bio-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
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

Note the polarity flip: the stacked-divider rule becomes the **default** and the
wide rule the override, which removes the `47.999rem` edge entirely. This is the
single change that also unlocks §2.3, §2.7 and §2.11.

**Browser support:** container queries are Baseline since 2023 and the project
already targets `baseline-widely-available`
([`vite.config.ts:36`](app/vite.config.ts)). No fallback needed; if one is
wanted, the un-queried default (stacked) is a correct degradation.

---

### 2.5 🔴 On a short viewport the codex opens with zero lines of text visible

**The measurement**, at 844×390 (landscape phone), entry `agustin-barrios`:

| | px | % of pane |
|---|---:|---:|
| Reading pane height | 317 | 100 % |
| `.codex-scroll` top padding (`pt-14`) | 56 | 18 % |
| `CodexHeader` plate | 196 | 62 % |
| Tab strip | 41 | 13 % |
| **Chrome before the first line of prose** | **301** | **95 %** |
| **Lines of biography visible on open** | **0** | |

At 390×844 the same figure is 317 px of a 769 px pane — **41 %** — and the
four-item tab strip **wraps to two rows** (measured tops 316 and 346; the four
buttons total 419 px in a 318 px row).

Plate composition at 844×390: kicker 16 + 8 → **h1 at 48 px** (`sm:text-5xl`, on
a 390 px-tall screen) → h2 at 36 px → subtitle 28 → ornament 28 + `mb-5` 20.

**Root causes.**
1. [`CodexShell.tsx:191`](app/src/components/codex/CodexShell.tsx) — `pt-16 sm:pt-14`. **The mobile value is larger than the desktop value** (64 px vs 56 px), which is backwards; the control row it clears is `top-4` + 36 px = 52 px at both sizes.
2. [`CodexHeader.tsx:284, 291`](app/src/components/codex/CodexHeader.tsx) — `sm:text-5xl` / `sm:text-4xl` are viewport-width decisions applied to a *height*-constrained problem. A 48 px title is right at 844×900 and absurd at 844×390.
3. [`CodexTabs.tsx:336`](app/src/components/codex/CodexTabs.tsx) — `flex-wrap` on a 4-item strip guarantees a second row on narrow screens.
4. `max-h-[94vh]` uses `vh`, not `dvh` (§2.10).

**Fix.**

```css
/* 1 — correct the inversion and derive the value from the control row */
.codex-scroll { padding-top: calc(1rem + 2.25rem + 0.5rem); } /* 3.75rem, both sizes */

/* 2 — fluid plate; the desktop value is unchanged at ≥ 1200px */
.codex-plate h1 { font-size: clamp(1.75rem, 1.1rem + 2.6vw, 3rem); }
.codex-plate h2 { font-size: clamp(1.35rem, 0.9rem + 1.9vw, 2.25rem); }
.codex-plate p  { font-size: clamp(0.95rem, 0.9rem + 0.3vw, 1.125rem); }

/* 3 — low-height compaction: the one place a height query is genuinely right */
@media (max-height: 34rem) {
  .codex-plate            { margin-bottom: 0.5rem; }
  .codex-plate .kicker,
  .codex-plate .divider-ornament { display: none; }
  .codex-plate h1         { font-size: clamp(1.35rem, 3.2vh, 1.9rem); }
  .codex-plate h2         { font-size: clamp(1.1rem, 2.6vh, 1.5rem); }
  .codex-scroll           { padding-top: 3.25rem; }
  [role="tablist"]        { margin-bottom: 0.6rem; }
}
```

```tsx
// 4 — CodexTabs.tsx: a scroll strip, never a second row
className="mb-6 flex snap-x snap-mandatory justify-start gap-1 overflow-x-auto
           [scrollbar-width:none] rounded-md border border-gold-600/40
           bg-paper-100/60 p-1 sm:justify-center sm:gap-2"
```

Projected effect at 844×390: chrome 301 → ~150 px, leaving ~5 lines of prose
visible on open instead of none.

---

### 2.6 🟠 Widescreen wastes 30–40 % of the available width and stays at 4 columns

**The measurement.** At 1920×1080 the grid is 1152 px inside a 1920 px viewport
— **384 px of unused gutter on each side (40 % of the screen)** — and still
renders 4 columns of 262 px, exactly as at 1280.

**Root cause.** `max-w-6xl` (72 rem = 1152 px) plus a fixed three-step column
ladder, in two places that must stay in sync:
[`CharacterGrid.tsx:50`](app/src/components/CharacterGrid.tsx) and the skeleton
at [`App.tsx:370`](app/src/App.tsx):

```
grid-cols-2 gap-4 px-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4
```

Three hard column counts and a hard cap mean the layout has exactly three
states across a 2240 px range.

**Fix.** One `auto-fill` grid with a banded minimum and a fluid gap. This makes
column count continuous and content-driven, removes the duplicated ladder, and
raises the cap.

```css
.card-grid {
  display: grid;
  gap: clamp(0.75rem, 2vw, 1.5rem);
  grid-template-columns: repeat(auto-fill, minmax(min(var(--card-min), 100%), 1fr));
  max-width: 96rem;               /* was 72rem */
  margin-inline: auto;
  padding-inline: var(--gutter);
  --card-min: 8rem;
}
@media (min-width: 30rem) { .card-grid { --card-min: 9rem;  } }
@media (min-width: 56rem) { .card-grid { --card-min: 11rem; } }
@media (min-width: 80rem) { .card-grid { --card-min: 13rem; } }
```

**Verified numerically** (column count must never decrease as the viewport
widens — this parameterisation was checked for monotonicity across 22 widths):

| Viewport | Proposed cols × width | Today | Density |
|---|---|---|---|
| 320 | 2 × 134 | 2 × 132 | — |
| 375 | 2 × 162 | 2 × 160 | — |
| 414 | 2 × 181 | 2 × 179 | — |
| 540 | 3 × 159 | 2 × 242 | **+50 %** |
| 640 | 3 × 189 | 3 × 181 | — |
| 768 | 4 × 169 | 3 × 224 | **+33 %** |
| 900 | 4 × 200 | 3 × 268 | **+33 %** |
| 1024 | 5 × 179 | 4 × 226 | **+25 %** |
| 1280 | 5 × 227 | 4 × 270 | **+25 %** |
| 1440 | 6 × 212 | 4 × 270 | **+50 %** |
| 1920 | 6 × 236 | 4 × 270 | **+50 %** |

Card widths stay in the 134–244 px band — never smaller than today's phone card,
never larger than today's desktop card. **The 1280 px reference composition
gains one column and loses 43 px of card width**; if that is judged too great a
change to the canonical view, raise the `80rem` band to `--card-min: 15rem`,
which holds 4 columns to 1440 and gives 5 above it.

---

### 2.7 🟠 Two documented media escape hatches are inert

**a) Article tables do not scroll — they squash.**

Measured at 390×844 on `jimi-hendrix`: the table is 317 px wide inside a 317 px
scroller (`scrolls: false`), 3 columns at 51/109/158 px, and **every row is
75 px tall** because each cell wraps to three or four lines.

`ScrollableTable` ([`BioArticle.tsx:188`](app/src/lib/biomd/BioArticle.tsx))
correctly wraps the table in `overflow-x-auto`, but
[`index.css:1035`](app/src/index.css) sets `table { width: 100% }`, so the table
always shrinks to the scroller and there is never anything to scroll.
[`docs/Biography-Markup.md`](docs/Biography-Markup.md) §3.8 promises "a wide
table scrolls inside its own box, never the page"; today it does neither.

```css
.bio-article .bio-table-scroll { overflow-x: auto; overscroll-behavior-x: contain; }
.bio-article .bio-table-scroll > table { width: 100%; min-width: 26rem; }
/* optional: a fade cue that there is more to the right */
.bio-article .bio-table-scroll {
  mask-image: linear-gradient(90deg, #000 calc(100% - 1.5rem), transparent);
}
@container article (min-width: 26rem) {
  .bio-article .bio-table-scroll { mask-image: none; }
}
```

**b) `body { overflow-x: hidden }` is a belt with no braces.**
[`index.css:86`](app/src/index.css). Verified not to be hiding anything today,
but it will silently absorb any future overflow instead of surfacing it. Keep
it, and add a CI/dev assertion (`documentElement.scrollWidth <= innerWidth` at
320/390/768) rather than removing it.

---

### 2.8 🟠 Touch targets are 26–36 px throughout; one control triggers iOS auto-zoom

**Measured heights** of interactive controls (WCAG 2.5.8 minimum: 24 px;
practical minimum: 44 px):

| Control | Size | Where |
|---|---|---|
| Facet chips (`md`) | 89 × **27** | [`Chip.tsx:33`](app/src/components/form/Chip.tsx) |
| `.form-segment` | 54 × **26** | [`index.css:348`](app/src/index.css) |
| `AdvancedToggle` | 54 × **26** | [`AdvancedToggle.tsx:373`](app/src/components/search/AdvancedToggle.tsx) |
| `.btn-rpg` (codex close / ← →) | 40–49 × **36** | [`index.css:205`](app/src/index.css) |
| Gallery download | 95 × **26** | [`AudioPlayer.tsx`](app/src/components/AudioPlayer.tsx) |
| Language menu option | full × **~30** | [`LanguageMenu.tsx:141`](app/src/components/LanguageMenu.tsx) |
| Codex tab | 87–112 × **29** | [`CodexTabs.tsx:347`](app/src/components/codex/CodexTabs.tsx) |

**And:** all seven `.form-ink` controls compute to **15.2 px**
(`font-size: 0.95rem`, [`index.css:290`](app/src/index.css)). Any `<input>`
under 16 px makes **iOS Safari zoom the whole page on focus** — the reader taps
"Forename", the layout jumps, and they have to pinch back out. The main search
input is correctly 18 px; only the refinement panel is affected.

**Root cause.** Sizes were chosen for a fine pointer, where a 26 px pill is
elegant and perfectly clickable. There is no coarse-pointer branch anywhere in
the project.

**Fix.** Expand the *hit area* without changing the *drawn size* — this is
exactly the "increased density must not make controls impractical" requirement.
Scope everything to `pointer: coarse` so the desktop rendering is byte-identical.

```css
@media (pointer: coarse) {
  /* The pill stays the size it is drawn; the tappable box grows around it. */
  .chip, .form-segment, .btn-rpg, [role="tab"], .lang-option { position: relative; }
  .chip::after, .form-segment::after, .btn-rpg::after,
  [role="tab"]::after, .lang-option::after {
    content: ""; position: absolute; inset: 50% 0 auto 0;
    height: max(100%, 2.75rem); transform: translateY(-50%);
  }
  /* No page zoom on focus. */
  .form-ink { font-size: 1rem; }
}
```

> `.btn-rpg` must not set `position` per its own comment at
> [`index.css:201–204`](app/src/index.css). Adding `position: relative` inside a
> `pointer: coarse` block re-opens that footgun for the codex close button.
> Either use a wrapper element, or add the rule under
> `@media (pointer: coarse) { .btn-rpg:not(.absolute) { … } }`. **Verify the
> codex close button's placement after this change.**

---

### 2.9 🟠 The refinement panel opens off-screen on short viewports

**Measured at 320×568** with the panel open: panel top **517 px**, bottom
**926 px**, viewport 568 px. The reader taps the filter handle and **the entire
panel is below the fold** with no scroll cue.

**Root cause.** The panel is `absolute; top: 100%` off the search bar
([`SearchBar.tsx:110`](app/src/components/search/SearchBar.tsx)), and the search
bar itself sits 443 px down (§2.1). `max-height: min(72vh, 40rem)`
([`index.css:239`](app/src/index.css)) caps the panel's *own* height but knows
nothing about how far down the page it starts, so 72vh of panel is placed
beginning at 91vh.

**Fix (minimal, CSS-only).** Cap against the remaining space rather than the
whole viewport, and make the panel a viewport-anchored sheet where there is no
remaining space:

```css
.search-panel { max-height: min(60dvh, 40rem); }

/* Below 34rem the panel cannot fit under the bar at all — anchor it to the
   viewport instead. Same parchment, same frame; only the anchoring changes. */
@media (max-width: 34rem) {
  .search-panel-shell { position: fixed; inset: auto 0 0 0; z-index: 45; padding: 0 0.5rem 0.5rem; }
  .search-panel { max-height: 80dvh; border-radius: 10px 10px 0 0; }
}
```

Note this becomes cheaper once §2.1 lands: with 230 px reclaimed, the bar sits
at ~290 px and a 60dvh panel fits under it on most phones. Implement §2.1 first
and re-measure before deciding whether the sheet is needed.

---

### 2.10 🟠 `vh` everywhere, `dvh` nowhere, and `viewport-fit=cover` with no safe-area handling

[`index.html:5`](app/index.html) declares `viewport-fit=cover`, but
`grep -r "env(" src/` returns **nothing**. Meanwhile every full-height surface
uses `vh`:

| Value | Where |
|---|---|
| `max-h-[94vh]` | [`CodexShell.tsx:145`](app/src/components/codex/CodexShell.tsx) |
| `max-h-[96vh]` | [`AsciiTabViewer.tsx:110`](app/src/components/AsciiTabViewer.tsx) |
| `max-h-[60vh]` | [`LanguageMenu.tsx:130`](app/src/components/LanguageMenu.tsx) |
| `max-height: 70vh` | [`index.css:1443`](app/src/index.css) (`.bio-doc-embed iframe`) |
| `max-height: min(72vh, 40rem)` | [`index.css:239`](app/src/index.css) |
| `min-h-[40vh]` | `BiographyView.tsx:73`, `PageView.tsx:163` |

On mobile Safari and Chrome `100vh` is the *large* viewport — it excludes the
retracted URL bar. A `94vh` modal is therefore taller than the visible area when
the bar is showing, and its bottom edge (with the ornate corner and the closing
line) is clipped. On a notched device, `viewport-fit=cover` additionally pushes
content under the status bar and home indicator.

**Fix.** Mechanical substitution plus two insets:

```css
/* vh → dvh for anything sized to "the screen" */
.codex-panel     { max-height: 94dvh; }
.tabviewer-panel { max-height: 96dvh; }
.lang-list       { max-height: 60dvh; }
.bio-doc-embed iframe { max-height: 70dvh; }
.search-panel    { max-height: min(60dvh, 40rem); }

/* min-h-[40vh] should be svh: it is a floor, and a floor wants the small
   viewport so it never pushes content out of reach. */
.codex-tabbody   { min-height: 40svh; }

/* Honour the cover viewport that index.html already asks for. */
.app-header { padding-top: env(safe-area-inset-top); }
.codex-shell {
  padding-inline: max(0.5rem, env(safe-area-inset-left)) max(0.5rem, env(safe-area-inset-right));
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

### 2.11 🟡 Article typography is entirely static; measure is wrong at both ends

**Measured.** `.bio-article` is a flat `font-size: 1.13rem; line-height: 1.75`
([`index.css:861`](app/src/index.css)) at every width. Resulting line length:

| Viewport | Article width | Approx. measure |
|---|---:|---:|
| 390 | 318 px | **~35 ch** (too tight — the ideal band is 45–75) |
| 700 | 556 px | 62 ch ✅ |
| 844 | 684 px | 76 ch (slightly wide) |

35 characters at 18 px with a 1.75 line-height produces a ragged,
frequently-hyphenating column and wastes vertical space on leading. The demo
article measures **12.9 screens** on a 390 px phone.

**Root cause.** No fluid type scale exists. `1.13rem/1.75` is a good desktop
value applied unconditionally.

**Fix.** Once the article container from §2.4 exists, size the type to the
*column*, not the window — which is the correct quantity and needs no
breakpoints at all:

```css
.bio-article {
  font-size:   clamp(1rem, 0.92rem + 0.55cqi, 1.13rem);
  line-height: clamp(1.5,  1.42  + 0.22cqi, 1.75);
}
.bio-article h2 { font-size: clamp(1.15rem, 1rem + 0.9cqi, 1.35rem); }
.bio-article h3 { font-size: clamp(1.05rem, 0.95rem + 0.6cqi, 1.15rem); }
.bio-article .bio-title        { font-size: clamp(1.4rem, 1rem + 2.4cqi, 2rem); }
.bio-article .bio-title--second{ font-size: clamp(1.15rem, 0.85rem + 1.8cqi, 1.6rem); }
.bio-article blockquote { font-size: 1.05em; padding-inline-start: clamp(0.7rem, 3cqi, 1.1rem); }
.bio-article .bio-frame { padding: clamp(0.7rem, 3cqi, 1.2rem) clamp(0.8rem, 4cqi, 1.4rem); }
```

At a 318 px column this yields ~16.4 px / 1.53 → **~39 ch and ~12 % less
vertical space per paragraph**, with the desktop rendering unchanged (the clamps
reach their maxima at a 768 px column).

`.bio-article p { margin: 0 0 0.4em }` ([`index.css:866`](app/src/index.css)) is
unusually tight already — leave it; the leading is where the savings are.

---

### 2.12 🟡 The footer is 1.5 viewports tall on a phone and 22 % of the whole document

**Measured:**

| Viewport | Footer height | Share of document |
|---|---:|---:|
| 320 × 568 | **882 px** (1.55 screens) | 22 % |
| 375 × 812 | 850 px | 21 % |
| 414 × 896 | 833 px | — |
| 1440 × 900 | 517 px | 16 % |

Breakdown at 320: title block 147 + nav **344** + colophon 175 + rules/padding.

**Root cause.** [`SiteFooter.tsx:205`](app/src/components/SiteFooter.tsx) —
`grid-cols-2 sm:grid-cols-3 lg:grid-cols-9` for nine items. At 2 columns that is
**five rows** of `min-height: 4.25rem` (68 px) tiles
([`index.css:659`](app/src/index.css)). The `lg:grid-cols-9` single-row layout
only ever appears above 1024 px.

**Fix.**

```css
.footer-menu {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(7rem, 100%), 1fr));
  gap: clamp(0.4rem, 1.2vw, 0.75rem);
}
.footer-menu-item {
  min-height: clamp(2.6rem, 7vw, 4.25rem);
  padding: clamp(0.5rem, 2vw, 1.2rem) 0.45rem clamp(0.35rem, 1.5vw, 0.8rem);
}
@media (max-width: 30rem) {
  .footer-menu-numeral, .footer-menu-flourish { display: none; }
}
.footer-colophon { padding-block: clamp(0.6rem, 2.5vw, 1rem); }
```

At 320 px this gives 2 columns of ~44 px tiles (nav 344 → ~150 px) and at 1024+
it reaches 9 across as today. Estimated footer height at 320: **882 → ~500 px**.

The nine tiles are also the site's *only* global navigation, and six of the nine
are placeholders ([`SiteFooter.tsx:111–121`](app/src/components/SiteFooter.tsx)).
Worth asking whether all nine need to be present at phone size at all — but that
is a content decision, out of scope here.

---

### 2.13 🟡 Fixed `w-32` label column in the Lore tab

**Measured at 390×844:** `dt` is a hard 128 px = **42 % of a 307 px row**,
leaving 167 px for the value; rows with real content wrap to 60 px tall. The
label renders at 11.2 px, the value at 15.68 px — so 42 % of the width goes to
the *smaller, less important* text.

[`LoreTab.tsx:281`](app/src/components/codex/tabs/LoreTab.tsx):
`<dt className="w-32 shrink-0 …">`

**Fix.** A container-aware two-column grid that collapses to stacked pairs:

```css
.lore-row { display: grid; grid-template-columns: minmax(5rem, 8rem) 1fr; gap: 0.75rem;
            align-items: baseline; }
@container article (max-width: 24rem) {
  .lore-row { grid-template-columns: 1fr; gap: 0.05rem; }
  .lore-row dt { letter-spacing: 0.14em; }
}
```

The Lore tab's own two-up grid (`sm:grid-cols-2`,
[`LoreTab.tsx:213`](app/src/components/codex/tabs/LoreTab.tsx)) should likewise
become `@container article (min-width: 34rem)`.

---

### 2.14 🟡 Card internals waste ~19 % of card height on a phone

**Measured at 390×844:** card 167 × 322 px — portrait 4:3 = 223 px, name plate
**81 px** for an 18 px name and a 12 px subtitle.

Plate composition ([`CharacterCard.tsx:264–288`](app/src/components/CharacterCard.tsx)):
`px-3 pb-3 pt-1.5` + `text-lg sm:text-xl` name + `mt-0.5` subtitle + `mt-1.5`
hover flourish. The hover flourish (`group-hover:w-24`) is dead weight on a
touch device — there is no hover.

**Fix.**

```css
@media (max-width: 30rem) {
  .card-portrait { aspect-ratio: 4 / 5; }        /* was 3 / 4 */
  .card-plate    { padding: 0.25rem 0.5rem 0.5rem; }
  .card-name     { font-size: 1rem; }
  .card-flourish { margin-top: 0.25rem; }
}
@media (hover: none) { .card-flourish { display: none; } }
```

**Verified live at 390×844:** card height **322 → 262 px (−19 %)**, steady-state
density **4 → 6 cards per screen (+50 %)**, document height 4143 → 3768 px.

The 4:5 portrait is the one recommendation here that touches the visual language
(it crops the portrait slightly tighter). It is listed separately in the roadmap
so it can be declined without losing the rest.

---

### 2.15 🟢 Smaller findings

| # | Finding | Where | Fix |
|---|---|---|---|
| a | `pt-20` (80 px) clears a 53 px header — **27 px surplus at every viewport** | [`App.tsx:260`](app/src/App.tsx) | `pt-14` + safe-area (folded into §2.1) |
| b | Two owners for one horizontal gutter: `main` has `px-1 sm:px-2`, the grid has `px-4` | `App.tsx:260`, `CharacterGrid.tsx:50` | One `--gutter: clamp(0.75rem, 3vw, 2rem)` token; remove one of the two |
| c | The grid ladder is **duplicated** between the real grid and the loading skeleton and can silently diverge | `CharacterGrid.tsx:50`, `App.tsx:370` | Both use the `.card-grid` class from §2.6 |
| d | Ad-hoc breakpoints at **420 px** (footer) and **480 px** (search panel, herald) belong to no scale | `index.css:274, 584, 755` | Fold into the 30 rem band of §3 |
| e | `47.999rem` fractional edge can be missed under zoom | `index.css:1351` | Removed by the polarity flip in §2.4 |
| f | Gallery grid is a fixed `grid-cols-2 sm:grid-cols-3` | [`GalleryTab.tsx:44`](app/src/components/codex/tabs/GalleryTab.tsx) | `repeat(auto-fill, minmax(min(7.5rem,100%),1fr))` → 2 up at 390, 3 at 480, 4 at 640 |
| g | `.divider-ornament::before/after { max-width: 14rem }` is fixed | `index.css:196` | `max-width: clamp(3rem, 18vw, 14rem)` |
| h | `AsciiTabViewer` header uses `px-14 sm:px-28` to clear the close button — 56 px each side leaves 208 px of title at 320 px | [`AsciiTabViewer.tsx:115`](app/src/components/AsciiTabViewer.tsx) | `padding-inline: clamp(2.75rem, 12vw, 7rem)` |
| i | `.bio-doc-embed iframe { aspect-ratio: 3/4; max-height: 70vh }` — at 390 px that is a 424 px-tall PDF frame | `index.css:1439` | `aspect-ratio: 3/4; max-height: min(70dvh, 30rem)` |
| j | `.herald-line` has a lone raw `@media (min-width: 640px)` font bump | `index.css:482` | `font-size: clamp(0.95rem, 0.9rem + 0.45vw, 1.12rem)` |
| k | Language menu options are ~30 px tall and the list is `max-h-[60vh]` | `LanguageMenu.tsx:130, 141` | Covered by §2.8 and §2.10 |
| l | `text-wrap: balance` is used on `.herald-line` and `.bio-title` ✅ — extend to `.card-name` and `.codex-plate h1` | `index.css:480, 896` | Cheap legibility win at narrow widths |

---

## 3 · Proposed responsive strategy

The goal is **three content-derived breakpoints plus continuous behaviour
between them** — not more breakpoints.

### 3.1 The scale

| Band | Range | Rationale (content, not device) |
|---|---|---|
| **Compact** | `< 30rem` (480 px) | Below the width at which two ~150 px cards plus gutters and a three-column record grid both stop working. |
| **Medium** | `30rem – 56rem` (480–896 px) | The band where the catalogue grid grows from 2 to 4 columns and article figures start earning a float. |
| **Wide** | `≥ 56rem` (896 px) | Full ornament, full spacing, the canonical composition. |
| **Low-height** *(orthogonal)* | `max-height: 34rem` (544 px) | Landscape phones and short split-screen windows. Only the codex plate and the preamble respond to it. |

Delete: 420 px, 480 px (as a raw value), 640 px raw, 47.999 rem. Keep Tailwind's
`sm:`/`lg:` only where they happen to coincide; prefer the named CSS bands.

### 3.2 The four mechanisms, in order of preference

1. **Fluid by default (`clamp`).** Spacing, type and ornament size scale
   continuously. This is what delivers *progressive spatial compression* — the
   brief's central ask — and it removes the need for most breakpoints.
2. **Intrinsic layout (`auto-fill` + `minmax` + `min()`).** The catalogue grid,
   the gallery grid and the footer nav become content-driven. Column count then
   responds to *available space*, including in the 640–1024 dead zone, with no
   query at all.
3. **Container queries** for anything inside the codex, whose width is set by
   the modal, not the window: the article column, `::: columns`, figure floats,
   the Lore grid. One `container-type` declaration on
   [`CodexArticle.tsx:336`](app/src/components/codex/CodexArticle.tsx) serves all
   of them.
4. **Media queries last**, and only for the three bands above, the
   `max-height: 34rem` compaction, `pointer: coarse`, `hover: none`, and
   `prefers-reduced-motion`.

### 3.3 What each band looks like

| | Compact `<30rem` | Medium `30–56rem` | Wide `≥56rem` |
|---|---|---|---|
| Preamble to first card | ~380–420 px | ~450–520 px | ~600 px (unchanged) |
| Title `h1` | 2rem, no floating glyphs | 2.5–4rem | 4.5rem (unchanged) |
| Herald | compact padding, `min-height: 2.25rem` | fluid | unchanged |
| Facet chips | hidden (live in the panel) | shown | shown |
| Grid | 2 cols, 4:5 portraits | 3–4 cols | 4–6 cols to a 96 rem cap |
| Refinement panel | viewport-anchored sheet, `80dvh` | drop-down, `60dvh` | drop-down (unchanged) |
| Codex plate | fluid title, ornament kept | fluid | unchanged |
| Codex tabs | horizontal scroll strip | centred row | centred row (unchanged) |
| Article figures | capped by `size:`, no float | float from a 26rem column | unchanged |
| `::: columns` | 1 track | 2 from a 30rem column | 2–4 by column width |
| Footer nav | `auto-fit`, ~2.6rem tiles, no numerals | 3–5 across | 9 across (unchanged) |
| Touch targets | 44 px hit boxes (coarse pointer) | as pointer dictates | unchanged |

**Low-height overlay (`max-height: 34rem`)** — applies at any width: drop the
codex kicker and closing ornament, clamp the plate title to `vh`, halve the
preamble gaps, reduce `.codex-scroll` top padding to 3.25 rem.

---

## 4 · Prioritized roadmap

Impact = information visible per screen. Effort = engineer-hours.
Risk = chance of a visible desktop regression.

### Phase 1 — Quick, high-value, near-zero risk (≈ half a day)

| # | Change | § | Impact | Effort | Risk | Verified effect |
|---|---|---|---|---|---|---|
| 1 | Fluid preamble spacing tokens + hide duplicated facet chips `<34rem` | 2.1 | 🔴 Very high | S | 🟢 Low | **−230 px, 0 → 2 cards above fold @390** |
| 2 | `.form-ink` → 16 px at coarse pointers | 2.8 | 🔴 High (bug) | XS | 🟢 None | Kills iOS focus-zoom |
| 3 | `vh` → `dvh`/`svh` sweep (6 sites) + safe-area insets | 2.10 | 🟠 High | S | 🟢 Low | No more clipped modal bottom on mobile |
| 4 | `pt-16 sm:pt-14` → `pt-15` in `.codex-scroll` | 2.5 | 🟠 Medium | XS | 🟢 None | −8 px, fixes an inversion |
| 5 | Codex tab strip: scroll instead of wrap | 2.5 | 🟠 Medium | XS | 🟢 Low | −32 px in the codex on every phone |
| 6 | Table scroller actually scrolls (`min-width: 26rem`) | 2.7a | 🟠 Medium | XS | 🟢 Low | Restores a documented spec guarantee |

> Phase 1 alone converts "0 cards visible" to "2 cards visible" on the two most
> common phone sizes and fixes three outright bugs. It touches no component
> structure.

### Phase 2 — Structural, high-value, low risk (≈ 1–1.5 days)

| # | Change | § | Impact | Effort | Risk |
|---|---|---|---|---|---|
| 7 | `.card-grid` → `auto-fill` + `minmax` + `96rem` cap; de-duplicate with the skeleton | 2.6, 2.15c | 🔴 Very high | M | 🟡 Medium — changes the 1280 reference from 4 to 5 columns; see the opt-out in §2.6 |
| 8 | Container query on the article wrapper; convert `::: columns` and figure floats | 2.3, 2.4 | 🔴 High | M | 🟡 Medium — verify `.fx-curl` stacking and the `.drop-cap` float |
| 9 | Fluid article type scale in `cqi` | 2.11 | 🟠 High | S | 🟢 Low |
| 10 | Codex plate `clamp()` + `max-height: 34rem` compaction | 2.5 | 🟠 High (landscape) | S | 🟢 Low |
| 11 | Footer `auto-fit` + fluid tile height | 2.12 | 🟠 Medium | S | 🟢 Low |

### Phase 3 — Density polish (≈ half a day)

| # | Change | § | Impact | Effort | Risk |
|---|---|---|---|---|---|
| 12 | Coarse-pointer 44 px hit boxes | 2.8 | 🟠 High (usability) | S | 🟡 Medium — `.btn-rpg` `position` footgun |
| 13 | Card plate compaction + `hover: none` flourish removal | 2.14 | 🟠 Medium | S | 🟢 Low |
| 14 | Card portrait 4:5 below 30 rem | 2.14 | 🟠 Medium | XS | 🟠 Visual-identity call — decline freely |
| 15 | Lore row grid; Lore two-up as a container query | 2.13 | 🟡 Medium | S | 🟢 Low |
| 16 | Refinement panel sheet below 34 rem | 2.9 | 🟡 Medium | S | 🟡 Medium — re-measure after Phase 1 first |
| 17 | Gallery `auto-fill`; `--gutter` token; §2.15 g/h/i/j/l | 2.15 | 🟡 Low | S | 🟢 Low |

### Phase 4 — Hygiene (opportunistic)

| # | Change | § |
|---|---|---|
| 18 | Delete the 420/480/640-raw/47.999 rem breakpoints once superseded | 2.15d/e |
| 19 | Move semantic rules into `@layer components` — ends the "unlayered beats utilities" footgun noted three times in `index.css` and in [`.claude-memory/15-app-critique.md`](.claude-memory/15-app-critique.md) | — |
| 20 | Add a dev-time overflow assertion at 320/390/768 | 2.7b |

### Suggested verification gate

After each phase, re-measure at **320×568, 390×844, 768×1024, 844×390,
1024×768, 1440×900, 1920×1080** and record: grid top, preamble %, column count,
card height, cards fully visible in screen 1, `documentElement.scrollWidth`
(must equal `innerWidth`), and codex chrome-before-text. The probe used for this
audit is reproducible in a few lines of `javascript_tool`; keeping it as a small
script under `app/vite/` would make the gate cheap.

---

## 5 · Things NOT to change

Explicitly out of bounds. Changing these would damage the identity or buy
nothing.

1. **The palette.** Every token in `@theme` ([`index.css:17–61`](app/src/index.css)).
   Ivory, muted gold, burgundy, dark brown, and the exact opacities used in the
   hairlines. No new colours, no dark mode, no `prefers-color-scheme` branch —
   the app declares `color-scheme: light` deliberately.
2. **The fonts.** Cormorant SC / Cormorant Garamond, and the `--font-music`
   fallback stack with its measured `--fx-clef-*` compensation
   ([`index.css:1493–1514`](app/src/index.css)). That stack is the product of
   real cross-platform measurement; do not "simplify" it.
3. **Ornament, at any size.** Corner filigree, the `❦` divider, the herald's two
   hairlines, the footer's six string rules and rosette, drop capitals,
   `.fx-curl`'s curled-corner shadows, the double `ornate-border`. **Scale them
   with `clamp()`; never delete them.** The one exception granted above is the
   `max-height: 34rem` codex overlay, where the kicker and closing ornament are
   hidden — that is a genuinely space-starved case, not a general mobile rule.
4. **The widescreen composition at ≥ 1440 px** — with the single, explicitly
   flagged exception of the grid column count in §2.6, which the reviewer may
   decline by raising `--card-min` at the `80rem` band.
5. **`max-w-3xl` on the article** ([`CodexArticle.tsx:336`](app/src/components/codex/CodexArticle.tsx)).
   768 px is a correct measure cap. Widen the *codex panel* if desired; never
   the prose column.
6. **The reduced-motion policy**, including the `html[data-fx="on"]` opt-back-in
   ([`index.css:1624–1642`](app/src/index.css)). It is subtle and correct.
7. **The page-turn choreography and `CLOSE_MS = 320`**
   ([`CodexShell.tsx:57`](app/src/components/codex/CodexShell.tsx)) and its
   coupling to `.page-turn-close`. Documented, measured, and unrelated to RWD.
8. **The component architecture.** No new dependencies, no CSS-in-JS, no
   JavaScript-driven layout, no `ResizeObserver`-based sizing. Every
   recommendation above is native CSS. The one JSX change strictly required is
   two class names on `CodexArticle.tsx:336`.
9. **`body { overflow-x: hidden }`.** Keep it as a safety belt; add an assertion
   rather than removing it.
10. **The three-files-one-fact content model** and everything in `pages/`. This
    audit changes presentation only; no `*.bio.md`, `*.bio.json` or `index.json`
    edit is implied by any recommendation. In particular, `size:`/`position:`
    values in existing articles keep their current meaning — §2.3 makes them
    *work* on phones, it does not redefine them.

---

## 6 · Appendix — measured baseline

Captured from the running dev server (`npm run dev`, port 5173), 16 catalogue
entries, English UI.

### 6.1 Catalogue page

| Viewport | Grid top | Pre % | Cols × width | Gap | Card H | Cards in screen 1 | Steady/screen | Side gutter | Footer H |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| 320 × 568 | 692 | 122 % | 2 × 132 | 16 | 239 | 0 | 4 | 4 | 882 |
| 375 × 812 | 597 | 74 % | 2 × 160 | 16 | 272 | 0 | 4 | 4 | 850 |
| 390 × 844 | 642 | 76 % | 2 × 167 | 16 | 322 | 0 | 4 | 4 | — |
| 414 × 896 | 614 | 69 % | 2 × 179 | 16 | 322 | 0 | 4 | 4 | 833 |
| 768 × 1024 | 597 | 58 % | 3 × 221 | 24 | 329 | 0 | 6 | 13 | 697 |
| 844 × 390 | 597 | **153 %** | 3 × 246 | 24 | 360 | 0 | ~1 row | 13 | 697 |
| 1024 × 768 | 617 | 80 % | 4 × 224 | 24 | 361 | **0** | **4** | 13 | 526 |
| 1280 × 1080 | 597 | 55 % | 4 × 262 | 24 | 380 | 4 | 8 | 40 | 517 |
| 1440 × 900 | 617 | 69 % | 4 × 262 | 24 | 413 | 0 | 8 | 144 | 517 |
| 1920 × 1080 | 597 | 55 % | 4 × 262 | 24 | 380 | 4 | 8 | **384** | 517 |

### 6.2 Codex modal

| Viewport | Pane H | Pad-top | Plate H | Tabs H | Chrome before text | % of pane | Article W | Measure |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 390 × 844 | 769 | 64 | 180 | 73 *(2 rows)* | 317 | 41 % | 318 | ~35 ch |
| 700 × 900 | 822 | 56 | — | — | — | — | 556 | 62 ch |
| 844 × 390 | 317 | 56 | 196 | 41 | **301** | **95 %** | 684 | 76 ch |

### 6.3 Article block behaviour

| Viewport | Figures full-width | `::: columns` tracks | Table scrolls |
|---|---:|---:|---|
| 390 | 12 / 13 | 1 | ❌ squashes (317 px, 75 px rows) |
| 639 | 12 / 13 | 1 | ❌ |
| 700 | 0 / 13 | 1 | — |
| 844 | 0 / 13 | 2 | ✅ n/a |

### 6.4 Simulated fix, measured live at 390 × 844

| Metric | Baseline | §2.1 only | §2.1 + §2.14 |
|---|---:|---:|---:|
| Grid top | 642 px | **412 px** | 412 px |
| Preamble share | 76 % | **49 %** | 49 % |
| Card height | 322 px | 322 px | **262 px** |
| Cards fully visible, screen 1 | **0** | **2** | 2 |
| Steady-state cards / screen | 4 | 4 | **6** |
| Document height | 4143 px | — | **3768 px** |

### 6.5 Responsive-primitive inventory

| Primitive | Count in `app/src` |
|---|---:|
| Tailwind `sm:` | 81 |
| Tailwind `md:` | **1** *(a naive grep says 10; 9 are TS `md:` annotations)* |
| Tailwind `lg:` | 5 |
| Tailwind `xl:` / `2xl:` | 0 |
| CSS `@media` width queries | 6, at 4 thresholds, in 3 unit conventions |
| `clamp()` in CSS | **0** |
| Container queries | **0** |
| `dvh` / `svh` / `lvh` | **0** |
| `env(safe-area-inset-*)` | **0** *(despite `viewport-fit=cover`)* |
| `pointer:` / `hover:` media features | **0** |
