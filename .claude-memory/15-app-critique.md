# 15 · `app/` — Critique & Improvement Backlog (2026-07-21)

> Honest strengths/weaknesses + a prioritized backlog, distilled from a deep
> read of every subsystem. Findings cite `file:line` **anchors** (they drift);
> treat each as "verify, then act." Severity: 🔴 high · 🟠 medium · 🟡 low.
> Many "weaknesses" only bite **at scale** (7 live entries today vs ~1249 in the
> legacy index) — tagged *(scale)*.

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
- 🟠 **No React error boundary** (`main.tsx`, `App.tsx`) — an uncaught render error (a parser edge, a bad prop) blanks the whole app.

### Audio
- 🟠 **Mute doesn't silence content.** `setEnabled` ramps only the engine `master` (`audio.ts`); mp3/MIDI/tab playback live on separate contexts/elements and keep sounding. Either intended or a headline bug — decide and document.
- 🟠 **Three `AudioContext`s + `HTMLAudioElement`, never `close()`d** (`audio.ts`, `midi.ts:~60`, `asciiTabPlayback.ts:~45`). Lifetime leak; iOS/Safari concurrency risk.
- 🟠 **Orphan `MidiPlayer` on dispose-mid-load** (`playback.ts` `MidiBackend.start`): `loadMidi().then(...)` has no disposed-guard, so a source change before the fetch resolves still constructs a player + starts a scheduler that's never cleared → ghost audio + leaked timer/oscillators.
- 🟡 **Theme button desync** (`GalleryTab.tsx` `ThemeRow`): local `playing` isn't reset when the theme is stopped externally (`claimPlayback`/`setEnabled(false)`) → button shows "playing" while silent.
- 🟡 Background-tab `setInterval` catch-up → clustered "chord blast" on refocus; `NativeBackend.dispose` never `removeEventListener`s; autoplay-blocked `play()` is swallowed while UI optimistically shows "playing"; `themeIsPlaying` ignores `wave`/`bass`.

### Search / i18n
- 🟠 **Latin→Cyrillic has no table — the Latin slug is a single point of failure** (`search.ts` haystack ← md filename via `paths.slugOf`). Works only because every migrated file has a Latin name; a Cyrillic md filename silently breaks Latin search for that entry.
- 🟠 *(scale)* **Unranked + unthrottled + redundant.** No relevance sort; `SearchBar` has no debounce; `translitVariants` is recomputed per-doc though it depends only on the token (N× waste). Fine for 7; needs hoist + debounce + prebuilt index + ranking before surfacing ~1249.
- 🟡 **`fold` collapses `ё→е`** before translit runs → the `ё` transliteration entry is dead and the literal `.replace(/ё/g,…)` is redundant (NFD already stripped it). "Фёдор" can never yield "fyodor".
- 🟡 Facet filter is exact-string on free-text country (case drift → duplicate chips); slug haystack isn't `fold`ed; `search.countFiltered` is a plain string (not a `Plural`) in every dict → won't decline correctly in Russian; translation *quality* is unpoliced (only presence is).

### Content / data / BioMD
- 🟠 **Block-derived `src` bypasses sanitization.** `::: image`/`::: document` `src` flows through `resolveResourcePath` (passes `javascript:` through) into `<img src>`/`<a href>` without react-markdown's `urlTransform`. Content is trusted today, but it's a real injection vector.
- 🟠 **Segmenter is unaware of Markdown code fences** — a ```` ``` ```` block containing a `:::` line is misparsed; fences must also start at column 0 (indented `:::` becomes prose).
- 🟠 **Sticky negative caching** (`catalog.ts` `fetchJson`/`fetchText`): a transient failure caches a resolved-`null` promise permanently — no retry/invalidation until full reload (asymmetric with `loadIndex`, which stays refetchable).
- 🟠 **Country mapping is a 10-entry band-aid** (`metadata.ts` `COUNTRY_TEXT_TO_ISO`): any other free-text country → raw text, no flag, no localization; non-English free text never maps.
- 🟠 **A11y: figures are mouse-only.** Inline `img` (`<span onClick>`) and block `Figure` (`<figure onClick>`) in `BioArticle.tsx` have no role/tabindex/keyboard handler (DocumentCard does it right with `<button>`/`<a>`).
- 🟡 Silent `columns.slice(0,3)` truncation (no warning — contradicts the "never delete" invariant); parser warnings are DEV-only (no prod author feedback); `splitList` can't escape commas ("Crosby, Stills & Nash" → 3); `ageOf` mixes UTC parse with local "now" (day-boundary off-by-one); `parseDmy` accepts Feb 30; `slugOf` collides on duplicate md filenames; no `AbortSignal` on `loadEntry`.
- 🟡 *(scale)* Prefetch is linear → ~1249 serial idle JSON fetches for the full legacy index.

### ASCII tablature
- 🟠 **`fatal:true` UTF-8 decode rejects legacy encodings** (`asciiTab.ts`). The domain is a Russian guitar site — CP1251/KOI8-R (or Latin-1 box-drawing) tabs will throw and drop to the download-only error screen. No charset fallback.
- 🟠 **Rigid 6-consecutive-line detection** (`detectSystems`): interleaved blank/beat lines or 7-line systems are missed; a stray leading line desyncs all following systems (`start += 6`).
- 🟠 **A11y: no focus trap / initial-focus move** in the tab viewer modal; the global capture-phase keydown swallows Escape/`+`/`-`/`0` app-wide while open.
- 🟡 Cross-string column misalignment when string rows mix prefix widths (`E-||` vs `B||`); the `r(n)` token drops its closing `)` → a stray red "unknown-symbol" glyph + spurious diagnostic; no `React.memo`/virtualization → jank on large tabs during the ~12 Hz playback re-render; capo is parsed but never applied to pitch; techniques re-articulated; only standard & drop-D tunings map; unbounded `documentCache`; several hardcoded English strings bypass i18n.

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
4. 🟠 **Fix the orphaned-`MidiPlayer` leak** (disposed-guard around `loadMidi().then`), and `removeEventListener` in `NativeBackend.dispose`.
5. 🟠 **Add an ErrorBoundary** around the codex/parser render path with a parchment-styled fallback.
6. 🟠 **Consolidate the flag/country stack**: one ISO-keyed SVG source of truth; derive `Flag(lang)` from it; unify `COUNTRY_TEXT_TO_ISO` + `CountryFlag` coverage; ideally migrate index.json `country` to ISO (raise with user).
7. 🟠 **ASCII-tab hardening**: charset fallback (CP1251/KOI8-R) for legacy tabs; fix the `r(n)` glyph; `React.memo`/virtualize `TabSystemSvg`; add a focus trap.
8. 🟠 **Content robustness**: sanitize block-derived `src`; retry/invalidate negative fetch cache; surface parser warnings in prod (dev overlay or a `pages/` content-lint script); reconsider comma-lists vs arrays in the data model.
9. 🟡 *(when surfacing the legacy set)* **Search scaling**: hoist `translitVariants`, debounce input, prebuild an index, add ranking; fix the `ё` fold; fold the slug haystack.
10. 🟡 **Structure/a11y polish**: split `index.css` and move rules into `@layer`; extract one shared look-ahead scheduler + one viewer-provider factory; unify the reduced-motion policy (framer vs CSS); make BioMD figures keyboard-operable.
