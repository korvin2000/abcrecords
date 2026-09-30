# Performance Analysis & Improvement Plan — `apps/guitar-codex`

> Audit date: 2026-09-30 · Code state: `main` @ `4eec1d5` · Scope: the host app
> only (`apps/guitar-codex/`); the two feature packages are touched only where
> the host pays for them.
>
> Purpose: a working document for optimizing the app for **low-power tablets,
> slow PCs and Android phones**, and for fixing the PDF viewer on Android.
> Every finding carries an evidence tag:
>
> | Tag | Meaning |
> |---|---|
> | **[reproduced]** | Failure reproduced in a browser during this audit |
> | **[measured]** | Number taken from the running app or the deployed site |
> | **[code]** | Established by reading the code path; not timed |
> | **[estimate]** | Arithmetic or engineering judgement; verify on a device |

---

## 1. Executive summary

| # | Finding | Impact | Evidence | Fix effort |
|---|---|---|---|---|
| **P0-1** | pdf.js 5.7 *modern* build needs Chromium ≥ 145 / Safari ≥ 26.2. Older engines cannot open any PDF. **This — not file size — is the Android "document could not be opened" bug.** | PDF viewer dead on most non-current mobile browsers | reproduced | S (switch to the `legacy/` build) |
| **P0-2** | An open PDF re-renders the whole page list ~60×/s forever (ref-callback ↔ IntersectionObserver feedback loop) | Main thread saturated while reading; starves pdf.js painting | measured | S |
| **P1-1** | PDF memory: 6–7 pages render concurrently, whole file auto-fetched (up to 63 MB), canvases not released eagerly, double buffer on zoom | Tab kills / reloads on 2–4 GB phones | code + estimate | M |
| **P1-2** | No low-power *paint* profile: `backdrop-filter` ×2 on the home page and on every overlay, per-card `filter: blur()` + `mix-blend-mode`, blur inside the 3D page-turn. The capability tier only thins the drifting glyphs | Scroll and modal-open jank on weak GPUs | measured (counts) + code | M |
| **P1-3** | 736 `*.bio.json` requests on every first page view (dossier crawl warms on idle) | Network, radio, battery; ~1 render of `App` per 500 ms while it runs | measured | S–M (one PHP aggregator replaces them with a single 18 KB response — §10) |
| **P1-4** | Server: JSON/Markdown served uncompressed, no `Cache-Control` anywhere | +270 KB on first load; revalidation storms | measured | S (server config) |
| **P2-1** | 12 infinite animations + two JS-driven ones keep the compositor and main thread awake on an idle home page | Constant GPU/CPU load, heat, throttling | measured | S |
| **P2-2** | Codex open = blur + 3D turn on a near-full-screen layer, over a full-viewport backdrop blur, while Markdown parses synchronously | The worst single frame-drop moment | code | S–M |
| **P2-3** | All 11 UI dictionaries (135 KB source) ship in the entry chunk | Slower first load/parse | measured | S |
| **P2-4** | `App` re-renders everything un-memoized on every keystroke and every crawl tick | Typing latency on slow CPUs | code | S |
| **P3** | Audio context never suspends; 25 ms scheduler timers; convolver reverb; forced layouts in glyph measuring; per-move React state in the image viewer | Minor, additive | code | S each |

Two side findings that are not performance but will waste testing time:

- **`pages/index.json` in the repo says `magazines/…`; the deployed index and
  the server say `magazine/…`** (the repo paths return 404 on
  `www.abc-guitars.com`). `docs/Catalog-Index.md` also says `magazine/`.
- **In `npm run dev` a missing PDF returns `200 text/html`** (Vite's SPA
  fallback), so a wrong path shows the very same "could not be opened" message
  as the engine bug. Check the Network tab before concluding anything.

---

## 1a. Implementation status (2026-09-30)

Everything below was implemented in one change set after the audit. The rest of
this document is kept as written — it describes the state *before* — so read a
finding together with its row here. Setting up the server side is walked
through in [`server-setup-guide.md`](server-setup-guide.md).

