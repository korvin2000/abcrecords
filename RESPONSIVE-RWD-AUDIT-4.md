# Guitar Codex — Responsive Web Design Audit

**Audit scope:** `app/` React/Vite SPA plus its served `pages/` content.  
**Mode:** transform-existing audit; no application code changes made.  
**Evidence:** full source inspection; a successful production build; every one of the 16 catalogue routes opened at 390×844; continuous catalogue width scanning from 280–1920px; targeted catalogue, codex, advanced-search, gallery, image-viewer, keyboard and zoom checks. Measurements below are current observed values, not targets.

## Executive assessment

The manuscript system is coherent and the layout is not generally broken: the audited catalogue, codex and tested overlays produced no document-level horizontal overflow at the named viewports. The dominant RWD defect is **vertical economics**. Title, herald, search, filters, ornament, tabs and transition space consume the first viewport before the catalogue or article can do useful work. At 360×640 no card intersects the viewport; at 844×390 the open codex shows no article text at all.

Two defects are more severe than density: fixed header controls leave the viewport below roughly 315px, and modal dialogs neither receive/trap focus nor make the covered page inert. `aria-modal="true"` does not provide either behavior by itself. Touch geometry is also broadly undersized, and every advanced-search input computes to 15.2px, which triggers iOS focus zoom.

The correct intervention is a CSS-first compression pass plus narrowly scoped interaction-accessibility corrections—not a redesign, content-model change, routing change or component rewrite. Preserve the wide composition and manuscript character. Compress low-value space progressively, restore it at medium/wide widths, and treat short landscape height as a first-class constraint.

## Current-state assessment — keep

### Architecture and rendering model

- `app/vite.config.ts:8-30` keeps catalogue data in `pages/` and the bundle in the renderer. This is the correct content/renderer boundary and should not be disturbed for an RWD pass.
- `app/src/App.tsx:32-210` has a single page flow: fixed controls, title, herald, search, grid, footer, with codex overlays keyed from the hash route. The hash route is deep-linkable and back-button compatible (`app/src/lib/hooks.ts:64-99`).
- `app/src/components/codex/CodexShell.tsx:127-180` gives the reader one dedicated scroll owner. Its `absolute inset-[11px]` reading pane stays inside the double frame; do not replace it with body scrolling.
- Lazy modal/image/tab viewers and catalogue caches are appropriate for low-end devices. The production build passed (`tsc -b && vite build`, 825 modules) and emitted separate codex, image-viewer, ASCII-viewer, playback, MIDI, motion, Markdown and React chunks.

### Visual language

- The palette, Cormorant typography, manuscript gradients, gold rules, burgundy emphasis, corner ornaments, and restrained frame system are consistent in `app/src/index.css:12-182`, `app/src/components/OrnateFrame.tsx`, and `app/src/components/CurlFrame.tsx`.
- The background is static CSS/SVG grain rather than canvas/particles (`app/src/components/Background.tsx:8-15`). Keep it. It avoids scroll-linked and mobile GPU cost.
- Desktop source and runtime composition are already effective. At 1366×768, the four-column grid is intact, first cards are 262px wide, and there is no horizontal overflow. The visual issue at that size is that cards begin around y=597, so only their upper portions appear above the fold.

### Responsive foundations already correct

