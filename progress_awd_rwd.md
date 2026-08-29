# RWD/AWD optimization — working record

Branch: **`RWD_AWD_optimized`**
Base: `main` @ `05ced5f` ("updated performance with 736 pages")
Work commit: **`17be472`** — *RWD/AWD: derive layout from available space, not from device breakpoints* (24 files, +899 / −223, `app/` only)
Follow-up commit on the branch: `72f2d10` — the audit and task markdown, committed separately.

Driving document: `RWD-AWD Optimization Task.md`.
Reference material read: `AWD-RWD-Guide.md`, `RESPONSIVE-RWD-AUDIT.md` (and the four fallback audits through it).

Everything below was measured in the running application against the real 736-entry
catalogue, in the in-app browser at emulated viewports, reading DOM geometry. Where a
number comes from the audit documents rather than from my own measurement it is marked.

---

## 1. What this branch is for

The app is a Vite + React 19 + TypeScript + Tailwind v4 renderer for a catalogue of
musician biographies presented as an antique manuscript. It responded to the viewport
but never *economised* for it. The brief was to make it ergonomic and information-dense
across portrait and landscape, from ~320 CSS px to 4K and beyond, **without redesigning
it**, using a hybrid strategy: intrinsic/fluid as the default layer, container queries
for component-local decisions, and a small number of content-driven media switches.

Two rounds of work happened in this session:

1. **Pass 1 — architecture.** Baseline measurement, root-cause diagnosis, and the
   systemic fixes (fluid rhythm tokens, intrinsic grid, codex geometry, article
   container queries, footer, dvh/svh, safe areas, 16 px inputs, table scrolling).
2. **Pass 2 — fine tuning.** Fourteen concrete observations from reading pass 1 on real
   devices, plus a change of direction on grid density (see §6.1).

---

## 2. Method

- Dev server (`npm run dev`) driven through the in-app browser; viewport emulated per
  class; **DOM geometry treated as authoritative**, screenshots used only for look and
  feel (see §9 for why).
- Every claim has a measurement. Audit recommendations were implemented only where the
  DOM agreed with them; one was refuted outright (§6.2, RC7).
- Overflow was checked by walking every element and reporting any whose box escapes the
  viewport **and** has no `overflow-x`-clipping ancestor — `documentElement.scrollWidth`
  alone is not a valid test, because fixed-position elements do not contribute to it and
  `body { overflow-x: hidden }` hides the rest.
- Widths were also swept continuously (ten samples between 320 and 1600), not only at
  named classes. This is how I caught a regression I had introduced myself (§6.3).

Settled a disputed fact from the audits before starting: `pages/index.json` holds **736**
entries, not one. Two of the four audits had measured a stale fixture, and their density
figures are therefore not usable.

---

## 3. Root causes (pass 1 diagnosis)

| # | Finding | Evidence |
|---|---|---|
| RC1 | **Grid column count and container were declared, not derived.** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` inside `max-w-6xl`. | Identical 1152 px / four 262 px columns at 1280, 1920, 2560 **and 3840** — 30 % of a 4K screen. Card width stepped 152 → 167 → 187 → 221 → 262 px. |
| RC2 | **Fixed pre-grid tower that never compressed.** Flat `pt-20`, kicker, h1, rule, herald, search, chips, flag row, `mt-10` — none aware of viewport height. | Document top → first card: **627 px at every desktop width 1280–3840**; 656 @ 390×844; 734 @ 360×800. At 844×390 that is the whole screen: **zero cards visible**. |
| RC3 | **Codex chrome did not compress.** `max-h-[94vh]` (not `dvh`), ~90 px flat padding, four-tab strip wrapping to two rows on every phone. | 844×390: pane 37→354, plate 196, tabs 41, **article top y=374 — 20 px below the bottom of the pane**. Opening a biography showed no words of it. 390×844: plate 180, tabs 73 (2 rows). |
| RC4 | **Article layout queried the window, not the column.** `SIZE_CLASS`/`FLOAT_CLASS`/`IMAGES_TRACK_CLASS` on `sm:` (640 px viewport); `::: columns` on a 48 rem viewport pair. | The reading column is 332 px @390, 701 @800, and **768 px at every viewport from ~1150 up**. A declared `small` figure measured 567 px at 639 and 175 px at 640 — a 3.2× cliff across one pixel. |
| RC5 | **Colophon cost more than a screen on a phone.** Nine tiles in two columns = five rows of 68 px. | **850 px** @390×844, plus 112 px of three stacked bottom spacers above it. |
| RC6 | **No fluid scale, no container query, no dynamic viewport unit.** | `clamp()` × 0, `@container` × 0, `dvh`/`svh` × 0 in 1681 lines. Seven refinement inputs computed to **15.2 px** — below the 16 px at which iOS Safari zooms the page on focus and does not zoom back. |
| RC7 | **The portraits were already being upscaled.** | Source portraits are the legacy archive's thumbnails — measured 150×200, 194×255, 196×271, 270×366, 400×283, 410×677 — rendered at 232×309. See §6.2: this refutes the "add `srcset`" recommendation and set the ceiling on card width. |

**Verified non-issues** (checked, found sound, left alone): no document horizontal overflow
at any width (the three elements a naive scan flags are decorative shine sweeps clipped by
`overflow-hidden` ancestors); portraits already reserve geometry via `aspect-[3/4]`;
`content-visibility` windowing already present on touch devices; `min-width: 0` correctly
applied on flex/grid children; the `::: nav` bar is already genuinely intrinsic.

---

## 4. Architecture as implemented

Four mechanisms, in strict order of preference.

### 4.1 Fluid rhythm — four bounded tokens

Added to the existing `@theme` block in `app/src/index.css`, so they are ordinary Tailwind
utilities (`mt-stack`, `pt-topbar`, `px-gutter`) rather than a parallel system:

```css
--spacing-stack:   clamp(0.75rem, 0.5rem + 1.2svh, 1.75rem);
--spacing-topbar:  clamp(3.6rem,  3.2rem + 1.5svh, 5rem);
--spacing-gutter:  clamp(0.5rem,  0.25rem + 1vw,  1.5rem);
--card-min:        clamp(8.75rem, 7rem + 4vw,     15rem);
--codex-ctrl-size: clamp(1.7rem,  1.5rem + 0.8vw, 2.1rem);
```

`--spacing-stack` is the single vertical step between hero blocks. Its middle term is
**`svh`, not `vw`**, because the quantity being economised is height; and **`svh` rather
than `dvh`** so a margin does not resize while the reader scrolls and the mobile URL bar
retracts. `--spacing-topbar` clears the 53 px fixed header and stops (it was a flat 80 px
at every viewport height).

### 4.2 An intrinsic grid bounded at both ends

```css
grid-template-columns: repeat(auto-fill, minmax(
  max(
    (100% - 4 * var(--grid-gap)) / 5,                       /* at most five  */
    min(var(--card-min), (100% - var(--grid-gap)) / 2)      /* at least two  */
  ), 1fr));
