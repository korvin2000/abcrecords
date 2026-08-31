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
- 🟡 *(scale)* At 736 entries the dossier crawl reads one `*.bio.json` per listed entry on **every** visit — `DOSSIER.warmOnIdle` is on so the herald can say "on this day", so every reader pays ~736 requests and ~0.7 MB to populate four fields per entry. A build-time digest (`vite/facts-digest.ts` → `/facts-<lang>.json`, one ~50 KB request) shipped on 2026-08-28 and was **reverted on 2026-08-30**: it froze the deployed answer at build time, so an edited birth year in `pages/` did not reach the search until the next rebuild — a second home for a fact `pages/` already owns. The crawl is bounded (concurrency 6), idle-scheduled, cache-shared with the codex, and keeps only the projected facts, so it is a background trickle rather than a stall; if it must get cheaper, the acceptable moves are **narrowing what is read** or **deferring when it starts**, not precomputing it into a file. See the pattern note in [`14`](14-app-patterns-and-gotchas.md).

### ASCII tablature
- ✅ **[fixed 2026-08-18]** ~~**`fatal:true` UTF-8 decode rejects legacy encodings** (`asciiTab.ts`). The domain is a Russian guitar site — CP1251/KOI8-R (or Latin-1 box-drawing) tabs will throw and drop to the download-only error screen. No charset fallback.~~ It was not hypothetical: **9 of the 22 tablatures the Barrios entry links to failed to open**, every one of them for a handful of Latin-1 accents (`Mangoré`, `Agustín`, `Dirk´s`, `1°`, `Ø`). `decodeAsciiTab` now goes BOM → BOM-less UTF-16 → declared charset → strict UTF-8 → **scored legacy code pages** (windows-1252, windows-1251, koi8-r, ibm866, iso-8859-2), scoring by mixed-alphabet words, accented-Latin runs, Cyrillic runs and C1/box-drawing junk. Still never U+FFFD: a candidate reads cleanly under a real codec or is not used. An inferred encoding carries an `assumed-encoding` diagnostic and a `?` beside the badge.
- ✅ **[fixed 2026-08-18]** ~~**Rigid 6-consecutive-line detection** (`detectSystems`): interleaved blank/beat lines or 7-line systems are missed; a stray leading line desyncs all following systems (`start += 6`).~~ The costly half was the *row* test, not the window: `^-{2,}` refused every continuation row that opens on a fret (`-3---1---`), and `LABELED_PREFIX` knew nothing of `E*`, `E ---` or `E 3---`. Whole scores read as "no systems detected" (`abmdp1z` 0 → 22 systems, `ldnbdc` 0 → 9, `abmeu` 1 → 14). A row now qualifies on prefix **or** shape (≥ 50 % staff characters in its body — `MIN_STAFF_RATIO`). The window rule (six adjacent, width spread ≤ 24, ≤ 30 letters, ≥ 1 fret) is unchanged, and the documented counts for all seven `pages/tabs/` fixtures still hold exactly.
- ✅ **[fixed 2026-08-18]** ~~A fret touching an unrecognised letter was discarded, so a `t` tremolo marker silently deleted a whole voice~~ — `El Ultimo Tremolo` lost the tremolo it is named for (474 → 930 notes; `abmusel` 983 → 1541). Technique markers (`t`, `h`, `p`, `poff`, `pulloff`, `s`, `b`) now fold into the fret token, and packed digit runs (`1412109` = 14 12 10 9) split greedily instead of reading as one impossible fret. Measured across 22 fixtures: **zero notes lost** against the old parser, thousands gained.
- 🟠 **A11y: no focus trap / initial-focus move** in the tab viewer modal; the global capture-phase keydown swallows Escape/`+`/`-`/`0` app-wide while open.
- 🟡 Cross-string column misalignment when string rows mix prefix widths (`E-||` vs `B||`); the `r(n)` token drops its closing `)` → a stray red "unknown-symbol" glyph + spurious diagnostic; no `React.memo`/virtualization → jank on large tabs during the ~12 Hz playback re-render; capo is parsed but never applied to pitch; techniques re-articulated; unbounded `documentCache`; several hardcoded English strings bypass i18n.
- 🟡 **Only standard & drop-D tunings map to pitch.** `detectTuning` now reads a declared `Tuning: DADGBE` / `Stimmung : E A D G B E` / "Tune the 6th string to D", and an *open* tuning it cannot voice (`abmsaudz` is DGDGBE) deliberately returns `unknown` rather than the wrong drop-D it used to claim — honest, but the notes are still unvoiced. Adding a `custom` kind means a new `TuningKind`, `tab.tuning.custom` in all eleven dictionaries, and real open strings in `asciiTabPlayback`.