- `app/index.html:5` includes `viewport-fit=cover`; the deployment contract already permits safe-area support.
- `CharacterGrid.tsx:47-50` uses a simple 2 / 3 / 4-column base / `sm` / `lg` progression. The two-column compact catalogue is the right density-preserving structure.
- Article columns stack below 48rem, then use `minmax(0, 1fr)` with child `min-width:0` (`index.css:1327-1356`). Keep this containment.
- Markdown tables and code blocks own local horizontal scrolling (`BioArticle.tsx:187-194`; `index.css:983-1006`), rather than widening the reader.
- Images are CSS-contained and lazy-loaded. Character portraits sit in a declared `aspect-[3/4]` box, which reserves card geometry even though the `<img>` has no intrinsic `width`/`height`. Treat intrinsic image metadata as later performance/CLS hardening, not a current RWD blocker.
- Image and ASCII viewers have distinct stacking tiers; opening the codex locks body scrolling. `.codex-scroll` remains the correct sole reader scroll owner.
- Search keeps the scalable country choice as a native `<select>` (`SelectField.tsx:8-15`). Dynamic localized labels already wrap in most high-risk areas.
- The CSS strategy is mixed but understandable: Tailwind mobile-first utilities plus a few raw `max-width` rules (`index.css:274`, `:584`, `:755`, `:1351`). Consolidate ownership during implementation; do not create a parallel responsive system.
- No component currently needs container-query behavior merely for novelty: catalogue cards and reader blocks live in stable page-level containers. Reconsider container queries only if those components are later embedded in independently sized regions.

## Audit method and evidence baseline

### Coverage

- Opened all 16 catalogue cards at 390×844. All produced a dialog and article without an error: 12 dossier entries exposed four tabs; About, Sources, Links and News correctly rendered as article-only pages.
- Audited `#/agustin-barrios` at 280×568, 320×568, 360×640, 390×844, 844×390, 1024×768 and 1366×768.
- Exercised Advanced Search at compact portrait, tablet and 844×390 landscape sizes; exercised Authors → Gallery and its nested Image Viewer at 390×844.
- Scanned catalogue widths every 20px from 280–1920px. The only fixed element outside the viewport was the top control group at 280 and 300px; root `scrollWidth` did not reveal it.
- Applied 125%, 150% and 200% page zoom at 1280×720. Content reflowed without root horizontal overflow, but the first card moved from y≈597 at 100% to y≈1374 at 200%, confirming that fixed/stepped hero spacing becomes substantially more expensive under magnification.

| Surface | Observed evidence |
|---|---|
| 280×568 catalogue | Root width remains 280px; title y≈126–216; herald y≈284–391; first card y≈692, 112×233px; zero cards intersect the viewport. Header controls extend to x≈314. |
| 320×568 catalogue | First card remains y≈692; zero cards intersect. Header controls fit by only ≈6px and remain 36px high. |
| 360×640 catalogue | Title remains two lines at y≈126–216; first card y≈642; zero cards intersect. |
| 390×844 catalogue | Title y≈126–171; herald y≈239–329; first card y≈597, 167×306px; two cards intersect but neither is complete. |
| 768×1024 catalogue | First card y≈597, 224×362px; the first three-column row intersects. |
| 1366×768 catalogue | Four-column grid is intact; first card y≈597, 262×413px; four upper card portions are visible, none complete. |
| 280×568 codex | Reader pane is ≈240×510px; tabs occupy four rows; article begins y≈472, leaving only ≈67px of visible reading pane below its start. |
| 390×844 codex | Reader pane ≈350×769px; tabs occupy two rows; article begins y≈398. Close is 49×36px, previous/next 40×36px, tabs 29px high. |
| 844×390 codex | Reader pane y≈36–354; article begins y≈373—below the pane and viewport. The initial reader view contains zero article text. |
| 390×844 advanced search | Panel x≈20, y≈443, width≈350px; client/content heights ≈606/708px; all 16 controls fail the 44px product target in at least one dimension; seven inputs/selects compute to 15.2px. |
| 844×390 advanced search | Panel begins around y≈476, below the viewport. Opening it does not reveal the panel because the search itself sits below the uncompressed hero. |
| 390×844 image viewer | Viewer fits the viewport, but close is ≈38×36px and seven toolbar actions are 36×36px. The toolbar spans x≈18–373, so simply increasing every existing box to 44px in one row would overflow. |
| Codex keyboard pass | On open, focus remains on `<body>`; 40 covered-page controls remain tabbable. Tab proceeds through background language/audio/search/filter controls instead of the dialog. All four `role="tab"` controls have `tabIndex=0`. |

The screenshots corroborate the measurements: the wide identity remains strong, but catalogue utility begins around y≈597; at 390×844 only card tops appear; at 844×390 the codex reads as a title card rather than an article reader. DOM geometry takes precedence over visual estimates where they conflict.

