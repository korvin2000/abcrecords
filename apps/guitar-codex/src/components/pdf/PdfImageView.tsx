import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { pageImage, type PagesManifest } from "@/lib/pdf/pages";
import { useI18n } from "@/lib/i18n";
import { PdfToolbar } from "./PdfToolbar";
import {
  FIT_GUARD,
  ZOOM_STEP,
  clamp,
  gutterFor,
  usePaneSize,
  useReadingPage,
  type ReaderProps,
} from "./readerShared";

/** Zoom bounds of the image reader, relative to fit-to-width. Past 4× a
 *  1100 px page image is only being enlarged; the pdf.js reader is one press
 *  away for anyone who needs the scan's own resolution. */
const IMAGE_MIN_ZOOM = 0.5;
const IMAGE_MAX_ZOOM = 4;

/**
 * The same document as pictures of its pages.
 *
 * Deliberately almost nothing: a column of lazily-loaded `<img>` in boxes of
 * the right shape. The browser decodes each page when it nears the screen,
 * keeps what it can afford and discards the rest — the windowing, the memory
 * budget and the decode scheduling the pdf.js reader has to implement by hand
 * are all the platform's here. There is no rotation, no text selection and no
 * "whole page" fit; what it offers instead is that it opens, at once, on a
 * phone that would not survive the PDF.
 */
export function PdfImageView({
  src,
  manifest,
  title,
  download,
  onClose,
  onSwitch,
}: ReaderProps & { manifest: PagesManifest; onSwitch: () => void }) {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef(new Map<number, HTMLElement>());
  const area = usePaneSize(scrollRef);
  const gutter = gutterFor(area.width);
  const pageCount = manifest.pages;

  const readingObserver = useReadingPage(scrollRef, pageEls, pageCount, setPage);

  const onElement = useCallback(
    (n: number, el: HTMLElement | null) => {
      const known = pageEls.current.get(n);
      if (known && known !== el) {
        readingObserver.current?.unobserve(known);
        pageEls.current.delete(n);
      }
      if (el && known !== el) {
        pageEls.current.set(n, el);
        readingObserver.current?.observe(el);
      }
    },
    [readingObserver],
  );

  const goToPage = useCallback(
    (wanted: number) => {
      const root = scrollRef.current;
      const target = clamp(Math.round(wanted), 1, pageCount);
      const el = pageEls.current.get(target);
      if (!root || !el) return;
      const top = root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - gutter;
      root.scrollTo({ top, behavior: Math.abs(target - page) <= 1 ? "smooth" : "auto" });
      setPage(target);
    },
    [pageCount, page, gutter],
  );

  // Stay on the page across a zoom step or a turned phone — every box changes
  // height at once (the same reason the pdf.js reader has this effect).
  const anchor = useRef(page);
  anchor.current = page;
  const pageWidth = Math.max(0, Math.floor((area.width - 2 * gutter - FIT_GUARD) * zoom));
  useLayoutEffect(() => {
    const root = scrollRef.current;
    const el = pageEls.current.get(anchor.current);
    if (!root || !el) return;
    root.scrollTop += el.getBoundingClientRect().top - root.getBoundingClientRect().top - gutter;
  }, [pageWidth, gutter]);

  const step = useCallback((direction: -1 | 1) => {
    setZoom((prev) => clamp(prev * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP), IMAGE_MIN_ZOOM, IMAGE_MAX_ZOOM));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || target?.tagName === "INPUT") return;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === "+" || e.key === "=") return stop(), step(1);
      if (e.key === "-" || e.key === "_") return stop(), step(-1);
      if (e.key === "ArrowLeft") return stop(), goToPage(page - 1);
      if (e.key === "ArrowRight") return stop(), goToPage(page + 1);
      if (e.key === "Home") return stop(), goToPage(1);
      if (e.key === "End") return stop(), goToPage(pageCount);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [step, goToPage, page, pageCount]);

  return (
    <>
      <PdfToolbar
        title={title}
        page={page}
        pageCount={pageCount}
        scale={zoom}
        fit={zoom === 1 ? "width" : null}
        onGoToPage={goToPage}
        onZoom={step}
        onFit={() => setZoom(1)}
        fitPage={false}
        href={src}
        download={download}
        onClose={onClose}
        onSwitch={onSwitch}
        switchLabel={t("pdf.viewFull")}
      />

      <div
        ref={scrollRef}
        tabIndex={0}
        className="codex-scroll relative flex-1 overflow-y-scroll overflow-x-auto outline-none"
      >
        {pageWidth > 0 && (
          <div className="flex w-fit min-w-full flex-col items-center gap-4" style={{ padding: gutter }}>
            {manifest.sizes.map(([w, h], i) => (
              <ImagePage
                key={i}
                pageNumber={i + 1}
                src={pageImage(manifest, i + 1)}
                width={pageWidth}
                height={Math.round((pageWidth * h) / w)}
                onElement={onElement}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ImagePage({
  pageNumber,
  src,
  width,
  height,
  onElement,
}: {
  pageNumber: number;
  src: string;
  width: number;
  height: number;
  onElement: (pageNumber: number, el: HTMLElement | null) => void;
}) {
  const setElement = useCallback((el: HTMLElement | null) => onElement(pageNumber, el), [onElement, pageNumber]);
  return (
    <div
      ref={setElement}
      data-page={pageNumber}
      className="pdf-page relative shrink-0 bg-paper-50 shadow-[0_4px_18px_rgba(51,34,15,0.35)] ring-1 ring-gold-600/40"
      style={{ width, height }}
    >
      <span
        className="pointer-events-none absolute inset-0 grid place-items-center font-heading text-sm tracking-[0.25em] text-sepia-500/60"
        aria-hidden
      >
        {pageNumber}
      </span>
      {/* The first page is wanted now; every other one when it nears the
          screen. The number behind it is what shows until then, and what stays
          if a file is missing. */}
      <img
        src={src}
        alt=""
        loading={pageNumber === 1 ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className="relative block h-full w-full"
        onError={(e) => {
          e.currentTarget.style.visibility = "hidden";
        }}
      />
    </div>
  );
}