| Item | Status | Where / note |
|---|---|---|
| **P0-1** legacy pdf.js | done | `lib/pdf/engine.ts` (the one importer again), `vite.config.ts` manualChunks, `pdfjs-dist` pinned to `5.7.284`, `scripts/verify-pdf-build.mjs` in `npm run verify`. **Re-tested:** with `toHex`, `getOrInsertComputed`, `sumPrecise` and `Promise.try` deleted in both realms before load, the document opens and paints |
| Diagnosable failures | done | reason shown under the message; `lib/diagnostics.ts` (`console.error` + optional report); `try/catch` around `getDocument`; 25 s watchdog; per-page "could not be drawn — retry"; "Open in the browser" |
| **P0-2** render loop | done | memoized `PdfPage`, stable ref, set published only on change. **Measured:** 0 `observe()` calls while idle (was ~5 800/s) |
| M-1 frugal loading | done | `frugal` = not `high`, or touch-only: `disableAutoFetch` + `disableStream`, 256 KB ranges. Not exercised against a range-capable server (the dev proxy has none) |
| M-2 window + queue | done | `PDF.renderMargin` (fraction of the pane), `lib/pdf/queue.ts` |
| M-3 dwell | done | `PDF.dwellMs` = 120 |
| M-4 canvas release | done | verified: a page left behind is `0×0` |
| M-5 double buffer | done | only for the page being read |
| M-6 canvas budget | done | `PDF.canvasPixels`, `PDF.maxDpr`, `PDF.maxScaleTouch` |
| M-7 text layer | done | current page only; built unasked for a mouse on `mid`/`high`, and on a long press (or the context-menu gesture) on `low` and on touch-only devices. Verified on a pinned `low` grade: 0 spans before the gesture, 64 after |
| M-8 page 1 first | done | and the scale is now derived during render, not chased by an effect |
| M-9 image ceiling | done | `canvasMaxAreaInBytes` below `high`; `maxImageSize` left alone |
| M-10 recompress scans | **not done** | content on the server. Instead: §10.5 is implemented — `npm run prerender:pdf` + the image reader (`PdfImageView`, `lib/pdf/pages.ts`), which also keeps the engine chunk from loading |
| §4.3 paint profile | done | `data-perf` / `data-fx` / `data-lite` from `lib/fx/store.ts`; `styles/perf.css`; a *deliberate* ✨ off = lite (a switch that is off only because the system asks for reduced motion stops what moves and keeps the static finish); touch + ≤ 4 GB starts `low` |
| R-1 backdrop-filter | done | scrims: no blur, opacity 0.7. Top bar and search box: blur only on `high` with ornaments on. Panel, language menu, image viewer: removed |
| R-2 cards | done | `mid` no blur; lite no filter, no blend |
| R-3 page turn | done | blur removed everywhere; below `high` a fade-and-rise |
| R-4 herald halo | done | opacity of a dedicated layer |
| R-5 ornaments | done | `low` defaults the switch to off; the two framer loops are CSS. Hidden tabs need no code — browsers already stop CSS animations there |
| R-6 title | done | CSS; blur only on `high`. The per-letter drop-shadow was never visible (the animated filter replaced it) and is removed, not merged |
| R-7, R-8, R-10 | done | `base.css`, `perf.css` |
| R-9 | no action | as analysed |
| N-1 crawl | done | 3 s warm-up delay; no idle crawl on `low` / Save-Data / 2g–3g; 3 sockets below `high`; `facts.php` asked first. **Measured in dev on `low`:** 0 dossier requests at idle |
| N-2, N-3 server headers | **files only** | `assets/.htaccess` and `pdfjs/.htaccess` are emitted by the build; the root block (`server/htaccess/root.htaccess`) must be merged by hand. Nothing was changed on the live server |
| N-4 dictionaries | done | `ru` + `en` static, nine lazy. Entry chunk 235 → 150 KB raw |
| N-5 render scope | done | `memo` on `AnimatedTitle`, `CharacterGrid`, `SiteFooter`, `HeraldBanner`; stable `canOpen` |
| N-6 article | done | deferred render behind a skeleton below `high` |
| N-7 framer-motion | done | the library is removed from the app altogether, not just from the entry. Fades, rises and pops are CSS (`styles/motion.css` and the owning stylesheets); `lib/motion.ts` supplies the two things CSS cannot (`useLinger` — stay mounted through an exit; `useReducedMotion`); the card tilt is a hand-integrated spring with the same stiffness/damping/mass (`lib/spring.ts`, `lib/tilt.ts`) that runs a frame loop only while moving. Checked in the browser: tilt converges and clears, menu/panel/viewer exits linger and unmount, Escape still closes the innermost layer only |
| N-8, C-1, C-2, C-3 audio | done | `lib/audio.ts`; not verified by ear. The MIDI and tablature players keep their own contexts, which still do not idle-suspend |
| N-9 glyph probes | done | one contained probe root |
| N-10 fonts | done | two faces preloaded by script at entry (`lib/fontPreload.ts`) |
| C-4, C-5, C-7 | done | rAF-coalesced pan; tablature LRU (12); `GRID.lowPageSize` |
| Independent review | done | two passes. A five-area review with an adversarial verifier per area, run on the final tree before committing, confirmed seventeen more (one refuted): most are fixed in the same change set — a tap closing the image viewer falling through to the codex, a manifest timeout cached for the session, arrow keys reaching the codex behind a PDF that is still loading, the text layer deleting a selection mid-drag, reduced motion silently selecting the lite paint profile, `AddOutputFilterByType` guarded by the wrong module. Before it, a second-opinion review (Codex) of the change set found twelve defects — among them a watchdog that would have closed an open document after 25 quiet seconds, a render slot a stalled request could hold for ever, and a lost search demand. All twelve are fixed; pdf.js runtime data moved under `pdfjs/<version>/` as one of them |
| §10 PHP layer | **written, not run** | `server/facts.php`, `server/log.php`, `server/README.md`. No PHP binary was available — run both `?a=selftest` on the host before relying on them |
| §8 budgets | done | `verify-pdf-build.mjs`: legacy worker byte-identical, polyfills present, `.htaccess` emitted, entry ≤ 115 KB gzip (measured 109.3; it was ~150 before the audit). The budget already caught one regression during this work: with the animation chunk gone, Rollup filed React under the Markdown chunk and the entry began importing it — `manualChunks` now assigns per package |

Still to do by hand: §9 (real devices), merging the root `.htaccess`, uploading
and self-testing the two PHP scripts, and pre-rendering the four large issues.

---

## 2. How this was measured

- Static read of the PDF stack, `App.tsx`, grid/card, codex shell, fx tier,
  dossier crawl, audio engine and all 16 stylesheets.
- The dev server driven in Chromium 152 (12 cores, DPR 2, 562 px viewport):
  animation/filter census, request counts, long tasks, and an instrumented
  `IntersectionObserver.prototype.observe`.
- Older engines were **simulated by deleting the missing built-ins** in the
  worker realm (and the page realm where relevant) before pdf.js loaded — no
  old device was available. The failure modes below are therefore exact for the
  API gap, but timings on real hardware still need a device pass (§9).
- The deployed site (`https://www.abc-guitars.com/`) was probed with `HEAD`
  requests for headers, sizes and MIME types.
- Browser support versions come from MDN browser-compat-data (`main`, 2026-09-30).

No real low-power device was profiled. Everything tagged **[estimate]** needs
that pass before it is treated as a number.

---

## 3. PDF viewer

Files: `src/lib/pdf/engine.ts`, `src/components/pdf/{PdfViewer,PdfPage,PdfModal,PdfToolbar}.tsx`,
`src/lib/pdfViewer.tsx`, `vite/pdfjs-assets.ts`, `vite.config.ts`.

### 3.1 P0-1 — the engine build needs a 2026 browser **[reproduced]**

`engine.ts:1-7` imports `pdfjs-dist` and `pdfjs-dist/build/pdf.worker.min.mjs?url`
— the **modern** build of pdfjs-dist **5.7.284**. `PdfPage.tsx:2-8` imports the
same package directly. The package README is explicit: *"For usage with older
browsers/environments … please see the `legacy/` folder."*

The modern build calls built-ins that shipped very recently, un-polyfilled.
Confirmed present in the deployed `assets/pdf-3Eh5914l.js` and
`assets/pdf.worker.min-iDqQPrd3.mjs`:

| Built-in | Chrome | Firefox | Safari | Where pdf.js uses it |
|---|---|---|---|---|
| `Promise.withResolvers` | 119 | 121 | 17.4 | `getDocument()` itself (main thread, synchronous) |
| `Promise.try` | 128 | 134 | 18.2 | `MessageHandler` — every main↔worker call (`pdf.worker.mjs:59426`) |
| `Uint8Array.prototype.toHex` / `fromBase64` | 140 | 133 | 18.2 | `PDFDocument.fingerprints` (`pdf.worker.mjs:58880`), awaited while opening (`:62501`) |
| `Map.prototype.getOrInsertComputed` | 145 | 144 | 26.2 | `PDFObjects` on the main thread (`pdf.mjs:14311`, `:14334`) — every font/image of every page |
| `Math.sumPrecise` | 147 | 137 | 26.2 | Font writing in the worker |