## Concrete RWD problems and recommendations

### P0 — Fixed header controls leave sub-315px viewports

**Affected code:** `app/src/App.tsx:218-252`; `app/src/components/LanguageMenu.tsx:57-102`; `CtrlButton` in `App.tsx:341-365`; `body` overflow rule in `index.css:80-87`.

**Observed problem:** one `justify-between` row contains a non-shrinking brand group and a non-shrinking control group. Language is ≈81px wide; each icon is 36px; gaps accumulate. At 280px the final control occupies x≈278–314. The failure remains at 300px and disappears by 320px. Root `scrollWidth` still equals the viewport because fixed outliers do not enlarge normal flow and `body { overflow-x:hidden }` masks them.

**Root cause:** the row’s intrinsic minimum width exceeds the viewport. The language trigger is `shrink-0`; icon controls are fixed `w-9`; there is no compact brand/header mode.

**Recommended solution:** preserve all unique controls. Effects, ambience and sound have no duplicate settings surface, so hiding any one is not a valid cutover. Use one of these source-level strategies:

1. **Preferred:** below the content-fit threshold, replace the visible `CODEX` wordmark with the existing star/emblem while retaining the full brand as visually hidden accessible text; reduce only group gaps/padding. Restore the wordmark with a mobile-first `min-width` rule when it fits.
2. If 44px hit boxes plus all controls cannot fit in one line, use a declared two-tier/wrapping header and bind main top inset to the same header-height token. Do not let content slide behind an implicitly taller fixed header.

Do not solve this by shrinking targets. Compact visuals can sit inside 44px hit boxes. Acceptance: every control box lies within 280, 300, 320, 360 and 390px viewports; all controls remain keyboard/touch reachable; no horizontal clipping at 200% zoom.

**Impact / effort / risk:** very high / low–medium / medium.

### P0 — First useful catalogue content begins too low

**Affected code:** `App.tsx:260-299`; `AnimatedTitle.tsx:33-110`; `HeraldBanner.tsx:38-45`; `SearchBar.tsx:57-155`; `CharacterGrid.tsx:47-50`; `index.css:400-484`.

**Observed problem:** at 390×844, title begins y≈126, herald y≈239, search y≈394 and cards y≈597. At 280×568 cards start y≈692; at 360×640 y≈642; neither viewport shows any card. At 1366×768 cards still start y≈597 and none is complete. At 200% zoom on a 1280×720 viewport, the first card moves to y≈1374. Width steps also produce abrupt title-height changes: ≈90px through 360px, ≈45px around 380px, then 75/90px after `sm`/`md` type jumps.

**Root cause:** stacked fixed/stepped spacing: main `pt-20`, title `mt-3`, `text-4xl sm:text-6xl md:text-7xl`, unbreakable animated words, divider `mt-5`, herald `mt-5` with `min-height:3.5rem`, search `mt-9`, chips/count spacing and result wrapper `mt-10`. Each value is defensible alone; their sum is not.

**Recommended solution — progressive spatial compression:** 

- Make the compact layout the compressed base, then restore the present wide rhythm at ≥64rem. Suggested starting values: main top inset `3.5–4rem`; title `clamp(2rem, 8–9vw, 4.5rem)` with tests for unbreakable localized words; hero/divider/herald/search/result gaps `0.75–1.5rem` rather than independent 2–2.5rem steps.
- Compact `.herald` to roughly `0.7–0.8rem 1rem`; reduce `.herald-body` minimum to ≈2.75rem. Keep the current 1.15rem/2.1rem wide values.
- Use one `max-height:44rem` modifier for compact-height and landscape windows. Reduce or inline the secondary volume/divider treatment; do not remove the title, herald or search.
- Define a small set of fluid type/space custom properties and let components consume them. Do not globally scale the interface or add a breakpoint per device.

**Acceptance target:** first card top ≤480px at 360×640 and 390×844, with at least 35–40% of the first card visible; first card top ≤500px at 1366×768; preserve the 1366×1080/1920×1080 composition within an agreed small screenshot tolerance.

