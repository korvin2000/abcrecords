import { useEffect, useRef, useState } from "react";
import { touchOnly } from "@/lib/fx";
import { useI18n } from "@/lib/i18n";

/**
 * What the document viewer's two readers have in common — the pdf.js reader
 * (PdfDocumentView) and the image reader (PdfImageView): the pane geometry,
 * the "which page am I on" observer, the zoom step, the loading panel.
 *
 * It lives apart from both so that neither has to import the other: the image
 * reader must not drag the pdf.js engine into its chunk, which is the whole
 * reason it is a separate module (see PdfViewer.tsx).
 */

/** Zoom bounds and step, matching what browser PDF viewers offer. The upper
 *  bound is `PDF.maxScale` / `PDF.maxScaleTouch`. */
export const MIN_SCALE = 0.2;
export const ZOOM_STEP = 1.25;

/** Read once: a device does not grow a mouse while a document is open, and the
 *  answer sizes the zoom range and decides whether a text layer is built. */
export const TOUCH_ONLY = touchOnly();

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
export function gutterFor(paneWidth: number): number {
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
export const FIT_GUARD = 1;

/** The pane's inner size, which is what "fit" is relative to. */
export function usePaneSize(ref: React.RefObject<HTMLDivElement | null>): { width: number; height: number } {
  const [area, setArea] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setArea((prev) =>
        prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight },
      );
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [ref]);
  return area;
}

/**
 * Which page the reader is on: whatever crosses a thin band across the middle
 * of the pane. An observer rather than a scroll handler, so the work stays off
 * the scroll frame entirely.
 */
export function useReadingPage(
  rootRef: React.RefObject<HTMLDivElement | null>,
  pageEls: React.RefObject<Map<number, HTMLElement>>,
  pageCount: number,
  onPage: (page: number) => void,
): React.RefObject<IntersectionObserver | null> {
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !pageCount) return;

    const reading = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) reading.add(n);
          else reading.delete(n);
        }
        if (reading.size) onPage(Math.min(...reading));
      },
      { root, rootMargin: "-40% 0px -50% 0px" },
    );
    observer.current = io;
    for (const el of pageEls.current.values()) io.observe(el);
    return () => {
      observer.current = null;
      io.disconnect();
    };
  }, [rootRef, pageEls, pageCount, onPage]);
  return observer;
}

export function Opening({ progress }: { progress?: number }) {
  const { t } = useI18n();
  return (
    <div className="grid flex-1 place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4" role="status" aria-busy="true">
        <span className="h-12 w-12 animate-spin rounded-full border-2 border-gold-300/40 border-t-gold-500" />
        <p className="font-body text-sm italic text-sepia-600">{t("pdf.loading")}</p>
        {progress !== undefined && (
          <span className="h-1 w-40 overflow-hidden rounded-full bg-gold-600/20">
            <span
              className="block h-full rounded-full bg-gold-600 transition-[width] duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * "The document could not be opened" — and what the reader can do about it.
 *
 * The reason is the engine's own sentence, small: it means nothing to most
 * readers and everything to whoever is sent the screenshot. The first link has
 * no `download` attribute on purpose — the platform's own viewer is a working
 * reader wherever this one is not.
 */
export function OpenFailed({
  src,
  download,
  reason,
  onSwitch,
  onClose,
}: {
  src: string;
  download: string;
  reason?: string;
  /** Offered when the document also exists as page images. */
  onSwitch?: () => void;
  /** Offered where no toolbar is on screen to close the viewer with. */
  onClose?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid h-full flex-1 place-items-center px-6 text-center">
      <div>
        <p className="font-display text-xl text-burgundy-600">{t("pdf.error")}</p>
        {reason && <p className="mx-auto mt-2 max-w-md break-words font-body text-xs text-sepia-600/80">{reason}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href={src} target="_blank" rel="noopener noreferrer" className="btn-rpg inline-block">
            {t("pdf.openDirect")}
          </a>
          <a href={src} download={download} className="btn-rpg inline-block">
            {t("viewer.download")}
          </a>
          {onSwitch && (
            <button type="button" onClick={onSwitch} className="btn-rpg">
              {t("pdf.viewLite")}
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="btn-rpg">
              {t("viewer.close")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ReaderProps {
  src: string;
  title?: string;
  download: string;
  onClose?: () => void;
}

export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

export function sameMembers(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const n of a) if (!b.has(n)) return false;
  return true;
}

/** ".../magazine/2022/issue.pdf" -> "issue.pdf", for the download attribute. */
export function basename(url: string): string {
  return decodeURIComponent(url.split(/[?#]/, 1)[0].split("/").pop() || "document.pdf");
}