`build.target: "baseline-widely-available"` (`vite.config.ts:100`) does not help:
it lowers *syntax* in the main-thread chunk, never polyfills APIs, and the worker
is a `?url` asset copied verbatim.

Resulting behaviour, reproduced by removing the built-ins:

| Engine | What the reader sees | Reproduced |
|---|---|---|
| Chromium < 119 | `getDocument()` throws inside the effect → codex error boundary: "This entry would not open" | code |
| Chromium 119–127, Safari < 18.2 | Endless "Opening the document…" spinner (worker throws on the first request; the task never settles) | ✔ |
| **Chromium 128–139** | **"The document could not be opened"** — `toHex` is missing → `DocException` | ✔ |
| Chromium 140–144, Safari 18.2–26.1 | Document "opens": page boxes with numbers, **no page ever paints**, no message | ✔ |
| Chromium ≥ 145, Firefox ≥ 144, Safari ≥ 26.2 | Works | ✔ (control) |

Why this is "most Android phones" and not desktops: desktop Chrome
auto-updates. On Android, Chrome stopped updating on Android 7 (119) and on
Android 8/9 (138); Samsung Internet, Yandex Browser, Opera, MIUI/Huawei
browsers and in-app WebViews (Telegram, VK) all trail Chromium by months.
Anything that reports Chromium 128–139 produces exactly the reported message,
for every PDF, regardless of size.

The server is **not** the cause **[measured]**: the worker is served as
`text/javascript` (gzip), `.wasm` as `application/wasm`, PDFs with
`Accept-Ranges: bytes` and a `Content-Length`.

**Control experiment:** the *legacy* worker
(`pdfjs-dist/legacy/build/pdf.worker.min.mjs`), loaded into a worker realm with
all five built-ins deleted, opened and painted the same document.

#### Fix

1. Import the legacy build in **one** module and re-export what the viewer needs,
   so there is again exactly one importer (the header comment of `engine.ts`
   already claims this; `PdfPage.tsx` breaks it):

   ```ts
   // src/lib/pdf/engine.ts
   import {
     getDocument, GlobalWorkerOptions, RenderingCancelledException,
     setLayerDimensions, TextLayer,
   } from "pdfjs-dist/legacy/build/pdf.mjs";
   import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
   export { setLayerDimensions, TextLayer };
   export type { PDFDocumentProxy, PDFPageProxy, RenderTask, PDFDocumentLoadingTask } from "pdfjs-dist";
   ```

   `PdfPage.tsx` and `PdfViewer.tsx` then import values from `@/lib/pdf/engine`
   (type-only imports from `"pdfjs-dist"` are erased and stay harmless).
2. `vite.config.ts` `manualChunks.pdf` → `["pdfjs-dist/legacy/build/pdf.mjs"]`,
   otherwise the modern build can be pulled back in as a second copy. Verify
   with `npm run verify`, and by comparing `dist/assets/pdf.worker.min-*.mjs`
   byte-for-byte with `node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs`
   (a `?url` asset is copied verbatim). Grepping for `getOrInsertComputed(`
   proves nothing — the legacy build still calls it, after installing its own
   polyfill.
3. Pin `pdfjs-dist` to an exact version (drop the `^`): the modern build's
   browser floor moves with every minor release, silently.
4. Cost: +62 KB (main) and +54 KB (worker) raw, both in lazy chunks only.

#### Make the next failure diagnosable

- `PdfViewer.tsx:146-148` throws the rejection reason away. Keep it
  (`error.name` / `message`), show it in small print under the message, and
  `console.error` it in production — a phone screenshot then names the cause.
- Wrap `loadPdfDocument(src)` in `try/catch` (a synchronous throw currently
  escapes to the error boundary).
- Add a watchdog: no document and no progress for ~20 s ⇒ error state. The
  spinner case above otherwise hangs forever.
- `PdfPage.tsx:157` logs render failures in DEV only, so a page that cannot
  paint is a blank box for ever. Give the page a "could not be drawn — retry"
  state.
- The error panel offers only "Download". Add "Open in the browser" (the same
  `href`, no `download` attribute) — on Android that hands the file to the
  system viewer, which is a working reader when pdf.js is not.

### 3.2 P0-2 — idle render loop while a PDF is open **[measured]**

With a 48-page document open and nothing being touched,
`IntersectionObserver.observe()` was called **≈ 5 800 times per second**
(71 618 calls in ~15 s) = 48 pages × 2 observers × ~60 React renders per second.

Mechanism:

1. `PdfPage.tsx:175` passes an inline `ref={(el) => onElement(pageNumber, el)}`.
   A new function identity every render makes React call the old ref with
   `null` and the new one with the element — on **every** render.
2. `onElement` (`PdfViewer.tsx:227-237`) therefore `unobserve`s and re-`observe`s
   each page on both observers.
3. A freshly observed target always fires an initial IntersectionObserver entry.
4. The callback does `setNearby(new Set(near))` (`PdfViewer.tsx:255`) — always
   a new identity, so React re-renders `PdfViewer`.
5. `PdfPage` is not memoized and `boxOf(n)` returns a new object
   (`PdfViewer.tsx:430`), so all N pages re-render → back to step 1.

On a desktop this is invisible. On a phone it is a permanently busy main
thread competing with pdf.js, whose canvas painting also runs on the main
thread — slow first paint, janky scroll, heat, and a larger OOM window.

**Fix (all three; each alone breaks the loop):**

- Stable ref: in `PdfPage`, `const setRef = useCallback((el) => onElement(pageNumber, el), [onElement, pageNumber])`.
- Only publish a change: in the window observer, compare membership and return
  the previous `Set` when nothing entered or left.
- `export const PdfPage = memo(...)`, and pass `width`/`height` as two numbers
  instead of a fresh `box` object.

Regression check: the instrumented `observe` counter must stay flat while idle.

### 3.3 P1-1 — memory and CPU on large documents

The ten magazine issues on the server **[measured]**:

