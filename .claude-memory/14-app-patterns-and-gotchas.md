# 14 · `app/` — Patterns, Gotchas & Task Recipes (2026-07-21)

> How to work in `app/` without stepping on mines. Companion to
> [`13-app-code-map.md`](13-app-code-map.md) (where things live) and
> [`15-app-critique.md`](15-app-critique.md) (what's weak).

> ✅ **Catalogue v2 — code complete (2026-07-31).** Format, data and code are
> all v2 ([`docs/Catalog-Index.md`](../docs/Catalog-Index.md); Steps 4–6 of
> [`the plan`](../docs/proposals/Plan_Catalog-v2-index-ids-localized-names-codex-split.md)).
> Only Step 7 (`lint:content` + Vitest) is outstanding, so nothing below is
> enforced by a test yet — verify changes by hand.

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
- **Two independent bases.** index.json + its `json`/`md`/`img` resolve via `APP_BASE`; in-entry media/documents resolve via `RESOURCE_BASE_PATH` (`VITE_RESOURCE_BASE_PATH ?? /pages`). A plain root deploy will 404 media unless `VITE_RESOURCE_BASE_PATH` points where `pages/` actually lives.
- **Dev serves the archive by fall-through, not by prefix proxy.** `vite/legacy-archive.ts` fetches anything `publicDir` can't serve from abc-guitars.com and streams it back same-origin (local files always win). It replaced a `/pages` proxy, which could not work: a target that climbs out of the base (`^/main/x.jpg`, `/../main/x.jpg`) no longer *starts* with `/pages` by the time it is requested, so the proxy never matched and Vite answered with the SPA shell.
- **Escaping the resource base is a real feature, not a hack** (BioMD 1.4 §15.1). `^/main/x.jpg` anchors at the resource root; `/../main/x.jpg` climbs out. `resolveResourcePath` collapses `.`/`..` itself and clamps at the root, so the emitted URL is the one actually requested. Prefer `^` — `..` only works when it matches the base depth segment for segment.
- **`resolveResourcePath` swallows a leading `pages/`** (`basePrefix`, a documented back-compat shim for legacy content): `pages/photo/k/x.jpg` → `/pages/photo/k/x.jpg`, not `/pages/pages/…`. Consequence: a real directory named `pages` *inside* the base is unaddressable. Don't write the prefix in new content.
- **`publicDir = ../pages` IS the content store** — editing `../pages/**` changes served content with no rebuild; the tree also ships in `dist`.
- **json/md are localized (`/<lang>/…`), media are NOT.** Use `localizeContentPath` only for json/md.
- **`index.json` v1 deviates from the metadata spec**: free-text `country` (not ISO), no `id`. ✅ **Resolved by the v2 spec** — the index now owns `id` and ISO `country` and is the source of truth for identity. Mixed leading-slash conventions stay (`json`/`md` rooted, `img` bucket-relative). Follow [`docs/Catalog-Index.md`](../docs/Catalog-Index.md) for new content.
- **v2: `*.bio.json` is a per-language *edition*.** `forename`, `surname`, `birthplace`, `instruments`, `jobs`, … must be authored in the directory's language; only `dates`/`ranking`/`url` are invariant. The current fixtures violate this and are **not** examples to copy (Step 2 fixes them).
- **v2: `json` present ⟺ biography.** An entry without a dossier is a *page*: no tabs, header shows display name + country. Declared in `index.json`, never inferred from a failed fetch.

**Routing / modal / focus**
- **Body scroll-lock is owned by `App`, not the modal** — per-modal locking miscounts during AnimatePresence overlap on ← → turns. Don't move it back.
- **Escape ordering is capture-phase.** `LanguageMenu` and `ImageViewer` register `keydown` in the capture phase and `stopPropagation()` so Escape closes them before the codex behind them. Preserve this when adding nested overlays.
- **Hash route slugs are ASCII `[\w.-]+`** (`SLUG_PATTERN` in `lib/entry.ts`, percent-decoded) — dots allowed, so `#/goya2.right` routes. Setting `location.hash` fires `hashchange` (state updates), but the null-clear uses `history.pushState` (no event). Programmatic hash changes from outside React may not switch entries — reload to re-init.
- **One link classifier, `entryTargetSlug`** (`lib/entry.ts`) decides whether a URL is an in-app entry (`#/slug`, `/#/slug`, `x.bio.md`, `x.md`). `BioArticle`'s `a` handler is its only caller and passes the **slug** to `onNavigateEntry`; `App` only checks the slug exists. Don't add a second URL parser — extend this one.
- **A link to a slug that isn't in `index.json` does nothing** (App's `bySlug.has` guard, unchanged policy from v1). That is a *content* error and belongs to `lint:content` (Step 7), not to runtime defensiveness. `pages/ru/goya2.right.md` has several — it is a routing fixture, not reference content.
- 🔴 **`fold()` must not blanket-strip combining marks.** `normalize("NFD")` decomposes Cyrillic `й` into `и` + breve; deleting every mark turned `йовичич` into `иовичич`, so it could only transliterate to `iovicic`, never `jovicic` — a silent cross-script miss for every name with `й` (fixed 2026-07-31). The strip is now scoped to Latin bases (`/([a-z])[̀-ͯ]+/g`) followed by `normalize("NFC")`. If you touch `fold`, check `Agustín→agustin`, `Jovičić→jovicic`, `Ёлка→елка` **and** `йовичич→йовичич` together.
- **Search work is split by what it depends on.** Corpus-only work (folding, weights, the ASCII flag) belongs in `buildSearchIndex`; query-only work (folding, tokenizing, transliterating) belongs in `tokenize`. Anything left in the per-doc loop runs `docs × fields` times per keystroke. The current budget: **0.398 ms/query at 1249 docs** — re-measure before adding an index.
- **The codex is composed, not branched.** `CodexModal` (45 lines) picks `BiographyView` or `PageView` from `record.biography` and hands both to the same `CodexShell`; both build the same `CodexHeader` from different data. If you find yourself adding `if (isPage)` inside the shell or the header, the data should differ instead.