**Impact / effort / risk:** very high / low / medium. The risk is wide-screen identity regression; isolate the wide restoration rule and compare before/after screenshots.


### P0 — Touch targets and mobile input type are undersized

**Affected code:** `App.tsx:341-365`; `LanguageMenu.tsx:66-102`; `SearchBar.tsx:70-103`; `AdvancedToggle.tsx`; `Chip.tsx:23-40`; `index.css:282-385`; `CodexShell.tsx:156-187`; `CodexTabs.tsx:29-51`; `ImageViewer.tsx:161-257`; `AsciiTabViewer.tsx:98-266`; gallery/document/audio controls.

**Observed problem:** header icons are 36×36px; codex close/nav are 36px high; tabs are 29–31px high; chips can be ≈21px high. In Advanced Search, 15–16 of 16 controls fail a 44px product target in at least one dimension. All seven native/text fields compute to 15.2px from `.form-ink { font-size:.95rem }`, below the 16px iOS Safari focus-zoom threshold. In the image viewer, eight actions are 36–38px high and already span nearly the full 390px width.

**Root cause:** the visual ornament is also the hit box. Small `py-*`, `h-9/w-9` and 0.64–0.8rem labels have no larger interaction wrapper. A single global `min-width/min-height:44px` would improve targets but break the tightly packed image toolbar.

**Recommended solution:** adopt 44×44px as the product target for primary mobile actions while documenting that WCAG 2.2 AA’s normative Target Size minimum is 24×24px with exceptions—not 44px. Keep small glyphs and ornamental faces inside larger boxes. Treat each density pattern deliberately:

- header/codex/viewer primary controls: 44×44px;
- chips/segmented groups: 40–44px row height with adequate separation if a full 44px per pill creates excessive vertical cost;
- `.form-ink`: `font-size:max(16px, 1rem)` on compact/coarse-pointer contexts and a 44px control height;
- image/ASCII toolbars: allow wrapping or group secondary actions into two logical rows; do not force eight 44px controls into the existing single 355px row;
- preserve visible focus rings and test long translated labels.

Audit every duplicate owner together: header, language menu, search clear/refine, quick chips, segmented fields, selects, codex controls/tabs, gallery/doc/audio actions, image viewer, ASCII viewer and footer links.

**Impact / effort / risk:** very high / medium / medium.

### P0 — Modal focus and tab semantics are functionally broken

**Affected code:** `CodexShell.tsx:108-137`; `CodexTabs.tsx:29-51`; `ImageViewer.tsx:150-166`; `AsciiTabViewer.tsx:98-120`; modal providers in `app/src/lib/`.

**Observed problem:** after opening `#/agustin-barrios`, focus remains on `<body>`. Forty controls behind the visible codex remain tabbable; Tab moves through the covered header, search and filters instead of the dialog. Nested Image Viewer creates the correct visual stacking tier, but the parent dialog and page are still keyboard-reachable. All four `role="tab"` buttons use `tabIndex=0`; the tablist has no roving focus or Arrow/Home/End handling. ArrowLeft/ArrowRight bubble to the shell’s global entry-turn listener, so the keys expected to navigate tabs can turn catalogue entries instead.

**Root cause:** `aria-modal="true"` declares modality but does not implement focus entry, containment, background inertness or restoration. The visual overlay model and keyboard model have diverged.

**Recommended solution:** add one reusable modal-focus primitive, not three partial fixes. On open, record the invoker, focus a stable dialog control, make all lower layers inert, contain Tab/Shift+Tab in the topmost dialog, close only the topmost layer on Escape, remove inertness and restore focus on close. For `CodexTabs`, implement the ARIA tab pattern: selected tab `tabIndex=0`, others `-1`; ArrowLeft/Right, Home/End move/select within the strip and stop propagation. If that behavior is not desired, remove tab roles and expose ordinary buttons—but a correct tab pattern matches the existing UI.