| File | Size | Linearized |
|---|---|---|
| `2012/IGvL_5-6_2012.pdf` | 61.9 MB | no (PDF 1.4) |
| `2017/IGvL_1(20)_2017.pdf` | 37.8 MB | no |
| `2017/IGvL_2(21)_2017.pdf` | 62.7 MB | no |
| `2018/IGvL_1(22)_2018.pdf` | 49.9 MB | not checked |
| `2019/IGvL_1(23)_2019_min.pdf` | 11.2 MB | — |
| `2019/IGvL_2(24)_2019_min.pdf` | 8.5 MB | — |
| `2020/IGvL_1(25)_2020_min.pdf` | 5.1 MB (48 pp.) | yes |
| `2021/IGvL_1(26)_2021_min.pdf` | 12.9 MB | — |
| `2021/IGvL_2(27)_2021_min.pdf` | 7.1 MB | — |
| `2022/IGvL_1-2(28-29)_2022_min.pdf` | 8.5 MB (106 pp.) | yes |

Size does not cause the "could not be opened" message, but once P0-1 is fixed
the four 38–63 MB issues are where a phone will run out of memory.

| ID | Problem | Where | Fix |
|---|---|---|---|
| M-1 | **Whole file is fetched into the worker.** `disableAutoFetch` defaults to `false`: after the first pages pdf.js keeps downloading until it holds all 62 MB | `engine.ts:49-60` | `disableAutoFetch: true`; on low tier also `disableStream: true` (pure on-demand ranges) and `rangeChunkSize: 262144` (default 65 536 → fewer round trips). The server already supports ranges |
| M-2 | **6–7 pages render at once.** `RENDER_MARGIN = "1200px"` each side; on a phone a fit-width page is ~490 px tall, so the window holds ~7 pages, and every one starts `page.render()` immediately with no queue. A scanned A4 page at 300 dpi decodes to ~35 MB RGBA — ~245 MB transient **[estimate]** | `PdfViewer.tsx:97`, `PdfPage.tsx:79-171` | Margin relative to the pane (≈ 1 viewport; 0.5 on low tier). One render queue: visible page first, concurrency 1 on low/mid tier |
| M-3 | **Fling scrolling starts renders that are immediately cancelled.** Cancelling stops painting, not the worker's parse/decode already in flight | `PdfViewer.tsx:248-258` | Activate a page only after it has stayed in the window ~120 ms |
| M-4 | **Canvas backing stores are left to the GC.** Deactivation unmounts the `<canvas>` without zeroing it; mobile engines release canvas memory lazily and cap the total | `PdfPage.tsx:163-170`, `:180-185` | In the cleanup: `canvas.width = canvas.height = 0` |
| M-5 | **Double buffer on every re-render.** A zoom/rotate paints into a detached canvas of the same size, per active page, concurrently | `PdfPage.tsx:113-133` | Keep it for the *visible* page only; others may blank. Serialised by the M-2 queue |
| M-6 | **Canvas budget is desktop-sized.** 8 Mpx (32 MB) per page, DPR capped at 2, zoom up to 8× | `PdfPage.tsx:62`, `:200` | Tiered: low 3 Mpx / DPR ≤ 1.5, mid 5 Mpx, high 8 Mpx; `MAX_SCALE` 4 on touch |
| M-7 | **Text layer on every active page**: a second parse plus hundreds of absolutely positioned spans per page, ×7 pages; a zoom restyles all of them through `--total-scale-factor` | `PdfPage.tsx:144-153`, `pdf.css:51-59` | Build it for the current page only; skip on low tier and on `(hover: none)` until the reader long-presses |
| M-8 | **First pages can render twice.** Pages mount at a scale fitted to an assumed A4; page 1 then reports its real size, the fit changes, the render restarts | `PdfViewer.tsx:100`, `:173`, `:197-205` | Read page 1's viewport in the load effect, before `setStatus("ready")` |
| M-9 | No decoded-image ceiling. pdf.js offers `maxImageSize` (pixels; larger images are *skipped*) and `canvasMaxAreaInBytes` | `engine.ts:49-60` | Set `canvasMaxAreaInBytes` from the tier. Treat `maxImageSize` as a last resort — it blanks oversized scans |
| M-10 | The four large issues are unoptimised content | archive | Re-export through the pipeline that produced the `_min` editions: downsample scans to 150 dpi, linearize ("fast web view"). Target ≤ 15 MB. This is the cheapest large win for phones |

---

## 4. Rendering cost (GPU / compositor / paint)

### 4.1 Census of the idle home page **[measured]**

Tier `high`, 562 px viewport, 21 cards visible, 1 087 DOM nodes:

| Thing | Count |
|---|---|
| Running infinite animations | **12** — 7 drift glyphs, clef spin, 2× `floaty`, 2× framer-motion |
| Elements with `backdrop-filter` | 2 — the fixed top bar (`App.tsx:330`), the search box (`SearchBar.tsx:83`) |
| Elements with a CSS `filter` | 55 |
| Elements with `mix-blend-mode` | 22 |

An idle page therefore never idles: the compositor produces a frame every
vsync, and every frame re-runs two backdrop-blur passes because animated layers
move underneath them.

### 4.2 Findings