```

Both bounds live in the track size, not in a breakpoint. The lower guard means the track
can never be so wide that one card fills the row; the upper guard means the track is never
smaller than a fifth of the row, so `auto-fill` cannot fit a sixth. Between them
`--card-min` decides and the card grows with the room.

`auto-fill`, not `auto-fit`: a search returning three results should leave them at card
size on the left, not stretch three cards across the row. (Verified — a one-result search
renders one normal-sized card, not one 1344 px card.)

`.page-wide` caps the band at **90 rem = 1440 px**, which is not a taste but an arithmetic
consequence: five cards of ~270 px plus their gaps. 270 px is where a card stops being a
photograph and starts being an enlargement of a 400 px scan (RC7).

### 4.3 The article is a query container

`container: bio / inline-size` sits on `.bio-measure` — the wrapper, **not** `.bio-article`,
because an element cannot read its own `cqi`. Everything inside now asks the reading
column:

- type size `clamp(0.85rem, 0.73rem + 0.82cqi, 1.13rem)`;
- `--bio-lead` and `--bio-block` (leading and block gap), switched once at a 34 rem
  container width, spent by headings, quotes, verse, code, rules, notices, figures,
  image groups and column blocks;
- `--bio-cell` (table cell padding), same switch;
- figure ceilings as proportion-with-a-cap: `min(40cqi, 200px)` / `min(52cqi, 320px)` /
  `min(66cqi, 460px)` — continuous, no threshold, no cliff;
- the float threshold at 28 rem of column;
- `::: images` tracks at 24 / 34 / 44 rem, `::: columns` at 30 / 40 / 50 rem, so a group
  narrows a track at a time instead of falling straight from N columns to one;
- `::: signature` right-alignment at 30 rem.

### 4.4 Two media queries, both earning their keep

- `@media (max-height: 36rem)` — the short-viewport band. Covers a landscape phone
  (~390 px of height), an old 568 px portrait phone, and a half-height desktop window.
  It tightens `--spacing-stack` and `--spacing-topbar` **once** and lets that carry into
  every gap on the page, retires the volume line and the rule under the headline, and
  compresses the codex plate. The query is on **height alone**: the same 390 px width in
  portrait has 844 px to spend and no such problem.
- `@media (hover: none)` — the pre-existing `content-visibility` windowing, untouched.

Two narrow-width overrides survive (herald corner ornaments below 480 px, footer tile
inline padding below 420 px) plus `prefers-reduced-motion`. Total `@media` blocks in the
stylesheet: **9 → 6**.

---

## 5. Change log

### `app/src/index.css` (1681 → 2232 lines)

| Area | Change |
|---|---|
| `@theme` | Five fluid tokens (§4.1). |
| `.page-wide` | Shared page band, `min(100%, 90rem)`. |
| `.catalog-grid` | Intrinsic 2–5 column formula (§4.2). |
| `.grid-cell` | `container-type: inline-size` added; `contain-intrinsic-size` 26 → 18 rem to match the new card height. |
| `.card-name / -sub / -badge` | Card typography read from the card's own `cqi`; the name clamped to two lines. |
| `.hero-title / -kicker / -rule` | Fluid headline, fluid tracking on the volume line. |
| short-viewport band | New. |
| `.herald*` | Fluid padding, inner rules, body min-height, line size; the 480 px override reduced to the corner ornaments only. |
| `.search-panel`, `.form-ink`, `.form-segment` | Fluid padding and lettering; `.form-ink` 0.95 → **1 rem** (iOS focus zoom). |
| `.chip / .chip--sm` | New — fluid facet pills. |
| `.country-flag`, `.country-row--open` | New — fluid flag size, bounded scrollable open state. |
| `.gallery-grid`, `.lore-grid` | Intrinsic, replacing `sm:` column switches inside the codex pane. |
| `.codex-plate*`, `.codex-tabstrip`, `.codex-tab`, `.codex-ctrl`, `.codex-topfade` | New — fluid plate, one-row tab strip, compact square controls, parchment scrim. |
| `.bio-measure` | New — reading measure and query container. |
| `.bio-article` | `--bio-lead` / `--bio-block` / `--bio-cell`; fluid type; `overflow-wrap: break-word`. |
| `.bio-figure`, `.bio-fig--*`, `.bio-images*` | Shrink-wrap, no upscaling, centred when not floating, container-driven ceilings and tracks. |
| `.fx-curl .inner img` | `width: 100%` → **`max-width: 100%`** — the single most consequential line in the pass (§6.2). |
| `table`, `th`, `td` | `width:auto; min-width:100%`, cell floor, container-driven padding. |
| `.footer-menu-item`, `.footer-rosette`, `.footer-string-rule` | Fluid tile height, padding and lettering. |
| overlay heights | `72vh` → `72svh`, `70vh` → `min(70svh, 44rem)`. |

### TSX

| File | Change |
|---|---|
| `App.tsx` | `px-gutter pb-2 pt-topbar`; safe-area insets on the fixed header; skeleton matches the real grid. |
| `CharacterGrid.tsx` | `.catalog-grid .page-wide`; full-row divider by class; bottom spacers collapsed. |
| `CharacterCard.tsx` | `.card-*` classes; tighter plate padding; `title` on the name. |
| `AnimatedTitle.tsx` | `.hero-*` hooks; fluid headline and tracking. |
| `HeraldBanner.tsx`, `SearchBar.tsx` | Spacing on the shared step; refinement panel scrolled into view on open. |
| `SiteFooter.tsx` | Three-column nav on phones; fluid type; `.page-wide`; safe-area bottom. |
| `CodexShell.tsx` | `dvh`; fluid pane padding; **one flex control row** replacing three absolute boxes; scrim; panel cap 84 rem. |
| `CodexHeader.tsx`, `CodexTabs.tsx` | Class hooks for the fluid plate and one-row tab strip. |
| `CodexArticle.tsx` | `.bio-measure` wrapper. |
| `BiographyView.tsx`, `PageView.tsx` | `min-h-[40vh]` → `min-h-48`. |
| `GalleryTab.tsx` | `.gallery-grid`; **duplicate-key fix** ported from the background task (§8). |
| `LoreTab.tsx` | `.lore-grid`; fluid label column. |
| `BioArticle.tsx` | Semantic `bio-fig--*` / `bio-images--*` classes replacing `sm:` utilities; `w-full` removed from figures. |
| `Chip.tsx`, `Field.tsx`, `YearRangeField.tsx`, `AdvancedSearchPanel.tsx` | Panel density; name fields paired on one row while single-column. |
| `CountryFilter.tsx` | Fluid flags; **the counter became a toggle** with a bounded open state. |
| `LanguageMenu.tsx`, `AsciiTabViewer.tsx` | `dvh`; codex trigger uses the shared control size; dropdown anchors right. |

---

## 6. Decisions

### 6.1 Accepted — with the reasoning

**Card size is capped by the source images, not by taste.** The archive's portraits are
150–410 px wide. A card wider than ~270 px is enlarging a small JPEG. This decided the
`--card-min` ceiling, the 90 rem page cap, and the no-upscale rule for article figures. It
also means *denser is sharper* here, which is the opposite of the usual trade.

**Grid capped at five columns per row.** Pass 1 produced 8 columns at 1920 and 10 at 2560
by letting the container grow to 160 rem. You asked for **no more than five**, with the
image size varying instead. Implemented as an upper guard in the track formula rather than
a breakpoint. Consequence, stated plainly: at 3840 the page is a 1440 px band with wide
margins. That is the direct arithmetic of "five per row with cards that do not exceed the
source resolution", and it is your call — not a limitation.

**Two columns guaranteed down to ~270 px.** You reported seeing a single card on narrow
screens. Reproduced: below ~305 px the old `--card-min` floor forced one column. The lower
guard in the formula now makes two columns structural rather than incidental.

**Card names clamped to two lines.** Russian patronymics ("Владимир Павлович Машкевич")
ran to three lines and made a card half again as tall as its neighbours, breaking the row
rhythm. Smaller container-driven type fits most names in two; the clamp guarantees the
rest, and the full name survives in `title` and the accessible name.

**The codex controls became one flex row.** Not a tuning — a structural fix. The three
groups were independently absolutely positioned (`left-9`, `left-1/2`, `right-9`) and below
~360 px the centred edition menu reached the page-turn arrows. A flex row cannot overlap
itself, so the class of bug is gone rather than pushed to a smaller width.

**A parchment scrim under the floating controls.** Found while reading a long article at
390 px: lines scrolled out from behind the buttons half-covered. The controls have to stay
fixed over a scrolling pane, so they were given something to sit on, in the same paper.

**One line of JavaScript, added deliberately.** The refinement panel hangs out of the
search bar on `position: absolute`; its foot landed at y=964 in an 844 px viewport. There
is no CSS expression for "how far is it to the bottom of the screen", and the answer moves
with the hero above it, so the panel asks to be scrolled into view once, on open. Not a
viewport listener: one scroll, on one click.

### 6.2 Rejected — and why

| Rejected | Why |
|---|---|
| **`srcset` / `sizes` on portraits** (asked for by the task's Phase F and by the audits) | Measurement refuted the premise. `naturalWidth` for the first twelve portraits: 150, 300, 194, 270, 410, 400, 196, 291, 300, 400, 244, 155 — rendered at 232 CSS px, i.e. **already upscaled** on a DPR-1 display and doubly so on DPR-2. There are no larger variants to select from. Adding `srcset` would be complexity with no possible benefit, and the task says not to add it without evidence. |
| **Keeping 8–10 columns at 4K** (pass 1) | Reverted on your instruction. Both are defensible: more columns means more catalogue per screen, five means larger, more recognisable portraits. Your call recorded, and the mechanism supports either by changing one number. |
| **`float: inline-start` / `inline-end`** | Every content language in the catalogue is left-to-right, and logical floats are considerably newer than the rest of the baseline this stylesheet targets. An unsupported value is silently dropped, so the failure mode is a figure that stops floating with no warning. Used physical `left`/`right`, as the utilities they replaced were. |
| **Hiding the herald plaque in the short-viewport band** | Would have bought ~52 px in landscape. Rejected: the plaque carries clickable "on this day" links into entries, so hiding it removes capability rather than decoration — precisely what `AWD-RWD-Guide.md` §11.2 warns against. Compressed instead (padding, min-height, inner rules). |
| **Container queries for the refinement panel's two-column switch** | The panel's width is `min(viewport − gutters, 672 px)`, so viewport and container coincide over the whole range that matters. A container query would be machinery with no behavioural difference. Kept `sm:`. |
| **New i18n keys for the country facet toggle** | Would mean editing ten dictionaries for one label. Used the existing `facet.country.group` as the accessible name plus `aria-expanded` for state, with a `+33` / `−` glyph carrying it visually. Correct ARIA, zero translation churn. |
| **Icon-only close button at every width** | Considered for compactness. Kept the word "Close codex" from `lg` up — the label is part of the RPG chrome and there is room for it there. Icon below. |
| ~~**Splitting `index.css`**~~ — **reversed on 2026-08-29, and the reasoning here was wrong.** | I wrote that the single stylesheet was "the project's documented convention". It was not: nothing in `docs/` or `.claude-memory/` required it, and `15-app-critique.md`'s own backlog item 10 had asked for the split. Deferring it was defensible on scope grounds; calling it a convention was not. The sheet is now fourteen files under `src/styles/`, imported in cascade order by `index.css`. |
| **Modal focus trap / `inert` background** | A real defect (≈40 controls stay tabbable behind an open codex) and flagged by the audit. Rejected for this branch: it is accessibility semantics, not responsive layout, it touches focus management rather than CSS, and mixing it in would make the diff hard to review. Flagged in §11. |
| **Adding intrinsic `width`/`height` to article images** | Would fix the remaining load-time reflow, but the dimensions are not in the content and cannot be known at render time. This is a content problem (the `pages/` corpus), not a renderer problem. |
| **The audit's five-band breakpoint scheme** | `RESPONSIVE-RWD-AUDIT.md` §5.2 proposes three width regimes plus a height modifier. Implemented as one height query plus intrinsic sizing instead: the width regimes turned out to be unnecessary once the grid derived its own columns. Fewer special cases, per the task's decision rule. |
| **Audit claim X4 ("container queries not needed in the first pass")** | Contradicted by measurement — see RC4. The audit's own reconciliation section already sided against it; the DOM confirmed it. |
| **Bar/meter graphics in the summary report** | The published report is 12 rows × 5 numeric columns; a well-set table with tabular figures is the right presentation, and inline bars would have been decoration. |

### 6.3 Corrected mid-flight

- **A regression I introduced myself.** After switching the grid to `auto-fill`, the 320 px
  viewport collapsed to **one column** (it had been two). Cause: `.page-wide` subtracted
  the page gutter a second time on top of `main`'s own, costing 32 px of a 320 px screen,
  and the `--card-min` floor was 9.5 rem. Found by the continuous width sweep, not by the
  named-viewport matrix — the failure sat *between* the classes I had listed. Fixed by
  removing the double gutter and lowering the floor; later made structural by the lower
  guard in §4.2.
- **The refinement panel's scroll-into-view fired before layout.** The panel animates in,
  so the first measurement was of a zero-height box. Now settles first.

### 6.4 Assumptions

1. **Content languages are LTR.** All eleven codes in the catalogue are; this justifies the
   physical floats in §6.2.
2. **The archive's image sources will not be re-scanned.** Everything about card and figure
   sizing follows from their current resolution. If higher-resolution scans ever land, the
   ceilings (`--card-min`, the `min(Ncqi, Npx)` pairs) are the two places to revisit.
3. **736 entries is representative of the catalogue's eventual scale**, i.e. the facet rows
   will keep growing. This is why the country facet was made bounded-and-scrollable rather
   than merely smaller.
4. **`svh` / `dvh` / `@container` / `cqi` are available.** The build targets
   `baseline-widely-available`; all four are, as of this year. `float: inline-start` was
   judged *not* safely inside that line (§6.2).
5. **Below 320 px is out of scope.** 280–305 px works (two columns) but was not tuned.

---

## 7. Your requirements added during the session

Recorded in the order you raised them.

**Turn 2 — fourteen fine-tuning observations, all implemented:**

| # | What you observed | What was done |
|---|---|---|
| 1 | Biography type and spacing still too large on mobile; text does not fit the width | Type read from the column: 18.08 px flat → **14.4 px** at a 332 px column, 17.4 at 701, 18.08 at 768. Leading 1.75 → **1.60** narrow. All block spacing on one shared `--bio-block`. The not-fitting was unbroken legacy URLs — `overflow-wrap: break-word`. |
| 2 | The four codex buttons could be smaller, prettier, more compact | One shared square size, 27 px on a phone / 34 px on a desktop, replacing `btn-rpg`'s standalone padding. |
| 3 | Table row spacing too loose | Cell padding 0.4/0.6em → **0.2/0.4em** narrow; measured row height ~75 → **29 px**. |
| 4 | Be more frugal with vertical *and* horizontal padding at low resolutions | Gutters, panel padding, chips, flags, footer tiles, herald and codex pane padding all fluid. |
| 5 | Show no more than five biographies per row; vary the image size | Upper guard in the track formula; card grows to 270 px instead. |
| 6 | On narrow screens only one card is shown; more would fit if smaller | Lower guard; two columns guaranteed to ~270 px. |
| 7 | Advanced search is bulky and does not fit vertically; fields and combos too large | Content **761 → 578 px** at 360×800 — fits entirely, no inner scrolling. Name boxes pair onto one row while single-column. |
| 8 | The country menu is broken on narrow screens — enormous, or truncated | It was a one-way expansion to all 51 flags. Now a **toggle** into a bounded scrollable band; flags shrink so 18 nations take two rows, not three. |
| 9 | Card names too large, two or three lines, cards disproportionately long | Smaller container-driven type, clamped to two lines; rows now uniform in height. |
| 10 | Footer menu bulky and wasteful | **850 → ~490 px** on a phone: three columns, fluid tiles, and the three stacked bottom spacers collapsed. |
| 11 | Narrow: photo sits left, empty block beside it, then text — centre it | Below the float threshold the figure is centred. |
| 12 | The edition menu overlaps the back arrow | The flex control row (§6.1). |
| 13 | Two photos that do not fit take the full width and look outsized | Groups narrow a track at a time; a stacked cell keeps an 18 rem ceiling so paper shows both sides. |
| 14 | Low-resolution article images shown too large | `width: 100%` → `max-width: 100%` on the print, and the figure shrink-wraps. A 150 px scan blown up to 332/768 px is now shown at 150 px, and is sharp. |

Plus, in the same turn: verify the spawned background task and whether its fix landed;
review proportionality across different biographies, tables and widths; publish the report
as an artifact; create the `RWD_AWD_optimized` branch and commit.

**Turn 3:** this document.

---

## 8. The spawned background task

`task_c8c08f35` — *Fix duplicate React key in GalleryTab photos*. It completed, but in its
own git worktree branched from pristine `main`, so its version of `GalleryTab.tsx` did not
contain any of this branch's changes and could not be merged over them. The fix itself
(`dedupeByTarget`, first occurrence wins so a declared index portrait keeps the lead) was
sound and was **ported by hand** into this branch.

Verified after porting: Barrios' gallery renders 4 figures with 4 unique sources and no
duplicates, where the index portrait and a `media.photos` entry previously resolved to the
same URL and produced a repeated React key.

---

## 9. Testing

### 9.1 Catalogue — measured on the committed build

“Chrome” = document top → first card. “Visible” = cards intersecting the first viewport.

| Viewport | Cols | Card | Chrome | Visible | Footer | Overflow |
|---|---:|---:|---:|---:|---:|---|
| 320 × 568 | 2 | 147 | 425 | 2 | 522 | none |
| 360 × 800 | 2 | 167 | 509 | 4 | 509 | none |
| 390 × 844 | 2 | 182 | 515 | 4 | 490 | none |
| 412 × 915 | 2 | 193 | 540 | 4 | 490 | none |
| 430 × 932 | 2 | 202 | 528 | 4 | 491 | none |
| 640 × 360 *(1280 @ 200 %)* | 4 | 147 | 336 | 4 | 489 | none |
| 768 × 1024 | 4 | 175 | 504 | 8 | 480 | none |
| 800 × 830 | 4 | 183 | 485 | 8 | 482 | none |
| 844 × 390 *(landscape)* | 5 | 152 | 344 | 5 | 485 | none |
| 932 × 430 *(landscape)* | 5 | 169 | 381 | 5 | 490 | none |
| 1024 × 768 | 5 | 186 | 523 | 5 | 432 | none |
| 1280 × 720 | 5 | 234 | 526 | 5 | 440 | none |
| 1440 × 900 | 5 | 264 | 553 | 5 | 447 | none |
| 1920 × 1080 | 5 | 270 | 578 | 10 | 453 | none |
| 2560 × 1440 | 5 | 269 | 611 | 10 | 453 | none |
| 3840 × 2160 | 5 | 269 | 634 | 20 | 453 | none |
| 7680 × 4320 | 5 | 269 | 634 | 45 | 453 | none |

Baseline for comparison (measured before any change): chrome **627 px at 1280/1920/2560/3840**,
656 @390×844, 734 @360×800, 692 @320 (audit); columns 2/3/4 with cards 152–262; footer
850 px on a phone; **0 cards visible at 844×390**.

Nothing grows past 3840 — grid, card and headline all reach their ceilings and stop.

### 9.2 Codex — measured on the committed build

“Readable” = pixels of article visible inside the pane the moment an entry opens.

| Viewport | Plate | Tabs | Article top | Readable | Measure | Type | Panel |
|---|---:|---:|---:|---:|---:|---:|---:|
| 320 × 800 | 144 | 35 (1 row) | 312 | 452 | 263 | 13.8 px | 309 |
| 390 × 844 | 149 | 35 (1 row) | 320 | 486 | 332 | 14.4 px | 378 |
| 640 × 360 | 93 | 36 (1 row) | 231 | 106 | 566 | 16.3 px | 623 |
| 768 × 1024 | 175 | 37 (1 row) | 368 | 613 | 671 | 17.2 px | 748 |
| 844 × 390 | 103 | 37 (1 row) | 243 | 123 | 742 | 17.8 px | 822 |
| 1280 × 720 | 184 | 39 (1 row) | 357 | 329 | 768 | 18.0 px | 1249 |
| 3840 × 2160 | 199 | 40 (1 row) | 443 | 1639 | 768 | 18.0 px | 1344 |

Baseline: 844×390 plate 196 / tabs 41 / article top 374 with the pane ending at 354 →
**readable 0**; 390×844 plate 180 / tabs 73 (two rows) / article top 398 (audit-corroborated
across all four audits).

### 9.3 Content cases exercised

- **`agababov`** — `::: images` group: stacked at a 332 px column, cells at their natural
  196 / 213 px, centred, paper both sides.
- **`abiton`** — the case you named: a `size:small position:right` figure at a 332 px
  column, now 133 px and **centred** (offset 100 px left, 100 px right), text below.
- **`milan`** — four-column table: 363 px table inside a 332 px scroller, **scrolls**;
  rows 29 px; no page-level horizontal scroll.
- **`aguado`** — two-column table: fits the column, no spurious scroll.
- **`acosta`** — `::: columns`: stacked at 332, two tracks at 701, driven by the column
  rather than the window.
- **`sarenko`** — the largest article in the corpus (56 KB source, 18,033 px rendered at
  390 px): no unclipped overflow anywhere in the article subtree; this is where the
  control-row collision was found.
- **`barrios`** — gallery (2 columns @390, 6 @1344), documents tab, attributes tab; image
  viewer opened at 390 with no overflow.
- Continuous width sweep 320 → 1600 at ten samples: no horizontal scroll, no unclipped
  overflow, card width stays in a 141–202 px band instead of stepping 152 → 262.
- Touch emulation (375×812, `hover: none`): `content-visibility: auto` and
  `container-type: inline-size` both active on cells; two columns; 15.7 px name.
- Refinement panel at 360×800: all seven `.form-ink` controls compute to **16 px**.

### 9.4 Build

- `tsc -b` — clean.
- `vite build` — clean, 825 modules; CSS 99,450 bytes (~18 kB gzip).
- **Not run:** no lint or test script exists in `package.json` (`dev`, `build`,
  `build:fable`, `preview` only).
- **Not re-tested:** `prefers-reduced-motion`. That CSS block, including the `--fx-dur`
  custom-property trick that lets an opted-in ornament survive the blanket `!important`
  clamp, is untouched by this branch.

---

## 10. Observations worth keeping

- **DOM geometry beats screenshots in this harness.** The in-app browser renders faithfully
  up to about 800 CSS px; above that a screenshot returns a partial crop that does not
  match the DOM. Two apparent "bugs" during the session were screenshot artifacts. All
  measurements here are `getBoundingClientRect`.
- **Sweep, don't sample.** Every size discontinuity found — including the one I caused —
  sat *between* the named viewport classes, not at them.
- **`scrollWidth` is not an overflow test.** Fixed-position elements do not contribute to
  it, and `body { overflow-x: hidden }` hides the rest. The per-element walk with an
  `overflow-x` ancestor check is what actually finds the escapes; it also correctly
  ignores the decorative shine sweeps, which are clipped and harmless.
- **An element cannot read its own `cqi`.** The article container had to move from
  `.bio-article` to the `.bio-measure` wrapper before the type could scale with the column.
- **The settings store re-persists.** Writing `localStorage` directly and reloading does not
  clear a remembered filter; the facets have to be cleared through the UI or the app writes
  the old value straight back. Cost me two false measurements.
- **The measurement that changed the design.** Reading `naturalWidth` off the portraits took
  one line and invalidated an entire recommended workstream (`srcset`), while simultaneously
  supplying the ceiling for card width and the fix for oversized article images. Checking
  the assets before optimising for them was the highest-leverage thing in the session.
- **Backgrounded subagents branch from `main`.** Useful for genuinely independent work,
  useless for anything touching files under active edit — the patch had to be ported by hand.
- **Unlayered project CSS beats Tailwind utilities**, which the codebase already documents.
  Every new rule was written with that in mind; where a component class owns a property
  (`position`, `padding`, `font-size`), the corresponding utility was removed from the JSX
  rather than left to lose silently.

---

## 11. Remaining

| Item | Why it is still open |
|---|---|
| **Modal focus is not trapped; background is not `inert`** | ≈40 controls stay tabbable behind an open codex, and arrow keys turn catalogue pages instead of moving between tabs. Real defect; accessibility semantics rather than responsive layout, so deliberately left to its own change. |
| **320 × 568 is usable, not comfortable** | 425 px of chrome in a 568 px screen. Below the stated target range; further gain would mean dropping the herald, which is a feature. |
| **Lazy article images still shift on load** | The corpus carries no intrinsic dimensions, so a shrink-wrapped figure cannot reserve its exact box. A `min-inline-size: min(100%, 6rem)` floor keeps the reflow small. Real fix belongs in the content. |
| **Column count is a single number** | `5` in the `.catalog-grid` formula. If the five-per-row decision is ever revisited, that and the 90 rem page cap are the only two values to change. |
| **No lint or test script** | Nothing to run in CI beyond `tsc -b` and `vite build`. Worth adding, out of scope here. |

---

## 12. Token reference

```css
/* app/src/styles/tokens.css — @theme */
--spacing-stack:   clamp(0.75rem, 0.5rem + 1.2svh, 1.75rem);  /* hero vertical step   */
--spacing-gutter:  clamp(0.5rem,  0.25rem + 1vw,  1.5rem);    /* page gutter          */
--card-min:        clamp(8.75rem, 7rem + 4vw,     15rem);     /* narrowest card       */