**Acceptance:** keyboard focus never enters covered content; nested viewer containment works; Escape unwinds one layer; focus returns to the invoking card/tab/figure; arrow keys inside the tablist never turn entries; screen-reader virtual navigation does not expose inert layers.

**Impact / effort / risk:** very high / medium / medium. This is not cosmetic RWD work, but it blocks responsive keyboard and zoom usability and belongs before visual polish.

### P1 — Codex header and wrapped tabs consume the reading window

**Affected code:** `CodexShell.tsx:127-197`; `CodexHeader.tsx`; `CodexTabs.tsx:29-51`; article typography in `index.css:858-903`.

**Observed problem:** at 390×844 the article begins y≈398 after a two-row tab strip. At 280×568 tabs wrap into four rows and the article begins y≈472 inside a pane ending y≈539. At 844×390 the article begins y≈373 while the pane ends y≈354: zero article text appears in the initial landscape view.

**Root cause:** fixed shell controls and top padding precede a generous title/meta/divider block; `CodexTabs` adds `mb-6` and wraps. Width-only adaptations cannot recover the 318px reader height in landscape.

**Recommended solution:** 

- compact title/meta/divider sizes and margins by roughly 25–35% below 40rem;
- use `clamp(1.7rem, 8vw, 2.5rem)` for normal entry names while preserving the existing long-title branch;
- make compact tabs a one-line `overflow-x:auto`, `flex-wrap:nowrap` strip with 44px targets, scroll padding and visible edge affordance; restore centered tabs where all four fit;
- apply the same `max-height:44rem` modifier to compress codex header/divider/tab margins in landscape. Set a measurable invariant: the first article heading or at least two body lines must be visible when the tab is selected at 844×390 and 667×375;
- keep `.codex-scroll` as the only reader scroll owner and retain the frame inset.

Do not move tabs to bottom navigation or make the body the scroll owner. Those are redesigns with worse nesting semantics.

**Impact / effort / risk:** high / medium / medium.

### P1 — Advanced Search can open below the visible viewport

**Affected code:** `index.css:228-276`; `AdvancedSearchPanel.tsx:48-176`; `SearchBar.tsx:57-155`; form atoms in `components/form/`.

**Observed problem:** at 390×844 the panel starts y≈443 and its 606px client area scrolls 708px of content. At 280/320×568 it starts around y≈505, exposes ≈407px and scrolls ≈759px. At 844×390 it starts around y≈476—completely below the viewport—so toggling refinement appears to do nothing until the page is manually scrolled. The secondary scroll region is acceptable; invisibility is not.

**Root cause:** the panel is absolutely anchored below a search control that itself follows the oversized hero. `max-height:min(72vh,40rem)` constrains panel height but does not ensure its top is visible. Dense one-column fields, seven undersized inputs and 1rem row gaps lengthen the leaf.

**Recommended solution:** compress the outer flow first. When opening the panel, ensure the search shell is visible (native `scrollIntoView` only for this user-triggered reveal, honoring reduced motion), then size the panel from available visual space using `dvh` plus safe-area offsets. Keep it an anchored leaf, not a new modal, unless full focus/inert semantics are implemented. Provide a visible internal-scroll cue; consider a sticky action row within the existing scroll owner. Reduce gap/padding to ≈0.7/0.8–1rem only after field heights reach the touch target. Native `<details>` grouping is a later option if the leaf remains too long.

**Acceptance:** opening at 280×568, 390×844 and 844×390 reveals the panel title and first control; its final actions are keyboard/touch reachable; only the panel scrolls when the pointer is over it; no page-width expansion.

**Impact / effort / risk:** high / medium / medium.

### P1 — Card rows are large, but hero spacing is the primary cause

**Affected code:** `CharacterGrid.tsx:47-50`; `CharacterCard.tsx:112-210`; skeleton in `App.tsx:368-374`.

**Observed problem:** compact cards are ≈112×233px at 280 and ≈167×306px at 390; medium/wide cards reach ≈224×362 and ≈262×413px. The two-column base is correct. The grid’s 1rem gap and `sm` 1.5rem gap add cost, but changing the portrait crop cannot recover the ≈597–692px pre-grid stack.

