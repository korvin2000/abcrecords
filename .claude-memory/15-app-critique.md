# 15 · `app/` — Critique & Improvement Backlog (2026-07-21)

> Honest strengths/weaknesses + a prioritized backlog, distilled from a deep
> read of every subsystem. Findings cite `file:line` **anchors** (they drift);
> treat each as "verify, then act." Severity: 🔴 high · 🟠 medium · 🟡 low.
> Many "weaknesses" only bite **at scale** (7 live entries today vs ~1249 in the
> legacy index) — tagged *(scale)*.

> ⚠ **Catalogue v2 (2026-07-31)** addresses several items below. The *spec* has
> landed ([`docs/Catalog-Index.md`](../docs/Catalog-Index.md)); the code lands
> in Steps 4–6 of
> [`the plan`](../docs/proposals/Plan_Catalog-v2-index-ids-localized-names-codex-split.md).
> Items it resolves are marked **[v2]** below — do not re-file them.

## Overall

A genuinely well-crafted front end: coherent philosophy (pure renderer over
external content), strong performance engineering, a distinctive and consistent
visual identity, and — unusually — code that documents its own *rationale* in
comments. The gaps are almost entirely **process/robustness** (no tests, no
lint, a few latent audio/parse bugs, cross-cutting duplication) rather than
architecture. It reads like a polished solo/small-team project that hasn't yet
had a hardening pass.

## Strengths (keep these)

- **Content ⇄ renderer separation.** Nothing is bundled; `../pages/` is the store; language only selects an *edition*. Editing content needs no rebuild.
- **Performance discipline.** Lazy+preload chunks, idle & save-data-aware serial prefetch, vendor `manualChunks`, subset self-hosted fonts, static SVG/gradient background (no canvas). ~121 KB initial gzip.
- **Deterministic per-entry identity** (theme/accent/placeholder from one hash) — cheap, memorable, zero requests.
- **Fault tolerance.** BioMD parser never crashes (unknown/unclosed/stray → preserved+warned); fetch helpers fail soft; missing metadata → omitted row; broken img → placeholder.
- **Security-sane Markdown.** No `rehype-raw` ⇒ raw HTML inert; markdown URLs pass react-markdown `urlTransform`.
- **Bilingual search from a tiny primitive** (fold + query-side translit + slug haystack), and **compiler-policed i18n completeness** (ru = key source; 9 dicts typed).
- **Timezone-safe dates** — the most error-prone area (`DD.MM.YYYY` → UTC → Intl) is done correctly.
- **Sample-accurate audio** (look-ahead schedulers) with soft-fail everywhere.
- **Strict TS** (`noUnusedLocals/Parameters`, `verbatimModuleSyntax`).

## Weaknesses & risk register

### Process / tooling
- 🔴 **No automated tests at all** (no runner/deps in `package.json`). The highest-logic, highest-risk code — `biomd/parse.ts`, search `fold`/`translitVariants`, `metadata` date/list parsing, `paths` resolution, i18n plurals — has zero coverage. This is the single biggest blocker to safe change.
- 🟠 **No ESLint/Prettier, no CI.** Style/quality is unenforced; only `tsc` gates.
- ✅ **[fixed 2026-08-04]** ~~No React error boundary — an uncaught render error (a parser edge, a bad prop) blanks the whole app.~~ `components/ErrorBoundary.tsx` is mounted twice: at the root (under `I18nProvider`, over both viewer providers) and around the codex `Suspense`. It was a **production** gap, not a dev nicety — the headline trigger is a deploy invalidating hashed chunk names under an open tab. See [14](14-app-patterns-and-gotchas.md) for the `resetKey`-not-`key` rule.

