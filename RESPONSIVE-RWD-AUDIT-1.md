# Responsive Web Design Audit — `app/` (Кодекс Гитаристов · The Guitar Codex)

> **Scope:** RWD audit only. No application code was changed.
> **Date:** 2026-08-21 · **Subject:** `app/` (Vite 7 · React 19 · Tailwind 4 · `src/index.css`, 1642 lines)
> **Brief:** [`todo-audit.md`](todo-audit.md) — make the app substantially more
> usable and information-dense on phones, tablets, narrow windows and low-height
> displays **without changing its visual language, desktop appearance, content
> model or architecture**.

## How this was measured

Findings are not inferred from reading CSS alone. The existing `app/dist/` build
was served read-only and instrumented in a real Chromium at 11 viewports from
320×568 to 2560×1440. Because the shipped `pages/index.json` holds **one** entry
(the localized name maps already carry 15 ids — a separate content gap worth
filing), grid density was measured against a 24-entry fixture built from the real
portraits and the real `agustin-barrios` article. Every number below with a unit
is measured, not estimated. Proposed fixes for the two highest-impact findings
were **simulated in the live page and re-measured** (§3.1, §3.2, §3.7); those
results are quoted as "validated".

Two things about the local environment, unrelated to RWD but worth knowing:
`app/node_modules/.bin` contains only POSIX symlinks (no Windows `.cmd` shims),
so `npm run dev` cannot resolve `vite`; and `@rollup/rollup-win32-x64-msvc` is
absent, so Vite cannot start at all until `npm install` is re-run on this
machine. The audit used the prebuilt `dist/` instead.

---

## 0. Measurement baseline

### 0.1 Space before the first catalogue card

"Chrome" = every pixel above the first card: fixed header + `main` padding +
title block + herald + search block + grid offset.

| Viewport | Chrome | % of viewport height | Columns | Card W×H | Row pitch | Cards **fully** visible on load |
|---|---|---|---|---|---|---|
| 320 × 568 | **833 px** | **147 %** | 2 | 121 × 239 | 275 | 0 |
| 375 × 812 | **770 px** | **95 %** | 2 | 147 × 273 | 312 | 0 |
| 639 × 900 | 637 px | 71 % | 2 | 268 × 414 | 466 | 0 |
| 640 × 900 | 737 px | 82 % | 3 | 167 × 304 | 354 | 0 |
| 768 × 1024 | 768 px | 75 % | 3 | 203 × 329 | 381 | 0 |
| 844 × 390 *(phone landscape)* | 680 px | **174 %** | 3 | 226 × 360 | 415 | 0 |
| 1023 × 768 | 683 px | 89 % | 3 | 281 × 433 | 495 | 0 |
| 1024 × 768 | 678 px | 88 % | 4 | 206 × 332 | 385 | 0 |
| 1280 × 720 | 680 px | 94 % | 4 | 241 × 380 | 437 | 0 |
| 1512 × 1080 | 680 px | 63 % | 4 | 241 × 380 | 437 | 4 |
| 2560 × 1440 | 680 px | 47 % | 4 | 241 × 380 | 437 | 4 |

Read the last three rows together: **the chrome is a constant 680 px from
1024 px upward.** It does not grow, but it does not shrink either — it is a fixed
additive tower, so its cost is entirely a function of how short the viewport is.
And the column count stops at 4 forever: at 2560 px, **55 % of the window width
is empty margin** and one row still fills the fold.

### 0.2 Vertical budget at 375 × 812, item by item

| Element | Source | Height |
|---|---|---|
| Fixed header | `App.tsx:218` | 53 px |
| `main` `padding-top: 5rem` | `App.tsx:260` `pt-20` | 80 px (→ **27 px of dead air** under a 53 px header) |
| Title block (kicker 34 + h1 90 + divider 28) | `AnimatedTitle.tsx:33–110` | 184 px |
| Herald (`mt-5` + plaque) | `App.tsx:262`, `index.css:400` | 20 + 107 px |
| Search block (`mt-9` + box 54 + **chips 158** + count 16 + gaps) | `SearchBar.tsx:62–152` | 36 + 256 px |
| Grid offset `mt-10` | `App.tsx:295` | 40 px |
| **Total before the first card** | | **770 px** |

The single largest line item is not the title — it is the **quick facet chip row
at 158 px** (223 px at 320 px wide), for 15 chips. `TokenSelect.tsx:11` already
states the catalogue will reach "a hundred" countries.

Note also that the mobile title block (**184 px**) is *taller* than the desktop
one (**167 px**): `text-4xl` wraps "Der Gitarren-Kodex" onto two lines at 375 px.
Smaller type did not buy less space — this is the audit's thesis in miniature.

### 0.3 The open codex

| | 375 × 812 | 844 × 390 | 1512 × 982 |
|---|---|---|---|
| Panel | 359 × 763 | 796 × 342 | 1152 × 958 |
| Reading pane `padding-top` | 64 px | 56 px | 56 px |
| Name plate block (`CodexHeader`) | — | **196 + 20 px** | 196 + 20 px |
| Tab strip | **72 px (2 rows)** | 41 px | 41 px |
| Article column width | 304 px | 685 px | **768 px** (180 px empty parchment each side) |
| Article font / line-height | 18.08 / 31.64 px | idem | idem |
| Characters per line | **≈ 34** | ≈ 76 | ≈ 85 |
| First article line at y = | 400 | **373 of 390** | 378 |
| **Share of viewport showing article text** | 51 % | **4 %** | 62 % |

In phone landscape the reader opens a biography and sees **no words of it**. The
plate, the padding and the tab strip consume the entire modal.

### 0.4 Footer

| Viewport | Footer height | % of viewport | Menu columns |
|---|---|---|---|
| 375 × 812 | **881 px** | **109 %** | 2 (9 items → 5 rows, 344 px) |
| 1512 × 982 | 536 px | 55 % | 9 (1 row, 68 px) |

On a phone the colophon costs more than a full screen — for 9 items of which
4 are non-functional placeholders (`SiteFooter.tsx:10–20`).

### 0.5 Responsive machinery inventory

| Mechanism | Count | Where |
|---|---|---|
| `@media` queries in `index.css` | **9** total, of which 8 are layout | `index.css:274, 482, 584, 755, 1338, 1351, 1427, 1624` |
| Distinct breakpoint thresholds | **5** (420 px, 480 px, 640 px/40rem, 768 px/48rem, 1024 px) | mixed `px` and `rem`, mixed `min-` and `max-width` |
| Tailwind responsive prefixes | **81 × `sm:`**, 4 × `md:`, 5 × `lg:`, 0 × `xl:` | — |
| `@container` / container queries | **0** | — |
| CSS `clamp()` for size or space | **0** | — |
| `dvh` / `svh` / `lvh` | **0** (5 × `vh` in layout-critical `max-height`) | — |
| `env(safe-area-inset-*)` | **0**, although `viewport-fit=cover` is set | `index.html:5` |
| `@media (height …)` | **0** | — |
| `!important` Tailwind overrides in TSX | **16** (15 × `!px-3`) | 8 files, all fighting `.btn-rpg` |
| Horizontal overflow found | **none** at any tested width | ✅ |

The shape of the problem is now visible: this is a **two-state design** — below
640 px and above it — with one extra column at 1024 px. 81 of 90 responsive
declarations fire at the same threshold. There is no tablet state, no
laptop state, no short-viewport state, and nothing scales continuously.

---

## 1. Current state — what is already right, and must stay

These are genuine strengths. Several are unusual and should be protected from
the changes proposed below.

