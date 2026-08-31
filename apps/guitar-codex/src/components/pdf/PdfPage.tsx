import { useEffect, useRef, useState } from "react";
import {
  setLayerDimensions,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from "pdfjs-dist";
import { isCancellation } from "@/lib/pdf/engine";

/**
 * One page of the open document: a canvas painted by pdf.js, plus the
 * transparent text layer that makes the page selectable.
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
 */

export interface PageSize {
  /** Unrotated page size in PDF points (72 per inch), i.e. at scale 1. */
  width: number;
  height: number;
}

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number;
  /** Display scale: CSS pixels per PDF point, as shown right now. */
  scale: number;
  /** Scale to paint at; trails `scale` while the reader is still zooming. */
  renderScale: number;
  /** Degrees clockwise; a multiple of 90. */
  rotation: number;
  /** The box to occupy — already scaled and rotated by the viewer. */
  box: { width: number; height: number };
  /** Inside the render window. */
  active: boolean;
  /** Reports the page's true size the first time it is opened, so the viewer
   *  can correct a box it had only estimated from the first page. */
  onMeasure: (pageNumber: number, size: PageSize) => void;
  /** Hands the element to the viewer, which scrolls to it and observes it. */
  onElement: (pageNumber: number, el: HTMLElement | null) => void;
}

/**
 * Cap on one canvas's pixels. Browsers refuse to allocate much beyond ~16 Mpx
 * (iOS Safari is the strict one) and hand back a blank canvas rather than an
 * error, so device pixel ratio is given up before that line is reached — a
 * slightly soft page beats a white one.
 */
const MAX_CANVAS_PIXELS = 8_000_000;

export function PdfPage({
  doc,
  pageNumber,
  scale,
  renderScale,
  rotation,
  box,
  active,
  onMeasure,
  onElement,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (!active) {
      setPainted(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let task: RenderTask | undefined;
    let layer: TextLayer | undefined;
    let page: PDFPageProxy | undefined;

    void (async () => {
      try {
        page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const natural = page.getViewport({ scale: 1, rotation: 0 });
        onMeasure(pageNumber, { width: natural.width, height: natural.height });

        const viewport = page.getViewport({ scale: renderScale, rotation });
        const ratio = outputScale(viewport.width, viewport.height);
        const width = Math.floor(viewport.width * ratio);
        const height = Math.floor(viewport.height * ratio);

        // A page that already has pixels is re-rendered into a *detached*
        // canvas and blitted over in one commit. pdf.js paints its background
        // over whatever it draws into, so rendering straight into the visible
        // canvas would replace the page the reader is looking at with a white
        // hole for the length of the render — a second or more per page, on
        // every zoom step and every quarter turn. The first paint has nothing
        // to protect and goes direct, which is also where the memory would
        // hurt: a double buffer for each page of a fresh document at once.
        const buffered = canvas.width > 0;
        const target = buffered ? document.createElement("canvas") : canvas;
        target.width = width;
        target.height = height;

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
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(target, 0, 0);
          target.width = target.height = 0; // hand the buffer back at once
        }
        setPainted(true);

        // The text layer costs a second parse of the page, so it follows the
        // pixels rather than racing them: the reader sees the page first and
        // gains selection a moment later.
        //
        // pdf.js lays the layer out in *unrotated* page space and leaves the
        // rotation to the host's stylesheet; rather than reimplement that, a
        // turned page is simply not selectable. Turning is a way to read a
        // landscape scan, not a way to read its text.
        const container = textRef.current;
        if (!container || rotation % 360 !== 0) return;
        container.replaceChildren();
        setLayerDimensions(container, viewport);
        layer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container,
          viewport,
        });
        await layer.render();
      } catch (error) {
        // Scrolling away and zooming both cancel renders in flight; that is
        // the mechanism working, not a failure worth reporting.
        if (!cancelled && !isCancellation(error) && import.meta.env.DEV) {
          console.warn(`[pdf] page ${pageNumber} failed to render`, error);
        }
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
      layer?.cancel();
      // Releases the page's parsed operator list on the worker side; the
      // canvas goes with the unmount below.
      page?.cleanup();
    };
  }, [doc, pageNumber, renderScale, rotation, active, onMeasure]);

  return (
    <div
      ref={(el) => onElement(pageNumber, el)}
      data-page={pageNumber}
      className="pdf-page relative shrink-0 bg-paper-50 shadow-[0_4px_18px_rgba(51,34,15,0.35)] ring-1 ring-gold-600/40"
      style={{ width: box.width, height: box.height, ["--total-scale-factor" as string]: scale }}
    >
      {active && (
        <>
          <canvas ref={canvasRef} className="block h-full w-full" />
          <div ref={textRef} className="textLayer" />
        </>
      )}
      {!painted && (
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center font-heading text-sm tracking-[0.25em] text-sepia-500/60"
          aria-hidden
        >
          {pageNumber}
        </span>
      )}
    </div>
  );
}

/** Device pixels per CSS pixel, given up as needed to stay under the cap. */
function outputScale(width: number, height: number): number {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixels = width * height * ratio * ratio;
  return pixels <= MAX_CANVAS_PIXELS ? ratio : Math.max(1, ratio * Math.sqrt(MAX_CANVAS_PIXELS / pixels));
}