/* the fixed top bar, and the page clearance derived from it */
--topbar-ctrl:       clamp(1.75rem, 1.45rem + 0.75vw, 2.6rem);
--topbar-pad-block:  clamp(0.25rem, 0.15rem + 0.3vw, 0.7rem);
--topbar-gap:        clamp(0.3rem,  0.18rem + 0.35vw, 0.8rem);
--topbar-icon:       clamp(0.78rem, 0.66rem + 0.38vw, 1.3rem);
--topbar-text:       clamp(0.62rem, 0.54rem + 0.26vw, 1rem);
--topbar-height:     calc(var(--topbar-ctrl) + 2 * var(--topbar-pad-block) + 1px);
--spacing-topbar:    calc(var(--topbar-height) + var(--spacing-stack));

/* the codex's floating control row */
--codex-ctrl-size:        clamp(1.7rem,  1.5rem + 0.8vw, 2.1rem);
--codex-ctrl-inset:       clamp(1.05rem, 0.9rem + 0.6vw, 1.6rem);
--codex-ctrl-inset-block: clamp(0.75rem, 0.55rem + 0.6svh, 1.05rem);
--codex-scrollbar:        17px;  /* replaced at start-up by lib/scrollbar.ts */

/* .bio-article — switched once at a 34 rem container */
--bio-lead:  1.6   → 1.75;    /* leading            */
--bio-block: 1.05em → 1.6em;  /* block gap          */
--bio-cell:  0.2em 0.4em → 0.4em 0.6em;  /* table cell padding */
--bio-track: 0.06em → 0.12em;            /* uppercase heading tracking */
--bio-track-title: 0.085em → 0.14em;
```

Page band `min(100%, 90rem)`. Codex panel `max-w-[84rem]`, `max-h-[94dvh]`. Reading measure
`48rem`. Figure ceilings `min(40cqi, 200px)` / `min(52cqi, 320px)` / `min(66cqi, 460px)`.
Float threshold 28 rem of column. Short-viewport band `max-height: 36rem`.

---

*Summary report published as an artifact:*
<https://claude.ai/code/artifact/73b8ab21-8691-4049-82e3-613daefbd346>

---

# Round 2 — fine tuning (2026-08-29)

Ten defects and refinements reported after reading the first pass on real screens.
Everything below was again measured in the running app at emulated viewports, with DOM
geometry treated as authoritative.

## 13. What was wrong, and what was done

### 13.1 The print frame was drawn around the caption, not around the picture 🔴

*Reported with three screenshots (`images/abiton_page_image_artifact_01.png`,
`…barbosa_lima…_02.png`, `…albeniz…_03.png`), each with the artefact ringed in red.*

A regression from pass 1, and the diagnosis is a two-step one. `.bio-figure` shrink-wraps
(`inline-size: fit-content`) — but its content is the picture **and the caption**, so a
caption longer than a small scan makes the figure wider than the photograph. Pass 1 then
changed `.fx-curl .inner img` from `width: 100%` to `max-width: 100%`, which was right (it
stopped 150 px scans being blown up to the column) and which is what made the mismatch
visible: the frame — a `display: block` span — still filled the figure, so its drop shadow
and its two curled-corner shadows were painted against empty paper beside the print.

Measured on `abiton`: figure 160 px, frame 160 px, picture **150 px**. On `barbosa_lima`:
figure 288, picture 125.

Fixed by shrink-wrapping the frame too, scoped to the article so the gallery's deliberately
uniform `w-full` crops keep filling their cells:

```css
.bio-article .fx-curl { inline-size: fit-content; max-inline-size: 100%; margin-inline: auto; }
```

Verified across the three reported pages: 13 figures, frame width equal to picture width to
within a pixel in every one. The picture now centres under a caption that is allowed to be
wider — which is the right relationship, and better than forcing a 70-character caption
into a 125 px column.

### 13.2 The codex controls sat towards the middle, and on the scrollbar 🟠

The row was `inset-x-0 top-0 px-9 pt-2.5`: 36 px in from the panel edge and 10 px below it.
You supplied a "should be" mock-up but told me — correctly — not to take it literally, so
the geometry is derived from the panel instead of matched to the image:

| | derivation | result |
|---|---|---|
| leading inset | a corner gutter that grows with the panel | `clamp(1.05rem, 0.9rem + 0.6vw, 1.6rem)` → 17 px phone, 26 px desktop |
| trailing inset | the same, **plus the scrollbar track** | leading + `--codex-scrollbar` |
| top | the same gutter plus an optical correction — a solid dark button crowds a hairline border in a way the reading pane's transparent edge does not — given back on a short viewport | `clamp(0.75rem, 0.55rem + 0.6svh, 1.05rem)` |

Two intermediate values were rejected in front of you: 11 px (flush with the reading pane —
"pressed against the edges") and the original 36 px.

**The scrollbar had to be measured, not assumed.** `.codex-scroll` sets both
`::-webkit-scrollbar { width: 12px }` and the standard `scrollbar-width`/`scrollbar-color`,
and in Chromium the standard properties *disable* the legacy pseudo-element — so the track
was never 12 px, it was the platform's 15. It also is not a constant: 15 in Chromium, 17 in
Firefox on Windows, **0** where scrollbars overlay (iOS, Android, macOS). `lib/scrollbar.ts`
measures a probe styled exactly like the pane, once at start-up, and publishes
`--codex-scrollbar`; the CSS keeps 17 px as the fallback so a failure errs towards *clear of
the track*. Confirmed live: 15 px on desktop Chromium, 0 under device emulation (where the
row then becomes symmetrical, which is correct).

Checked at 320 / 360 / 390 / 768 / 844×390 / 1024 / 1920 / 2560 / 3840: the buttons never
overlap each other, never overlap the track (9 px of daylight at 1024), and the language
menu still opens from inside the row despite its `pointer-events: none` (the row is mostly
empty air over the article; only the controls take a click).

### 13.3 Two photographs became two rows far too early 🟠

"About 1080 pixels width" is a phone panel, not a window: 1080 device pixels at DPR 3 is a
**360 CSS px** viewport, whose reading column measures 304 px — under the 24 rem (384 px)
container query that switched `::: images` to two tracks. So a pair of 210 px scans that
would sit side by side at 148 px each was stacked into two full-width prints, one screen
each.

Replaced the three declared thresholds (24 / 34 / 44 rem) with the formula the catalogue
grid already uses — a ceiling from the declared `columns: N`, a floor from what a print may
shrink to, and the track decides everything between:

```css
grid-template-columns: repeat(auto-fill, minmax(
  max((100% - (var(--bio-images-n) - 1) * var(--bio-images-gap)) / var(--bio-images-n),
      min(9rem, 100%)), 1fr));