**Root cause:** this is a secondary density issue, not the root page defect. Card image `aspect-[3/4]`, metadata padding and grid gap determine row height after the oversized hero. Some long names create unequal card heights, but CSS Grid handles the row safely.

**Recommended solution:** after hero compression is measured, reduce compact grid gaps to ≈0.65–0.85rem and metadata padding/line-height modestly. Keep two columns and `minmax(0,1fr)`. Preserve 3/4 portraits for the first implementation. Only A/B a compact 4/5 crop against real portraits if the new hero still fails the information-density target; cropping faces is a higher regression risk than spacing changes. Keep skeleton ratio/columns synchronized with final card geometry.

**Impact / effort / risk:** medium–high / low / low–medium. Do not rank crop changes ahead of hero, focus or target fixes.

### P2 — Hover motion is capability-blind

**Affected code:** `CharacterCard.tsx:87-105`; `.fx-curl` in `index.css:1124-1191`.

**Observed problem:** cards always declare `whileHover={{ y:-8, scale:1.045 }}`; curl-framed images always scale to 1.06 on hover. On narrow fine-pointer windows these enlarged surfaces can encroach on adjacent content. Touch devices do not need hover affordance, and the curl rule is deliberately exempted from the blanket reduced-motion behavior.

**Root cause:** interaction effects are not gated by input capability; the reduced-motion comments and actual exceptions are more nuanced than “all animation is killed.”

**Recommended solution:** gate hover lift/zoom with `(hover:hover) and (pointer:fine)`. Retain restrained tap/focus feedback without shrinking already small touch targets. Preserve the existing user-controlled ornament override, and verify both OS reduced-motion states rather than assuming the blanket rule wins.

**Impact / effort / risk:** medium / low / low.

### P2 — Article typography and block spacing are fixed at wide values

**Affected code:** `index.css:861-1113`, `:1231-1466`; `BioArticle.tsx:187-210`, `:305-440`; representative `pages/*/*.bio.md`.

**Observed problem:** `.bio-article` is fixed at 1.13rem / 1.75 line-height. Section headings use 1.6em top margin; blockquotes, verse, frames, nav, image groups, columns and signatures each add their own vertical rhythm. This is excellent at wide measure but makes a 208–351px reader extremely long. The conformance content exercises tables, code, verse, floats, image groups, 2–4 tracks, frames, nav and signatures; no tested content widened the page.

**Root cause:** article typography and most block margins have one wide setting. Compact mode stacks blocks correctly but does not compress their accumulated vertical whitespace.

**Recommended solution:** use a compact fluid base such as `font-size:clamp(1rem, .96rem + .45vw, 1.13rem)` and line-height progressing from ≈1.55 to 1.75. Reduce compact heading/block margins by ≈15–25%, not prose readability. Apply `overflow-wrap:anywhere` only to URLs, filenames and constrained table cells; do not fragment ordinary prose. Preserve local table/pre scrolling, figure stacking, `minmax(0,1fr)` columns, drop caps and the wide maximum.

**Impact / effort / risk:** medium / low / medium. Validate every BioMD block type before treating this as a token-only change.

### P2 — Fixed overlays lack safe-area and visible-height policy

**Affected code:** `CodexShell.tsx:127-149`; `ImageViewer.tsx:150-251`; `AsciiTabViewer.tsx:98-153`; `.search-panel`; `app/index.html:5`.

**Observed problem:** `viewport-fit=cover` is present, but no fixed surface consumes `env(safe-area-inset-*)`. Codex/ASCII panels use `94vh`/`96vh`; the search leaf uses `72vh`. Rectangular emulation fits, but notched landscape and browser chrome can cover controls or waste already scarce height.

**Root cause:** metadata enables safe-area values but components do not use them; legacy `vh` describes the layout viewport, not necessarily the currently visible area.