1. **No overflow anywhere.** Tested 320 → 2560 px: `document.scrollWidth` never
   exceeded the viewport. The brief's premise holds — this is a *density*
   problem, not a breakage problem.
2. **`min-width: 0` is applied correctly** on flex/grid children that carry
   dynamic text: `DocumentsTab.tsx:65,125`, `GalleryTab.tsx:84`,
   `SiteFooter.tsx:132`, `LoreTab.tsx:105`, `index.css:1335`. This is the single
   most common responsive bug in React codebases and it is absent here.
3. **Wide content already scrolls inside its own box**, never the page:
   `.bio-article pre` (`index.css:951`), `.bio-article table` at `width: 100%`
   (`index.css:1000`), `.search-panel` (`index.css:237`), the codex reading pane.
4. **The `::: nav` bar is genuinely intrinsic** — `width: max-content;
   max-width: 100%; flex-wrap: wrap` with a deliberate refusal of `nowrap`
   (`index.css:1249–1273`). It needs no breakpoints and has none. This is the
   pattern the rest of the app should imitate.
5. **The reduced-motion policy is thorough and correct**, including the
   three-axis separation (hardware grade × reader switch × OS hint) and the
   `--fx-dur` custom-property trick that lets an opted-in ornament survive the
   blanket `!important` clamp (`index.css:1624–1641`).
6. **Performance discipline that responsive work must not undo**: `will-change`
   promoted only on hover (`index.css:1145`), `contain: layout paint style` on
   the drift layer, literal keyframe values to stay on the compositor, the
   4-eager-portrait rule, `memo`'d cards.
7. **The main search input is 18 px** (`SearchBar.tsx:79` `text-lg`) — the one
   place iOS input-zoom is already avoided. Do not shrink it.
8. **Fluid intrinsic behaviour where it exists is well chosen**: `text-wrap:
   balance` on the herald line, `text-wrap: pretty` on verse,
   `aspect-ratio` on portraits and gallery cells, `mask-image` fades on rules.
9. **The desktop composition works.** At 1512 px the codex article sits at
   ≈ 85 characters per line in a serif at 1.75 line-height — comfortable. The
   symmetry, the parchment, the double gold border and the ornaments read exactly
   as intended. Nothing in §2 should alter what a 1440–1600 px reader sees.

---

## 2. Findings

Each finding gives **Problem → Evidence → Root cause → Fix**. Severity:
🔴 high · 🟠 medium · 🟡 polish. `I` = impact, `E` = effort, `R` = regression risk.

### Group A — Vertical budget and density

---

#### A1 🔴 The pre-grid stack is a fixed additive tower that never compresses
**I: very high · E: low · R: low**

**Problem.** 680–833 px of chrome stands between the top of the page and the
first card, at *every* viewport. On a 375 × 812 phone that is 95 % of the
screen; at 320 × 568, 147 %; in phone landscape, 174 %. Zero cards are fully
visible on load at any viewport below 1512 px height.

**Evidence.** §0.1, §0.2.

**Root cause.** Every gap in the stack is a fixed Tailwind step —
`pt-20`, `mt-5`, `mt-9`, `mt-4`, `mt-3`, `mt-10` (`App.tsx:260,295`,
`HeraldBanner.tsx:43`, `SearchBar.tsx:62,128,148`, `AnimatedTitle.tsx:60,109`) —
and the two plaques set fixed internal padding (`.herald` `padding: 1.15rem
2.1rem`, `.herald-body { min-height: 3.5rem }`, `index.css:400,453`). None of
them knows anything about available height. `pt-20` (80 px) is additionally a
magic number for a 53 px header, leaving 27 px of dead air.

**Fix.** Make the *vertical* rhythm fluid on the viewport's short axis, and
anchor the header offset to the header itself. Horizontal padding and the visual
design of the plaques stay untouched.

```css
/* index.css — new, near the top */
:root {
  --header-h: 3.25rem;          /* measured: 53 px */
  --gap-section: clamp(0.75rem, 2.2vh, 2.25rem);
  --gap-tight:   clamp(0.35rem, 1.2vh, 0.75rem);
}
```

```diff
- <main className="relative z-20 px-1 pb-16 pt-20 sm:px-2">
+ <main className="relative z-20 px-1 pb-[var(--gap-section)] sm:px-2"
+       style={{ paddingTop: "calc(var(--header-h) + var(--gap-section))" }}>
```

Then replace `mt-5` / `mt-9` / `mt-10` / `mt-3` on the four stacked blocks with
`mt-[var(--gap-section)]` / `mt-[var(--gap-tight)]`, and make the herald fluid:

```css
.herald {                                   /* index.css:400 */
  padding: clamp(0.6rem, 1.4vh, 1.15rem) clamp(1rem, 3vw, 2.1rem);
}
.herald-body { min-height: clamp(2.25rem, 4vh, 3.5rem); }   /* :453 */
.herald::before { top: clamp(0.3rem, 0.8vh, 0.5rem); }      /* :424 */
.herald::after  { bottom: clamp(0.3rem, 0.8vh, 0.5rem); }
```

And make the headline fluid on both axes instead of stepping at 640/768:

```diff
- className="… text-4xl … sm:text-6xl md:text-7xl"
+ className="… text-[clamp(2rem,1.2rem+3.4vw,4.5rem)] …"
```

**Validated.** With this alone: 375 × 812 chrome **770 → 602 px**;
1512 × 982 chrome **680 → 571 px**, and 6 cards become fully visible above the
fold (was 0).

---

#### A2 🔴 The card grid has a fixed column count, a 4-column ceiling, and 27–38 % size discontinuities
**I: very high · E: low · R: low**

**Problem.** Three hard-coded column counts at two Tailwind breakpoints. Dragging
a window across a breakpoint makes the card *jump*:

| At width | Columns | Card width | Row pitch |
|---|---|---|---|
| 639 px | 2 | 268 px | 466 px |
| **640 px** | 3 | **167 px (−38 %)** | 354 px |
| 1023 px | 3 | 281 px | 495 px |
| **1024 px** | 4 | **206 px (−27 %)** | 385 px |

Worse, the grid never exceeds 4 columns: `max-w-6xl` caps content at 1152 px, so
a 2560 px display shows 4 cards per row inside 55 % empty margin. And at 640 px
the chrome simultaneously *grows* by 100 px (637 → 737) because `sm:` also fires
on the title and paddings — the layout gains a column and loses a screen at the
same pixel.

**Evidence.** §0.1; `CharacterGrid.tsx:50`
`mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-10 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4`.

**Root cause.** Device-oriented breakpoints doing a job that intrinsic sizing
does natively. The column count is asserted rather than derived from how wide a
card needs to be. The fixed `px-4` (32 px) side padding also costs 10 % of a
320 px screen.

**Fix.** One `auto-fill` track list with a fluid minimum, fluid gap and fluid
padding. Delete all three breakpoints.

```diff
  <m.div layout
-   className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 pb-10 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4"
+   className="codex-grid mx-auto"
  >
```

```css
/* index.css — new (inside @layer components once A9 lands) */
.codex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(8.75rem, 6.25rem + 8.3vw, 14rem), 1fr));
  gap: clamp(0.55rem, 1.1vw, 1.5rem);
  padding-inline: clamp(0.4rem, 2vw, 1.25rem);
  max-width: min(100rem, 100%);
}
```

The "other tongues" divider must span the row explicitly, since the count is no
longer known (`CharacterGrid.tsx:62`):