**Audio**
- **The mute (🔊) toggle silences only the procedural engine (SFX+ambient+theme)** — mp3/MIDI/tab playback live on separate contexts and keep playing. This is current behaviour, widely assumed to be a bug (see [15](15-app-critique.md)).
- **Three `AudioContext`s + one `HTMLAudioElement`, none ever `close()`d** — mobile/Safari concurrency risk; don't add a fourth casually.
- **Ambient + SFX intentionally bleed over content**; only the per-entry *theme* yields to a recording. Don't "fix" that.
- **StrictMode double-invokes effects in dev** — schedulers/unlock must be idempotent.

**Search / i18n / flags**
- **v1: the Latin slug (from the md filename) is the sole bridge letting Latin queries hit Cyrillic entries.** Keep migrated md filenames Latin/ASCII-hyphenated. There is no Latin→Cyrillic table. **v2** makes `index.json.title` the explicit Latin fallback and `index-<lang>.json` aliases the primary mechanism — the slug bridge stops being load-bearing (but the filenames stay Latin, because they are the routes).
- **CJK cannot be transliterated at all.** `CYR_TO_LAT` covers Cyrillic only, so a `zh`/`ja`/`ko` query matches nothing in v1. Aliases in `index-<lang>.json` are the fix, not a bigger table.
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
- **Add a catalogue entry (v2 — follow [`docs/Catalog-Index.md`](../docs/Catalog-Index.md) §12):** append a row to `../pages/index.json` with the next unused `id` (string, never reused), a **Latin** `title`, `type`, `gender`, **ISO** `country`, `born`/`died` copied from the dossier, `lang`, and `md`/`json`/`img`. Create `../pages/<lang>/<slug>.bio.md` + `.bio.json` for **every** code in `lang`, each fully authored in that language. Add the localized name + search aliases to `../pages/index-<lang>.json` — including languages with no content edition. Keep the md filename Latin/ASCII (it is the slug and the route). Put media under `../pages/` (never localized). Then `npm run lint:content`.
- **Add a technical page (v2):** same, but `type: "hidden"`, `md` → `/<slug>.md` (no `.bio.` infix), and **no** `json`/`img`/`gender`/`born`/`died`. It stays routable at `#/<slug>` and linkable from articles, but never appears in the grid, search, facets or ←/→ order.
- **Add a searchable alias (v2):** append it to that entry's array in `../pages/index-<lang>.json`, after `[0]`. Content-only — no code change, no rebuild. This is how CJK search works; there is no transliteration path for `塞戈维亚`.
- **Add a country flag:** add an ISO-keyed SVG to `COUNTRY_FLAGS` in `CountryFlag.tsx`; if the entry’s country arrives as free text via index.json, also add it to `COUNTRY_TEXT_TO_ISO` in `metadata.ts` (else no flag/localization).
- **Add a BioMD block:** add a handler in `parse.ts` (`parseBlock`) and a case in `BioArticle.tsx` `renderNode`. Unknown blocks already render their children — extend, don't special-case-break. If the block owns both properties and a body, reuse `splitPropsAndBody` (not `parseProps`). Validate enum properties with `enumProp` + a warning, and if it needs CSS, scope it `.bio-article .your-class …` so it outranks the generic `.bio-article ul/a/p` rules regardless of source order.
- **BioMD 1.3 additions (2026-07-29):** `::: align` (`position: left|center|right`), image/images `frame:` (`curl none mat black white red gold` — theme tokens only, never a literal colour; the four colour borders are broad by design; class names come from a static map in `CurlFrame`), and `::: nav` rendered as a centered pill bar. `frame:` (image property) and `::: frame` (callout block, still unimplemented) are different things. A `nav` item targeting a `*.bio.md` outside `index.json` is a silent no-op (`App.navigateByMdPath`). Conformance fixture: `pages/ru/biomd-demo.bio.md`.
- **Frame a new image:** wrap the `<img>` in `<CurlFrame>` inside a clickable `<figure>`/`<span>` that calls `useImageViewer()` — same as `GalleryTab`/`BioArticle`. `CharacterCard` is intentionally exempt (its own 3D effect).
- **Verify an animation/hover in the Browser pane:** the pane throttles compositing, so CSS transitions don't visibly advance and screenshots time out — move a real cursor with `computer{hover, ref}`, confirm via a non-transitioned property (e.g. `z-index`), and read the true end-state after injecting `*{transition:none}`. (See personal memory `browser-pane-transition-verification`.)
