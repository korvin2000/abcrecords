import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PDF } from "@/config";
import { loadPdfDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy } from "@/lib/pdf/engine";
import { RenderQueue } from "@/lib/pdf/queue";
import { describeError, reportProblem } from "@/lib/diagnostics";
import { perfTier, useFx } from "@/lib/fx";
import { useI18n } from "@/lib/i18n";
import { PdfPage, type PageEnv, type PageSize } from "./PdfPage";
import { PdfToolbar, type FitMode } from "./PdfToolbar";
import {
  FIT_GUARD,
  MIN_SCALE,
  OpenFailed,
  Opening,
  TOUCH_ONLY,
  ZOOM_STEP,
  basename,
  clamp,
  gutterFor,
  sameMembers,
  usePaneSize,
  useReadingPage,
  type ReaderProps,
} from "./readerShared";

/**
 * The pdf.js reader: exact, zoomable to any size, selectable.
 *
 * **The only module of the viewer that reaches the pdf.js engine** (through
 * PdfPage and lib/pdf/engine), which is why PdfViewer loads it lazily: a
 * document read as page images never downloads the engine at all.
 *
 * Four ideas carry it:
 *
 * 1. **Every page has a box; only nearby pages have pixels.** All page
 *    wrappers are mounted from the start, sized from the document's own
 *    geometry, so the scrollbar tells the truth about the length of the
 *    document and "go to page 31" is one scroll. What is expensive — the
 *    canvas — exists only inside the render window, and the window is sized
 *    from the pane and the machine's grade (`PDF.renderMargin`).
 *
 * 2. **Page size is estimated, then corrected.** Asking pdf.js for all forty
 *    pages up front, only to learn they are the same size, is a request per
 *    page before the first one paints. The first page's size — read before
 *    anything is mounted — stands in for all of them and each page reports its
 *    true size as it opens, so a document of mixed sizes reflows those few
 *    pages and no others.
 *
 * 3. **Fit is a mode, not a number.** `fit` survives a window resize, a
 *    rotation and a phone turning on its side — the scale is *derived* from
 *    the container on every render. A zoom button drops out of fit mode and
 *    takes the scale on screen as its starting point, so zooming never jumps.
 *
 * 4. **Painting is budgeted.** Pages paint through one queue, the page being
 *    read first; a page must stay in the window a moment before it is painted
 *    at all; and the canvas, the image decoder and the network all take their
 *    ceilings from `PDF` in config.ts. See docs/performance-analysis.md §3.
 */

/** A4 in points — the placeholder box should the first page refuse to say. */
const ASSUMED_PAGE: PageSize = { width: 595, height: 842 };

/** The render window before the observer has reported: the first page. */
const FIRST_PAGE: ReadonlySet<number> = new Set([1]);

type Status = "loading" | "ready" | "error";