```diff
- className="col-span-2 flex items-center justify-center gap-3 py-3 sm:col-span-3 lg:col-span-4"
+ className="col-span-full flex items-center justify-center gap-3 py-2"
```

Apply the same substitution to `GridSkeleton` (`App.tsx:370`) so the loading
state matches.

**Validated** (measured with the formula injected live):

| Viewport | Today | With `auto-fill` |
|---|---|---|
| 320 px | 2 × 121 px | **2 × 145 px** (+20 % card, same count) |
| 375 px | 2 × 147 px | **2 × 172 px** (+17 %) |
| 480 px | 2 × 199 px | **3 × 145 px** |
| 768 px | 3 × 203 px | **4 × 171 px** |
| 1024 px | 4 × 206 px | **4 × 231 px** |
| 1512 px | 4 × 241 px | **6 × 227 px** — cards per viewport 9.4 → **14.6 (+55 %)** |

Note the progression is now monotone: no width where the card shrinks as the
window grows. The implementer **must drag-test 280 → 2560 px** and may need to
retune the `8.3vw` slope by a few tenths; the clamp bounds (8.75rem / 14rem) are
the values that keep 2 columns at 320 px and stop cards inflating past 1600 px.

---

#### A3 🔴 The quick facet chip row is unbounded and is the largest single item in the mobile chrome
**I: high · E: low–medium · R: low**

**Problem.** 158 px at 375 px wide; 223 px at 320 px — for 15 chips. The row has
no height ceiling and grows with the catalogue. `TokenSelect.tsx:11` says
countries will reach "a hundred".

**Evidence.** §0.2; `SearchBar.tsx:128–146`.

**Root cause.** `flex flex-wrap` with no cap: an unbounded set of controls is
rendered as an unbounded block, in the scarcest space on the page.

**Fix.** Keep both chip groups on wide screens exactly as they are. On compact,
turn the row into a **single-row horizontal rail** — the controls stay visible
and one-tap, they simply stop stealing vertical space. Countries remain fully
reachable in the refinement panel's `TokenSelect`, which is already the
designed home for the long list.

```css
/* index.css */
.facet-rail { display: flex; flex-wrap: wrap; justify-content: center;
              align-items: center; column-gap: 1rem; row-gap: 0.5rem; }

@media (max-width: 40rem) {
  .facet-rail {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;                     /* the fade is the affordance */
    padding-block: 0.15rem;
    /* the rail's own edge fade, in the manuscript idiom */
    mask-image: linear-gradient(90deg, transparent, #000 1.25rem,
                                #000 calc(100% - 1.25rem), transparent);
  }
  .facet-rail::-webkit-scrollbar { display: none; }
  .facet-rail > [role="group"] { flex-wrap: nowrap; }
  .facet-rail button { flex: none; }
}
```

Two smaller wins in the same block: drop the `|` separator on compact (it is
already `hidden sm:inline`, good), and fold the result count into the search
row instead of giving it its own 16 px line + 12 px margin.

**Validated:** chips row **158 → 48 px** at 375 px. Combined with A1: chrome
**770 → 492 px**, and **2 cards fully visible above the fold** (was 0), with
*larger* cards and a *shorter* document (5470 → 5354 px).

---

#### A4 🟠 The footer costs more than a full screen on a phone
**I: high · E: low · R: low**

**Problem.** 881 px = 109 % of a 375 × 812 viewport (desktop: 536 px / 55 %).
Nine menu items in 2 columns = 5 rows = 344 px, at `min-height: 4.25rem` each,
plus a 175 px colophon and two decorative rule blocks.

**Evidence.** §0.4; `SiteFooter.tsx:104` `grid-cols-2 sm:grid-cols-3 lg:grid-cols-9`;
`index.css:655` `.footer-menu-item { min-height: 4.25rem }`; `index.css:755`
already patches the item at `max-width: 420px`.

**Root cause.** Same fixed-column-count pattern as A2, plus a fixed `min-height`
sized for a desktop row, plus a 420 px patch that treats the symptom.

**Fix.** One intrinsic track list — which also deletes the `max-width: 420px`
query — and a fluid item height.

```diff
- className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 sm:gap-3 lg:grid-cols-9"
+ className="footer-menu m-0 grid list-none p-0"
```

```css
.footer-menu {
  grid-template-columns: repeat(auto-fill, minmax(min(6.5rem, 100%), 1fr));
  gap: clamp(0.4rem, 1vw, 0.75rem);
}
.footer-menu-item {                            /* index.css:655 */
  min-height: clamp(2.75rem, 7vw, 4.25rem);
  padding: clamp(0.7rem, 2vw, 1.2rem) 0.45rem clamp(0.45rem, 1.4vw, 0.8rem);
  font-size: clamp(0.64rem, 0.6rem + 0.2vw, 0.72rem);
}
```
Then **delete** `index.css:755–762` (`@media (max-width: 420px)`) — it becomes
redundant. At 375 px this yields 3 columns × 3 rows ≈ 150 px instead of 344 px.

Also compress the colophon's ornament stack on short/narrow viewports
(`SiteFooter.tsx:172–176` — the `✦` between two hairlines is a 40 px block) and
consider hiding the string-rule + rosette (`SiteFooter.tsx:81`, 18 px + 36 px)
below 30rem. Both are pure ornament; the *frame* and the corners carry the
identity.

---

#### A5 🟡 Three stacked bottom spacers = 96–136 px of nothing
**I: low · E: trivial · R: none**

`main` `pb-16` (64 px) + `footer` `mt-8` (32 px) + `CharacterGrid` `pb-10`
(40 px) all stack between the last card and the colophon (`App.tsx:260`,
`SiteFooter.tsx:67`, `CharacterGrid.tsx:50`). Keep one, make it
`var(--gap-section)`; drop the other two.

---

#### A6 🟡 `min-h-[40vh]` reserves 40 % of the viewport for a possibly-3-row tab
**I: low · E: trivial · R: low**

`BiographyView.tsx:73` and `PageView.tsx:43` reserve `min-height: 40vh` to stop
a tab switch from collapsing the pane. Reasonable intent, wrong unit and wrong
place: on a 390 px-tall landscape screen it reserves 156 px of the 319 px pane.
Use `min-height: min(40dvh, 18rem)` — the intent is "don't collapse", not "be
tall".

---

### Group B — Breakpoint architecture

---

#### B1 🔴 Project CSS is unlayered, so it beats every Tailwind utility — including every responsive one
**I: very high (as an enabler) · E: low–medium · R: low**

**Problem.** `index.css` imports Tailwind (which layers its utilities) and then
declares ~1500 lines of component rules **outside any layer**. Unlayered rules
win over layered ones regardless of specificity. Consequence: you **cannot** add
`sm:px-*`, `md:text-*` or any responsive utility to an element carrying
`.herald`, `.search-panel`, `.form-ink`, `.btn-rpg`, `.form-segments`,
`.fx-clef` or `.fx-drift`. The codebase knows this — four separate comments warn
about it (`index.css:200–203, 232–236, 396–399, 1518–1522`) — and pays for it
with **16 `!important` overrides** in 8 TSX files, 15 of them `!px-3` fighting
`.btn-rpg`'s fixed `padding: 0.45rem 1.1rem`.

**Evidence.** §0.5; `CodexShell.tsx:181,184`, `AdvancedSearchPanel.tsx:171`,
`DocumentsTab.tsx:87,100,113`, `GalleryTab.tsx:86,132`, `AudioPlayer.tsx:86`,
`AsciiTabViewer.tsx:230,238,242`, `ImageViewer.tsx:166`, `LanguageMenu.tsx`.
The existing critique note already flags the layering
([`.claude-memory/15-app-critique.md:94`](.claude-memory/15-app-critique.md))
but not this consequence.