### Audio
- 🟠 **Mute doesn't silence content.** `setEnabled` ramps only the engine `master` (`audio.ts`); mp3/MIDI/tab playback live on separate contexts/elements and keep sounding. Either intended or a headline bug — decide and document.
- 🟠 **Three `AudioContext`s + `HTMLAudioElement`, never `close()`d** (`audio.ts`, `midi.ts:~60`, `asciiTabPlayback.ts:~45`). Lifetime leak; iOS/Safari concurrency risk.
- ✅ **[fixed 2026-08-13]** ~~**Orphan `MidiPlayer` on dispose-mid-load** (`playback.ts` `MidiBackend.start`): `loadMidi().then(...)` has no disposed-guard, so a source change before the fetch resolves still constructs a player + starts a scheduler that's never cleared → ghost audio + leaked timer/oscillators.~~ `MidiBackend` carries a `disposed` flag checked inside the `.then`. `NativeBackend` now keeps its unbind thunks and `dispose()` removes all three listeners plus `load()`s the element so it stops buffering a src it no longer has.
- ✅ **[fixed 2026-08-13]** The playback ticker published `currentTime` to React **every frame** — 60 re-renders/s of `AudioPlayer` for a readout that counts in tenths. The frame clock still drives the MIDI end-check (its 50 ms tolerance needs it); state is written only when the tenth changes.
- 🟡 **Theme button desync** (`GalleryTab.tsx` `ThemeRow`): local `playing` isn't reset when the theme is stopped externally (`claimPlayback`/`setEnabled(false)`) → button shows "playing" while silent.
- 🟡 Background-tab `setInterval` catch-up → clustered "chord blast" on refocus; `NativeBackend.dispose` never `removeEventListener`s; autoplay-blocked `play()` is swallowed while UI optimistically shows "playing"; `themeIsPlaying` ignores `wave`/`bass`.

### Search / i18n
- ✅ **[fixed, Step 4]** ~~Latin→Cyrillic has no table — the Latin slug is a single point of failure.~~ `index.json.title` is now an explicit Latin fallback haystack beside the slug.
- ✅ **[fixed, Step 4]** ~~CJK search is impossible, not merely degraded.~~ `index-<lang>.json` aliases are folded into the haystacks — verified: `塞戈维亚` (zh UI) and `セゴビア` (ja UI) both find Segovia.
- ✅ **[fixed, Step 5]** ~~Unranked + unthrottled + redundant.~~ Prefolded weighted corpus, variants hoisted to once per token (and only for Cyrillic tokens), exact→prefix→word-start→contains→translit scoring, `useDeferredValue`. **0.398 ms/query at 1249 docs.**
- 🟡 **Transliteration is single-character**, so digraph spellings are unreachable: `хендрикс` never becomes `hendrix` (`кс`→`x`). An alias in `index-<lang>.json` is the intended remedy; adding digraph support to `CYR_TO_LAT` would be a structural change for a handful of names.
- 🟡 **`fold` collapses `ё→е`** before translit runs, so the `ё: ["e","yo"]` table entry is dead and "Фёдор" can never yield "fyodor". Deliberate for now — the collapse is what lets a reader type `федор` for a name spelled `Фёдор`, and no current entry has `ё`. (The `.replace(/ё/g,…)` is **not** redundant since the Step-5 fold change: NFD no longer strips the diaeresis.)
- 🟡 Facet filter is exact-string on free-text country (case drift → duplicate chips); slug haystack isn't `fold`ed; `search.countFiltered` is a plain string (not a `Plural`) in every dict → won't decline correctly in Russian; translation *quality* is unpoliced (only presence is).