| ID | Problem | Where | Fix |
|---|---|---|---|
| R-1 | **`backdrop-filter` everywhere.** Top bar (re-blurred on every scroll frame), search box, refinement panel, language menu, and the full-viewport backdrop of *every* overlay — codex, PDF, stats, guestbook, tab viewer, image viewer, the Suspense fallback. The image viewer blurs behind a 90 %-opaque scrim: full cost, no visible effect | `App.tsx:330,659,672`, `SearchBar.tsx:83`, `search.css:26`, `LanguageMenu.tsx:123`, `CodexShell.tsx:184`, `PdfModal.tsx:116`, `StatsModal.tsx:117`, `GuestbookOverlay.tsx:88`, `AsciiTabViewer.tsx:170`, `ImageViewer.tsx:154,223` | Remove it outright from the image viewer and from modal scrims (raise scrim opacity ~0.55 → 0.7). Keep blur only on the top bar at `high`; elsewhere use a more opaque paper colour |
| R-2 | **Per-card filters and blending.** Every portrait carries `filter: sepia() blur(0.5px)` (an off-screen raster pass per image), a `mix-blend-soft-light` overlay (forces an isolated group), a gradient and an 18 px shadow; 40–80 cards | `CharacterCard.tsx:176-177,189-193,198` | Low/mid tier: drop `blur(0.5px)` and the blend layer; approximate the sepia with a plain semi-transparent overlay. Bake the grade into thumbnails long-term |
| R-3 | **Blur inside the page-turn.** `page-turn-open` animates `filter: blur(6px)` together with `rotateY` on a panel up to 84 rem × 94 dvh; `leaf-in` does the same on every tab switch | `codex.css:362-383,404-419` | Low/mid: opacity + small translate only. High: keep the turn, drop the blur (it is invisible at −90° and barely visible by 60 %) |
| R-4 | **`box-shadow` animated forever.** `herald-halo` repaints a 34–44 px inset + outer shadow every frame while a birth anniversary shows; `box-shadow` cannot be composited | `herald.css:155,162-165` | Animate `opacity` of a pseudo-element that carries the brighter shadow |
| R-5 | **Infinite ornaments at every tier.** `glyphBudget()` never returns 0 (`Math.max(1, …)`), the clef spins in 3D forever, `anim-floaty` runs on dividers, two framer-motion loops animate `y` on the JS thread | `fx/store.ts:64-68`, `effects.css:37-40,124`, `AnimatedTitle.tsx:34-49` | On `low`, make the reader's switch **default to off** (the same mechanism `prefers-reduced-motion` already uses — the grade picks a default, it does not remove the switch). Convert the two framer loops to CSS keyframes. Pause everything on `visibilitychange: hidden` |
| R-6 | **Title reveal.** ~20 letters each animate `filter: blur(10px)` and keep a permanent `drop-shadow` filter; replayed on every language switch | `AnimatedTitle.tsx:11-19,100-105` | Low/mid: opacity/translate only; replace the per-letter `drop-shadow` with `text-shadow` on the word |
| R-7 | `text-rendering: optimizeLegibility` on `body` — kerning/ligature shaping for every run; slow on Android for long articles | `base.css:23` | Limit it to headings |
| R-8 | `.parchment`: four stacked gradients including a 4 px repeating diagonal plus a 70 px inset shadow on a near-full-screen panel | `chrome.css:4-21` | Low tier: two layers, no repeating gradient, smaller inset |
| R-9 | `content-visibility: auto` on grid cells only under `(hover: none)` | `home.css:152-161` | Fine as is; note that a touch laptop with a mouse gets neither this nor a lite card |
| R-10 | Grain layer: `feTurbulence` SVG tile under `mix-blend-multiply` on a fixed full-viewport element | `base.css:74`, `Background.tsx:12-14` | Low tier: drop the grain (a flat 16 %-opacity noise is not worth a blend pass) |

### 4.3 Proposed mechanism: one paint profile, two inputs

The capability tier exists (`lib/fx/tier.ts`) but only scales
`EFFECTS.driftCount`. Extend what it controls rather than adding a second
system:

1. **Publish the tier to CSS.** In `lib/fx/store.ts`, write
   `document.documentElement.dataset.perf = tier` when the snapshot is built
   and whenever the probe lands (`App.tsx:262-264` already does this for
   `data-fx`).
2. **One stylesheet, `styles/perf.css`, imported last**, holding every
   reduction from §4.2 under `html[data-perf="low"]` (and a subset under
   `"mid"`). Unlayered and last in `index.css`, so it wins the cascade by
   position — no `!important`, no edits scattered over 15 files.
3. **Make the ✨ switch mean "lite mode".** Today "effects off" stops the drift
   and the clef but leaves every blur and filter running. Let
   `html[data-fx="off"]` select the same reductions as `data-perf="low"`. The
   reader then has one obvious control for a slow machine, and it is already in
   the bar.
4. **Tighten the static grade for touch devices.** `staticTier()`
   (`tier.ts:77-83`) returns `low` only at ≤ 2 cores or ≤ 2 GB. Typical
   low-power tablets report 4–8 slow cores and 3–4 GB and land on `mid`.
   Suggested: `(hover: none) && deviceMemory <= 4` ⇒ `low` for the *paint*
   profile; keep the CPU/rAF probe as the correction. `deviceMemory` is absent
   in Safari and Firefox — default those to `mid` and rely on the probe.
5. **Hand the tier to the PDF viewer** (M-2, M-6, M-7) through the same store.

This respects the rule written at the head of `fx/store.ts` ("a grade must
never be able to switch an effect off"): ornaments stay governed by the
reader's switch; the grade only chooses that switch's *default* and the paint
fidelity.

---

## 5. Startup, network and main-thread work

### 5.1 Payload **[measured]**

| Asset | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry) | 235 KB | — |
| `react-*.js` | 184 KB | 57.6 KB |
| `motion-*.js` | 91 KB | 32.1 KB |
| `index-*.css` | 123 KB | 23.2 KB |
| `index.json` + `index-ru.json` | 223 KB + 88 KB | **not compressed** |
| First codex: `CodexModal` + `markdown` | 45 KB + 157 KB | 14 KB + 47 KB |
| First PDF: `pdf` + worker | 415 KB + 1 232 KB | — |

### 5.2 Findings