**Recommended solution:** keep a `vh` fallback, then use `svh` for stable maximum panel height and `dvh` only where the panel should track browser chrome/keyboard changes. Apply each safe-area side independently with `max(base-padding, env(...))`; landscape needs left/right insets as much as top/bottom. Coordinate with the low-height compression rule; do not add another scroll owner.

**Impact / effort / risk:** medium / low / low.

### P2 — Footer is intentionally dense in columns but still long on phones

**Affected code:** `SiteFooter.tsx:65-183`; `index.css:611-762`.

**Observed problem:** the footer is nine menu items. On compact widths it uses two columns and a minimum item height of 4.25rem, with a special 3.9rem rule at max 420px. This is not a fold problem when the catalogue is long, but on filtered/empty states it can dominate the remaining page and contribute to the app feeling spatially heavy.

**Root cause:** every footer item remains a large ornamental tile, even placeholder items that do not navigate. The footer is content, but its visual weight is close to a second navigation surface.

**Recommendation:** retain the footer shell and colophon, but compact only the tile padding/min-height on narrow screens (for example 3.25–3.5rem) and reduce ornament scale. Keep two columns at 280–430px; do not force nine columns until the content actually fits. Do not hide placeholder items without a product decision, because they provide translated feedback and project navigation intent.

**Impact / effort / risk:** low–medium / low / low.

## Responsive strategy

Use three mobile-first width regimes plus one shared height modifier. Keep Tailwind and the existing unlayered component CSS ownership; do not introduce a second styling system.

| Regime | Layout policy | Primary behavior |
|---|---|---|
| Compact base `<40rem` | compressed spacing/type tokens; two card columns; 44px primary hit areas | compact brand/header; fluid title; anchored/revealed search leaf; one-line scrollable codex tabs; stacked article media; safe-area overlays |
| Medium `≥40rem` | restore moderate spacing; three card columns where current content supports it | title may step up; search form may use two columns; tabs stay one line; article floats/image tracks re-enable through existing rules |
| Wide `≥64rem` | preserve current visual baseline; four card columns | restore current hero/card/codex rhythm and larger ornament; cap content with existing max widths |
| Short-height `≤44rem` | combines with any width | reduce title/header/divider/herald/codex-tab vertical rhythm; panel heights use visible viewport units; ensure catalogue/article content enters the first view |

### CSS hierarchy

1. **Intrinsic first:** wrapping labels, `min-width:0`, `minmax(0,1fr)`, contained images/tables, flex/grid wrap where wrapping is desirable.
2. **Fluid second:** a small named set of `clamp()` type/space values. Avoid unrelated one-off clamps.
3. **Width media queries third:** only for structural changes—header mode, column count, tab mode, form columns.
4. **Height query:** one shared compact-height policy, not per-device patches.
5. **Container queries:** not in the first pass. Current components respond to page geometry, not variable embedding containers.

### Orientation, zoom and localization invariants

- Test portrait and landscape explicitly; never infer landscape from width.
- At 200% zoom, every primary action remains reachable, no root horizontal scroll appears, and dialog focus stays in the visible top layer.
- Long Russian/German/English labels wrap or scroll within owned containers. Unbreakable title words, URLs and filenames are separate cases.
- Avoid `100vh` for full-screen surfaces. Use fallback `vh`, then `svh`/`dvh` according to whether stability or live chrome tracking is required.
- Apply safe-area insets on all four sides.

## Prioritized implementation roadmap

### Phase 0 — Correctness and access

1. Implement topmost-modal focus entry, inertness, containment, Escape behavior and focus restoration across Codex, Image Viewer and ASCII Viewer.
2. Implement roving keyboard behavior for `CodexTabs`; prevent tab-arrow events from turning catalogue entries.
3. Fix the sub-315px fixed header while preserving every unique control.
4. Establish 44px primary targets and 16px compact input text; redesign dense viewer toolbars to wrap/group rather than overflow.

**Phase gate:** 280–430px and 200% zoom pass reachability; covered-page controls cannot receive focus; nested dialogs unwind and restore focus correctly.

### Phase 1 — Recover first-viewport utility