### Rendering / lifetime (audited 2026-08-13)
- ✅ **[fixed]** ~~Closing the codex took ~670 ms (a 450 ms panel turn *then* a 250 ms backdrop fade) against a ~500 ms open, and under `prefers-reduced-motion` the whole 670 ms was a timer waiting for animations the CSS had already clamped to nothing.~~ One 320 ms clock, both movements together, 0 ms when motion is reduced (measured 17 ms).
- ✅ **[fixed]** ~~`key={slug}` on `LazyCodexModal` rebuilt the entire codex on every ← →: two shells alive through the crossfade, so two stacked translucent backdrops let the page flash back through (~0.47 vs 0.55 combined dim), two full-viewport `backdrop-filter`s, the 0.85 s opening turn replayed, and the article refetched.~~ One persistent shell; the *view* is keyed instead. Verified: exactly one `[role="dialog"]` across three consecutive turns, and **zero content requests** during a turn thanks to the idle neighbour prefetch.
- ✅ **[fixed]** ~~`CharacterCard` was unmemoized~~ — five motion values, two springs and a motion template each, rebuilt for every result on every App render (a keystroke, a header toggle, a dossier batch landing). Now `memo`'d; `record` is identity-stable per slug and `onSelect` is a stable callback, so the comparison holds. **Beware Fast Refresh**: swapping a plain function export for a `memo()` object cannot be hot-reconciled — the dev overlay throws `Component is not a function` until a full reload. Production is clean.
- ✅ **[fixed]** ~~`.fx-curl { will-change: transform }`~~ held a permanent compositor layer for **every** article and gallery print, purely for a 6% hover zoom. Promoted on `:hover`/`:focus-within` instead.
- ✅ **[fixed]** ~~The body scroll-lock effect depended on the *record*~~, so a turn unlocked and re-locked the body — handing the page its scrollbar back and reflowing the grid under the modal. Keyed on a boolean now.
- ✅ **[fixed]** `MusicalDrift`'s paused layer only stopped its clock; it now also goes `visibility: hidden`, so the compositor releases up to `driftCount` glyph textures for exactly as long as a codex is covering them.
- ✅ **[fixed 2026-08-28]** ~~*(scale)* **The grid renders every result — no cap, no windowing.**~~ It arrived exactly as predicted, at **736** entries rather than 1249. Measured before the fix: **741 cards mounted, 20 170 DOM nodes, 100 MB heap, and the first keystroke in the search box took 15 657 ms to reach the next frame** (second 7 953 ms; 53 long tasks, worst 879 ms). None of it was the search — a full pass over 736 docs measures 0.075 ms. It was `AnimatePresence mode="popLayout"` + `layout` on every cell, measuring and exit-animating all 736 on every result change.

  The fix is the one this note called for: `GRID.pageSize` (40) with incremental reveal, `GRID.autoPages` (3) free pages on an `IntersectionObserver` sentinel and an explicit "show more" after that; `layout` and the exit choreography deleted (a cell still *arrives*, once, on mount). On top of it `.grid-cell` carries `contain: layout style` everywhere and, under `(hover: none)`, `content-visibility: auto` + `contain-intrinsic-size: auto 26rem` — native windowing on the devices whose hover ornament the implied paint containment would otherwise clip. `CharacterCard` also split into `TiltShell`/`PlainShell` chosen once per session off `(hover: hover) and (pointer: fine)`, so a phone never builds the five motion values and two springs it can never fire.

  **After: 40 cards, 1 518 DOM nodes, 35 MB heap, keystroke 49 ms, zero long tasks.**
- 🟡 `App.tsx` rebuilds `turnPage` on every keystroke (it closes over `turnOrder`). Harmless now that `CodexShell` binds its `keydown` through a ref, but it still invalidates the prop on a memo boundary.