**Root cause.** Layer order was never declared, so authoring order decides
precedence — the opposite of what a utility-first system needs.

**Fix.** Two mechanical steps.

1. Wrap the semantic rules so utilities can win:
   ```css
   @import "tailwindcss";
   @layer components {
     /* everything from `.parchment` (index.css:154) to the end of the
        component rules — tokens in @theme and the @media
        (prefers-reduced-motion) block at the foot stay outside */
   }
   ```
2. Give `.btn-rpg` a custom-property API so size becomes a variable, not a
   fight, and then **delete all 16 `!important`s**:
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
   This is also what makes buttons *responsive at all* — today you cannot write
   `sm:` anything on a `.btn-rpg`.

**Do this first.** Several fixes below are blocked or made ugly without it.

---

#### B2 🟠 Five uncoordinated breakpoint thresholds, in two unit systems, in both directions
**I: medium · E: low · R: low**

**Problem.** Hand-written CSS uses 420 px, 480 px, 640 px, 40 rem, 48 rem and
`47.999 rem`; Tailwind uses its own 640/768/1024. `40rem` and `640px` are the
same number written two ways in the same file. `min-width: 48rem` and
`max-width: 47.999rem` (`index.css:1338, 1351`) are a hand-rolled exclusive pair
that will drift the moment the root font-size does. 420 px and 480 px are
device-shaped, not content-shaped: they exist only to shrink padding that should
have been fluid.

**Evidence.** §0.5; `index.css:274, 482, 584, 755, 1338, 1351, 1427`.

**Root cause.** No shared breakpoint scale, and fixed padding forcing per-device
patches.

**Fix.**
1. Declare the scale once so Tailwind and hand-written CSS cannot disagree:
   ```css
   @theme {
     --breakpoint-sm: 34rem;   /* 544 — where 3 card columns start to pay */
     --breakpoint-md: 48rem;   /* 768 */
     --breakpoint-lg: 64rem;   /* 1024 */
   }
   ```
   (Retuning `sm` from 40 rem to 34 rem is optional and touches 81 call sites'
   behaviour — treat it as a separate, drag-tested change, not part of this fix.)
2. **Delete** the 420 px query (A4) and the 480 px queries (`index.css:274`,
   `:584`) by making the affected paddings `clamp()`s (A1, and
   `.search-panel { padding: clamp(0.85rem, 2.5vw, 1.35rem) }`).
3. **Delete** the `48rem` / `47.999rem` pair by replacing `.bio-columns`' fixed
   tracks with intrinsic ones (C5).

Target: **two** width thresholds plus one height threshold, all content-derived.

---

#### B3 🟠 Zero container queries, and the codex article demonstrably needs them
**I: medium–high · E: low · R: low**

**Problem.** The codex article column is **768 px wide at every viewport from
1150 px up** (`CodexArticle.tsx:34` `max-w-3xl`) — yet everything inside it
responds to *viewport* width. So at 1600 px the article is 768 px wide while
`sm:grid-cols-4` (fired at 640 px viewport) puts four images across it. The
component's own box and the query driving it are unrelated quantities.

**Evidence.** §0.3 (`articleW: 768` at 1512 px); `BioArticle.tsx:245–267`.

**Root cause.** Viewport queries used for component-scoped decisions.

**Fix.** Two lines of CSS turn the article into its own query context; then the
image and column rules ask the right question.

```css
.bio-article { container-type: inline-size; container-name: article; }
```
```css
@container article (min-width: 30rem) {
  .bio-article .bio-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* … and the float/size rules from C4 */
}
```
The catalogue card is the second candidate (`CharacterCard.tsx`): with A2 its
width becomes continuous, so its internal type and badge sizes should follow its
own `cqi`, not the viewport.

---

#### B4 🔴 No height-aware rule anywhere
**I: high · E: low · R: low**

**Problem.** Every responsive decision in the app is a function of width alone.
Phone landscape (844 × 390) therefore gets the *widescreen* treatment: `sm:` has
fired, so the title is 60 px, the codex plate is 196 px, and the chrome is 174 %
of the viewport height.

**Evidence.** §0.1 row 6; §0.3 column 2; §0.5.

**Root cause.** `min-width` is treated as a proxy for "large screen". It isn't.

**Fix.** One height tier, applied to ornament only — nothing informational is
removed.

```css
@media (max-height: 34rem) {
  :root { --gap-section: 0.5rem; --gap-tight: 0.25rem; }
  /* the kicker, the rule under the title and the herald are ornament:
     they are what a 390 px-tall screen cannot afford */
  .title-kicker, .title-rule, .herald-wrap { display: none; }
  .codex-plate  { --plate-scale: 0.62; }   /* see C1 */
  .divider-ornament { display: none; }
}
```
With A1+A2+A3 this takes the 844 × 390 chrome from 680 px to ~240 px. Phone
landscape stays a scrolling experience — a 3:4 portrait card is 87 % of a 390 px
viewport by construction — but the reader reaches content immediately instead of
after 1.7 screens.

---

### Group C — The codex (reading experience)

---

#### C1 🔴 The codex name plate does not compress; in phone landscape the article starts below the fold
**I: very high · E: low · R: low–medium**

**Problem.** The plate is 196 px + 20 px margin at *every* viewport ≥ 640 px
wide. In the 319 px reading pane of a landscape phone it is 61 % of the pane;
with 56 px of pane padding and a 41 px tab strip above it, the first line of the
biography sits at y = 373 of a 390 px viewport — **4 % of the screen shows
article text**.

**Evidence.** §0.3; plate breakdown measured at 844 × 390: kicker 16 + `mb-2`,
h1 **48 px**, h2 **36 px** + `mt-1`, subtitle 28 px + `mt-2`, divider ornament
28 px + `mt-4`.

**Root cause.** `CodexHeader.tsx:33,40,45` steps type at `sm:` (a width
threshold) with no notion of available height, and the divider ornament
(`:47`) is an unconditional 44 px block.

**Fix.** Fluid type on both axes plus a scale hook the height tier can turn down.

```diff
- <header className="mb-5 text-center">
+ <header className="codex-plate mb-[clamp(0.5rem,1.6vh,1.25rem)] text-center">
```
```css
.codex-plate {
  --plate-scale: 1;
}
.codex-plate h1 {
  font-size: calc(var(--plate-scale) * clamp(1.5rem, 1rem + 2.6vw, 3rem));
  line-height: 1.05;
}
.codex-plate h2 {
  font-size: calc(var(--plate-scale) * clamp(1.15rem, 0.85rem + 1.9vw, 2.25rem));
  line-height: 1.1;
}
.codex-plate p { font-size: clamp(0.85rem, 0.8rem + 0.3vw, 1.125rem); }
.codex-plate .divider-ornament { margin-top: clamp(0.4rem, 1.4vh, 1rem); }
```
Remove the `long ? … : …` branch's *duplicate* size scale in
`CodexHeader.tsx:33` — with `clamp()` plus `text-wrap: balance` the long-roster
case no longer needs its own type ramp, only its own tracking. And tie the pane's
top padding to the actual control row instead of guessing:

