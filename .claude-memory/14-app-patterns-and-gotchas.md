# 14 · `app/` — Patterns, Gotchas & Task Recipes (2026-07-21)

> How to work in `app/` without stepping on mines. Companion to
> [`13-app-code-map.md`](13-app-code-map.md) (where things live) and
> [`15-app-critique.md`](15-app-critique.md) (what's weak).

## Recurring patterns (learn these once — they repeat everywhere)

- **Lazy + preload singleton.** `LazyX = lazy(loadX)` with a module-level `pending` promise, plus `preloadX = () => void loadX()` fired on hover/focus/click intent. Identical shape in `LazyCodexModal.ts`, `LazyImageViewer.ts`, `LazyAsciiTabViewer.ts`. Copy it for any new heavy overlay.
- **Provider + `useX()` overlay.** App-wide overlays (image viewer, ascii-tab viewer) and i18n are React contexts mounted once at root in `main.tsx`. A hook opens them from anywhere; the overlay is mounted `key={src}` under `Suspense`+`AnimatePresence`, so **remount = state reset** (don't "optimize" the key away). `imageViewer.tsx` and `asciiTabViewer.tsx` are near-verbatim twins.
- **Audio singleton + single-active coordinator.** `audio` (from `audio.ts`) is pinged on interactions (`hover/click/pageTurn/open/close`). *Content* playback (mp3/midi/tab-preview/theme) is arbitrated by a module-level `stopActive` in `playback.ts` (`claimPlayback`/`stopAllPlayback`) that keys on the **reference identity** of the stop callback → always pass a stable (`useCallback`) function.
- **Look-ahead scheduler.** Four independent copies (theme + ambient in `audio.ts`, `midi.ts`, `asciiTabPlayback.ts`): `setInterval` (25–40 ms) + a while-loop scheduling notes ≤~0.15 s ahead on the sample-accurate `AudioContext` clock. Position derives from the clock, so suspend = frame-perfect pause.
- **Deterministic-from-seed identity.** `fnv1a(slug/name)` → `mulberry32` → the entry's theme (`themeFromSeed`), accent (`accentFor`), and placeholder portrait (`placeholder.ts`). Same entry ⇒ same look/sound every visit. Reuse `fnv1a`/`accentFor` for any per-entry visual.
- **Motion.** `LazyMotion features={domAnimation} strict` ⇒ use `m.*`, never `motion.*`. framer components gate on `useReducedMotion()`; CSS animations gate on `@media (prefers-reduced-motion)`. (These two are applied inconsistently — see the reduced-motion landmine.)
- **Fail-soft by default.** Parser preserves unknown/malformed content + warns; fetch helpers resolve to `null`; missing metadata → the row is omitted (never an empty label); broken `<img>` → hidden or procedural placeholder. Match this — don't throw in a render path.
- **Type-enforced i18n.** `ru.ts` defines `MsgKey`; the other 9 dicts are `Record<MsgKey,Message>` so drift is a compile error. `DICTS` forces a dict per `Lang`.
- **Styling.** Tailwind v4 utilities + `clsx` for conditionals + a small set of semantic classes in `index.css` (`.parchment`, `.btn-rpg`, `.bio-article`, `.fx-curl`, footer chrome). `@/` ⇒ `src/`.
- **Two-base paths & promise-memo caches** (see code map / gotchas below).

## Landmines (verify before you touch)

**CSS**
- **Unlayered rules in `index.css` beat Tailwind's layered utilities.** A hand-written `.foo { position: … }` will override `class="absolute"`. Documented scars: `.btn-rpg` must NOT set `position`; the codex scroll area relies on `absolute inset-[11px]`. When adding semantic CSS, don't set properties you also drive with utilities on the same element.
- **Reduced-motion is dual-tracked and was inconsistent.** framer uses `useReducedMotion()`; CSS uses `@media`. A CSS `@media (prefers-reduced-motion){ transform:none }` guard once silently killed the requested `.fx-curl` hover zoom for users with reduced-motion on. Decide per-effect whether it's decorative (suppress) or a functional affordance (keep), and don't blanket-disable transforms.

**Content / paths / dates**
- **Never `new Date(metadataDateString)`** — dates are `DD.MM.YYYY`. Use `parseDmy`/`formatDmy`/`yearOf`/`ageOf` (`metadata.ts`).
- **Two independent bases.** index.json + its `json`/`md`/`img` resolve via `APP_BASE`; in-entry media/documents resolve via `RESOURCE_BASE_PATH` (`VITE_RESOURCE_BASE_PATH ?? /pages`). A plain root deploy will 404 media unless `VITE_RESOURCE_BASE_PATH` points where `pages/` actually lives; **dev only works because `vite.config.ts` proxies `/pages` → abc-guitars.com**.
- **`publicDir = ../pages` IS the content store** — editing `../pages/**` changes served content with no rebuild; the tree also ships in `dist`.
- **json/md are localized (`/<lang>/…`), media are NOT.** Use `localizeContentPath` only for json/md.
- **`index.json` deviates from the metadata spec on purpose**: free-text `country` (not ISO), no `id`, mixed leading-slash conventions. Don't "correct" it — raise with the user.

**Routing / modal / focus**
- **Body scroll-lock is owned by `App`, not the modal** — per-modal locking miscounts during AnimatePresence overlap on ← → turns. Don't move it back.
- **Escape ordering is capture-phase.** `LanguageMenu` and `ImageViewer` register `keydown` in the capture phase and `stopPropagation()` so Escape closes them before the codex behind them. Preserve this when adding nested overlays.
- **Hash route slugs are Latin only** (`[\w-]+`); setting `location.hash` fires `hashchange` (state updates), but the null-clear uses `history.pushState` (no event). Programmatic hash changes from outside React may not switch entries — reload to re-init.

**Audio**
- **The mute (🔊) toggle silences only the procedural engine (SFX+ambient+theme)** — mp3/MIDI/tab playback live on separate contexts and keep playing. This is current behaviour, widely assumed to be a bug (see [15](15-app-critique.md)).
- **Three `AudioContext`s + one `HTMLAudioElement`, none ever `close()`d** — mobile/Safari concurrency risk; don't add a fourth casually.
- **Ambient + SFX intentionally bleed over content**; only the per-entry *theme* yields to a recording. Don't "fix" that.
- **StrictMode double-invokes effects in dev** — schedulers/unlock must be idempotent.

**Search / i18n / flags**
- **The Latin slug (from the md filename) is the sole bridge letting Latin queries hit Cyrillic entries.** Keep migrated md filenames Latin/ASCII-hyphenated. There is no Latin→Cyrillic table.
- **`fold` collapses `ё→е`**, which makes the `ё` transliteration entry dead — don't rely on ё-specific translit.
- **Search is unranked and unthrottled** — add relevance ordering in `App.tsx` (not `search.ts`), and debounce before scaling past the 7 live entries toward the ~1249 legacy set.
- **Flags are hand-drawn SVG, never emoji** (Windows renders flag emoji as letters). There are **two** sets: `Flag.tsx` (by UI language) and `CountryFlag.tsx` (by ISO country). Missing coverage falls back to text.

**BioMD**
- **`:::` fences are matched before Markdown parsing and must start at column 0** — a fenced code block containing a `:::` line will be misparsed; indented `:::` is treated as prose.
- **`# title` is extracted only from the very first markdown node** — a doc that opens with a `:::` block keeps its title in-body.
- **No `rehype-raw`** ⇒ raw HTML in BioMD is inert (intended). Adding `rehype-raw` would open an XSS hole. Note block-derived `src` (image/document) bypasses react-markdown's `urlTransform` — treat content as trusted-only.

**App-wide**
- **No error boundary exists** — an uncaught render error (e.g. a parser edge case) blanks the app. Consider one if you add risky render logic.

## Task recipes

- **Add a UI language:** (1) add to `LANGUAGES` in `languages.ts` (order is curated, not alphabetical); (2) create `lib/messages/<code>.ts` typed `Record<MsgKey,Message>` with ALL keys; (3) add it to `DICTS` in `messages/index.ts`; (4) draw the flag in `Flag.tsx` (`FLAGS` is `Record<Lang,…>` → compile error if missing). `Intl.PluralRules`/`DisplayNames` handle locale formatting.
- **Add a message key:** add to `ru.ts` **first** (it defines `MsgKey`); the other 9 dicts then fail to compile until filled. Plural values need `one/few/many/other` in `ru` + `as Plural`.
- **Add a catalogue entry:** append a row to `../pages/index.json` (`title,type,forename,surname,country`[free-text]`,lang,json,md,img`) + create `../pages/<lang>/<slug>.bio.json` and `.bio.md`. Keep the md filename Latin/ASCII (search depends on it). Put media under `../pages/` (never localized).
- **Add a country flag:** add an ISO-keyed SVG to `COUNTRY_FLAGS` in `CountryFlag.tsx`; if the entry’s country arrives as free text via index.json, also add it to `COUNTRY_TEXT_TO_ISO` in `metadata.ts` (else no flag/localization).
- **Add a BioMD block:** add a handler in `parse.ts` (`parseBlock`) and a case in `BioArticle.tsx` `renderNode`. Unknown blocks already render their children — extend, don't special-case-break.
- **Frame a new image:** wrap the `<img>` in `<CurlFrame>` inside a clickable `<figure>`/`<span>` that calls `useImageViewer()` — same as `GalleryTab`/`BioArticle`. `CharacterCard` is intentionally exempt (its own 3D effect).
- **Verify an animation/hover in the Browser pane:** the pane throttles compositing, so CSS transitions don't visibly advance and screenshots time out — move a real cursor with `computer{hover, ref}`, confirm via a non-transitioned property (e.g. `z-index`), and read the true end-state after injecting `*{transition:none}`. (See personal memory `browser-pane-transition-verification`.)