| ID | Problem | Where | Fix |
|---|---|---|---|
| N-1 | **736 dossier requests per first visit.** `heraldWantsFacts` is true by default, so the crawl starts as soon as the catalogue lands: 736 × `*.bio.json` (910 KB of JSON, avg 1.2 KB each), six at a time. 888 requests in total on a cold home page. The crawl also re-renders `App` every 500 ms while it runs | `App.tsx:84-85`, `config.ts:201-210`, `factsStore.ts:107-151` | (a) Do not warm on idle when `saveData`, `effectiveType` is `2g`/`3g`, or tier is `low` — crawl only when a name/year criterion asks; the herald then shows sayings. (b) Otherwise start after the herald's own reveal delay or first interaction, `concurrency` 2–3 on `mid`. (c) Longer term, see §5.3 |
| N-2 | **No compression for JSON and Markdown** on the server: `index.json` is sent as 223 KB | Apache config | `AddOutputFilterByType DEFLATE application/json text/markdown` → ~85 % smaller |
| N-3 | **No `Cache-Control` on anything.** Hashed `/assets/*` rely on heuristic freshness; a returning reader revalidates the index, the chunks and — via N-1 — up to 736 dossiers | Apache config | `/assets/*` and `/pdfjs/*`: `public, max-age=31536000, immutable`. `index*.json`, `*.bio.json`, `*.bio.md`: `no-cache` (validators already present → cheap 304s). PDFs and photos: `max-age=2592000` |
| N-4 | **All 11 dictionaries in the entry chunk** (135 KB of source; `DICTS` is a static map) | `lib/messages/index.ts:3-31` | Keep `ru` + `en` (the fallback chain) static; `import()` the rest on demand. Saves roughly 100 KB raw from the entry |
| N-5 | **`App` is one render scope.** Every keystroke (`criteria`) and every crawl tick re-renders `AnimatedTitle` (~25 motion components), `SiteFooter`, `HeraldBanner`, the top bar and `CharacterGrid` (its `Cell` wrappers; the cards themselves are memoized) | `App.tsx:41-557`, `CharacterGrid.tsx:61,187-201` | `memo` on `AnimatedTitle`, `SiteFooter`, `CharacterGrid`; stable callbacks for `SiteFooter.canOpen`; pass `facts.bySlug` only to the herald |
| N-6 | **Markdown is parsed synchronously on open**, one `ReactMarkdown` (a full unified pipeline) per prose block, during the page-turn animation. Articles average 7 KB, the largest is 56 KB | `BioArticle.tsx:64-180,588` | Render the shell first and mount the article in a transition (`startTransition`) or after the turn; on low tier skip the turn (R-3) so the two never overlap |
| N-7 | `framer-motion` (91 KB) is in the initial graph for a fade, a tilt and `AnimatePresence` | `main.tsx:3,24` | Long-term: CSS for `Cell` and the title; keep `m` only behind lazy chunks |
| N-8 | Audio engine is built at mount: `setEnabled` → `ensure()` creates the `AudioContext` and fills a 1.15 s stereo impulse (~110 000 `Math.random`/`Math.pow` calls) before any gesture | `App.tsx:191-193`, `audio.ts:126-183,197-199` | Create the context on the first gesture only; build the room lazily on first use |
| N-9 | Glyph measuring appends a probe to `<body>` and forces layout per distinct sign, then repeats everything once `fonts.ready` resolves | `glyph.ts:128-191,271-285` | Batch all probes into one host element, one forced layout |
| N-10 | Fonts: five faces × up to three Unicode subsets, none preloaded | `index.css:4-8` | `<link rel="preload">` for the two faces the first screen uses in the reader's script |

### 5.3 The dossier crawl, longer term (needs a decision)

The project rule — *cross-entry metadata is read in the browser, never
precomputed into a file* — exists because a build-time `facts-<lang>.json` went
stale. It rules out a generated artefact; it does not rule out asking the
server at request time. Two options that keep `pages/` the only home of a fact:

- **A. Keep the crawl, make it shy** (N-1 a–b). No new moving parts; a phone on
  mobile data simply does not get "on this day" until it searches by date.
- **B. A live aggregator beside `counter.php`**: one PHP endpoint that reads the
  four fields out of `pages/<lang>/*.bio.json` on request (cached by the newest
  `mtime`). One request instead of 736, never stale. Cost: a second server
  script, which the project has so far avoided on purpose.

Recommendation: ship A now (no server change, no rule change). B is feasible
on this host and is the larger win — 736 requests become one 17.9 KB response
— but it needs the owner's decision; the design, the freshness argument and the
fallback are in §10.3.

---

## 6. Steady-state CPU and memory

| ID | Problem | Where | Fix |
|---|---|---|---|
| C-1 | **The `AudioContext` never suspends.** Once unlocked it runs for the whole session with a compressor and a convolver attached, keeping the audio thread and the device's audio path awake | `audio.ts:126-191` | `ctx.suspend()` after ~10 s with no voice and no ambient; resume on the next cue. Suspend on `visibilitychange: hidden` |
| C-2 | 25 ms `setInterval` schedulers for ambient and theme (40 wake-ups/s each), 40 ms for tab playback | `audio.ts:511,591`, `asciiTabPlayback.ts:157` | 100 ms tick with a 250 ms look-ahead — the audio clock keeps timing exact |
| C-3 | Convolver reverb (1.15 s stereo impulse) on low-power ARM | `audio.ts:170-183` | Bypass the room on `low` |
| C-4 | Image viewer pans through React state on every `pointermove` | `ImageViewer.tsx:134-140` | Write the transform directly in a rAF; commit state on pointer-up |
| C-5 | Unbounded `documentCache` for parsed tablature (already noted in `.claude-memory/15`) | `lib/asciiTab.ts` | LRU, as `catalog.ts` does |
| C-6 | Article/dossier caches | `catalog.ts:226-227` | Already bounded (48 / 120) — no action |
| C-7 | Grid DOM | `config.ts:110-115` | Already paged (40 + 40, then explicit) — no action. On `low`, `pageSize: 24` cuts first paint further |

---

## 7. Roadmap

Ordered by user-visible gain per unit of work. Each phase is independently
shippable and verifiable.

| Phase | Items | Expected result |
|---|---|---|
| **1 — PDF works** | P0-1 (legacy build, pin version, single importer), error reporting + watchdog + "open in browser", P0-2 (render loop) | PDFs open on every engine the legacy build targets (see the pdf.js FAQ; confirm the floor on devices, §9); idle CPU with a PDF open drops to ~0 |
| **2 — PDF survives phones** | M-1, M-2, M-3, M-4, M-6, M-7, M-8; then M-10 on the content side | 60 MB issues readable on a 3 GB phone without a tab kill |
| **3 — Lite paint profile** | §4.3 (`data-perf`, `perf.css`, ✨ = lite), R-1, R-2, R-3, R-4, R-5, R-6 | Smooth scroll and modal open on weak GPUs; an idle page that actually idles on `low` |
| **4 — Network** | N-2, N-3 via `.htaccess` (§10.4), N-1 a–b, N-4; then the PHP facts aggregator and error sink (§10.2–10.3) once approved | ~270 KB less on first load; cold home page 888 → ~153 requests |
| **4b — Lite PDF reader** | Pre-rendered page images + manifest (§10.5) | Large issues readable on phones that cannot run pdf.js at all |
| **5 — Main thread** | N-5, N-6, N-8, C-1, C-2 | Lower typing latency; no audio thread at rest |
| **6 — Polish** | R-7…R-10, N-7, N-9, N-10, C-3…C-5 | Additive |

Documentation to update alongside the code: `.claude-memory/13`, `14`, `15`
(the PDF section claims `engine.ts` is the only pdf.js importer; the budget line
changes with the legacy build), and `apps/guitar-codex/README.md` if it states
browser support.

---

## 8. Suggested budgets (to hold the line afterwards)