### Content / data / BioMD
- 🟠 **Block-derived `src` bypasses sanitization.** `::: image`/`::: document` `src` flows through `resolveResourcePath` (passes `javascript:` through) into `<img src>`/`<a href>` without react-markdown's `urlTransform`. Content is trusted today, but it's a real injection vector.
- 🟠 **Segmenter is unaware of Markdown code fences** — a ```` ``` ```` block containing a `:::` line is misparsed; fences must also start at column 0 (indented `:::` becomes prose).
- 🟠 **Sticky negative caching** (`catalog.ts` `fetchJson`/`fetchText`): a transient failure caches a resolved-`null` promise permanently — no retry/invalidation until full reload (asymmetric with `loadIndex`, which stays refetchable).
- ✅ **[fixed, Step 4]** ~~Country mapping is a 10-entry band-aid.~~ `COUNTRY_TEXT_TO_ISO` and its three wrappers are deleted; `index.json` carries ISO alpha-2 and `countryName(iso, locale)` localizes every country the platform knows.
- ✅ **[fixed, Steps 2+6]** ~~Per-entry dossiers are language-blind in practice.~~ The fixtures are per-edition, §3.3 makes that normative, and `LoreTab.localizeJob` is deleted.
- 🟠 **A11y: figures are mouse-only.** Inline `img` (`<span onClick>`) and block `Figure` (`<figure onClick>`) in `BioArticle.tsx` have no role/tabindex/keyboard handler (DocumentCard does it right with `<button>`/`<a>`).
- 🟡 Silent `columns.slice(0,3)` truncation (no warning — contradicts the "never delete" invariant); parser warnings are DEV-only (no prod author feedback); `splitList` can't escape commas ("Crosby, Stills & Nash" → 3); `ageOf` mixes UTC parse with local "now" (day-boundary off-by-one); `parseDmy` accepts Feb 30; `slugOf` collides on duplicate md filenames; no `AbortSignal` on `loadEntry`.
- 🟡 *(scale)* Prefetch is linear → ~1249 serial idle JSON fetches for the full legacy index.

### ASCII tablature
- 🟠 **`fatal:true` UTF-8 decode rejects legacy encodings** (`asciiTab.ts`). The domain is a Russian guitar site — CP1251/KOI8-R (or Latin-1 box-drawing) tabs will throw and drop to the download-only error screen. No charset fallback.
- 🟠 **Rigid 6-consecutive-line detection** (`detectSystems`): interleaved blank/beat lines or 7-line systems are missed; a stray leading line desyncs all following systems (`start += 6`).
- 🟠 **A11y: no focus trap / initial-focus move** in the tab viewer modal; the global capture-phase keydown swallows Escape/`+`/`-`/`0` app-wide while open.
- 🟡 Cross-string column misalignment when string rows mix prefix widths (`E-||` vs `B||`); the `r(n)` token drops its closing `)` → a stray red "unknown-symbol" glyph + spurious diagnostic; no `React.memo`/virtualization → jank on large tabs during the ~12 Hz playback re-render; capo is parsed but never applied to pitch; techniques re-articulated; only standard & drop-D tunings map; unbounded `documentCache`; several hardcoded English strings bypass i18n.

### Rendering / lifetime (audited 2026-08-13)
- ✅ **[fixed]** ~~Closing the codex took ~670 ms (a 450 ms panel turn *then* a 250 ms backdrop fade) against a ~500 ms open, and under `prefers-reduced-motion` the whole 670 ms was a timer waiting for animations the CSS had already clamped to nothing.~~ One 320 ms clock, both movements together, 0 ms when motion is reduced (measured 17 ms).
- ✅ **[fixed]** ~~`key={slug}` on `LazyCodexModal` rebuilt the entire codex on every ← →: two shells alive through the crossfade, so two stacked translucent backdrops let the page flash back through (~0.47 vs 0.55 combined dim), two full-viewport `backdrop-filter`s, the 0.85 s opening turn replayed, and the article refetched.~~ One persistent shell; the *view* is keyed instead. Verified: exactly one `[role="dialog"]` across three consecutive turns, and **zero content requests** during a turn thanks to the idle neighbour prefetch.
- ✅ **[fixed]** ~~`CharacterCard` was unmemoized~~ — five motion values, two springs and a motion template each, rebuilt for every result on every App render (a keystroke, a header toggle, a dossier batch landing). Now `memo`'d; `record` is identity-stable per slug and `onSelect` is a stable callback, so the comparison holds. **Beware Fast Refresh**: swapping a plain function export for a `memo()` object cannot be hot-reconciled — the dev overlay throws `Component is not a function` until a full reload. Production is clean.
- ✅ **[fixed]** ~~`.fx-curl { will-change: transform }`~~ held a permanent compositor layer for **every** article and gallery print, purely for a 6% hover zoom. Promoted on `:hover`/`:focus-within` instead.
- ✅ **[fixed]** ~~The body scroll-lock effect depended on the *record*~~, so a turn unlocked and re-locked the body — handing the page its scrollbar back and reflowing the grid under the modal. Keyed on a boolean now.
- ✅ **[fixed]** `MusicalDrift`'s paused layer only stopped its clock; it now also goes `visibility: hidden`, so the compositor releases up to `driftCount` glyph textures for exactly as long as a codex is covering them.
- 🔴 *(scale)* **The grid renders every result — no cap, no windowing.** 16 entries today; at the ~1249-row legacy index an unfiltered browse mounts 1249 tilt cards **and** `AnimatePresence mode="popLayout"` with `layout` on every cell, which measures all of them per frame during a reflow. `memo` cuts the re-render cost, not the mount cost. This is now the app's largest remaining bottleneck and the one thing that will decide whether it holds its "smooth on slow devices" promise at full scale. The fix is a first-page cap with incremental reveal (IntersectionObserver), not virtualization — the ornate frames make fixed row heights a lie.
- 🟡 `App.tsx` rebuilds `turnPage` on every keystroke (it closes over `turnOrder`). Harmless now that `CodexShell` binds its `keydown` through a ref, but it still invalidates the prop on a memo boundary.

### Cross-cutting duplication / drift 🟠
- **Two flag components** — `Flag.tsx` (by UI language, 10) and `CountryFlag.tsx` (by ISO country, ~25) — with overlapping hand-drawn SVGs. `CountryFlag` was added 2026-07-21 for the Lore tab; the DE/ES/FR/IT/PT/RU/JP/CN/KR/GB art is now duplicated between the two.
- **Four hand-maintained country/flag tables can drift**: index.json free-text `country`, `COUNTRY_TEXT_TO_ISO`, the `CountryFlag` ISO set, the `Flag` language set. A country can localize but lack a flag, or vice-versa.
- **Four copies of the look-ahead scheduler** and **two near-verbatim viewer providers** (image / ascii-tab) — extractable into one utility / one factory each.

### Structure / styling 🟡
- `index.css` is ~700 unlayered lines mixing tokens/base/components/utilities; moving the semantic rules into `@layer components` would both organize it and **end the "unlayered beats utilities" footgun**.
- `App.tsx` is a single large orchestrator (search + route + audio + scroll-lock + modal). Fine now; watch it as features grow.

## Prioritized improvement backlog

1. 🔴 **Add Vitest + unit tests** for the pure logic first: `parse.ts` (fences/unknown/columns/title), search `fold`/`translitVariants`, `metadata` DMY/`ageOf`/`splitList`/country, `paths` resolution, i18n plural/interpolation. This unlocks safe refactoring of everything below.
2. 🟠 **Add ESLint + Prettier + a CI check** (`tsc -b` + lint + test on push).
3. 🟠 **Resolve the mute-vs-content bug**: route content playback through a gain the 🔊 toggle controls (or stop all content on mute) — or explicitly document it as intended and reflect that in the tooltip.
4. ✅ **Audio lifetime — done (2026-08-13).** Disposed-guard around `loadMidi().then`, `removeEventListener` + `load()` in `NativeBackend.dispose`, ticker throttled off the frame clock. Still open by choice: the three `AudioContext`s are never `close()`d, and the 25 ms ambient/theme intervals cluster on refocus after background throttling.
5. ✅ **ErrorBoundary — done (2026-08-04).** Root + codex boundaries with parchment-styled, localized fallbacks (`app.crash*`); DEV-only logging. Still open by choice: the image and ascii-tab viewers rely on the *root* boundary (a throw there replaces the page rather than just the overlay) — give each its own boundary when the tab viewer is hardened (item 7).
6. 🟠 **Consolidate the flag/country stack**: one ISO-keyed SVG source of truth; derive `Flag(lang)` from it; unify `COUNTRY_TEXT_TO_ISO` + `CountryFlag` coverage. **[v2 does half of this]** — `index.json` `country` becomes ISO and the text→ISO dict is deleted, leaving only the two hand-drawn SVG sets to merge.
7. 🟠 **ASCII-tab hardening**: charset fallback (CP1251/KOI8-R) for legacy tabs; fix the `r(n)` glyph; `React.memo`/virtualize `TabSystemSvg`; add a focus trap.
8. 🟠 **Content robustness**: sanitize block-derived `src`; retry/invalidate negative fetch cache; surface parser warnings in prod (dev overlay or a `pages/` content-lint script); reconsider comma-lists vs arrays in the data model.
9. ✅ **Search scaling — done (Step 5).** Prebuilt weighted corpus, hoisted variants, ranking, `useDeferredValue`; **0.398 ms/query at 1249 docs**. Still open by choice: the `ё` collapse and single-character transliteration (no `кс`→`x`).
10. 🟡 **Structure/a11y polish**: split `index.css` and move rules into `@layer`; extract one shared look-ahead scheduler + one viewer-provider factory; unify the reduced-motion policy (framer vs CSS); make BioMD figures keyboard-operable. **[`CodexModal` is done — 271 → 45 lines across 10 focused files (Step 6). `App.tsx` remains the large one.]**
11. 🟠 **[v2, Step 7]** **Content validation**: `scripts/lint-content.mjs` — the guard-rail for the two-file index split (dangling ids, duplicate slugs, drifted `born`/`died`, untranslated editions). The repo has no content validation at all today.
