# RWD/AWD Optimization Task

## 1. Objective

Improve the existing website's responsive and adaptive behavior across desktop, smartphone, tablet and laptop displays **without redesigning it**.

The site is already approximately 85-90% implemented using Responsive Web Design principles and currently works best on medium/high-resolution landscape displays. Your task is to make its layout substantially more ergonomic, information-dense, visually balanced, and performant across both **portrait and landscape orientations**, while preserving the existing visual identity.

Use a modern hybrid strategy:

**fluid / intrinsic RWD as the default layer + a small number of content-driven discrete adaptive switches + container queries for component-level responsiveness.**

Do not treat AWD and RWD as competing architectures. Combine their strongest techniques pragmatically.

The final result should preserve the current design while making the **amount of useful content visible per screen** appropriate for the available space.

---

## 2. Role

Act primarily as a **senior frontend engineer and autonomous coding agent specializing in responsive layout systems**.

Apply the combined judgment of:

- frontend architecture and CSS layout engineering;
- responsive/adaptive web design;
- UX ergonomics and information density;
- browser rendering and frontend performance;
- visual regression analysis;
- production-oriented code review.

Treat this as an engineering optimization task, not a creative redesign.

Use deep reasoning internally where useful, but report **evidence, conclusions, trade-offs, and validation results rather than hidden reasoning traces**.

---

## 3. Context

### Application

The website is an index of musician/composer biographies.

Main UI:

- header/info block/search block;
- grid/gallery of biography cards;
- each card contains a portrait/thumbnail and a name, other info;
- footer/navigation;
- selecting a biography opens a modal/dialog markdown rendering engine;
- the dialog renders a potentially long biography through a Markdown rendering engine, including text, images, links, tables, lists, etc.

The current design language is already established and should remain recognizable.

### Current problem

The layout technically responds to viewport changes, but its scaling and density are poorly balanced.

Observed behavior:

- the site looks best around medium/high-resolution landscape displays;
- on lower-resolution desktops/laptops, images, typography, gaps, menus, and surrounding UI consume too much space;
- on portrait smartphones the problem becomes much stronger: cards, images, fonts, navigation and spacing appear disproportionately large and too little information fits on screen;
- the mobile grid often shows only two biography cards per row even where a denser arrangement may be practical;
- on large 4K displays the inverse can happen: elements may become relatively small and excessive content is rendered simultaneously;
- very large viewports can also increase image decoding, painting, compositing, and browser/GPU workload.

Do **not** assume that screen hardware resolution directly represents available layout space.

A high-resolution smartphone may still expose only roughly 360–480 CSS pixels of viewport width because physical pixels, CSS pixels, DPR, browser zoom, and viewport scaling are different concepts.

Therefore first determine whether the mobile density problem actually originates from:

- viewport configuration;
- CSS-pixel width;
- device pixel ratio;
- breakpoint logic;
- card minimum width;
- fixed/rem-based typography;
- oversized spacing tokens;
- grid configuration;
- image sizing;
- container width;
- orientation/aspect-ratio handling;
- browser defaults;
- or a combination of these.

Do not blindly accept the hypothesis that portrait orientation itself is the root cause.

### Target ranges

Treat desktop/laptop and mobile CSS viewports separately.

Desktop/laptop:

- practical lower desktop target: approximately `1280×720`;
- primary range: `1920×1080` to `2560×1440`;
- explicitly verify `3840×2160` / 4K;
- ensure sane behavior on very large/8K-class displays without unbounded scaling.

Mobile portrait must still support realistic mobile **CSS viewports**, typically far narrower than 1280 physical pixels. Representative widths such as approximately 360, 390, 412, and 430 CSS px are relevant.

Also verify representative tablet and landscape-mobile layouts.

Do not optimize for arbitrary obsolete tiny desktop resolutions below the stated range unless required to preserve mobile behavior.

### Reference documents

Read before modifying code:

1. `\AWD-RWD-Guide.md`
   - architectural/design guidance for the modern hybrid AWD/RWD approach.

2. `\RESPONSIVE-RWD-AUDIT.md`
   - primary existing audit and planning baseline.

3. Fallback/reference audits:
   - `\RESPONSIVE-RWD-AUDIT-1.md`
   - `\RESPONSIVE-RWD-AUDIT-2.md`
   - `\RESPONSIVE-RWD-AUDIT-3.md`
   - `\RESPONSIVE-RWD-AUDIT-4.md`