export function PdfDocumentView({
  src,
  title,
  download,
  onClose,
  onSwitch,
  onBroken,
}: ReaderProps & {
  /** Offered when the document also exists as page images. */
  onSwitch?: () => void;
  /** The document would not open at all. */
  onBroken: () => void;
}) {
  const { t } = useI18n();
  const { tier } = useFx();
  const maxScale = TOUCH_ONLY ? PDF.maxScaleTouch : PDF.maxScale;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  /** The engine's own words for why it failed — shown, not swallowed. */
  const [reason, setReason] = useState("");
  const [progress, setProgress] = useState(0);

  const [sizes, setSizes] = useState<ReadonlyMap<number, PageSize>>(() => new Map());
  const [fit, setFit] = useState<FitMode>("width");
  /** The scale outside fit mode. Inside it, the scale is derived (see below). */
  const [manual, setManual] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  const [nearby, setNearby] = useState<ReadonlySet<number>>(FIRST_PAGE);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef(new Map<number, HTMLElement>());
  const windowObserver = useRef<IntersectionObserver | null>(null);
  const area = usePaneSize(scrollRef);

  const pageCount = doc?.numPages ?? 0;

  const broken = useRef(onBroken);
  broken.current = onBroken;

  /* --------------------------------------------------------------- the file */

  useEffect(() => {
    setStatus("loading");
    setReason("");
    setProgress(0);
    setSizes(new Map());
    setPage(1);
    setNearby(FIRST_PAGE);

    let alive = true;
    let task: PDFDocumentLoadingTask | undefined;
    let watchdog = 0;

    const fail = (error: unknown) => {
      if (!alive) return;
      alive = false;
      window.clearTimeout(watchdog);
      const { name, message } = describeError(error);
      setReason(`${name}: ${message}`);
      setStatus("error");
      reportProblem("pdf.open", error, { file: basename(src) });
      task?.destroy().catch(() => undefined);
      broken.current();
    };

    // A load that stops talking has failed, whatever it thinks. On an engine
    // too old for pdf.js the worker dies on its first message and the task
    // never settles — without this the reader watches a spinner for ever.
    const arm = () => {
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(
        () => fail(new Error(`no response from the document engine for ${PDF.watchdogMs / 1000} s`)),
        PDF.watchdogMs,
      );
    };

    try {
      // Read here rather than subscribed to: the grade settling a moment after
      // the viewer opens must not restart a download already under way.
      const grade = perfTier();
      task = loadPdfDocument(src, {
        frugal: grade !== "high" || TOUCH_ONLY,
        imageBytes: grade === "high" ? -1 : PDF.canvasPixels[grade] * 4 * 2,
      });
    } catch (error) {
      // `getDocument` itself can throw on an engine that lacks what it needs;
      // uncaught, that took the whole codex boundary down with it.
      fail(error);
      return;
    }

    // The watch covers *opening* only. pdf.js keeps reporting progress after
    // the document is ready (the rest of the file, later range requests), and
    // re-arming on those would let a quiet 25 seconds of reading tear down a
    // document that opened perfectly well.
    let opening = true;
    arm();
    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (!alive || !opening) return;
      arm();
      if (total > 0) setProgress(Math.min(1, loaded / total));
    };
    task.promise.then(async (opened) => {
      opening = false;
      window.clearTimeout(watchdog);
      // The first page's geometry, before a single box is mounted: every box
      // is estimated from it, and mounting on a guess (A4) meant the first
      // pages were laid out, started painting, then laid out and painted again
      // the moment the real size arrived.
      let first: PageSize | null = null;
      try {
        const viewport = (await opened.getPage(1)).getViewport({ scale: 1, rotation: 0 });
        first = { width: viewport.width, height: viewport.height };
      } catch {
        /* the page will report for itself, or fail visibly, when it renders */
      }
      if (!alive) return;
      window.clearTimeout(watchdog);
      if (first) setSizes(new Map([[1, first]]));
      setDoc(opened);
      setStatus("ready");
    }, fail);

    return () => {
      alive = false;
      window.clearTimeout(watchdog);
      setDoc(null);
      // Aborts the download if it is still running, and tears down the
      // worker's copy of the document if it is not.
      task?.destroy().catch(() => undefined);
    };
  }, [src]);

  /* -------------------------------------------------------------- geometry */

  const base = sizes.get(1) ?? ASSUMED_PAGE;
  const turned = rotation % 180 !== 0;
  const gutter = gutterFor(area.width);

  // Fit is satisfied on every render from what it depends on — the pane, the
  // page geometry, the rotation — rather than chased by an effect one commit
  // behind, which is what used to paint the first pages at the wrong scale.
  const fitted = useMemo(() => {
    if (!area.width || !area.height) return null;
    const width = turned ? base.height : base.width;
    const height = turned ? base.width : base.height;
    const byWidth = (area.width - 2 * gutter - FIT_GUARD) / width;
    const byHeight = (area.height - 2 * gutter - FIT_GUARD) / height;
    return clamp(fit === "page" ? Math.min(byWidth, byHeight) : byWidth, MIN_SCALE, maxScale);
  }, [fit, area.width, area.height, base.width, base.height, turned, gutter, maxScale]);

  const scale = fit && fitted !== null ? fitted : manual;
  const current = useRef(scale);
  current.current = scale;

  /**
   * The resolution the canvases are painted at. React holds it back while the
   * reader is still clicking, so a burst of zoom steps costs one re-render of
   * the visible pages instead of one per click; the boxes meanwhile follow
   * `scale` immediately, so the layout never lags behind the button.
   */
  const renderScale = useDeferredValue(scale);

  const onMeasure = useCallback((n: number, size: PageSize) => {
    setSizes((prev) => {
      const known = prev.get(n);
      if (known && known.width === size.width && known.height === size.height) return prev;
      const next = new Map(prev);
      next.set(n, size);
      return next;
    });
  }, []);

  /* ------------------------------------------ what is on screen, and where */

  const readingObserver = useReadingPage(scrollRef, pageEls, pageCount, setPage);

  const onElement = useCallback(
    (n: number, el: HTMLElement | null) => {
      const known = pageEls.current.get(n);
      if (known && known !== el) {
        windowObserver.current?.unobserve(known);
        readingObserver.current?.unobserve(known);
        pageEls.current.delete(n);
      }
      if (el && known !== el) {
        pageEls.current.set(n, el);
        windowObserver.current?.observe(el);
        readingObserver.current?.observe(el);
      }
    },
    [readingObserver],
  );

  // Which pages are worth painting. The window is a fraction of the pane on
  // each side (a fixed 1200 px was seven pages on a phone), and a page has to
  // *stay* in it for `dwellMs` before it counts: a fling across forty pages
  // then paints the one it stops on instead of starting — and cancelling —
  // a render for every page it passed. Cancelling stops the painting, not the
  // decoding the worker had already begun.
  const margin = Math.round(PDF.renderMargin[tier] * 100);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !pageCount) return;

    const near = new Set<number>();
    let settle = 0;
    const publish = () => {
      // The same members, the same object: publishing a fresh Set on every
      // report is what kept this component rendering without end.
      setNearby((prev) => (sameMembers(prev, near) ? prev : new Set(near)));
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) near.add(n);
          else near.delete(n);
        }
        window.clearTimeout(settle);
        settle = window.setTimeout(publish, PDF.dwellMs);
      },
      { root, rootMargin: `${margin}% 0px` },
    );

    windowObserver.current = io;
    for (const el of pageEls.current.values()) io.observe(el);
    return () => {
      windowObserver.current = null;
      window.clearTimeout(settle);
      io.disconnect();
    };
  }, [pageCount, margin]);

  // One queue per open document. `focus` is read when a slot frees, so the
  // next page painted is the nearest to where the reader is *then*.
  const focus = useRef(page);
  focus.current = page;
  const queue = useMemo(() => new RenderQueue(() => focus.current), []);
  queue.limit = PDF.concurrency[tier];

  const env = useMemo<PageEnv>(
    () => ({
      queue,
      maxPixels: PDF.canvasPixels[tier],
      maxDpr: PDF.maxDpr[tier],
      // Built unasked for a mouse on a capable machine; everywhere else a
      // long press on the page asks for it.
      textLayer: PDF.textLayer[tier] && !TOUCH_ONLY ? "always" : "on-demand",
    }),
    [queue, tier],
  );

  /* --------------------------------------------------------------- controls */

  // Read through a ref rather than closed over: `goToPage` is a dependency of
  // the keyboard bindings and of the anchor below, and neither should be torn
  // down because the pane grew by a pixel.
  const gutterRef = useRef(gutter);
  gutterRef.current = gutter;

  const goToPage = useCallback(
    (wanted: number, behavior?: ScrollBehavior) => {
      const root = scrollRef.current;
      const target = clamp(Math.round(wanted), 1, pageCount || 1);
      const el = pageEls.current.get(target);
      if (!root || !el) return;
      const top =
        root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - gutterRef.current;
      // A step to the neighbouring page reads as a page turn; a jump across
      // the document should simply arrive.
      root.scrollTo({ top, behavior: behavior ?? (Math.abs(target - page) <= 1 ? "smooth" : "auto") });
      setPage(target);
    },
    [pageCount, page],
  );

  /**
   * Stay on the same page across a zoom, a rotation or a resized window.
   * Every box on the page changes size at once, so the scroll offset the
   * reader was at now points somewhere else entirely — turning a phone
   * sideways would otherwise land them thirty pages away. The ref holds the
   * page from *before* the change, because `page` cannot have moved in the
   * same commit as the scale that moved it.
   */
  const anchor = useRef(page);
  anchor.current = page;
  const jump = useRef(goToPage);
  jump.current = goToPage;
  useLayoutEffect(() => {
    jump.current(anchor.current, "auto");
  }, [scale, rotation]);

  const zoom = useCallback(
    (direction: -1 | 1) => {
      // From the scale on screen, whichever mode produced it.
      setManual(clamp(current.current * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP), MIN_SCALE, maxScale));
      setFit(null);
    },
    [maxScale],
  );

  const rotate = useCallback(() => setRotation((prev) => (prev + 90) % 360), []);

  // Ctrl/Cmd + wheel is the zoom gesture every PDF viewer has, and it is what
  // a trackpad pinch arrives as. A passive listener cannot preventDefault, so
  // the browser's own page zoom would fire as well — hence the manual binding.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom]);

  // Shortcuts. Vertical scrolling stays the browser's business (the pane is
  // focusable, so the space bar and Page Up/Down already work); this covers
  // only what it has no opinion about.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.altKey || target?.tagName === "INPUT" || target?.isContentEditable) return;
      const zoomKey = e.ctrlKey || e.metaKey;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === "+" || e.key === "=") return stop(), zoom(1);
      if (e.key === "-" || e.key === "_") return stop(), zoom(-1);
      if (e.key === "0" && zoomKey) return stop(), setFit("width");
      if (zoomKey) return;
      if (e.key === "ArrowLeft") return stop(), goToPage(page - 1);
      if (e.key === "ArrowRight") return stop(), goToPage(page + 1);
      if (e.key === "Home") return stop(), goToPage(1);
      if (e.key === "End") return stop(), goToPage(pageCount);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [zoom, goToPage, page, pageCount]);

  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i + 1), [pageCount]);

  return (
    <>
      <PdfToolbar
        title={title}
        page={page}
        pageCount={pageCount}
        scale={scale}
        fit={fit}
        onGoToPage={goToPage}
        onZoom={zoom}
        onFit={setFit}
        onRotate={rotate}
        href={src}
        download={download}
        onClose={onClose}
        onSwitch={onSwitch}
        switchLabel={t("pdf.viewLite")}
      />

      <div
        ref={scrollRef}
        tabIndex={0}
        // `overflow-y: scroll` rather than `auto`: with `auto`, fit-to-width
        // picks a scale that summons the scrollbar, which narrows the pane,
        // which changes the fit — a loop that settles only by luck.
        className="codex-scroll relative flex-1 overflow-y-scroll overflow-x-auto outline-none"
      >
        {status === "ready" && doc && area.width > 0 ? (
          // `w-fit min-w-full` is what makes a zoomed-in page reachable:
          // a centred flex column narrower than its children overflows on
          // *both* sides, and the left half of an overflow is unscrollable.
          // Sized to its widest child instead, the column scrolls properly and
          // still centres a page smaller than the pane.
          <div className="flex w-fit min-w-full flex-col items-center gap-4" style={{ padding: gutter }}>
            {pages.map((n) => {
              const size = sizes.get(n) ?? base;
              const width = turned ? size.height : size.width;
              const height = turned ? size.width : size.height;
              return (
                <PdfPage
                  key={n}
                  doc={doc}
                  pageNumber={n}
                  scale={scale}
                  renderScale={renderScale}
                  rotation={rotation}
                  // Floor, not round, on the inline axis only: a page half a
                  // pixel wider than the pane summons a horizontal scrollbar,
                  // while one half a pixel shorter than it should be is
                  // invisible. Nothing on the block axis can do that, so the
                  // height keeps the more accurate rounding.
                  width={Math.floor(width * scale)}
                  height={Math.round(height * scale)}
                  active={nearby.has(n)}
                  current={n === page}
                  env={env}
                  onMeasure={onMeasure}
                  onElement={onElement}
                />
              );
            })}
          </div>
        ) : status === "error" ? (
          <OpenFailed src={src} download={download} reason={reason} onSwitch={onSwitch} />
        ) : (
          <div className="grid h-full">
            <Opening progress={progress} />
          </div>
        )}
      </div>
    </>
  );
}