```

Two prints now stay a row down to ~296 px of column, and 4 → 3 → 2 → 1 is continuous rather
than three steps. Verified on `alfonso` at 360 px: two 148 px prints on one row.

`::: columns` keeps container queries — its `--divided` rules address cells by `nth-child`
and therefore have to know the count — but the thresholds move to one ~9 rem column each
(30/40/50 → **18/28/38 rem**). Two consequences: the only shape in the corpus (153 blocks,
every one a two-cell record row of a title and a year or a photograph) stays a row on a
360 px phone, and `bio-cols-4` becomes reachable **at all** — it was asking for 50 rem of a
column that `.bio-measure` caps at 48.

### 13.4 The refinement panel: 598 → 426 px on a phone 🟠

All four of your suggestions, plus the general tightening:

| | | |
|---|---|---|
| a | gender as signs (`⚥ ♂ ♀`), scope and gender sharing one line | −50 px |
| b | inputs and selects shorter — leading 1.35 → 1.2, padding 0.26 → 0.2 rem (the **type** cannot shrink: 16 px is the floor below which iOS Safari zooms the page on focus and never zooms back) | 31.5 → 27.2 px each |
| c | the two year ranges paired on one row; the boxes share the row instead of claiming 4 rem each | −59 px |
| d | reset and hide smaller and tighter | −20 px |
| — | field label gap, grid row gap, divider, panel padding and title all tightened | −30 px |

Result at 360×800: **426 px, no inner scrolling**; at 390×844 it ends 21 px above the fold.
The two-column desktop layout is unchanged — every pairing is a wrapper that dissolves with
`sm:contents`.

`flex-wrap`, not a two-track grid, for the scope/gender pair: below ~330 px of panel the
scope strip takes its own line again rather than being clipped by its own `overflow: hidden`.

### 13.5 The top bar was one size at every width 🟠

A 36 px control, a 14 px glyph, a 14 px wordmark and 8 px of padding — 53 px tall on a
320 px phone and 53 px tall on a 4K display. Now one bounded fluid family
(`--topbar-*`), and **`--spacing-topbar` is derived from it** rather than guessed:

```css
--topbar-height:  calc(var(--topbar-ctrl) + 2 * var(--topbar-pad-block) + 1px);
--spacing-topbar: calc(var(--topbar-height) + var(--spacing-stack));
```

`pt-topbar` can no longer under- or over-clear a bar whose size it does not know, and the
short-viewport band's override of it could be deleted — tightening the step now tightens
the clearance by itself.

| viewport | bar height | control |
|---|---|---|
| 360 | 36.8 px | 28 px |
| 1920 | 54.7 px | 37.6 px |
| 3840 | 64.8 px | 41.6 px |

### 13.6 The tablature viewer was built at desktop sizes throughout 🔴

Measured at 360×800 before: plate 56 px of side padding with the title running under the
close button, a toolbar of eight controls wrapping onto **four rows**, and — the real
problem — every one of the document's **92 systems** drawn at 610 px inside a 322 px pane,
each with its own horizontal scrollbar to drag.

- **The score fits the pane.** Zoom state is now `number | null`, where `null` means "what
  fits": the pane is observed (`ResizeObserver`), the widest system measured, and the ratio
  clamped to `[0.4, 1]` — never above 1, because fitting is for making a wide system
  readable, not for blowing a short one up on a desktop. The moment the reader touches
  `+`/`−` the number is theirs; a new `⤡` button hands it back. The percentage carries the
  `⤡` mark while it is the pane's answer, because "43 %" with no explanation reads as a
  fault. New i18n key `viewer.fitWidth` in all ten dictionaries.
- **0.4 is a floor, not a target.** Fitting to the widest system guarantees nothing ever
  scrolls, but one long line then sizes all ninety others. Below 0.4 the handful of unusually
  wide systems keep their own scrollbar. It sounds severe and is not: a phone reporting
  360 CSS px does so at DPR 3, so a 4.4 px note head is 13 real pixels.
- **Chrome halved.** Plate, kicker, title, toolbar, buttons, zoom readout and body padding
  are all fluid. The toolbar is two rows on a phone instead of four.
- **The English preamble is prose again.** The "is this a diagram?" test was "three lines
  containing any of `|:-`, plus six rule characters somewhere", which every legacy file's
  `#--------PLEASE NOTE--------` header satisfies — so half the archive's introductions were
  put in a horizontal scroller and read four words at a time. A staff line is the
  *conjunction* of a bar and a run of rule: three lines with `|` **and** `-{4,}`.