```diff
- className="codex-scroll absolute inset-[11px] overflow-y-auto px-4 pb-6 pt-16 sm:px-9 sm:pt-14"
+ className="codex-scroll absolute inset-[11px] overflow-y-auto
+            px-[clamp(0.75rem,2.5vw,2.25rem)]
+            pb-[clamp(1rem,2vh,1.5rem)]
+            pt-[clamp(2.75rem,7vh,3.5rem)]"
```
(the `pt` must clear the 40 px `btn-rpg` control row at `top-4`, so
`2.75rem` is the floor, not a guess.)

---

#### C2 🟠 The codex tab strip wraps to two rows on phones
**I: medium · E: low · R: low**

**Problem.** Four tabs at `px-3 py-1.5 text-[0.72rem]` in a 304 px column
overflow: the fourth drops to a second row. Measured strip height **72 px**
instead of ~41 px, and the wrap breaks the plaque's symmetry — the visual
signature of the codex.

**Evidence.** §0.3; measured tab tops 305, 305, 305, **338**;
`CodexTabs.tsx:31,42`.

**Root cause.** `flex flex-wrap` with intrinsic-width items and fixed padding.
Wrapping is the correct *fallback* but the wrong *design* for exactly four
first-class tabs.

**Fix.** Four equal tracks that cannot wrap, with the label doing the yielding.

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
  padding-inline: clamp(0.35rem, 1.5vw, 1.25rem);
  font-size: clamp(0.6rem, 0.55rem + 0.35vw, 0.8rem);
  letter-spacing: clamp(0.06em, 0.18em, 0.18em);
  overflow-wrap: anywhere;      /* a long localized label breaks, never overflows */
}
```
Verify with the longest localized labels — Russian «Летопись · Галерея · Свитки ·
Атрибуты» and German are the stress cases.

---

#### C3 🔴 Article typography is fixed at every width → ≈ 34 characters per line on a phone
**I: high · E: low · R: low**

**Problem.** `.bio-article { font-size: 1.13rem; line-height: 1.75 }`
(`index.css:861`) never changes. In the 304 px mobile column that is ≈ 34
characters per line against a 45–75 optimum: the reader gets a narrow ribbon of
text with a 31.6 px leading between every 34 characters — the worst possible
ratio of ink to whitespace, and the reason a biography feels endless on a phone.
Measured article content: 3842 px of scroll in a 740 px window.

**Evidence.** §0.3; `Range.getClientRects()` on three long paragraphs.

**Root cause.** Fixed type in a fluid column, and horizontal padding
(`px-4` + the 11 px frame inset) eating 8 % of a 375 px screen.

**Fix.** Recover measure horizontally *and* scale type and leading together.
`clamp()` on `line-height` is the part usually forgotten — a tight column needs
tighter leading, not looser.

```css
.bio-article {
  font-size: clamp(1rem, 0.94rem + 0.5vw, 1.13rem);
  line-height: clamp(1.5, 1.36 + 0.55vw, 1.75);
  text-wrap: pretty;
  hyphens: auto;                 /* ru/de compounds; harmless elsewhere */
}
.bio-article h2 { font-size: clamp(1.15rem, 1.05rem + 0.6vw, 1.35rem);
                  margin-block: clamp(1em, 0.8em + 0.8vw, 1.6em) 0.55em; }
