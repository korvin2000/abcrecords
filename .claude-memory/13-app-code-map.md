# 13 · `app/` — Code Map & Control/Data Flow (2026-07-21)

> Navigational companion to [`12-app-architecture.md`](12-app-architecture.md).
> "Where does X live and how does control reach it?" Pair with
> [`14-app-patterns-and-gotchas.md`](14-app-patterns-and-gotchas.md) (how to work
> here) and [`15-app-critique.md`](15-app-critique.md) (what's weak / backlog).
> All paths are repo-relative; line numbers drift — treat them as anchors.

> ✅ **Catalogue v2 migration — code complete (2026-07-31).** Steps 4, 5 and 6
> are in: `lib/entry.ts` + `lib/names.ts`, a validating/normalizing
> `catalog.ts` that assembles a `Catalog`, no `prefetchAll`/`rankings`, dotted
> hash slugs, a weighted-scoring `search.ts` with `useDeferredValue`, and the
> codex decomposed into Shell/Header/Tabs/Article + BiographyView/PageView.
> Only **Step 7** (`lint:content` + Vitest) is left — see
> [`the plan`](../docs/proposals/Plan_Catalog-v2-index-ids-localized-names-codex-split.md).
> Format spec: [`docs/Catalog-Index.md`](../docs/Catalog-Index.md).

## Layered architecture (bottom → top)

```
main.tsx  ─ providers: LazyMotion(strict) › I18nProvider › ImageViewerProvider › AsciiTabViewerProvider › App
App.tsx   ─ single orchestrator: catalog load, search/filter state, hash route, audio toggles, body scroll-lock, codex mount
  ├─ Data/content layer   catalog.ts · paths.ts · types.ts · metadata.ts · languages.ts · hooks.ts
  ├─ Search + i18n        search.ts · i18n.tsx · messages/* · languages.ts
  ├─ BioMD render         biomd/{parse.ts, remarkHighlight.ts, BioArticle.tsx}
  ├─ Audio                audio.ts · playback.ts · midi.ts · asciiTabPlayback.ts · AudioPlayer.tsx
  ├─ Overlays (viewers)   imageViewer.tsx+ImageViewer.tsx · asciiTabViewer.tsx+AsciiTabViewer.tsx · asciiTab.ts
  ├─ Browse UI            CharacterGrid · CharacterCard · SearchBar · AnimatedTitle · Background · SiteFooter · LanguageMenu
  ├─ Codex modal          codex/{CodexModal, CodexShell, CodexHeader, CodexTabs, CodexArticle,
  │                              BiographyView, PageView, CodexSkeleton, useCodexEntry, codexScroll}
  │                       codex/tabs/{Gallery, Documents, Lore}Tab
  └─ Shared UI atoms      OrnateFrame · Flag · CountryFlag · CurlFrame · placeholder.ts · index.css
```

**Philosophy (the through-line):** the app is a *pure renderer* — **all** content lives outside it in `../pages/` (mounted as Vite `publicDir`) and is fetched at runtime; nothing is bundled. It is a faithful, i18n-first re-creation of the legacy `guitar-times.ru`/`abc-guitars.com` site as an antique-manuscript "RPG codex," engineered for low-end devices (lazy chunks, idle prefetch, no canvas), with **deterministic per-entry identity** (theme/accent/placeholder all seeded from the slug) and **graceful degradation everywhere** (unknown blocks render, missing data → absent rows, failed fetch → soft-null, broken img → hidden/placeholder).

## File inventory by layer

### Entry & orchestration
| File | Role / key exports |
|---|---|
| `src/main.tsx` | Root render + provider nesting (see above). `LazyMotion features={domAnimation} strict` → only `m.*` allowed, no full `motion.*`. |
| `src/App.tsx` | The one orchestrator. Owns: query/filter state, `useCatalog`, `useHashRoute`, `useAudioUnlock`, sound/ambient toggles, **body scroll-lock (single owner — do not move to the modal)**, facets (sorted by *label* with `Intl.Collator`), native/foreign result split + `nativeCount`, `turnPage` (← →), `openLinkedEntry(slug)` (cross-entry links, already classified by `BioArticle`), footer section links. Browse UI reads `catalog.listed`; routing reads `catalog.bySlug` (**all** records, so hidden pages stay reachable). Mounts `LazyCodexModal` under `Suspense`+`AnimatePresence`. |
| `src/index.css` | Tailwind v4 `@theme` tokens + all semantic CSS (`.parchment`, `.ornate-border`, `.btn-rpg`, `.bio-article`, `.fx-curl`, footer chrome, keyframes). **~700 lines, unlayered → beats Tailwind utilities (footgun).** |
| `index.html` | Static shell, `lang="ru"`, inline "Кодекс открывается…" fallback, ❧ emoji-SVG favicon. No SSR. |

### Data / content layer
| File | Role |
|---|---|
| `src/lib/catalog.ts` | **The catalogue**, in two halves. *Read model:* `CatalogRecord {entry,id,slug,langs,listed,biography,display}`, `Catalog {records,listed,bySlug,names}`, pure `buildCatalog(entries,names)`, `EMPTY_CATALOG`. *I/O + cache:* `loadIndex()` (validates & **normalizes case once at the boundary**; drops rows with no `id`/`md`; duplicate id/slug → DEV warn, first wins; rejection is not cached so retry works), `loadNames(lang)` (per-lang, missing file → `{}`, never throws), `loadEntry(entry,lang)` (per-`slug::lang`; **skips the JSON fetch when `json` is absent** — a page makes no speculative request). Four module-level **promise** caches. |
| `src/lib/entry.ts` | Pure per-entry facts: `slugOf` (md basename), `isBiography` (`json` declared), `isListed` (`type !== "hidden"`), `portraitPath` (img → `photos/default-<gender>.svg`), `initialsFrom` (code-point safe), `entryTargetSlug` (**the one** in-app link classifier: `#/slug`, `/#/slug`, `x.bio.md`, `x.md`), `SLUG_PATTERN`, `decodeSlug`. **All visibility/biography branching goes through these predicates.** |
| `src/lib/names.ts` | `displayName(names,id,fallback)` / `aliasesOf(names,id)` over an `index-<lang>.json`. `[0]` renders, `[1…]` are search-only. |
| `src/lib/paths.ts` | **Two independent bases**: `APP_BASE`(`import.meta.env.BASE_URL`) for index.json + its json/md/img via `resolveContentPath`; `RESOURCE_BASE_PATH`(`VITE_RESOURCE_BASE_PATH ?? "/pages"`) for in-entry media/docs via `resolveResourcePath`. The latter is one pipeline: strip `?#` suffix → detect `^` anchor → `basePrefix` (skip base if anchored or already spelled out) → `collapse` `.`/`..` clamped at the root → rejoin. `localizeContentPath` (json/md only), `isExternalUrl`. (`slugOf` moved to `entry.ts` — it is about entries, not paths.) |
| `src/lib/types.ts` | `IndexEntry` (v2 row: `id`/`title`/`type`/`md` required, `lang`/`gender`/`country`/`json`/`img` optional; `country` UPPERCASE, other enums lowercase after normalization), `Gender`, `NameIndex`, `EntryMeta` (dossier — **no** id/title/gender/type/country/bio), `EntryData`, `EntryBundle`, `MediaItem`, `DocumentItem`. |
| `src/lib/metadata.ts` | DMY dates (`parseDmy`/`formatDmy`/`yearOf`/`ageOf` — **never `new Date(str)`**), `splitList`, `countryName(iso,locale)` (case-insensitive; one cached `Intl.DisplayNames` per locale), `rankStars`, `fnv1a`, `accentFor`. |
| `src/lib/languages.ts` | `LANGUAGES` (curated order, `ru` 8th), `Lang`, `DEFAULT_LANG="ru"`, `entryLangs`/`parseLangList`/`pickContentLang`, `langInfo`. |
| `src/lib/hooks.ts` | `useAudioUnlock` (gesture unlock), `useCatalog(lang)` → `{state,retry}` resolving `[loadIndex, loadNames]` into one `Catalog` (**keeps the loaded catalogue on screen across a language switch** — no skeleton flash), `useHashRoute` (`#/slug`; `SLUG_PATTERN` allows dots + `decodeURIComponent`). |

### BioMD parser / renderer
| File | Role |
|---|---|
| `src/lib/biomd/parse.ts` | Recursive-descent `::: block` fence parser over line-segmented text → `BioDoc {title,nodes,warnings}`. Tolerant: unknown/stray/unclosed → preserved + warned. Node kinds: `markdown·lead·align·image·images·document·columns·nav·unknown`; `splitPropsAndBody` serves the blocks that own both properties and a body (`align`,`nav`); image `alt`/`link`(safe-scheme-checked)/`frame` per spec 1.3. |
| `src/lib/biomd/remarkHighlight.ts` | remark plugin: `==text==` → `<mark>` via mdast `data.hName`. Can't span lines / contain `=`. |
| `src/lib/biomd/BioArticle.tsx` | react-markdown (GFM + highlight) renderer + **link-rewiring hub** — in-app entry (`entryTargetSlug`: `#/slug`, `x.bio.md`, `x.md`) → `onNavigateEntry(slug)`, audio→player, .txt→tab viewer, image→zoom viewer, external→new tab, else archival. Renders `Figure`/`images`/`DocumentCard`/`BioNav`. Wraps images in `CurlFrame` (optional `frame` variant). `Md`'s optional `nav` prop = nav mode: suppresses media widgets and renders the `active` label as `aria-current`. |

### Search & i18n
| File | Role |
|---|---|
| `src/lib/search.ts` | Ranked client-side name search, four sections. **Corpus-side (once per catalogue + UI language):** `buildSearchIndex(records, names)` → `SearchDoc{record, fields}`; each `Field{text (folded), weight 3 name / 2 alias / 1 latin-title-or-slug, latin (ASCII flag)}`, deduped keeping the highest weight. **Query-side (once per query):** fold + tokenize; `translitVariants` **only for Cyrillic tokens** (capped 64). **Per doc:** `matchScore` — one `indexOf` yields exact 100 / prefix 70 / word-start 50 / contains 25; transliterations score 10 and only against `latin` fields. Token score = best field hit × weight; **AND across tokens**; sum, sort desc (stable ties = index order). `fold` strips diacritics **from Latin bases only** — see the gotcha in [`14`](14-app-patterns-and-gotchas.md). Measured: **0.398 ms/query at 1249 docs**, which is why there is no inverted index. |
| `src/lib/i18n.tsx` | `I18nProvider`/`useI18n`/`t`. `detectLang` (localStorage `codex-lang` → navigator → `ru`), `Intl.PluralRules`, `{k}` interpolation, fallback `lang→en→ru→key`. |
| `src/lib/messages/ru.ts` | **Source of truth**: `satisfies Record<string,Message>` + `export type MsgKey = keyof typeof ru`. |
| `src/lib/messages/{en,es,ja,de,fr,it,pt,zh,ko}.ts` | Typed `Record<MsgKey,Message>` → missing/extra keys = compile error. |
| `src/lib/messages/{types,index}.ts` | `Message`/`Plural` types; `DICTS` map (adding a `Lang` w/o dict = compile error). |

### Audio (all runtime-synthesised; only user mp3/wav/midi are files)
| File | Role |
|---|---|
| `src/lib/audio.ts` | Singleton `audio` (`AudioEngine`): one-shot SFX, ambient bed (I–V–vi–IV loop), per-entry deterministic **theme** (`themeFromSeed`). Own `AudioContext` + master→limiter→destination + convolver "room". |
| `src/lib/playback.ts` | `useAudioPlayback(src,kind)` over `NativeBackend`(HTMLAudio) / `MidiBackend`. `audioKind()`. **Single-active coordinator** (`claimPlayback`/`stopAllPlayback`, module-level `stopActive`) — keys on stop-callback reference identity. |
| `src/lib/midi.ts` | `loadMidi` (lazy `@tonejs/midi`, per-URL cache, soft-null) + `MidiPlayer` (own context, look-ahead scheduler). |
| `src/lib/asciiTabPlayback.ts` | `useAsciiTabPlayback` — oscillator preview from tab data (own context; approximate). |
| `src/components/AudioPlayer.tsx` | Presentational `AudioPlayer`/`InlineAudioPlayer` over `useAudioPlayback`. |

### Overlays / viewers (twin provider pattern)
| File | Role |
|---|---|
| `src/lib/imageViewer.tsx` | `ImageViewerProvider`/`useImageViewer`/`isImageUrl`. Holds one `ViewerImage|null`, mounts `LazyImageViewer key={src}`. |
| `src/components/ImageViewer.tsx` | Full-screen zoom/pan/rotate/1:1/download viewer. |
| `src/lib/asciiTabViewer.tsx` | `AsciiTabViewerProvider`/`useAsciiTabViewer` — same shape as image viewer. |
| `src/lib/asciiTab.ts` | Tab detection (`isAsciiTabUrl` = `.txt`), lossless decode/parse → immutable `TabDocument` (grid-authoritative, unbounded `documentCache`). |
| `src/components/AsciiTabViewer.tsx` | SVG "score" + raw fallback + zoom + approximate playback. |

### Browse UI & shared atoms
| File | Role |
|---|---|
| `src/components/CharacterGrid.tsx` | `AnimatePresence mode="popLayout"` grid; native cards, ornate divider, dimmed foreign cards. |
| `src/components/CharacterCard.tsx` | Pointer-tilt 3D card (own effect — **not** `.fx-curl`), glare/shine, rank stars, foreign flag chips, preloads codex on intent. |
| `src/components/SearchBar.tsx` | Search input + type/country facet chips; audio feedback; `aria-live` count. **No debounce.** |
| `src/components/AnimatedTitle.tsx` · `Background.tsx` · `SiteFooter.tsx` | Title letter-reveal (`useReducedMotion`); static memoized backdrop; colophon w/ **placeholder** nav sections. |
| `src/components/LanguageMenu.tsx` | Dropdown (variants `header`/`codex`); capture-phase Escape so it closes before the codex. |
| `src/components/OrnateFrame.tsx` | `CornerOrnament`, `Divider`, `RankStars` SVG atoms. |
| `src/components/Flag.tsx` · `CountryFlag.tsx` | Flags by **UI language** (10) vs by **ISO country** (~25 + `hasCountryFlag`) — two separate hand-drawn SVG sets (see [15](15-app-critique.md)). |
| `src/components/CurlFrame.tsx` · `lib/placeholder.ts` | Lifted-Curl image frame (`.fx-curl`); deterministic SVG portrait placeholder. |

### Codex modal
| File | Role |
|---|---|
| `src/components/codex/CodexModal.tsx` | **45 lines**: picks the view from `record.biography` and wires the shell. Nothing else. |
| `.../CodexShell.tsx` | All the chrome — backdrop, 3D page-turn panel, corner filigree, close/prev/next, per-entry `contentLang` menu, the reading pane, the closing line, Esc/← →. Knows nothing of dossiers or tabs. Pane is `absolute inset-[11px]` (keeps the scrollbar inside the border — invariant); resets scroll on `[slug, contentLang]`. |
| `.../codexScroll.ts` | One-value context so `CodexTabs` (two levels down) can reset the shell's pane without a threaded ref. |
| `.../CodexHeader.tsx` | `{kicker?, title, secondary?, subtitleParts}` → kicker · h1 (+ optional h2) · subtitle · ❦. **Both modes use it — the difference is data, not a branch.** Derives the long-title (roster) type scale itself. |
| `.../CodexTabs.tsx` | The tab strip + `CodexTab` type. Switching plays the page-turn and scrolls the pane to the top. |
| `.../CodexArticle.tsx` | The article body + its "not written yet" fallback — shared by the Biography tab and the whole of a page. |
| `.../BiographyView.tsx` | Dossier header (name from the **edition being read**) + tabs + the tab switch. |
| `.../PageView.tsx` | Header + article. No tab bar, no empty dossier rows. |
| `.../useCodexEntry.ts` | `contentLang` state (follows the UI language) + `loadEntry` → `bundle`. |
| `.../tabs/GalleryTab.tsx` | `media.photos` (CurlFrame) + `media.music` (AudioPlayer/tab) + procedural `ThemeRow`. |
| `.../tabs/DocumentsTab.tsx` | `documents[]` rows (image/tab/link) + source row. |
| `.../tabs/LoreTab.tsx` | Metadata dossier (absent value → absent row); `type`/`gender`/`country` from the **index row**, country as a **flag**, gender as a **♂/♀** glyph. |

### Config
`vite.config.ts` (`base=DEPLOY_BASE??"/"`, `publicDir=../pages`, `legacyArchive()` dev plugin, vendor `manualChunks`) · `vite/legacy-archive.ts` (dev-only: publicDir miss → fetch from abc-guitars.com → stream back same-origin) · `tsconfig.json` (strict, `noUnusedLocals/Parameters`, `@/*`→`src/*`, `verbatimModuleSyntax`) · `package.json` (scripts: dev/build/build:fable/preview — **no test/lint**).

## Control & data flow

1. **Boot** → `main.tsx` mounts providers → `App`. `useCatalog(lang)` resolves `Promise.all([loadIndex(), loadNames(lang)])` → `buildCatalog` → one `Catalog`. **Exactly two requests** (`/index.json`, `/index-<lang>.json`); dossiers stay lazy until a codex opens. `useAudioUnlock` arms a one-shot gesture listener.
2. **Search/filter** → `SearchBar` updates `query` in `App`; `useDeferredValue` hands the *deferred* value to the search so typing keeps its own frame (grid dims to `opacity-60` while stale). `docs = buildSearchIndex(catalog.listed, catalog.names)` (memo). `searchEntries` filters → scores → sorts → `App` splits into native/foreign by `d.record.langs.includes(lang)` (relevance order survives the split) and maps to plain `CatalogRecord[]` → `CharacterGrid` renders with the divider at `nativeCount`. **The grid does not know `search.ts` exists.**
3. **Open codex** → card click (`CharacterCard`) → `audio.unlock()`, `preloadCodexModal()`, `loadEntry(entry,pickContentLang(...))`, `onSelect(slug)` → `App.openEntry` sets `#/slug` → `useHashRoute` state → `LazyCodexModal` mounts. Deep link `#/slug` on load opens it directly. ← → = `turnPage` over the current filtered order.
4. **Codex** → `useCodexEntry` → `bundle`; `record.biography` picks `BiographyView` (header + 4 tabs) or `PageView` (header + article). Switching the per-entry `contentLang` refetches that edition (cached per slug::lang → instant re-switch) and **re-titles the header**, because dossiers are per-language editions.
5. **Viewers** → any image/tab link or figure calls `useImageViewer()`/`useAsciiTabViewer()` → provider holds the target, lazily mounts the overlay `key={src}` (remount resets its state — don't optimize the key away).
6. **Audio** → interactions call `audio.hover/click/pageTurn/open/close`. Content playback (`AudioPlayer`, tab preview, theme) goes through the single-active coordinator so only one *content* source sounds at once; **ambient + SFX intentionally overlap content, and the mute toggle governs only the procedural engine** (see [15](15-app-critique.md)).

## Component relationships (mermaid)

```mermaid
graph TD
  App --> SearchBar & CharacterGrid & LazyCodexModal & Background & AnimatedTitle & SiteFooter & LanguageMenu
  App -->|useCatalog/useHashRoute| catalog[catalog.ts] --> paths[paths.ts]
  catalog --> entry[entry.ts] & names[names.ts]
  App -->|search| search[search.ts] --> names
  CharacterGrid --> CharacterCard --> Flag
  LazyCodexModal --> CodexModal --> CodexShell & BiographyView & PageView
  BiographyView --> CodexHeader & CodexTabs & CodexArticle & GalleryTab & DocumentsTab & LoreTab
  PageView --> CodexHeader & CodexArticle
  CodexArticle --> BioArticle --> parse[parse.ts] & imageViewer & asciiTabViewer & AudioPlayer & CurlFrame
  GalleryTab --> AudioPlayer & CurlFrame & imageViewer & asciiTabViewer
  LoreTab --> CountryFlag & metadata[metadata.ts]
  AudioPlayer --> playback[playback.ts] --> midi[midi.ts]
  asciiTabViewer --> AsciiTabViewer --> asciiTab[asciiTab.ts] & asciiTabPlayback
  playback --> audio[audio.ts]
  asciiTabPlayback --> audio & playback
  subgraph providers[main.tsx providers]
    I18nProvider --- ImageViewerProvider --- AsciiTabViewerProvider
  end
```