Verified on both files you named. `da_8lz.txt` (92 systems) at 360 px: 43 %, 2 systems
scroll, 0 stray scrollers in the prose. `da_etcz.txt` (11 systems): same. At 1440 px: 100 %,
nothing scrolls.

### 13.7 The audio pill was wider than the link it replaced 🟡

The archive's score tables link a recording *as* its format — `[MIDI](…)`, `[MP3](…)` — so
the pill's label was the word "MIDI", set in small caps between a play triangle and a
download arrow: three pieces of chrome around one redundant word, in a table cell that has
to fit a phone.

Where the label says nothing the icon does not, it is drawn as a sign — two of them, a
keyboard for MIDI and a speaker for a recording — and the word moves into the `<title>` and
the accessible name. A label that carries real information ("Tico-Tico, Duo
Hill/Wilczynski") is never touched. Pill padding and gaps tightened at the same time.

Measured on `abreu` at 360 px: three pills at **62 px** each, and the three-column score
table now fits the 304 px column with no horizontal scrolling at all.

### 13.8 `index.css` split into fourteen files 🟡

2 528 lines → an import list plus `src/styles/*.css` at 47–318 lines each: `tokens` ·
`base` · `chrome` · `topbar` · `home` · `search` · `herald` · `footer` · `codex` ·
`article` · `figures` · `blocks` · `viewers` · `effects`.

The sheet is unlayered, so **the import order is the cascade** — `index.css` now says so and
names the two orderings that are load-bearing (`tokens` first; `chrome`'s `btn-rpg` above
everything that narrows it). The split preserved the original order exactly except for two
blocks moved earlier after checking that no rule between them touches their selectors
(`chrome`, and the new `topbar`), and a normalised-whitespace equality assertion guarded
against anything being lost or duplicated.

**On the reasoning in §6.2 of this document: it was wrong, and I have corrected it there.**
I wrote that the single stylesheet was "the project's documented convention". It was not —
nothing in `docs/` or `.claude-memory/` required it, and `15-app-critique.md`'s own backlog
item 10 had asked for exactly this split. Deferring it was defensible on scope grounds;
calling it a convention was not. `12-app-architecture.md`, `13-app-code-map.md`,
`14-app-patterns-and-gotchas.md` and `15-app-critique.md` have been updated. The `@layer`
half of critique item 10 remains open: splitting made the rules findable, not the cascade
safer.

### 13.9 Two photographs, left-aligned under a centred page 🟡

`adamjan`'s gallery laid its two portraits into the first two of four full-width tracks and
left a third of the pane empty on the right, under a plate, a tab strip and a heading that
are all centred. `auto-fit` with a ceiling instead of `auto-fill` with `1fr`: empty tracks
collapse, prints keep a 12 rem maximum rather than stretching, and what is left becomes
equal margins. A full gallery is unaffected — its tracks are already narrower than the
ceiling, so there is no free space to centre.

### 13.10 The footer's treble clef was clipped 🟢

Not a font problem — a containment one. `.footer-string-rule` is a 14 px band carrying a
`mask-image` for the fade at its ends, and a mask brings `mask-clip: border-box` with it:
that clips the **element's whole rendering, descendants included**. The rosette is a 31 px
absolutely-positioned child of that 14 px band, so the clef lost its head and its tail.

The strings and their fade moved to a `::before`; the rosette is no longer inside anything
masked. It also now asks for `--font-music` (U+1D11E is in none of the text faces, so the
glyph had been falling through to whatever generic serif the platform substituted).

### 13.11 Markdown headings were sized by the window 🟡
*(raised mid-session)*

`h2`/`h3` were the last things in the article still measured in `vw`, while everything
around them reads the reading column. A heading in a 304 px column was therefore being
sized by a 1080 px window — 18.4 px against 14.2 px body text, uppercase, tracked at
0.12 em — which is how "Nicolas Alfonso: Verzeichnis der veröffentlichten Werke" spent
three lines.

Sizes moved to `cqi`, keeping the ratio to the body text roughly constant (~1.18× for `h2`,
~1.06× for `h3`) at every width, and tracking became a variable on the existing 34 rem
switch (`--bio-track` 0.06 → 0.12 em, `--bio-track-title` 0.085 → 0.14 em) — tracking is
width, and an uppercase title in a narrow column cannot afford it. The same for the promoted
`# ` title lines. That heading is now **two lines**.

## 14. Verification

`tsc -b` clean, `vite build` clean (one 102 kB CSS bundle). Geometry checked at 320, 360,
390, 768, 844×390, 1024, 1440, 1920, 2560 and 3840; no element escapes the viewport at any
of them, and no document-level horizontal scroll. Frame-to-picture width equality asserted
across every figure on the reported pages.

## 15. Still open after this round

Unchanged from §11, minus the stylesheet row: modal focus trapping, 320×568 comfort, lazy
image reflow (a content problem), and the absence of lint/test scripts. Newly noted:

- **`--codex-scrollbar` is measured once at start-up.** Correct for real devices, where the
  scrollbar mode does not change; it does *not* follow a mid-session switch between device
  emulation and a desktop window in DevTools.
- **Eleven of `da_8lz`'s 92 systems still scroll sideways** at 360 px. That is the 0.4 floor
  doing its job; wrapping a long system onto two staves is the real fix and is a parser
  change, not a CSS one.
- **The stylesheet is still unlayered.** Fourteen files, same footgun.

---

## 16. Session state as of 2026-08-29 (end of round 2)

**Repository state.** Working tree, not committed — branch `RWD_AWD_optimized`, still one
commit ahead of `72f2d10` (the round-1 work is committed; round 2 above is uncommitted).
`git status` shows, beyond round 2's own edits:

- `pages/de|en|ru/*` deletions and index edits that **pre-date this session** — present in
  the working tree before round 2 began, not touched by it. Left alone; not this branch's
  concern unless you ask.
- `images/*.png` — the five screenshots you supplied for this round's reports (three
  artefact captures, two button-position mock-ups). Untracked; kept as evidence, not
  referenced by app code.