1. Add compact/wide fluid spacing/type tokens and compress the catalogue hero/search stack.
2. Add the shared short-height policy.
3. Compact the codex header and replace wrapped compact tabs with one scrollable row.
4. Ensure Advanced Search opens in view and sizes itself from available visible height.

**Phase gate:** first-card and first-article acceptance targets pass at 360×640, 390×844, 667×375, 844×390 and 1366×768; wide screenshot identity remains within tolerance.

### Phase 2 — Secondary density and resilience

1. Tune compact grid/card gaps and metadata; keep portrait ratio unless measured evidence still demands a crop experiment.
2. Introduce compact article type/block spacing and test every BioMD construct.
3. Apply safe-area/viewport-unit policy to fixed surfaces and adapt image/ASCII toolbars.
4. Gate hover motion by input capability; compact footer only after filtered/empty-state review.

### Phase 3 — Performance hardening, not RWD prerequisite

1. Add intrinsic image dimensions where content metadata can supply them without guessing.
2. Add responsive image candidates only after a real local image pipeline exists; external placeholders cannot be responsibly converted by CSS alone.
3. Reassess container queries only if cards/readers gain embedded/sidebar contexts.

## Measurable acceptance matrix

| Area | Required check |
|---|---|
| Catalogue flow | Continuous drag/scan 280–1920px; no clipped fixed controls or root overflow; card top ≤480px at 360×640/390×844 and ≤500px at 1366×768. |
| Header | 280, 300, 320, 360, 390, 430px; all controls visible, 44px targets, full accessible names, no content hidden under a wrapped fixed bar. |
| Codex | 280×568, 320×568, 390×844, 667×375, 844×390, 1024×768; one reader scroll owner; first heading/two lines visible in landscape; selected tab visible. |
| Dialog keyboard | Open from a card; Tab/Shift+Tab cycle top layer; open nested viewer; Escape closes one layer; focus restores twice; background inert throughout. |
| Tab semantics | Only selected tab has `tabIndex=0`; Arrow/Home/End stay in tablist and never turn entries; selection and panel association are announced. |
| Advanced Search | Opening at 280×568, 390×844 and 844×390 reveals title/first field; final action reachable; fields ≥16px type/target policy; panel scroll does not widen page. |
| BioMD | Conformance page: headings, table, code, verse, nav, floats, image tracks, columns, frames, signature, document trigger at compact/medium/wide. |
| Media viewers | Gallery, nested image viewer and a real document-triggered ASCII tab at 320×568, 390×844, 844×390; toolbar wraps/groups without occluding content. |
| Zoom/accessibility | 200% zoom at desktop and narrow-window equivalent; focus visible; no two-dimensional page scroll; reduced-motion on/off and coarse/fine pointer behavior. |
| Routes/locales | Reopen all 16 cards; smoke Russian, English and German names/filter labels; test the longest titles and an article-only route. |

## Things not to change

- Do not change the content/renderer split, hash routes, lazy viewer boundaries, catalogue data model or Markdown syntax.
- Do not replace the two-column compact catalogue with a one-card list by default.
- Do not remove the herald, ornament, drop caps, paper/gold/burgundy palette, codex frame or desktop title scale.
- Do not hide Effects, ambience or sound merely to make the header fit; each is a unique control.
- Do not move codex tabs to a bottom bar or introduce browser-width JavaScript when CSS can express the behavior.
- Do not add a custom select, carousel, global `overflow:hidden`, nested reader scroll area or breakpoint for each device.
- Do not globally reduce all font sizes. Compress low-value space while preserving readable prose and larger hit boxes.
- Do not change the card crop before hero compression proves it is still necessary.

## Expected result

After Phase 0–1, the app should retain its calm, symmetrical manuscript identity on desktop while exposing catalogue and article content materially sooner on compact and short screens. The highest-value gain is not “more responsive CSS”; it is a consistent spatial policy, correct modal keyboard behavior, reachable controls, and explicit width/height acceptance criteria applied to every existing surface.

This remains an audit and implementation plan. No application source, content or configuration file was changed.