.bio-article h3 { font-size: clamp(1.05rem, 1rem + 0.4vw, 1.15rem); }
.bio-article .bio-title        { font-size: clamp(1.35rem, 1rem + 2.2vw, 2rem); }
.bio-article .bio-title--second{ font-size: clamp(1.1rem, 0.9rem + 1.7vw, 1.6rem); }
```
Combined with C1's fluid `px`, the mobile measure should go from 304 px to
~345 px and from ≈ 34 to ≈ 42 characters at a slightly smaller size (projected,
not simulated) — still short of optimum, because a 375 px screen cannot reach
45–75 characters at a readable size, but the leading now matches the measure
instead of fighting it. **Do not touch the desktop values**: the clamp maxima
are today's numbers exactly.

---

#### C4 🔴 Article images ignore their declared size below 640 px, and image groups jump 1 → 4 columns at one pixel
**I: high · E: low · R: low**

**Problem.** `SIZE_CLASS` and `FLOAT_CLASS` are `sm:`-prefixed *only*
(`BioArticle.tsx:245–260`). Below 640 px a figure authored `size: small` —
explicitly a marginal illustration — renders **full column width**. Measured at
375 px: three `sm:max-w-[200px]` figures all 304 px wide. An article with six
small portraits becomes six full-width blocks, which is most of why a mobile
biography is 3842 px long. Meanwhile `IMAGES_TRACK_CLASS` (`:264`) goes from
1 column to *N* at exactly 640 px, so a 4-image group lands as four ~138 px
cells the instant the breakpoint fires.

**Root cause.** "Mobile = one column, everything full width" — the assumption the
brief explicitly warned against. A small illustration beside text is *more*
information-dense than the same illustration stacked, not less.

**Fix.** Let small and medium figures float from the width at which a floated
figure still leaves a readable column (~26 rem), using the article's own
container (B3), and make groups intrinsic.

```css
@container article (min-width: 26rem) {
  .bio-figure--small  { max-width: min(38%, 200px); }
  .bio-figure--medium { max-width: min(48%, 320px); }
  .bio-figure--left   { float: left;  margin-inline: 0 1.25rem; margin-block: 0.25rem 0.5rem; }
  .bio-figure--right  { float: right; margin-inline: 1.25rem 0; margin-block: 0.25rem 0.5rem; }
}
@container article (min-width: 40rem) {
  .bio-figure--large  { max-width: 460px; }
}
```
and replace the four literal track classes with one intrinsic grid — which also
removes the "Tailwind only emits what it sees" caveat at `BioArticle.tsx:262`:

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
This honours the author's declared track count when there is room and degrades
one column at a time instead of all at once. Keep the `position: center|full`
figures full width — that is what the author asked for.

---

#### C5 🟠 `::: columns` stacks entirely below 768 px and needs a hand-rolled exclusive query pair
**I: medium · E: low · R: low**

**Problem.** `.bio-cols-2/3/4` are single-column below `48rem` and full-width
above (`index.css:1327–1356`), with a `max-width: 47.999rem` twin for the
divider rule. A two-column record grid — the commonest use — would fit at 500 px.

**Fix.** One intrinsic track list, no query, and the divider expressed as a gap
rule that works at any count:

```css
.bio-article .bio-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(11rem, 100%), 1fr));
  gap: clamp(0.4rem, 1.5vw, 0.5rem) clamp(1rem, 4vw, 2rem);
}
```
For `--divided`, prefer a background-image rule on the container over
`:nth-child(Nn+1)` selectors, since the effective column count is now dynamic
and `nth-child` arithmetic can no longer know it. If that proves fiddly, keep
the current `nth-child` rules behind a single `@container article (min-width:
34rem)` — but **delete** the `47.999rem` twin either way.

---

#### C6 🟠 Five layout-critical `max-height`s use `vh`, which is the *large* viewport on mobile
**I: medium–high · E: trivial · R: none**

**Problem.** On iOS/Android, `100vh` is the viewport with browser chrome
*retracted*. A panel sized `94vh` therefore extends behind the toolbar whenever
the toolbar is showing — its bottom edge, and the last line inside it, are
unreachable.

**Evidence.** `CodexShell.tsx:145` `max-h-[94vh]`;
`AsciiTabViewer.tsx:110` `max-h-[96vh]`; `index.css:239`
`min(72vh, 40rem)`; `index.css:1443` `max-height: 70vh`;
`LanguageMenu.tsx:130` `max-h-[60vh]`.

**Fix.** Progressive enhancement — `vh` first as the fallback, `dvh` second.

```css
.codex-panel { max-height: 94vh; max-height: 94dvh; }
.search-panel { max-height: min(72vh, 40rem); max-height: min(72dvh, 40rem); }
.bio-doc-embed iframe { max-height: 70vh; max-height: 70dvh; }
```
Use `dvh` (dynamic) for panels the user is *inside*; `svh` would over-shrink
them the moment the toolbar retracts. For the codex specifically, prefer
`min(94dvh, 100dvh - 1rem)` so the inset frame is never the thing that clips.

---

### Group D — Touch, platform, and the refinement panel

---

#### D1 🔴 iOS Safari zooms the page whenever any refinement field is focused
**I: high · E: trivial · R: none**

**Problem.** All seven inputs and selects in the refinement panel compute to
**15.2 px**. Safari zooms the viewport on focus for any control under 16 px, and
does not zoom back out — the reader is left in a zoomed, horizontally scrolled
page mid-search.

**Evidence.** measured at 375 × 812: 7 controls at `15.2px`, `zoomRisk: true`
each; `.form-ink { font-size: 0.95rem }` (`index.css:293`).

**Fix.** One declaration; the visual change is 0.8 px.

```css
.form-ink { font-size: max(16px, 0.95rem); }
```

---

#### D2 🔴 On a phone the refinement panel hangs 195 px below the viewport with a nested scroll inside it
**I: high · E: low–medium · R: medium**

**Problem.** The panel is `position: absolute; top: 100%` under a search bar that
already sits at y = 431. Its own `max-height: min(72vh, 40rem)` = 584 px against
751 px of content, so it scrolls internally by 168 px — *and* its bottom edge is
195 px below the viewport. The reader gets two nested scroll regions, and the
"Clear refinements" / "Hide" controls are off-screen with no indication they
exist.

**Evidence.** measured at 375 × 812; `SearchBar.tsx:110`
`absolute inset-x-0 top-full z-40 pt-2`; `index.css:237–239`.

**Root cause.** An overlay geometry designed for a viewport tall enough to
contain it, applied unconditionally. `index.css:232–236` even documents the
intent ("a scroll of its own on short screens so it never pushes the grid
around") — but on a phone, pushing the grid is strictly better than hanging off
the screen.

**Fix (recommended, cheapest).** Below 40 rem, put the panel in the flow. It
already animates its own entry, so nothing else changes.

```diff
- <div className="absolute inset-x-0 top-full z-40 pt-2">
+ <div className="search-panel-slot pt-2">
```
```css
.search-panel-slot { position: absolute; inset-inline: 0; top: 100%; z-index: 40; }
@media (max-width: 40rem) {
  .search-panel-slot { position: static; }
  .search-panel { max-height: none; overflow-y: visible; }
}
```
**Fork worth raising with the designer.** The alternative is a bottom sheet
(`position: fixed; inset: auto 0 0; max-height: 85dvh`) with a drag handle. It is
the more modern phone pattern and keeps the grid still — but it is a *new*
interaction idiom for a manuscript-styled app, needs a focus trap and a scrim,
and will read as a mobile-app convention rather than a codex. **Recommendation:
the in-flow variant above.** It costs 6 lines and introduces no new metaphor.

---

#### D3 🟠 21 controls on the mobile home screen are below the 44 × 44 px touch minimum
**I: high · E: low · R: low**

**Problem.** Measured at 375 × 812:

| Control | Source | Size |
|---|---|---|
| Facet chips (15 of them) | `Chip.tsx:33` `px-3 py-1 text-[0.7rem]` | **26 px tall** |
| Refinement toggle | `AdvancedToggle.tsx:41` `px-2.5 py-1` | **26 × 54** |
| Header sound/fx/ambient | `App.tsx:357` `h-9 w-9` | 36 × 36 |
| Segmented control segments | `index.css:348` `padding: .32rem .8rem` | **26 px, 10.56 px font** |
| Chips inside the panel (`size="sm"`) | `Chip.tsx:33` | **21 px tall** |
| Search clear `✕` | `SearchBar.tsx:88` `p-1` + `h-4 w-4` | 24 × 24 |
| Image-viewer toolbar buttons | `ImageViewer.tsx:257` `h-9 w-9` | 36 × 36 |
| **Inline audio play/stop in prose** | `AudioPlayer.tsx:105,116` `h-4 w-4` | **16 × 16** |

A 10.56 px uppercase label at 0.12em tracking is also at the edge of legibility.

**Root cause.** Sizes tuned for a mouse. Nothing here is *responsive* to input
modality.

**Fix.** Expand the *hit area* without changing the drawn size — this is the
pattern that preserves the visual identity exactly, which matters because these
pills and plaques *are* the design.

```css
@media (pointer: coarse) {
  /* the drawn pill is unchanged; the tap target is not */
  .chip, .form-segment, .facet-rail button {
    position: relative;
    min-block-size: 2rem;                 /* 32 px drawn, was 26 */
  }
  .chip::after, .form-segment::after {
    content: ""; position: absolute; inset: -0.5rem; /* → ≥ 44 px */
  }
  .form-segment { font-size: 0.72rem; }   /* 10.56 → 11.5 px */
  .icon-btn { min-block-size: 2.75rem; min-inline-size: 2.75rem; }
}
```
Apply `.icon-btn` to `App.tsx`'s `CtrlButton`, `ImageViewer`'s `ICON_BTN`,
`AsciiTabViewer`'s `SmallButton` and the search clear button. For the inline
audio controls, give the 16 px glyph a `::after { inset: -0.75rem }` — it sits in
running prose where a larger drawn button would break the line box.

Note `.form-segment` and `.chip` are unlayered today, so **B1 must land first**
or these need `!important`.

---

#### D4 🟠 `viewport-fit=cover` is declared but no safe-area inset is ever used
**I: medium · E: low · R: none**

**Problem.** `index.html:5` opts into drawing under the notch and home
indicator, and then nothing accounts for it. On a notched phone the fixed header
sits partly under the status bar in portrait and under the notch in landscape;
the image-viewer toolbar (`ImageViewer.tsx:220` `pb-4`) and the codex's bottom
frame land under the home indicator.

**Fix.**
```css
header.app-bar {
  padding-top: max(0.5rem, env(safe-area-inset-top));
  padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
}
.codex-scroll  { padding-bottom: max(1.5rem, env(safe-area-inset-bottom)); }
.viewer-toolbar{ padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
.site-footer   { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
```
Test landscape too — `inset-left`/`inset-right` are the ones usually forgotten,
and this app's centred symmetry makes an asymmetric inset visible.

---

#### D5 🟡 A future sticky search bar has one prerequisite
**I: low now, high if §4 is adopted · E: trivial · R: low**

`body { overflow-x: hidden }` (`index.css:80`) computes to `hidden/auto`, which
makes `body` a scroll container. **Verified: `position: sticky` still works
today** — Chromium propagates the overflow to the viewport because `html` is
`visible/visible`. But the guarantee is fragile across engines. If the search bar
becomes sticky (§4), change it to `overflow-x: clip`, which expresses the same
intent (no horizontal scrollbar from an overshooting ornament) without creating a
scroll container.

---

## 3. Prioritized roadmap

Impact is measured against the audit's own metric: **useful information per
screen**, at 375 × 812, 844 × 390 and 1512 × 982.

### Phase 0 — Unblock (do first, half a day)

| # | Item | I | E | R | Why first |
|---|---|---|---|---|---|
| B1 | `@layer components` + `.btn-rpg` custom properties; delete 16 `!important`s | — (enabler) | M | Low | Without it, most fixes below cannot be written as utilities and D3 needs `!important` |

### Phase 1 — Quick, high-value, low-risk (≈ 1 day, most of the benefit)

| # | Item | I | E | R | Measured effect |
|---|---|---|---|---|---|
| A2 | `auto-fill` card grid + fluid gap/padding | ★★★★★ | S | Low | 1512: 4 → **6 columns**, 9.4 → **14.6 cards/viewport**; 320: card +20 %; all size discontinuities gone |
| A1 | Fluid vertical rhythm + `--header-h` | ★★★★★ | S | Low | chrome 375 px: **770 → 602**; 1512 px: **680 → 571** |
| A3 | Facet chips → single-row rail on compact | ★★★★☆ | S–M | Low | chips **158 → 48 px**; with A1: chrome **→ 492 px**, first full card row above the fold |
| D1 | `.form-ink { font-size: max(16px, .95rem) }` | ★★★★☆ | XS | None | Removes the iOS zoom trap |
| C6 | `vh` → `dvh` (5 sites, fallback-first) | ★★★☆☆ | XS | None | Panel bottoms stop hiding behind mobile toolbars |
| A5 | Collapse the three stacked bottom spacers | ★☆☆☆☆ | XS | None | −96 px of dead scroll |

### Phase 2 — The reading experience (≈ 1–1.5 days)

Effects in this phase are **projected** from the measured baseline (§0.3), not
simulated — verify each against §6.

| # | Item | I | E | R | Projected effect |
|---|---|---|---|---|---|
| C1 | Fluid codex plate + `--plate-scale` + fluid pane padding | ★★★★★ | S | Low–Med | 844 × 390: article text share 4 % → ~43 % (plate 216 → ~100 px, pane `pt` 56 → 44 px) |
| C3 | Fluid article type **and leading** | ★★★★☆ | S | Low | mobile measure ≈ 34 → ≈ 42 chars; desktop unchanged by construction |
| C2 | Codex tabs → 4 non-wrapping tracks | ★★★☆☆ | S | Low | strip 72 → ~41 px; symmetry restored |
| C4 | Article figures float from ~26 rem; intrinsic image groups | ★★★★☆ | M | Low | small illustrations stop being full-width blocks |
| B4 | One `max-height: 34rem` ornament tier | ★★★★☆ | S | Low | 844 × 390 chrome → ~240 px (from a **measured** 422 px with Phase 1 applied) |
| D3 | `@media (pointer: coarse)` hit expansion | ★★★★☆ | S | Low | 21 sub-44 px controls → compliant, **drawn sizes unchanged** |
| D2 | Refinement panel in-flow below 40 rem | ★★★★☆ | S | Med | panel stops hanging 195 px off-screen; one scroll instead of two |

### Phase 3 — Structural tidy (≈ 1 day, pays off later)

| # | Item | I | E | R |
|---|---|---|---|---|
| B3 | `container-type` on `.bio-article` (+ card); migrate its `sm:` rules to `@container` | ★★★☆☆ | M | Low |
| A4 | Footer `auto-fill` + fluid item height; **delete** the 420 px query | ★★★☆☆ | S | Low |
| C5 | `.bio-columns` intrinsic; **delete** the `48rem`/`47.999rem` pair | ★★☆☆☆ | M | Low |
| B2 | Declare `--breakpoint-*` in `@theme`; delete the 480 px queries | ★★☆☆☆ | S | Low |
| A6 | `min-h-[40vh]` → `min(40dvh, 18rem)` | ★☆☆☆☆ | XS | Low |
| D4 | `env(safe-area-inset-*)` on the four fixed edges | ★★☆☆☆ | S | None |

### Phase 4 — Optional, needs a design decision

- **Sticky search bar** on medium+ (§4). High value for a long catalogue;
  requires D5 first.
- **Bottom-sheet refinement panel** on compact — the alternative to D2, rejected
  above as off-idiom. Raise it only if the in-flow variant tests badly.
- **Wide-screen codex**: at 1512 px the article uses 768 px of a 1128 px pane
  (180 px of empty parchment each side). Do **not** set the article in two
  columns — a two-column measure inside a vertical scroll container forces the
  reader up and down per screen. Better uses of that space, in order of safety:
  (a) leave it — the margin *is* the manuscript; (b) a right-hand rail on
  `min-width: 80rem` holding the portrait and the Lore summary, so the Biography
  tab shows dossier facts without a tab switch; (c) narrow the panel itself.
  **Recommendation: (a) now, (b) as a designed feature later.**

### What *not* to sequence early

A2 and A1 must ship **together**. Measured: A2 alone at 1512 × 982 gives 6
columns but still 0 fully-visible cards, because 571 px of chrome plus a 383 px
row pitch exceeds 982 px. Either one alone under-delivers; together they put a
full row above the fold.

---

## 4. Responsive strategy

A coherent minimum: **three width tiers and one height tier**, all derived from
content, plus continuous scaling everywhere in between. Today's five thresholds
in two unit systems collapse to this.

### The three-layer discipline

| Layer | Tool | Owns |
|---|---|---|
| **Continuous** (default) | `clamp()`, `min()`, `max()`, `cqi` | type size, leading, gaps, padding, card min-width, plate scale |
| **Component** | `@container` on `.bio-article`, `.character-card` | article figures, image groups, `::: columns`, card internals |
| **Structural** (rare) | 2 width queries + 1 height query | the refinement panel's positioning, the facet rail, ornament suppression |

Rule of thumb for this codebase: **if a change is a size, it is a `clamp()`; if
it is a count, it is `auto-fill`; only a change of *kind* earns a media query.**
Applied strictly, this removes 6 of the 8 existing layout queries.

### The tiers

**Compact — up to 34 rem (544 px)** · phones portrait
2 card columns. Facet chips as a one-row rail (A3). Refinement panel in the flow
(D2). Ornament kept but minimised: the herald stays (it is content, not
decoration — "on this day" is a real entry point), the volume kicker and the
title rule stay, the footer's string-rule and rosette go. Article type at the
bottom of its clamp, leading tightened to 1.5. Touch targets ≥ 44 px via hit
expansion (D3). **Target: first card row above the fold at 375 × 812
(chrome ≤ 491 px — validated achievable at 492 px).**

**Medium — 34–64 rem (544–1024 px)** · phones landscape, tablets, half-screen windows
3–4 card columns, chosen by `auto-fill`, not asserted. Article figures begin to
float (C4, at ~26 rem of *article* width, not viewport). Facet chips return to a
wrapping row. Everything else is the continuous ramp between compact and wide.
This is the tier that does not exist today, and it is where "narrow desktop
window" lives.

**Wide — 64 rem+ (1024 px+)** · laptops and desktops
5–6+ card columns from the same `auto-fill` rule; content cap raised from
`max-w-6xl` (1152 px) to `min(100rem, 100%)`. **Every clamp reaches its maximum
here, so this tier renders byte-identically to today** except for the column
count and the grid's outer width. That is the guarantee that protects the
established desktop appearance.

**Short — `max-height: 34rem` (544 px)**, orthogonal to all three
The tier the app is missing entirely. It suppresses *ornament only*: the volume
kicker, the rule under the title, the herald plaque, the codex divider ornament;
and it turns `--plate-scale` down to ~0.62. Nothing informational is removed.
This is what makes phone landscape and 768 px-tall laptops usable, and it is
~15 lines of CSS.

### Progressive spatial compression

The mechanism the brief asks for, expressed once: every gap in the app draws from
two tokens whose `vh` term does the compressing automatically.

```css
:root {
  --gap-section: clamp(0.75rem, 2.2vh, 2.25rem);   /* between page blocks */
  --gap-tight:   clamp(0.35rem, 1.2vh, 0.75rem);   /* within a block */
  --pad-inline:  clamp(0.4rem, 2vw, 1.25rem);      /* page/grid side padding */
  --measure:     clamp(1rem, 0.94rem + 0.5vw, 1.13rem);  /* article body */
}
@media (max-height: 34rem) { :root { --gap-section: .5rem; --gap-tight: .25rem; } }
```
A `vh` term in a `clamp()` is what "compresses as space runs out" means in native
CSS. No JavaScript, no ResizeObserver, no extra breakpoints — and the desktop
value is pinned at today's number by the clamp's maximum.

### Optional: sticky search on medium and up

With A1+A2+A3 the chrome is ~490 px on a phone and ~570 px on a laptop, and the
reader scrolls a long grid. A sticky search bar would make the catalogue feel
half as deep. Requires D5 (`overflow-x: clip`) and `align-self: start` if the
bar ever lands in a flex or grid parent — the most common silent sticky failure.
Keep it off compact, where 56 px of permanent chrome is too expensive.

---

## 5. Things NOT to change

Explicitly out of scope. Changing any of these damages the identity the brief
says must survive, or buys nothing.

**Visual identity — untouchable**
1. The palette, the `@theme` token scales, the two Cormorant families and the
   `--font-music` fallback chain.
2. `.parchment`, `.ornate-border`, the double gold/brown border, the
   `CornerOrnament` filigree, `.fx-curl` and its curled-corner shadows, the drop
   cap, `.divider-ornament`. Only *sizes* and *conditional visibility on short
   viewports* are in scope; never the drawing.
3. The page-turn animations (`page-turn-open/close`, `leaf-in`) and the
   `CLOSE_MS` ↔ `.page-turn-close` contract. Do not make them responsive.
4. The centred, symmetrical composition. Do **not** left-align the title, the
   herald or the codex plate on mobile to save space — the symmetry *is* the
   manuscript, and A1–A3 recover the space without it.
5. The catalogue card's anatomy: `aspect-[3/4]` portrait, name plate beneath,
   badge top-left, flags top-right, gold hover ring. A2 changes how many cards
   fit, never what one looks like. (A shorter aspect ratio on short viewports was
   evaluated and is **not** recommended — it is the one change that would make
   the grid read as a generic app.)
6. The 3D pointer tilt, cursor glare and shine sweep, including their
   fine-pointer-only engagement.

**Structure and behaviour — leave alone**
7. **The four codex tabs.** Do not collapse them into a `<select>`, an accordion
   or a "more" menu on mobile. C2 makes all four fit; that is the correct answer.
8. The fixed header. It carries the brand and the language switch and costs
   53 px. Do not make it scroll away or shrink on scroll.
9. The codex's `p-2 sm:p-6` inset. The gap between the backdrop and the panel is
   what makes it a *book on a desk* rather than a full-bleed mobile page.
   Resist "edge-to-edge on mobile".
10. The desktop article measure (`max-w-3xl`, ≈ 85 characters). It is at the top
    of the comfortable range for this serif at 1.75 leading, and C3's clamp
    maximum preserves it exactly.
11. The herald's four tones, its `aria-live` rotation, and the *concept* of a
    settled `min-height` (only the number becomes fluid).
12. The content model: BioMD Lite, `index.json` / `index-<lang>.json` /
    `*.bio.json` / `*.bio.md`, the three-files-one-fact rule, `DD.MM.YYYY`,
    lowercase ISO codes, comma-lists. Nothing in this audit needs a content
    change. C4's figure classes are a *renderer* change; the `size:`/`position:`
    vocabulary the author writes is unchanged.
13. The reduced-motion policy, including the `--fx-dur` custom-property
    mechanism and the `html[data-fx="on"]` opt-in pair. It is subtle, correct,
    and easy to break by accident.
14. The performance choices responsive work could quietly undo: hover-only
    `will-change`, `contain` on the drift layer, literal keyframe values, the
    4-eager-portrait rule, `memo`'d cards, no canvas.
15. The main search input's 18 px font. It is the only control already immune to
    iOS zoom.

**Approaches to avoid**
16. **No JavaScript-driven layout.** No `ResizeObserver` column counting, no
    measured breakpoints, no JS-computed font sizes. `auto-fill` and `clamp()`
    do all of it, and the app's performance philosophy forbids per-frame layout
    work.
17. **No new dependencies** for any of this. Every fix above is native CSS.
18. **No breakpoint proliferation.** The target is *fewer* thresholds than today
    (5 → 3), not more. Any new query must name the content reason it exists.
19. Do not touch `pages/` or the fixture-only `index.json` gap noted in §"How
    this was measured" as part of this work — file it separately.

---

## 6. Verification checklist

Because there is no test suite (see
[`.claude-memory/15-app-critique.md`](.claude-memory/15-app-critique.md)),
verification is manual and must be done by **dragging**, not by jumping between
named sizes — every discontinuity in §0.1 was found between breakpoints, not at
them.

1. **Drag 280 → 2560 px** with the grid visible. The card must never shrink as
   the window grows. Watch 540, 640, 780, 1020, 1160 px.
2. **Drag height 300 → 1200 px** at a fixed 900 px width. Ornament should fade
   out below ~544 px; nothing informational may disappear.
3. Re-run the §0.1 table and record chrome, columns and *fully visible cards* at
   the same 11 viewports. Regression = any cell worse than the "today" column.
4. 844 × 390 with a codex open: article text must occupy > 40 % of the viewport
   (today 4 %).
5. 375 × 812: open the refinement panel. No part of it may sit below the
   viewport; there must be exactly one scrollbar.
6. Real iOS Safari: focus every refinement field — the page must not zoom. Check
   the notch and home-indicator insets in both orientations.
7. `pointer: coarse` emulation: every interactive element ≥ 44 × 44 px of hit
   area; no drawn size may have changed.
8. **1512 × 982 side-by-side against `main`**: the codex, the herald, the footer
   and the card *appearance* must be pixel-identical; only the grid's column
   count and outer width may differ.
9. Longest-label pass in ru, de and zh: codex tabs, facet chips, footer items,
   codex plate.
10. `prefers-reduced-motion: reduce` with `data-fx="on"` and `"off"` — the
    three-axis policy must still hold.

## 7. agent-message check
 I double-checked all 7 items. Result: 1 partly-confirmed (the container issue holds true for the 3/4-column BioMD and Lore layouts, but sm-floats in max-w-3xl at >=640 usually have enough space; recommendation to narrow it), 2 confirmed (toolbar ~442px intrinsic), 3 partly-confirmed (touch sizes are correct, but the footer is an irrelevant
counterexample; “high” is overestimated; do not duplicate the header), 4 confirmed and 6 are complete duplicates—merge into a single “keyboard-images” finding; href-figure is already a native anchor; viewer/entry/jump + Gallery + inline image break, lines are accurate), 5 rejected as a high production finding: the CSS code is indeed
3:4/max-height70vh with a fallback below, but pages do not contain mode: embed, meaning there is no current user scenario; nested iframe scroll is not proven by the source code), 7 partly-confirmed (header nowrap/space-between and 36px controls are confirmed, but the actual 320px overflow is not proven: CODEX is brief,
lang trigger ~69px; body overflow hidden only exacerbates the effects, not proof). StructuredOutput will provide further details later.
