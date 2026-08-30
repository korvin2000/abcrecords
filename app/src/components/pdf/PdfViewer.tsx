import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfDocument } from "@/lib/pdf/engine";
import { useI18n } from "@/lib/i18n";
import { PdfPage, type PageSize } from "./PdfPage";
import { PdfToolbar, type FitMode } from "./PdfToolbar";

/**
 * A continuous, themed PDF reader: toolbar on top, pages scrolling beneath it,
 * nothing else. It is the document counterpart of components/ImageViewer —
 * the same controls where the two overlap (zoom, fit, rotate, download), the
 * same gold-on-parchment chrome — and it is deliberately host-agnostic, so
 * the codex-styled dialog around it (PdfModal) and any future embedded use
 * share one implementation.
 *
 * Three ideas carry the whole file:
 *
 * 1. **Every page has a box; only nearby pages have pixels.** All page
 *    wrappers are mounted from the start, sized from the document's own
 *    geometry, so the scrollbar tells the truth about the length of the
 *    document and "go to page 31" is one scroll. What is expensive — the
 *    canvas — exists only inside the render window (`RENDER_MARGIN`).
 *
 * 2. **Page size is estimated, then corrected.** Asking pdf.js for all forty
 *    pages up front, only to learn they are the same size, is a request per
 *    page before the first one paints. The first page's size stands in for
 *    all of them and each page reports its true size as it opens, so a
 *    document of mixed sizes reflows those few pages and no others.
 *
 * 3. **Fit is a mode, not a number.** `fit` survives a window resize, a
 *    rotation and a phone turning on its side — the scale is recomputed from
 *    the container each time. A zoom button drops out of fit mode and takes
 *    the scale on screen as its starting point, so zooming never jumps.
 */

export interface PdfViewerProps {
  /** Fully-resolved URL of the file. */
  src: string;
  /** Shown in the toolbar; the entry's name, not the file name. */
  title?: string;
  /** Suggested download filename. Defaults to the URL's basename. */
  download?: string;
  /** When given, the toolbar offers a close control. */
  onClose?: () => void;
  /** **Required in practice: this is where the viewer's size comes from.** It
   *  declares none of its own (see the note in the markup), so a host must give
   *  it a height — `flex-1 min-h-0` inside a flex column is the safest form,
   *  because flexbox cannot over-constrain the way `height` + `inset` can. */
  className?: string;
}

/** Zoom bounds and step, matching what browser PDF viewers offer. */
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;

/**
 * Padding around the page column, in px — also the scroll-to-page offset.
 *
 * It used to be a flat 16, and a flat margin is a percentage in disguise: on a
 * 335 px-wide pane (a 375 px phone, once the modal's frame and the parchment
 * border are paid for) it spent **9.5 %** of the reader's width on empty
 * parchment either side of a scan they are trying to read. On a desk the same
 * 32 px is 2 % and reads as a mount, which is what it is for.
 *
 * So it is a fraction of the pane, bounded at both ends — the same fluid rule
 * the rest of the app spaces by. `clamp()` cannot do this in CSS here because
 * the number is also arithmetic input to the fit scale and to the scroll-to-
 * page offset, both of which live in JS.
 */
function gutterFor(paneWidth: number): number {
  return Math.round(clamp(paneWidth * 0.022, 6, 16));
}

/**
 * One pixel given up when fitting to width.
 *
 * `clientWidth` is specified to return the content width **rounded to the
 * nearest integer**, so it can overstate the real box by half a pixel — and
 * fit-to-width, which by definition lands the page exactly on that number,
 * then overflows by that half pixel. The cost is a horizontal scrollbar
 * appearing under a page that visibly fits, painted over the foot of it where
 * scrollbars overlay (iOS, Android). A pixel is cheaper than that.
 */
const FIT_GUARD = 1;

/** How far outside the pane a page is still worth painting. */
const RENDER_MARGIN = "1200px";