4. Use available skills if needed: 'responsive-craft', 'responsive-design' or any other if it helps to achieve better results.

The consolidated audit may contain inaccurate, contradictory, speculative, or outdated recommendations.

Use this evidence precedence when conflicts occur:

**actual rendered behavior and code > explicit task requirements > AWD/RWD guide principles > consolidated audit > fallback audits.**

Use the four fallback audits primarily to resolve uncertainty or recover useful observations omitted from the consolidated audit.

Never implement a recommendation merely because it exists in an audit document.

---

## 4. Instructions

### Phase A — Inspect and establish the baseline

Before editing code:

1. Read repository-level agent/development instructions such as `CLAUDE.md`, README files, package scripts, and relevant project conventions.

2. Read the reference documents above.

3. Inspect the implementation of:
   - application shell;
   - header/footer/navigation;
   - biography grid;
   - biography card;
   - portrait/image rendering;
   - modal/dialog;
   - Markdown renderer and its typography/tables/images;
   - global CSS/reset/theme;
   - design tokens and spacing variables;
   - existing media/container queries.

4. Inspect the actual rendered application with browser/devtools/screenshot tooling when available.

5. Capture a representative visual baseline before modifying layout.

6. Check specifically:
   - `<meta name="viewport">`;
   - computed CSS viewport dimensions;
   - root font size;
   - grid/flex definitions;
   - fixed widths/heights and `min-width`;
   - excessive `px`, `rem`, `vw`, or `vh` scaling;
   - breakpoint clustering and contradictory media queries;
   - card/image aspect ratios;
   - modal dimensions and mobile viewport units;
   - horizontal overflow;
   - image intrinsic dimensions versus rendered dimensions;
   - unnecessary rendering of off-screen content.

Do not infer visual correctness from source code alone if rendering tools are available.

### Phase B — Diagnose before proposing fixes

Identify the smallest set of root causes responsible for most of the poor responsive behavior.

Separate findings into:

- global viewport/layout problems;
- biography-grid problems;
- card/image sizing;
- typography;
- spacing/density;
- navigation;
- modal/Markdown content;
- tables and other overflow-prone content;
- large-screen behavior;
- rendering/image performance.

Distinguish symptoms from root causes.

For each meaningful issue record:

- evidence;
- affected viewport/orientation;
- expected user-visible impact;
- likely implementation scope;
- regression risk.

### Phase C — Produce a ranked implementation plan

Before changing code, create a concise ranked plan.

Prioritize changes using:

- visual/UX impact;
- confidence in diagnosis;
- implementation effort;
- regression risk;
- breadth of benefit across viewports.

Use priority levels such as `P0`, `P1`, `P2`, `P3`.

Prefer **high-impact, low-complexity, low-regression-risk changes first**.

The plan should normally favor a few systemic fixes over many breakpoint-specific patches.

### Phase D — Responsive architecture

Prefer intrinsic CSS behavior over viewport-specific overrides.

Use where appropriate:

- CSS Grid/Flexbox intrinsic sizing;
- `minmax()`;
- `auto-fit` / `auto-fill`;
- `min()`, `max()`, `clamp()`;
- bounded fluid typography;
- bounded fluid spacing;
- bounded card/image sizing;
- `aspect-ratio`;
- `max-inline-size`;
- logical properties;
- container queries;
- container query units where they simplify component-local scaling;
- a small number of meaningful media-query switches;
- `aspect-ratio` or orientation conditions when width alone is insufficient;
- `svh` / `dvh` / `lvh` where mobile browser chrome affects dialogs or viewport-height layouts.

Use **container queries for component behavior** when the component's available width matters more than global viewport width.

Use **media queries for page-level structural transitions or environment/input characteristics**.

Choose breakpoints from actual layout failure points, not named device categories.

Do not use screen hardware resolution or DPR as the primary layout breakpoint mechanism.

Do not globally scale the entire UI using raw viewport width.

Fluid values must normally have sensible minimum and maximum bounds.

### Phase E — Information density

The optimization goal is not simply “make mobile smaller.”

Aim for an appropriate relationship between:

- physical usability;
- readable typography;
- touch interaction;
- visual hierarchy;
- portrait image recognizability;
- and useful content visible above the fold.