| Metric | Budget | How to check |
|---|---|---|
| Requests on a cold home page, `low` tier | ≤ 40 | Network panel |
| Entry JS (gzip, all initial chunks) | ≤ 130 KB | `dist/` sizes |
| Running infinite animations, idle home, `low` | 0 | `document.getAnimations()` |
| `backdrop-filter` elements, `low` | 0 | computed-style census (§4.1 script) |
| `IntersectionObserver.observe` calls/s, PDF idle | 0 | instrumented counter (§3.2) |
| Active PDF canvases, phone fit-width | ≤ 3 | `document.querySelectorAll(".pdf-page canvas")` |
| PDF first page visible, 10 MB file, mid phone | ≤ 4 s | stopwatch / Performance panel |

A `scripts/verify-*.mjs` step for the two scriptable ones (the emitted worker
is byte-identical to the package's `legacy/` worker; entry size) would stop
P0-1 from returning with the next `pdfjs-dist` bump.

---

## 9. Device verification plan

Nothing here was run on real low-power hardware. Before and after each phase:

1. **PDF matrix** — open one small (`2020/…_min`, 5 MB) and one large
   (`2017/IGvL_2(21)`, 63 MB) issue on: Chrome current (Android 10+), a device
   frozen on Chrome 138 (Android 8/9), Samsung Internet, Yandex Browser, an
   in-app WebView (Telegram), iOS Safari 17 and 18. Record: opens? first page
   time? survives scrolling to the last page? survives 3× zoom?
2. **Remote-debug one Android phone** (`chrome://inspect`) and read the actual
   console error before and after the legacy-build switch — it should name
   `toHex` before, and be absent after.
3. **Low-power tablet** — Performance panel recordings of: home-page scroll,
   typing a 6-letter query, opening a biography, switching tabs. Compare long
   tasks and dropped frames with `data-perf` forced to `high` and `low`
   (`EFFECTS.tier` in `config.ts` already allows pinning a grade).
4. **Desktop approximation when no device is at hand** — DevTools CPU 6×
   throttle + "Low-end mobile" preset. Underestimates GPU cost; good enough for
   main-thread findings (P0-2, N-5, N-6).
5. **Memory** — `chrome://inspect` → Memory, or Android's
   `adb shell dumpsys meminfo <pid>` for the renderer while paging through a
   large issue.

---

## 10. A PHP intermediary layer — feasibility

Question: can a thin layer of PHP scripts between the React app and the
server's files cache, aggregate or accelerate what the app loads?
**Yes, for aggregation; mostly no for proxying.** The host can run it, one
endpoint is clearly worth building, and several tempting ones would make things
slower.

### 10.1 What the host offers

| Fact | Source |
|---|---|
| Apache, PHP **7.3.33**, APCu present | `server/README.md` (self-test of the live host) |
| Flat-file state with `flock` + atomic `rename()` already proven in production | `server/counter.php` |
| A second PHP surface already exists: the guestbook REST API at `/gbook/api` | `docs/guestbook-integration.md` |
| `.htaccess` is honoured (the counter writes one; `/.htaccess` answers 403) | measured |
| `mod_deflate` is on, but only for JS/CSS/WASM — JSON and Markdown go out raw | measured |
| Static files carry `ETag` + `Last-Modified`; a conditional request returns `304` | measured |
| HTTP/2 is offered (`Upgrade: h2`) — many small requests are cheaper than on HTTP/1.1, but not free on a phone | measured |
| Imagick / Ghostscript / `exec` availability | **unknown — must be probed** (§10.5) |

### 10.2 Candidates and verdicts

| Candidate | Gain | Verdict |
|---|---|---|
| **Facts aggregator** — one endpoint returning the four searchable dossier fields for a language | 736 requests → 1; **910 KB in 736 responses → 53 KB raw / 17.9 KB gzip** (measured on `pages/ru`) | **Build it** (§10.3). Resolves N-1 for every device, not just fast ones |
| **Client error sink** — `log.php` receiving `{where, name, message, UA}` | Makes the next P0-1-class bug visible without owning the phone | **Build it**, small. Rate-limit through APCu, cap body size, store no IP — the counter's privacy rules apply |
| **Boot bundle** — `index.json` + `index-<lang>.json` (+ quotes, + counter pulse) in one response | 311 KB → ~43 KB gzip (24.9 + 17.8 KB measured); 3–4 requests → 1 | **Not needed**: three lines of `.htaccess` give the same byte saving (§10.4). Use PHP only if the host refuses the directive |
| **Entry bundle** — dossier + article for a slug in one response | 2 requests → 1 per codex open | **Skip.** Negligible over HTTP/2, and it puts a PHP worker in the path of the most common action |
| **Static-file proxy** that adds gzip / `Cache-Control` / `ETag` | Same as `.htaccess` | **Wrong tool.** Every file would cost a PHP worker and lose Apache's sendfile and native range handling. Fallback only |
| **Thumbnail / WebP proxy** (GD) | Portraits are 3–40 KB; gallery photos average **20 KB** (41 sampled, max 213 KB) | **Skip.** Recompress the handful of outliers instead |
| **PDF byte proxy** | None — Apache already serves ranges (`Accept-Ranges: bytes`) | **Do not.** A PHP pass-through either drops range support or pins a worker per download; it also cannot fix P0-1, which is in the browser |
| **PDF page-image service** — pages as JPEGs | A phone loads ~100–250 KB per page instead of parsing a 60 MB file; works where pdf.js cannot run at all | **High value, conditional** (§10.5). Prefer pre-rendering to static files over rendering in PHP |
| **Server-side search** | Negative — client search measures 0.4 ms per query | **Do not** |

### 10.3 The facts aggregator

**Contract**

```
GET /api/facts.php?lang=ru
→ 200 application/json (gzip), ETag: "<count>-<fingerprint>", Cache-Control: no-cache
  { "v": 1, "lang": "ru",
    "entries": { "abiton": ["Жерар", "Абитон", "1954", ""],
                 "abreu":  ["Зекинья", "де Абреу", "19.09.1880", "22.01.1935"] } }
→ 304 when If-None-Match matches
```

- Keyed by the dossier's basename — what `index.json`'s `json` field names — so
  the client joins through the index row it already has.
- Values are **raw** (`forename`, `surname`, `dates.born`, `dates.died`). Folding
  and date parsing stay in the browser (`factsFrom`, `lib/dossier/facts.ts`), so
  there is still exactly one folding rule in the project.
- `lang` is validated against `^[a-z]{2}$` and an existing directory. No other
  input; no path ever comes from the request.

**Freshness — the rule this must not break.** The project rule says cross-entry
metadata is *never precomputed into a file*, because a build-time
`facts-<lang>.json` froze the deployed answer. This endpoint is a different
thing: on every request it `stat`s the directory's `*.bio.json` files and
derives a validator from their count and a fingerprint of every file's name, `mtime` and size; the built document is
kept (APCu, plus a cache file written with the counter's temp-file + `rename()`
pattern) only while that validator is unchanged. An edited birth year is
therefore visible on the next reload, exactly as today. `pages/` stays the only
home of the fact; what is added is a cache that cannot go stale.
Cost per request: ~736 `stat` calls — expected low single-digit milliseconds
**[estimate]**; expose it in a `?a=selftest` like the counter does.

**Client side** (`lib/dossier/factsStore.ts`)

- Try the endpoint first; on 404, a non-JSON body or a ~3 s timeout, **fall
  back to the existing crawl**. That fallback is not optional: `npm run dev` has
  no PHP, and a static mirror or a staging copy must keep working.
- Resolve the URL with `resolveSitePath`, like the counter and `pdf`, so a
  `--base=/fable/` build still finds it. Add `DOSSIER.endpoint` to `config.ts`
  (empty string = crawl only).
- Entries with no edition in the UI language (at most one per language today) read the fallback
  language's document, or are crawled individually.
- The herald and name/year search keep reading the same store — nothing above
  `useFacts` changes.

**What it needs from the owner:** a decision to reword the rule in `CLAUDE.md`
("never precomputed **at build time**; a request-time, mtime-validated server
aggregate is allowed, with the crawl as fallback") and to accept a second server
script. `server/README.md` and `CLAUDE.md` both currently describe
`counter.php` as *the one* server-side script.

**Result:** cold home page 888 → ~153 requests; the crawl's 500 ms re-render
ticks collapse to one.

### 10.4 What needs no PHP — `.htaccess`

N-2 and N-3 are configuration, not code. Guarded so a missing module cannot
produce a 500:

```apache
# site root
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE application/json text/markdown text/plain image/svg+xml
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\.(json|md)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\.(pdf|jpe?g|png|gif|webp)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
</IfModule>

# /assets/.htaccess and /pdfjs/.htaccess — hashed or version-pinned files
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
```

Check after deploying: `curl -sI -H "Accept-Encoding: gzip" …/index.json` must
show `Content-Encoding: gzip`. If the host ignores these directives
(`AllowOverride`), *then* a PHP boot bundle becomes the way to get compression.

### 10.5 PDF pages as images — the robust route for weak phones

pdf.js on a 3 GB phone has to hold a 40–60 MB file, decode full-resolution
scans and paint them on the main thread. A page *image* needs none of that: the
browser's own decoder, lazy loading and cache do the work, and it runs on
engines where pdf.js cannot start.

- **Preferred: pre-render offline, serve static files.** Per issue:
  `magazine/2017/<issue>/p-001.jpg …` at ~1100 px wide plus a small
  `manifest.json` (`pages`, `width`, `height`). No server capability is needed
  and nothing can time out. A "lite reader" is then a column of
  `<img loading="lazy" decoding="async">` inside the existing `PdfModal`
  frame, chosen when the tier is `low`, when the file is larger than ~20 MB, or
  when pdf.js fails to open it; the full viewer stays one tap away.
  Cost: ~100–250 KB per page, fetched only as it scrolls in **[estimate]**.
- **PHP on demand** (`pdfpage.php?f=<issue>&p=3&w=1100`, rendered once, cached on
  disk) only if the host has Imagick with a PDF delegate or allows `exec` of
  Ghostscript. Shared hosts often disable exactly this, and a first render of a
  scanned page can take seconds of server CPU. Probe before designing:
  `extension_loaded('imagick')`, `Imagick::queryFormats('PDF')`,
  `function_exists('exec')` — add them to a self-test action.

### 10.6 Ground rules for anything added under `server/`

- PHP **7.3** syntax (no typed properties, arrow functions, `match`, `str_contains`).
- GET-only, read-only, same-origin; one configuration block at the top
  (`content_dir`, `cache_dir`), as `counter.php` does it.
- Whitelist every input; never accept a path.
- Always answer with a validator (`ETag`) and honour `If-None-Match`.
- Never put PHP in front of a static file: on shared hosting each request
  occupies a PHP worker, and Apache serves files faster than any script can.
- The app must work without the layer (dev server, mirrors): every endpoint is
  an accelerator with a fallback, switched in `config.ts`.
- Document each script in `server/README.md` and keep `CLAUDE.md` /
  `.claude-memory` in step.

---

## Appendix — evidence

**A. Reproduction of P0-1** (dev server, Chromium 152; built-ins deleted in a
wrapper worker that then imports the shipped worker, and in the page where
noted):

| Removed | Dialog text after 10 s | Page boxes | Painted canvases |
|---|---|---|---|
| nothing (control) | document text | 48 | 3 |
| `Uint8Array.prototype.toHex`, `toBase64`, `fromBase64` (worker) | "The document could not be opened" | 0 | 0 |
| `Map.prototype.getOrInsertComputed`, `Math.sumPrecise` (worker + page) | page numbers only | 48 | 0 |
| `Promise.try` (+ the above) (worker + page) | "Opening the document…" (spinner) | 0 | 0 |
| all of the above, **legacy worker** | document text | 48 | 3 |

**B. P0-2 counter** — `observe()` calls at two instants 3 s apart with the
viewer idle: 54 242 → 71 618 (5 792/s).

**C. Home-page census** — see §4.1; first-load request count 888, of which 736
are `*.bio.json`; two long tasks at startup (62 ms, 103 ms) on a 12-core
desktop in the dev build.

**D. Deployed headers** (`www.abc-guitars.com`, 2026-09-30) — JS/CSS/WASM:
`Content-Encoding: gzip`, no `Cache-Control`. `index.json` (223 263 B),
`index-ru.json` (87 847 B), `*.bio.json`, `*.bio.md`: no `Content-Encoding`, no
`Cache-Control`. PDFs: `Accept-Ranges: bytes`, no `Cache-Control`. Worker:
`Content-Type: text/javascript`.

**E. PHP-layer sizing** — `pages/ru`: 736 dossiers, 910 KB total; their four
searchable fields as one JSON document: 53 253 B raw, 17 897 B gzip.
`index.json` gzips to 24 925 B, `index-ru.json` to 17 836 B. Gallery photos:
968 referenced, 41 sampled on the server, average 20 KB, largest 213 KB.
Listed biographies lacking an edition: `en` 1, `fr` 1, `zh` 1, all others 0.