/** A4 in points — the placeholder box before the first page has been read. */
const ASSUMED_PAGE: PageSize = { width: 595, height: 842 };

type Status = "loading" | "ready" | "error";

export function PdfViewer({ src, title, download, onClose, className }: PdfViewerProps) {
  const { t } = useI18n();

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [progress, setProgress] = useState(0);

  const [sizes, setSizes] = useState<ReadonlyMap<number, PageSize>>(() => new Map());
  const [fit, setFit] = useState<FitMode>("width");
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  const [nearby, setNearby] = useState<ReadonlySet<number>>(() => new Set([1]));
  const [area, setArea] = useState({ width: 0, height: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef(new Map<number, HTMLElement>());
  const observers = useRef<IntersectionObserver[]>([]);

  const pageCount = doc?.numPages ?? 0;

  /* --------------------------------------------------------------- the file */

  useEffect(() => {
    setStatus("loading");
    setProgress(0);
    setSizes(new Map());
    setPage(1);
    setNearby(new Set([1]));

    const task = loadPdfDocument(src);
    let alive = true;
    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (alive && total > 0) setProgress(Math.min(1, loaded / total));
    };
    task.promise.then(
      (opened) => {
        if (alive) {
          setDoc(opened);
          setStatus("ready");
        }
      },
      () => {
        if (alive) setStatus("error");
      },
    );

    return () => {
      alive = false;
      setDoc(null);
      // Aborts the download if it is still running, and tears down the
      // worker's copy of the document if it is not.
      void task.destroy();
    };
  }, [src]);

  /* -------------------------------------------------------------- geometry */

  // The pane's inner size, which is what "fit" is relative to.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setArea({ width: el.clientWidth, height: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const base = sizes.get(1) ?? ASSUMED_PAGE;
  const turned = rotation % 180 !== 0;

  /** A page's on-screen box: its own size when known, the first page's
   *  otherwise, turned and scaled. */
  const boxOf = useCallback(
    (n: number) => {
      const size = sizes.get(n) ?? base;
      const width = turned ? size.height : size.width;
      const height = turned ? size.width : size.height;
      // Floor, not round, on the inline axis only: a page half a pixel wider
      // than the pane summons a horizontal scrollbar, while one half a pixel
      // shorter than it should be is invisible. Nothing on the block axis can
      // do that, so the height keeps the more accurate rounding.
      return { width: Math.floor(width * scale), height: Math.round(height * scale) };
    },
    [sizes, base, turned, scale],
  );

  // Fit is re-satisfied whenever what it depends on moves: the pane, the page
  // geometry, the rotation. Leaving fit mode (a zoom click) freezes the scale
  // wherever it stood.
  const gutter = gutterFor(area.width);

  useEffect(() => {
    if (!fit || !area.width || !area.height) return;
    const width = turned ? base.height : base.width;
    const height = turned ? base.width : base.height;
    const byWidth = (area.width - 2 * gutter - FIT_GUARD) / width;
    const byHeight = (area.height - 2 * gutter - FIT_GUARD) / height;
    const wanted = fit === "width" ? byWidth : Math.min(byWidth, byHeight);
    setScale(clamp(wanted, MIN_SCALE, MAX_SCALE));
  }, [fit, area.width, area.height, base.width, base.height, turned, gutter]);

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

  const onElement = useCallback((n: number, el: HTMLElement | null) => {
    const known = pageEls.current.get(n);
    if (known && known !== el) {
      for (const o of observers.current) o.unobserve(known);
      pageEls.current.delete(n);
    }
    if (el) {
      pageEls.current.set(n, el);
      for (const o of observers.current) o.observe(el);
    }
  }, []);

  // Two observers over the same elements, answering two different questions:
  // which pages are worth painting, and which page the reader is on. Doing it
  // this way rather than from a scroll handler keeps the work off the scroll
  // frame entirely.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !pageCount) return;

    const near = new Set<number>();
    const windowObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) near.add(n);
          else near.delete(n);
        }
        setNearby(new Set(near));
      },
      { root, rootMargin: `${RENDER_MARGIN} 0px` },
    );

    // A thin band across the middle of the pane: whatever crosses it is what
    // the reader is looking at.
    const reading = new Set<number>();
    const currentObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) reading.add(n);
          else reading.delete(n);
        }
        if (reading.size) setPage(Math.min(...reading));
      },
      { root, rootMargin: "-40% 0px -50% 0px" },
    );

    observers.current = [windowObserver, currentObserver];
    for (const el of pageEls.current.values()) {
      windowObserver.observe(el);
      currentObserver.observe(el);
    }
    return () => {
      observers.current = [];
      windowObserver.disconnect();
      currentObserver.disconnect();
    };
  }, [pageCount]);

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

  const zoom = useCallback((direction: -1 | 1) => {
    setFit(null);
    setScale((prev) => clamp(prev * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP), MIN_SCALE, MAX_SCALE));
  }, []);

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
  const downloadName = download ?? basename(src);

  return (
    // The viewer is always a toolbar over a scrolling pane; the host says how
    // large that column is, and **only** the host.
    //
    // This used to declare `h-full` as well, which is one owner too many: the
    // host (PdfModal) sizes it, and when a host does that by anchoring all four
    // sides, `height: 100%` and `bottom` are over-constrained. CSS resolves that
    // by discarding `bottom` — so the viewer was exactly its own top inset (11px)
    // taller than the frame it sits in, and its foot was drawn across the
    // parchment's inner border. It is sized from outside now, so the two can no
    // longer disagree.
    <div className={clsx("flex min-h-0 flex-col", className)}>
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
        download={downloadName}
        onClose={onClose}
      />

      <div
        ref={scrollRef}
        tabIndex={0}
        // `overflow-y: scroll` rather than `auto`: with `auto`, fit-to-width
        // picks a scale that summons the scrollbar, which narrows the pane,
        // which changes the fit — a loop that settles only by luck.
        className="codex-scroll relative flex-1 overflow-y-scroll overflow-x-auto outline-none"
      >
        {status === "ready" && doc ? (
          // `w-fit min-w-full` is what makes a zoomed-in page reachable:
          // a centred flex column narrower than its children overflows on
          // *both* sides, and the left half of an overflow is unscrollable.
          // Sized to its widest child instead, the column scrolls properly and
          // still centres a page smaller than the pane.
          <div
            className="flex w-fit min-w-full flex-col items-center gap-4"
            style={{ padding: gutter }}
          >
            {pages.map((n) => (
              <PdfPage
                key={n}
                doc={doc}
                pageNumber={n}
                scale={scale}
                renderScale={renderScale}
                rotation={rotation}
                box={boxOf(n)}
                active={nearby.has(n)}
                onMeasure={onMeasure}
                onElement={onElement}
              />
            ))}
          </div>
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            {status === "error" ? (
              <div>
                <p className="font-display text-xl text-burgundy-600">{t("pdf.error")}</p>
                <a href={src} download={downloadName} className="btn-rpg mt-5 inline-block">
                  {t("viewer.download")}
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4" role="status" aria-busy="true">
                <span className="h-12 w-12 animate-spin rounded-full border-2 border-gold-300/40 border-t-gold-500" />
                <p className="font-body text-sm italic text-sepia-600">{t("pdf.loading")}</p>
                <span className="h-1 w-40 overflow-hidden rounded-full bg-gold-600/20">
                  <span
                    className="block h-full rounded-full bg-gold-600 transition-[width] duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/** ".../magazine/2022/issue.pdf" -> "issue.pdf", for the download attribute. */
function basename(url: string): string {
  return decodeURIComponent(url.split(/[?#]/, 1)[0].split("/").pop() || "document.pdf");
}
