import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  isCancellation,
  setLayerDimensions,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from "@/lib/pdf/engine";
import type { RenderQueue } from "@/lib/pdf/queue";
import { reportProblem } from "@/lib/diagnostics";
import { useI18n } from "@/lib/i18n";

/**
 * One page of the open document: a canvas painted by pdf.js, plus — for the
 * page being read — the transparent text layer that makes it selectable.
 *
 * The component owns the whole life cycle of one page's pixels. `active` is
 * the render window the viewer computes from what is on screen: false keeps
 * the box — so the scrollbar never lies about the length of the document —
 * and drops the bitmap. That is deliberate rather than frugal: a forty-page
 * magazine at fit-width on a retina display is over half a gigabyte of canvas
 * if every page is kept painted.
 *
 * **Two scales, on purpose.** `scale` is what the reader sees right now and
 * drives the CSS box; `renderScale` lags behind it (the viewer defers it) and
 * is the resolution the bitmap is painted at. Because the canvas is sized in
 * CSS rather than in pixels, a zoom step re-lays-out instantly with the old
 * bitmap stretched into the new box, and sharpens a moment later when the new
 * render lands — instead of blanking every visible page on every click.
 *
 * **Painting waits its turn.** A render is a request to the viewer's
 * `RenderQueue`, not a call: the page being read goes first and the rest
 * follow one at a time on a small machine (docs/performance-analysis.md §3.3).
 *
 * Memoized, with a stable ref callback, and both matter more than they look:
 * an inline `ref` is re-attached on every render, re-attaching re-observes the
 * element, a fresh observation always reports, and the report used to set
 * state — which re-rendered every page, sixty times a second, for as long as a
 * document was open.
 */

export interface PageSize {
  /** Unrotated page size in PDF points (72 per inch), i.e. at scale 1. */
  width: number;
  height: number;
}

/** What a page needs from the viewer beyond its own geometry. One object,
 *  stable until the machine's grade changes, so it never defeats the memo. */
export interface PageEnv {
  queue: RenderQueue;
  /** Ceiling on one canvas's pixels (`PDF.canvasPixels`). */
  maxPixels: number;
  /** Device pixels per CSS pixel, at most (`PDF.maxDpr`). */
  maxDpr: number;
  /**
   * When the page being read gets its selectable text layer: `"always"`, as
   * soon as it is painted, or `"on-demand"` — only once the reader asks for
   * it with a long press (or the context-menu gesture) on the page.
   */
  textLayer: "always" | "on-demand";
}

/** How long a press must be held to ask for the text layer (ms) — the
 *  platform's own long-press is about this long. */
const LONG_PRESS_MS = 450;

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number;
  /** Display scale: CSS pixels per PDF point, as shown right now. */
  scale: number;
  /** Scale to paint at; trails `scale` while the reader is still zooming. */
  renderScale: number;
  /** Degrees clockwise; a multiple of 90. */
  rotation: number;
  /** The box to occupy — already scaled and rotated by the viewer. Two numbers
   *  rather than an object, so an unchanged box is an unchanged prop. */
  width: number;
  height: number;
  /** Inside the render window. */
  active: boolean;
  /** The page the reader is on: first in the queue, and the only one that
   *  carries a text layer or is repainted behind a buffer. */
  current: boolean;
  env: PageEnv;
  /** Reports the page's true size the first time it is opened, so the viewer
   *  can correct a box it had only estimated from the first page. */
  onMeasure: (pageNumber: number, size: PageSize) => void;
  /** Hands the element to the viewer, which scrolls to it and observes it. */
  onElement: (pageNumber: number, el: HTMLElement | null) => void;
}