### Cross-cutting duplication / drift 🟠
- **Two flag components** — `Flag.tsx` (by UI language, 10) and `CountryFlag.tsx` (by ISO country, **53** as of 2026-08-28) — with overlapping hand-drawn SVGs. `CountryFlag` was added 2026-07-21 for the Lore tab; the DE/ES/FR/IT/PT/RU/JP/CN/KR/GB art is duplicated between the two. The case for merging got stronger, not weaker: `CountryFlag` now covers **every country in `index.json`**, because the country facet became a row of flags (`components/search/CountryFilter.tsx`) and a missing flag would break the row. `Flag(lang)` is now a strict subset and should be derived from the ISO set via the locale region (`languages.ts` `locale` → `search/persist.ts` `countryOfLanguage`), which already exists for the first-visit filter seed.
- **Two hand-maintained tables can still drift**: `index.json`'s ISO `country` values and the `CountryFlag` set. Adding an entry from an uncovered nation silently drops it to bare ISO letters in the facet row — `hasCountryFlag()` is the fallback, and a `lint:content` check for it belongs in Step 7.
- **Four copies of the look-ahead scheduler** and **two near-verbatim viewer providers** (image / ascii-tab) — extractable into one utility / one factory each.

### Structure / styling 🟡
- ✅ **The stylesheet is split (2026-08-29).** `index.css` had reached 2 528 lines mixing tokens/base/components; it is now the import list and the rules live in fourteen `src/styles/*.css` files of 47–318 lines each. The **`@layer` half of this item is still open**: the files are still unlayered, so the "unlayered beats utilities" footgun is unchanged — splitting made the rules findable, not the cascade safer.
- `App.tsx` is a single large orchestrator (search + route + audio + scroll-lock + modal). Fine now; watch it as features grow.

## Prioritized improvement backlog

1. 🔴 **Add Vitest + unit tests** for the pure logic first: `parse.ts` (fences/unknown/columns/title), search `fold`/`translitVariants`, `metadata` DMY/`ageOf`/`splitList`/country, `paths` resolution, i18n plural/interpolation. This unlocks safe refactoring of everything below. **Two new candidates head the list:** `search/cache.ts`'s containment rule (query extension must never lose a document — the property the whole narrowing rests on) and `search/persist.ts`'s `restore` (it is fed hand-editable `localStorage` and must be total).
2. 🟠 **Add ESLint + Prettier + a CI check** (`tsc -b` + lint + test on push).
3. 🟠 **Resolve the mute-vs-content bug**: route content playback through a gain the 🔊 toggle controls (or stop all content on mute) — or explicitly document it as intended and reflect that in the tooltip.
4. ✅ **Audio lifetime — done (2026-08-13).** Disposed-guard around `loadMidi().then`, `removeEventListener` + `load()` in `NativeBackend.dispose`, ticker throttled off the frame clock. Still open by choice: the three `AudioContext`s are never `close()`d, and the 25 ms ambient/theme intervals cluster on refocus after background throttling.
5. ✅ **ErrorBoundary — done (2026-08-04).** Root + codex boundaries with parchment-styled, localized fallbacks (`app.crash*`); DEV-only logging. Still open by choice: the image and ascii-tab viewers rely on the *root* boundary (a throw there replaces the page rather than just the overlay) — give each its own boundary when the tab viewer is hardened (item 7).
6. 🟠 **Consolidate the flag/country stack**: one ISO-keyed SVG source of truth; derive `Flag(lang)` from it; unify `COUNTRY_TEXT_TO_ISO` + `CountryFlag` coverage. **[v2 does half of this]** — `index.json` `country` becomes ISO and the text→ISO dict is deleted, leaving only the two hand-drawn SVG sets to merge.
7. 🟠 **ASCII-tab hardening**: charset fallback (CP1251/KOI8-R) for legacy tabs; fix the `r(n)` glyph; `React.memo`/virtualize `TabSystemSvg`; add a focus trap.
8. 🟠 **Content robustness**: sanitize block-derived `src`; retry/invalidate negative fetch cache; surface parser warnings in prod (dev overlay or a `pages/` content-lint script); reconsider comma-lists vs arrays in the data model.
9. ✅ **Search scaling — done (Step 5).** Prebuilt weighted corpus, hoisted variants, ranking, `useDeferredValue`; **0.398 ms/query at 1249 docs**. Still open by choice: the `ё` collapse and single-character transliteration (no `кс`→`x`).
10. 🟡 **Structure/a11y polish**: ~~split `index.css`~~ (done 2026-08-29 — fourteen files under `src/styles/`) and move rules into `@layer`; extract one shared look-ahead scheduler + one viewer-provider factory; unify the reduced-motion policy (framer vs CSS); make BioMD figures keyboard-operable. **[`CodexModal` is done — 271 → 45 lines across 10 focused files (Step 6). `App.tsx` remains the large one.]**
11. 🟠 **[v2, Step 7]** **Content validation**: `scripts/lint-content.mjs` — the guard-rail for the two-file index split (dangling ids, duplicate slugs, drifted `born`/`died`, untranslated editions). The repo has no content validation at all today.