On smaller screens, reduce unnecessary visual bulk before sacrificing readability.

Investigate whether card width, grid gaps, outer margins, portrait size, heading size, navigation height, and typography can be reduced independently.

Allow the number of cards per row to emerge from available component width where practical rather than hard-coding device-specific counts.

Do not force three cards onto a phone merely because they technically fit. Select the densest layout that remains visually coherent and usable.

For large displays, avoid unbounded growth. Use reasonable content/container maxima so that typography, spacing and images do not scale indefinitely.

### Phase F — Images and rendering performance

For biography portraits and other repeated imagery, verify whether the browser downloads significantly larger images than their rendered size requires.

Where supported by the existing architecture, consider appropriate use of:

- responsive `srcset` / `sizes`;
- correctly declared intrinsic width/height;
- lazy loading for off-screen images;
- asynchronous decoding;
- appropriate fetch priority for initially visible content.

Do not add complexity unless measurements or code inspection indicate a real benefit.

For long Markdown biographies or large lists/grids, consider containment or `content-visibility` only when appropriate and after checking layout/accessibility implications.

Profile before attempting speculative GPU optimizations.

### Phase G — Implement incrementally

After the diagnosis and ranked plan are complete, proceed with implementation.

Prefer:

- small patches;
- existing CSS architecture;
- existing design tokens;
- localized changes;
- reusable rules;
- deletion/consolidation of obsolete responsive overrides where safe.

After each meaningful group of changes:

1. render;
2. inspect;
3. compare with baseline;
4. correct regressions;
5. continue.

Avoid accumulating unverified changes.

### Phase H — Validation

Test at representative viewport classes, including at minimum:

- low-end desktop/laptop around 1280×720;
- 1920×1080;
- 2560×1440;
- 3840×2160;
- representative mobile portrait CSS widths around 360–430 px;
- representative mobile landscape;
- at least one tablet-like portrait viewport.

For each class verify:

- no accidental horizontal page scrolling;
- usable navigation;
- sensible cards-per-row;
- appropriate portrait/image size;
- readable but not oversized typography;
- controlled spacing;
- modal fits the usable viewport;
- long Markdown remains readable;
- tables/images/code blocks do not destroy layout;
- no obvious visual hierarchy regression;
- no significant layout instability.

Run the most relevant available build, typecheck, lint, unit/integration tests, and visual/browser smoke tests.

If a validation step cannot be run, state this explicitly.

---

## 5. Constraints and Limits

### Preserve the design

Do **not** change unless technically necessary:

- color palette;
- fonts styles/typefaces;
- icon style;
- visual theme;
- visual decorative elemenets like shadows;
- border language;
- decorative identity;
- menu visual concept;
- overall page identity.

You may change responsive properties such as:

- font size and line-height;
- image dimensions;
- card dimensions;
- margins/gaps/padding;
- container widths;
- text measure;
- paragraph spacing;
- element positioning;
- grid column count;
- table behavior;
- modal geometry;
- responsive visibility or arrangement where justified.

### Avoid overengineering

Prefer **small, robust, high-leverage CSS/layout changes over broad refactoring**.

Do not introduce:

- a new CSS/UI framework;
- duplicated desktop/mobile component trees;
- JavaScript viewport listeners when CSS can solve the problem;
- device/user-agent sniffing;
- dozens of device-specific breakpoints;
- arbitrary breakpoint values without observed layout justification;
- a new design-token system merely for this task;
- large architectural rewrites unless the existing structure makes the required behavior impossible.

Do not optimize theoretical edge cases at the expense of the primary viewport ranges.

Do not make unrelated cleanup changes.

### Decision rule

When several technically valid solutions exist, prefer the one with:

1. fewer special cases;
2. stronger intrinsic layout behavior;
3. smaller code surface;
4. lower regression risk;
5. easier maintenance;
6. broader benefit across viewport sizes.

---

## Expected Final Report

Keep the final response engineering-focused and concise.

Include:

1. **Root causes** — the most important verified problems.
2. **Ranked plan** — P0/P1/P2/P3 with expected impact and risk.
3. **Implemented changes** — affected files and purpose.
4. **Validation matrix** — tested viewport/orientation classes and results.
5. **Remaining issues** — only meaningful unresolved items or deliberately deferred optimizations.

Do not claim improvements that were not inspected or validated.