**Files changed by round 2**, beyond what §5's table already lists for round 1:

| File | Change |
|---|---|
| `app/src/index.css` | Reduced to an import list; owns the cascade-order contract (§13.8). |
| `app/src/styles/*.css` *(new, 14 files)* | The stylesheet itself, moved out of `index.css` verbatim. |
| `app/src/lib/scrollbar.ts` *(new)* | Measures the platform's real scrollbar width once at start-up, publishes `--codex-scrollbar`. |
| `app/src/main.tsx` | Calls `publishScrollbarWidth()` before the first render. |
| `app/src/components/codex/CodexShell.tsx` | Control row → `.codex-ctrl-row`, geometry derived from the frame (§13.2). |
| `app/src/components/AsciiTabViewer.tsx` | Fit-to-width zoom, halved chrome, fixed diagram heuristic (§13.6). |
| `app/src/components/AudioPlayer.tsx` | `InlineAudioPlayer`/`InlineAudioDownload` draw a format icon instead of the format word when the label carries no other information (§13.7). |
| `app/src/components/LanguageMenu.tsx`, `App.tsx` | Header controls rebuilt on the new `--topbar-*` token family (§13.5). |
| `app/src/components/form/{Field,SegmentedControl,YearRangeField}.tsx`, `search/AdvancedSearchPanel.tsx` | Refinement panel compaction (§13.4): gender as signs, paired rows, tighter everything. |
| `app/src/lib/messages/*.ts` (all 10) | New key `viewer.fitWidth`. |
| `.claude-memory/{12,13,14,15}-*.md` | Corrected to reflect the CSS split (§13.8) and the docs error in the old §6.2 reasoning. |

**Verification run at the end of the round**: `npx tsc -b` clean, `npm run build` clean (one
102 kB CSS bundle, 20 s). Manual geometry checks at 320/360/390/768/844×390/1024/1440/1920/
2560/3840 CSS px, both orientations where relevant; zero elements escaping the viewport;
zero document-level horizontal scroll; the `.fx-curl`/picture width equality re-checked on
all three reported artefact pages after the fix.

**What is left for a future session** (§15's list stands): modal focus trap, 320×568
comfort ceiling, lazy-image reflow (needs intrinsic dimensions in the content, not a CSS
fix), lint/test tooling, the eleven still-wide ASCII-tab systems in `da_8lz.txt`, and moving
the fourteen `src/styles/*.css` files into `@layer`. Nothing in this round introduced a new
regression that a later session needs to chase — every fix above was verified against the
symptom it was reported for, not just against its own unit.

**Not done, and deliberately not attempted**: no commit was made. The round-1 commit
(`17be472`) and its follow-up (`72f2d10`) are the only commits on this branch; round 2's
work sits in the working tree pending your review, per the standing instruction to commit
only when asked.
