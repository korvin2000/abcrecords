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
App.tsx   ─ single orchestrator: catalog load, search criteria, facts crawl gate, hash route, audio toggles, body scroll-lock, codex mount
  ├─ Feature switches     config.ts  (FEATURES · DOSSIER · HERALD — one place to turn a feature off/tune it)
  ├─ Data/content layer   catalog.ts · paths.ts · types.ts · metadata.ts · languages.ts · hooks.ts · dismiss.ts
  ├─ Search + i18n        search/{fold,docs,scoring,criteria,predicates,engine} · i18n.tsx · messages/* · languages.ts
  ├─ Dossier facts        dossier/{facts.ts, factsStore.ts, useFacts.ts}  (cross-entry *.bio.json metadata)
  ├─ Herald               herald/{types, today, anniversary, quotes, playlist, useHerald}
  ├─ BioMD render         biomd/{parse.ts, remarkHighlight.ts, remarkZeroPaddedLists.ts, BioArticle.tsx}
  ├─ Audio                audio.ts · playback.ts · midi.ts · asciiTabPlayback.ts · AudioPlayer.tsx
  ├─ Overlays (viewers)   imageViewer.tsx+ImageViewer.tsx · asciiTabViewer.tsx+AsciiTabViewer.tsx · asciiTab.ts
  ├─ Browse UI            CharacterGrid · CharacterCard · AnimatedTitle · Background · SiteFooter · LanguageMenu
  │                       search/{SearchBar, AdvancedSearchPanel, AdvancedToggle, DossierProgress}
  │                       herald/{HeraldBanner, HeraldFrame, HeraldMessageView, AnniversaryLine, QuoteLine, tones}
  ├─ Form atoms           form/{Field, TextField, SelectField, TokenSelect, SegmentedControl, Chip, ChipGroup, YearRangeField}
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
| `src/App.tsx` | The one orchestrator. Owns: the single `SearchCriteria` value (+ `useDeferredValue`) and its `compile()`, the `useFacts` gate, `useCatalog`, `useHashRoute`, `useAudioUnlock`, sound/ambient toggles, **body scroll-lock (single owner — do not move to the modal)**, facets (sorted by *label* with `Intl.Collator`), native/foreign result split + `nativeCount`, `turnPage` (← →), `openLinkedEntry(slug)` (cross-entry links, already classified by `BioArticle`), footer section links. Browse UI reads `catalog.listed`; routing reads `catalog.bySlug` (**all** records, so hidden pages stay reachable). Mounts `LazyCodexModal` under `Suspense`+`AnimatePresence`. |
| `src/index.css` | Tailwind v4 `@theme` tokens + all semantic CSS (`.parchment`, `.ornate-border`, `.btn-rpg`, `.bio-article`, `.fx-curl`, `.search-panel`, `.form-*`, `.herald*`, footer chrome, keyframes). **~1100 lines, unlayered → beats Tailwind utilities (footgun).** |
| `index.html` | Static shell, `lang="ru"`, inline "Кодекс открывается…" fallback, ❧ emoji-SVG favicon. No SSR. |

### Data / content layer
| File | Role |
|---|---|
| `src/lib/catalog.ts` | **The catalogue**, in two halves. *Read model:* `CatalogRecord {entry,id,slug,langs,listed,biography,display}`, `Catalog {records,listed,bySlug,names}`, pure `buildCatalog(entries,names)`, `EMPTY_CATALOG`. *I/O + cache:* `loadIndex()` (validates & **normalizes case once at the boundary**; drops rows with no `id`/`md`; duplicate id/slug → DEV warn, first wins; rejection is not cached so retry works), `loadNames(lang)` (per-lang, missing file → `{}`, never throws), `loadEntryData(entry,lang)` (**dossier only, no article** — what the facts crawl uses) and `loadEntry(entry,lang)` (per-`slug::lang`, dossier + article; **skips the JSON fetch when `json` is absent** — a page makes no speculative request). Four module-level **promise** caches. |
| `src/lib/entry.ts` | Pure per-entry facts: `slugOf` (md basename), `isBiography` (`json` declared), `isListed` (`type !== "hidden"`), `portraitPath` (img → `photos/default-<gender>.svg`), `initialsFrom` (code-point safe), `entryTargetSlug` (**the one** in-app link classifier: `#/slug`, `/#/slug`, `x.bio.md`, `x.md`), `SLUG_PATTERN`, `decodeSlug`. **All visibility/biography branching goes through these predicates.** |
| `src/lib/names.ts` | `displayName(names,id,fallback)` / `aliasesOf(names,id)` over an `index-<lang>.json`. `[0]` renders, `[1…]` are search-only. |
| `src/lib/paths.ts` | **Two independent bases**: `APP_BASE`(`import.meta.env.BASE_URL`) for index.json + its json/md/img via `resolveContentPath`; `RESOURCE_BASE_PATH`(`VITE_RESOURCE_BASE_PATH ?? "/pages"`) for in-entry media/docs via `resolveResourcePath`. The latter is one pipeline: strip `?#` suffix → detect `^` anchor → `basePrefix` (skip base if anchored or already spelled out) → `collapse` `.`/`..` clamped at the root → rejoin. `localizeContentPath` (json/md only), `isExternalUrl`. (`slugOf` moved to `entry.ts` — it is about entries, not paths.) |
| `src/lib/types.ts` | `IndexEntry` (v2 row: `id`/`title`/`type`/`md` required, `lang`/`gender`/`country`/`json`/`img` optional; `country` UPPERCASE, other enums lowercase after normalization), `Gender`, `NameIndex`, `EntryMeta` (dossier — **no** id/title/gender/type/country/bio), `EntryData`, `EntryBundle`, `MediaItem`, `DocumentItem`. |
| `src/lib/metadata.ts` | DMY dates (`parseDmy`/`formatDmy`/`yearOf`/`ageOf` — **never `new Date(str)`**), `splitList`, `countryName(iso,locale)` (case-insensitive; one cached `Intl.DisplayNames` per locale), `rankStars`, `fnv1a`, `accentFor`. |
| `src/lib/languages.ts` | `LANGUAGES` (curated order, `ru` 8th), `Lang`, `DEFAULT_LANG="ru"`, `entryLangs`/`parseLangList`/`pickContentLang`, `langInfo`. |
| `src/lib/hooks.ts` | `useAudioUnlock` (gesture unlock), `useCatalog(lang)` → `{state,retry}` resolving `[loadIndex, loadNames]` into one `Catalog` (**keeps the loaded catalogue on screen across a language switch** — no skeleton flash), `useHashRoute` (`#/slug`; `SLUG_PATTERN` allows dots + `decodeURIComponent`). |
| `src/lib/dismiss.ts` | `useDismissOnOutside(open, onDismiss)` → the ref for the element owning **both** trigger and panel. Escape is **capture-phase + `stopPropagation`** so the innermost layer closes first. Shared by `LanguageMenu` and the search panel — the one light-dismiss implementation. |
| `src/config.ts` | `FEATURES` (`advancedSearch`, `herald`) · `DOSSIER` (`warmOnIdle`, `concurrency`, `notifyThrottleMs`) · `HERALD` (`revealDelayMs` range, `rotateMs`, `anniversaries`, `quotes`). Typed as plain `boolean`/`number` on purpose, so flipping a flag never narrows into dead code. |

### Dossier facts index (cross-entry `*.bio.json` metadata)
| File | Role |
|---|---|
| `src/lib/dossier/facts.ts` | `EntryFacts` — the searchable slice of one dossier edition (`forenameKey`/`surnameKey` **folded at build time**, `born`/`died` as `Dmy`, plus slug/display/gender from the index row). Pure `factsFrom(record, data)`; `emptyFacts`; `NO_FACTS` (the stable empty map). |
| `src/lib/dossier/factsStore.ts` | `FactsIndex` — the **one** crawl of every listed entry's dossier, at module scope so it outlives any component and happens at most once per (catalogue, language). `start()` idempotent; `DOSSIER.concurrency` workers draining a shared cursor; `whenIdle()` between entries (`requestIdleCallback`, `timeout: 400`); `commit()` publishes a **fresh Map** per notification (so `useMemo` deps behave) and throttles intermediate ones (`done` always lands at once). `factsIndexFor(records, lang)` registry keyed by lang, stale index `dispose()`d. Reads via `loadEntryData` ⇒ **never fetches article text** and shares the codex's per-path cache. |
| `src/lib/dossier/useFacts.ts` | `useFacts(records, lang, enabled)` over `useSyncExternalStore`. `enabled` false ⇒ the empty snapshot and **zero requests**; callers need no null handling. |

### Herald (the dynamic line under the title)
| File | Role |
|---|---|
| `src/lib/herald/types.ts` | Closed union `HeraldMessage` = `default | anniversary | quote`, each carrying its own `tone`; `DEFAULT_MESSAGE`; `messageKey` (animation key — messages are rebuilt on every language switch, so identity is not a key). |
| `src/lib/herald/today.ts` | `todayDmy()` — a `Dmy`, never a `Date`, because everything it is compared against is `DD.MM.YYYY`. **DEV-only** `?herald-date=DD.MM.YYYY` pins the day for QA. |
| `src/lib/herald/anniversary.ts` | Pure `findAnniversaries(facts, today)` — day+month match, `years ≥ 1`, **births take precedence over deaths** (if anyone was born today the deaths are not mentioned), older anniversary first. Re-runs for free as facts stream in. |
| `src/lib/herald/quotes.ts` | `loadQuotes(lang)` → `pages/quotes/quote-<lang>.json`, cached per language, fails soft, **no cross-language fallback** by design. |
| `src/lib/herald/playlist.ts` | `buildPlaylist(anniversaries, quotes, quoteOffset)` — alternates the two pools (the shorter repeats), or cycles the one that is filled; empty when there is nothing to say. `quoteOffset` is chosen by the caller, so this stays pure. |
| `src/lib/herald/useHerald.ts` | Scheduling only. `index: number | null` (null = the default line); reveal uses an **absolute deadline** so streaming dossiers cannot keep postponing it; the rotation effect depends on `playlist.length`, not the array, so a rebuilt-but-same-length playlist does not restart the clock; **no timer at all** when there is ≤ 1 thing to say. |

### BioMD parser / renderer
| File | Role |
|---|---|
| `src/lib/biomd/parse.ts` | Recursive-descent `::: block` fence parser over line-segmented text → `BioDoc {title,nodes,warnings}` (spec v1.6). **The whole grammar is one table, `BLOCKS`**: per directive — documented `props`, `leaf?`, `rejects?` (child kinds refused, spec §4.1) and `build(ctx)`; adding a directive = adding one entry. Node kinds: `markdown·lead·align·image·images·document·columns·nav·frame·signature·anchor·unknown`. Tolerant by construction: unknown block/property, stray child, unclosed fence and **misplaced** directive all keep their readable content (`readableContent` unwraps it) + warn — only a `key: value` line whose key the block *declares* is eaten as a property, so prose can never be swallowed. The one-line `:: anchor{#name}` is desugared by `segment()` into an ordinary `anchor` block, so the table stays the only grammar; and because an anchor has no box, `columns` binds a stray one to the next cell and `images` to the next picture (`ImageNode.anchor`) rather than letting it claim a grid track. |
| `src/lib/biomd/anchors.ts` | The `::: anchor` ↔ `[…](#name)` id contract (spec §19): `anchorName` (canonical name), `anchorElementId` (the `bio-anchor-` namespace, so an id taken from content cannot collide with one the app owns), `anchorLinkTarget` (`#name` yes, `#/slug` no — that one is `entryTargetSlug`'s), and `scrollToAnchor(name, from)` — resolved inside `from`'s own `.bio-article`, `prefers-reduced-motion`-aware, and **never touching the hash**. |
| `src/lib/biomd/remarkHighlight.ts` | remark plugin: `==text==` → `<mark>` via mdast `data.hName`. Can't span lines / contain `=`. |
| `src/lib/biomd/remarkVerse.ts` | remark plugin (spec 3.9): a fence with **no** info string is verse, not code → a `.bio-verse` div of `<p>` stanzas with `<br>` lineation, so it wraps inside the reading column instead of scrolling sideways; an empty fence is dropped; a fence *with* a language stays a `<pre>`. Runs last in the plugin list, so fenced text stays literal. |
| `src/lib/biomd/remarkZeroPaddedLists.ts` | remark plugin (spec 3.4): an ordered list whose *source* marker is `01.` gets `class="bio-ol-zero"` → CSS `decimal-leading-zero`. remark normalises `01`→1, so the padding is read back from the first item's source offset. |
| `src/lib/biomd/BioArticle.tsx` | react-markdown (GFM + highlight) renderer + **link-rewiring hub** — in-app entry (`entryTargetSlug`: `#/slug`, `x.bio.md`, `x.md`) → `onNavigateEntry(slug)`, `#name`→a `.bio-jump` **button** (never an `<a>`: the hash is the router) that scrolls to that anchor, audio→player, .txt→tab viewer, image→zoom viewer, external→new tab, else archival. Renders `Figure`/`images`/`DocumentCard`/`BioNav`. Wraps images in `CurlFrame` (optional `frame` variant). `Md`'s optional `nav` prop = nav mode: suppresses media widgets, renders the `active` label — or a plain-text item (spec 1.5) — as `aria-current`. Also renders `frame`/`signature`/`columns` (`.bio-columns` + `bio-cols-N` + `--divided`, grid owned by CSS — no grid utilities on it) and `mode: embed` (lazy PDF `<iframe>` + the link card as fallback). |

### Search & i18n
| File | Role |
|---|---|
| `src/lib/search/` | Ranked client-side search, split **by what each step depends on**. `fold.ts` — `fold` (Latin-only diacritic strip, `ё→е`), `translitVariants` (capped 64), `isAscii`, `CYRILLIC`. Also used by `dossier/facts.ts`, so there is one folding rule in the app. `docs.ts` — **corpus-side, once per catalogue + UI language:** `buildSearchIndex(records, names)` → `SearchDoc{record, fields}`; each `Field{text (folded), weight 3 name / 2 alias / 1 latin-title-or-slug, latin}`, deduped keeping the highest weight. `scoring.ts` — **query-side, once per query:** `tokenize` (fold + translit only for Cyrillic tokens); **per doc** `matchScore` — one `indexOf` yields exact 100 / prefix 70 / word-start 50 / contains 25; transliterations score 10 and only against `latin` fields; token score = best field hit × weight, **AND across tokens**, summed. Measured **0.398 ms/query at 1249 docs** — why there is no inverted index. |
| `src/lib/search/criteria.ts` | `SearchCriteria` = the whole form in one value (`query`, `types`, `countries`, `gender`, `scope`, `forename`, `surname`, `born`/`died` year ranges as **typed strings**) and `compile()` → `CompiledCriteria` (folded terms, parsed bounds, "unset" collapsed to `null`, `needsDossier`). `compile` is the one boundary between them, so **a new criterion is three edits: the interface, `compile`, one predicate**. Also `EMPTY_CRITERIA`, `toggleValue`, `refinementCount` (counts *fields*, not values), `withoutRefinements` (keeps the query). Reversed year ranges are read the way they were meant. |
| `src/lib/search/predicates.ts` · `engine.ts` | `matchesIndex` (index.json only — free) vs `matchesDossier` (needs that entry's `*.bio.json`). `searchEntries` runs index filters → dossier filters (**only when `needsDossier`**) → relevance, cheapest first. **An unread dossier excludes**, so a result list is never wider than the evidence; the crawl streams in and the list grows towards the truth. |
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
| `src/components/search/SearchBar.tsx` | The loupe + name box, the quick facet chips, and the handle to the refinement panel. Owns **one** piece of state (is the panel open); every criterion lives in `App`, so the chips and the panel are two views of one value. `aria-live` count. **No debounce** — `useDeferredValue` in `App` does that job. |
| `.../search/AdvancedSearchPanel.tsx` | The refinement leaf: language scope · gender · craft · country · given/family name · birth & death year ranges. **Controlled and stateless** — every control reports a `Partial<SearchCriteria>` patch. Reading order = coarsest sieve to finest = the order the engine applies them. |
| `.../search/AdvancedToggle.tsx` · `DossierProgress.tsx` | Disclosure button (`aria-expanded`/`aria-controls`) with the refinement-count badge — with the panel shut, the badge is the only sign something other than the name is narrowing results. `DossierProgress` says *why* the list is still settling instead of blocking the page. |
| `src/components/form/*` | Codex-themed atoms: `Field` (label + control + hint), `TextField`, `SelectField` (native `<select>`, only the closed control restyled), `TokenSelect` (chosen values as removable tokens + a picker of the rest — the shape that survives 100 countries), `SegmentedControl` (radiogroup), `Chip`/`ChipGroup`, `YearRangeField`. |
| `src/components/herald/*` | `HeraldBanner` (the `useHerald` + `AnimatePresence mode="wait"` crossfade), `HeraldFrame` (tone-tinted plaque + `CornerOrnament`s), `HeraldMessageView` (the union's only exhaustive switch), `AnniversaryLine` (gender picks the **whole sentence**; `{name}` is spliced in as a node so the line can lead into the codex), `QuoteLine`, `tones.ts` (the static tone table: frame class, accent, glyph pair, label key, text classes). |
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

1. **Boot** → `main.tsx` mounts providers → `App`. `useCatalog(lang)` resolves `Promise.all([loadIndex(), loadNames(lang)])` → `buildCatalog` → one `Catalog`. **Exactly two requests up front** (`/index.json`, `/index-<lang>.json`); article Markdown stays lazy until a codex opens, and dossier JSON is read in the background by the facts crawl (step 3). `useAudioUnlock` arms a one-shot gesture listener.
2. **Search/filter** → `SearchBar` (and the panel inside it) reports a `Partial<SearchCriteria>` patch; `App` holds the one `criteria` value. `useDeferredValue(criteria)` hands the *deferred* value to `compile()` so typing keeps its own frame (grid dims to `opacity-60` while stale). `docs = buildSearchIndex(catalog.listed, catalog.names)` (memo). `searchEntries(docs, compiled, {lang, facts})` filters → scores → sorts → `App` splits into native/foreign by `d.record.langs.includes(lang)` (relevance order survives the split) and maps to plain `CatalogRecord[]` → `CharacterGrid` renders with the divider at `nativeCount`. **The grid does not know the search exists.**
   `App` passes `NO_FACTS` unless `compiled.needsDossier`, so the streaming facts map cannot re-run the search on every batch.
3. **Dossier crawl** → `useFacts(catalog.listed, lang, enabled)` where `enabled = (herald wants anniversaries && DOSSIER.warmOnIdle) || compiled.needsDossier`. The store crawls at idle with bounded concurrency, reusing `loadEntryData`'s cache. **Both** the herald's "on this day" lookup and name/year search read that one crawl.
4. **Herald** → `useHerald(facts.bySlug, lang, FEATURES.herald)` → default line → (5–10 s) an anniversary or a saying → every 30 s the next message. Clicking an anniversary calls `App.openEntry(slug)`.
5. **Open codex** → card click (`CharacterCard`) → `audio.unlock()`, `preloadCodexModal()`, `loadEntry(entry,pickContentLang(...))`, `onSelect(slug)` → `App.openEntry` sets `#/slug` → `useHashRoute` state → `LazyCodexModal` mounts. Deep link `#/slug` on load opens it directly. ← → = `turnPage` over the current filtered order.
6. **Codex** → `useCodexEntry` → `bundle`; `record.biography` picks `BiographyView` (header + 4 tabs) or `PageView` (header + article). Switching the per-entry `contentLang` refetches that edition (cached per slug::lang → instant re-switch) and **re-titles the header**, because dossiers are per-language editions.
7. **Viewers** → any image/tab link or figure calls `useImageViewer()`/`useAsciiTabViewer()` → provider holds the target, lazily mounts the overlay `key={src}` (remount resets its state — don't optimize the key away).
8. **Audio** → interactions call `audio.hover/click/pageTurn/open/close`. Content playback (`AudioPlayer`, tab preview, theme) goes through the single-active coordinator so only one *content* source sounds at once; **ambient + SFX intentionally overlap content, and the mute toggle governs only the procedural engine** (see [15](15-app-critique.md)).

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