export const PdfPage = memo(function PdfPage({
  doc,
  pageNumber,
  scale,
  renderScale,
  rotation,
  width,
  height,
  active,
  current,
  env,
  onMeasure,
  onElement,
}: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [painted, setPainted] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Bumped by "retry": the render effect's only way to run again unasked. */
  const [attempt, setAttempt] = useState(0);
  /** The reader asked for selectable text on this page (on-demand mode). */
  const [textAsked, setTextAsked] = useState(false);
  /** The reader's selection reaches into this page's text. */
  const [holdsSelection, setHoldsSelection] = useState(false);
  const press = useRef(0);

  // Read at the moment a render starts, not subscribed to: becoming the page
  // being read must not repaint a page that is already painted.
  const isCurrent = useRef(current);
  isCurrent.current = current;

  const setElement = useCallback((el: HTMLElement | null) => onElement(pageNumber, el), [onElement, pageNumber]);

  /* ---------------------------------------------------------------- pixels */

  useEffect(() => {
    if (!active) {
      setPainted(false);
      setFailed(false);
      setTextAsked(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let task: RenderTask | undefined;
    let page: PDFPageProxy | undefined;

    const withdraw = env.queue.add(pageNumber, async () => {
      if (cancelled) return;
      try {
        page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const natural = page.getViewport({ scale: 1, rotation: 0 });
        onMeasure(pageNumber, { width: natural.width, height: natural.height });

        const viewport = page.getViewport({ scale: renderScale, rotation });
        const ratio = outputScale(viewport.width, viewport.height, env);
        const pixelWidth = Math.floor(viewport.width * ratio);
        const pixelHeight = Math.floor(viewport.height * ratio);

        // A page that already has pixels is re-rendered into a *detached*
        // canvas and blitted over in one commit. pdf.js paints its background
        // over whatever it draws into, so rendering straight into the visible
        // canvas would replace the page the reader is looking at with a white
        // hole for the length of the render — a second or more per page, on
        // every zoom step and every quarter turn.
        //
        // Only the page being read is worth that second bitmap. Its
        // neighbours are in the render window, not on screen, and a double
        // buffer for each of them is exactly the memory a phone does not have;
        // they blank and repaint. The first paint has nothing to protect and
        // goes direct either way.
        const buffered = canvas.width > 0 && isCurrent.current;
        const target = buffered ? document.createElement("canvas") : canvas;
        target.width = pixelWidth;
        target.height = pixelHeight;

        try {
          task = page.render({
            canvas: target,
            viewport,
            transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
          });
          await task.promise;
          if (cancelled) return;

          if (buffered) {
            // Only the bitmap resolution is set here; the displayed size comes
            // from the wrapper's box (see the note above the component).
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
            canvas.getContext("2d")?.drawImage(target, 0, 0);
          }
        } finally {
          // Painted, cancelled or failed — the scratch buffer goes back at
          // once. A failed render otherwise kept a full-size bitmap alive for
          // as long as the page showed its error.
          if (buffered) target.width = target.height = 0;
        }
        setPainted(true);
        setFailed(false);
      } catch (error) {
        // Scrolling away and zooming both cancel renders in flight; that is
        // the mechanism working, not a failure worth reporting.
        if (cancelled || isCancellation(error)) return;
        // A page that cannot be drawn says so and offers another try. It used
        // to stay a numbered blank box for ever, with the reason logged in
        // development only — which is how an engine that could paint nothing
        // at all looked like a slow connection.
        setFailed(true);
        reportProblem("pdf.page", error, { page: pageNumber });
      }
    });

    return () => {
      cancelled = true;
      // Frees the queue's slot even if the job is stuck waiting for the page
      // itself (a stalled range request never settles).
      withdraw();
      task?.cancel();
      // Releases the page's parsed operator list on the worker side.
      page?.cleanup();
    };
  }, [doc, pageNumber, renderScale, rotation, active, env, attempt, onMeasure]);

  // Leaving the render window hands the bitmap back *now*. Unmounting the
  // element only makes it collectable, and mobile engines both collect canvas
  // memory lazily and cap the total — a fast scroll through a long scan could
  // hit that cap with every page it had already left still allocated.
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    return () => {
      if (canvas) canvas.width = canvas.height = 0;
    };
  }, [active]);

  /* ------------------------------------------------------------ text layer */

  // Selection, for the page being read only. The layer costs a second parse of
  // the page and a few hundred absolutely-positioned spans, so it follows the
  // pixels rather than racing them and exists on one page at a time. Where the
  // machine cannot spare it unasked — a weak one, or a touch device, where a
  // finger scrolls far more often than it selects — it waits for a long press
  // on the page (`env.textLayer === "on-demand"`); the press that builds it is
  // followed by the one that selects.
  //
  // pdf.js lays the layer out in *unrotated* page space and leaves the
  // rotation to the host's stylesheet; rather than reimplement that, a turned
  // page is simply not selectable. Turning is a way to read a landscape scan,
  // not a way to read its text.
  //
  // "Being read" includes "holding the selection": a drag that carries a
  // selection past the foot of a page scrolls the next one into the reading
  // band, and tearing the first page's spans down at that moment would delete
  // the selection from under the pointer. `keep` is one boolean on purpose —
  // were the two conditions separate dependencies, the selection arriving
  // would itself rebuild the layer it sits in.
  const keep = current || holdsSelection;
  useEffect(() => {
    const container = textRef.current;
    const wanted = env.textLayer === "always" || textAsked;
    if (!container || !painted || !keep || !wanted || rotation % 360 !== 0) return;

    let cancelled = false;
    let layer: TextLayer | undefined;

    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: renderScale, rotation });
        container.replaceChildren();
        setLayerDimensions(container, viewport);
        layer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container,
          viewport,
        });
        await layer.render();
      } catch {
        // Cancelled, or a page with no readable text. Selection is a courtesy
        // on top of a page that has already been drawn — nothing to report.
      }
    })();

    return () => {
      cancelled = true;
      layer?.cancel();
      container.replaceChildren();
    };
  }, [doc, pageNumber, renderScale, rotation, painted, keep, env.textLayer, textAsked]);

  useEffect(() => {
    if (!active) {
      setHoldsSelection(false);
      return;
    }
    const onSelection = () => {
      const container = textRef.current;
      const selection = document.getSelection();
      setHoldsSelection(
        !!container && !!selection && !selection.isCollapsed && selection.containsNode(container, true),
      );
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, [active]);

  useEffect(() => () => window.clearTimeout(press.current), []);

  // Only a page that could use the answer listens for the question.
  const askable = env.textLayer === "on-demand" && painted && !textAsked;
  const cancelPress = () => window.clearTimeout(press.current);

  return (
    <div
      ref={setElement}
      data-page={pageNumber}
      className="pdf-page relative shrink-0 bg-paper-50 shadow-[0_4px_18px_rgba(51,34,15,0.35)] ring-1 ring-gold-600/40"
      style={{ width, height, ["--total-scale-factor" as string]: scale }}
      onPointerDown={
        askable
          ? () => {
              cancelPress();
              press.current = window.setTimeout(() => setTextAsked(true), LONG_PRESS_MS);
            }
          : undefined
      }
      // A scroll cancels the pointer; a lift or a slide off the page ends it.
      onPointerUp={askable ? cancelPress : undefined}
      onPointerCancel={askable ? cancelPress : undefined}
      onPointerLeave={askable ? cancelPress : undefined}
      onContextMenu={askable ? () => setTextAsked(true) : undefined}
    >
      {active && (
        <>
          <canvas ref={canvasRef} className="block h-full w-full" />
          <div ref={textRef} className="textLayer" />
        </>
      )}
      {failed ? (
        <span className="absolute inset-0 z-[2] grid place-items-center p-4 text-center">
          <span>
            <span className="block font-body text-sm italic text-burgundy-600">{t("pdf.pageError")}</span>
            <button
              type="button"
              className="btn-rpg mt-3"
              onClick={() => {
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              {t("app.retry")}
            </button>
          </span>
        </span>
      ) : (
        !painted && (
          <span
            className="pointer-events-none absolute inset-0 grid place-items-center font-heading text-sm tracking-[0.25em] text-sepia-500/60"
            aria-hidden
          >
            {pageNumber}
          </span>
        )
      )}
    </div>
  );
});

/**
 * Device pixels per CSS pixel, given up as needed to stay under the machine's
 * canvas budget. Browsers refuse to allocate much beyond ~16 Mpx (iOS Safari
 * is the strict one) and hand back a blank canvas rather than an error, and a
 * small phone runs out of memory long before that — so the ceiling comes from
 * the capability grade (`PDF.canvasPixels`), and a slightly soft page beats a
 * white one.
 */
function outputScale(width: number, height: number, env: PageEnv): number {
  const ratio = Math.min(window.devicePixelRatio || 1, env.maxDpr);
  const pixels = width * height * ratio * ratio;
  return pixels <= env.maxPixels ? ratio : Math.max(0.5, ratio * Math.sqrt(env.maxPixels / pixels));
}
