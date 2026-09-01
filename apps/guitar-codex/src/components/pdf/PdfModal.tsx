import { useCallback, useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { audio } from "@/lib/audio";
import { CornerOrnament } from "../OrnateFrame";
import { PdfViewer } from "./PdfViewer";

/**
 * The codex's other kind of book: a scanned document, opened in the same
 * lamplit reading desk as a biography but with the PDF where the article
 * would be.
 *
 * It is CodexShell's sibling, not its client — the backdrop, the 3D page-turn,
 * the filigree corners and the single closing clock are the same, and that
 * shared look is the point. What it deliberately does not have is everything
 * CodexShell exists to arrange around an *entry*: no tabs, no header, no
 * dossier, no per-entry language menu (a scan is one file, not one edition per
 * tongue) and no ← → leafing, because those keys belong to the pages of the
 * document while it is open.
 *
 * Everything below the toolbar is PdfViewer's; this file is only the room it
 * is read in.
 *
 * It is addressed by *file*, not by entry: the same room opens for an index row
 * that is a document (App) and for a `.pdf` link met inside an article or in
 * the Documents tab (lib/pdfViewer). Resolving the path is the caller's job,
 * because the two do it against different bases — the site root for `pdf` in
 * index.json, the resource base for a target written inside an entry.
 */

interface Props {
  /** Shown in the toolbar and as the dialog's accessible name: the entry's
   *  name for a document row, the link's own text for a document in an
   *  article. */
  title: string;
  /** The fully-resolved URL of the file. */
  src: string;
  /** Suggested download filename; the viewer falls back to the basename. */
  download?: string;
  /**
   * Stacking level. 40 is the codex's own layer, where a document *entry*
   * opens in place of a codex. A PDF opened from inside an open codex passes
   * 60 and stacks over it, exactly as the image and tablature viewers do —
   * see the layer list in App.
   */
  z?: number;
  onClose: () => void;
}

/** Panel turn and backdrop fade share this clock; it must match
 *  `.page-turn-close` in index.css. See CodexShell for the reasoning. */
const CLOSE_MS = 320;

export function PdfModal({ title, src, download, z = 40, onClose }: Props) {
  const reduced = useReducedMotion();
  const closeMs = reduced ? 0 : CLOSE_MS;
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(0);

  useEffect(() => {
    audio.open();
    return () => window.clearTimeout(closeTimer.current);
  }, []);

  const handleClose = useCallback(() => {
    setClosing((was) => {
      if (!was) {
        audio.close();
        closeTimer.current = window.setTimeout(onClose, closeMs);
      }
      return true;
    });
  }, [onClose, closeMs]);

  // Escape closes, as everywhere else in the codex. The viewer's own shortcuts
  // are bound in capture phase and stop what they consume, so the two never
  // fight over a key.
  //
  // This one is captured and stopped too, and that is not decoration: a `.pdf`
  // met inside an article opens this dialog **over** an open codex, whose own
  // Escape listener is bound on `window` in the bubble phase. Without the stop
  // both fired on one keypress and shutting the document also shut the entry
  // that linked to it. Capture at the window runs before bubble at the window,
  // so the innermost overlay closes and nothing behind it hears the key — the
  // same convention LanguageMenu, ImageViewer and StatsModal already keep.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [handleClose]);

  return (
    <m.div
      // Same frame gap and same safe-area handling as CodexShell: one token for
      // how far a book is held off the screen, and `env()` so a notched phone
      // in landscape does not put the toolbar under the cutout.
      //
      // The layer is a style rather than a `z-*` utility on purpose: two
      // Tailwind z-index classes on one element are decided by their order in
      // the generated sheet, not by the order they are written in.
      style={{ zIndex: z }}
      className="codex-overlay fixed inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ duration: closing ? closeMs / 1000 : 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={handleClose} />

      <div
        className={clsx(
          // `dvh`, not `vh`: on a phone the URL bar is part of the viewport
          // `vh` measures and not part of the one the reader can see, so a
          // 94vh panel stands 6 % taller than the screen it is centred in.
          // (CodexShell has carried the `dvh` form since it was fixed there.)
          "preserve-3d relative z-10 flex h-full max-h-[94dvh] w-full max-w-6xl flex-col",
          closing ? "page-turn-close" : "page-turn-open",
        )}
      >
        {/* The frame gap is this element's **padding**, not the viewer's inset.
            Anchoring the viewer to all four sides looks equivalent and is not:
            any `height` on it then over-constrains the box and CSS silently
            drops `bottom`, which is how the document's foot ended up drawn
            across the bottom border. Padding plus a flex child is arithmetic
            the layout engine does — there is no second number to disagree with.
            Same token as the codex's reading pane, so the two stay in step. */}
        <div className="parchment ornate-border relative flex flex-1 flex-col overflow-hidden rounded-sm p-[var(--codex-pane-inset)]">
          <CornerOrnament className="pointer-events-none absolute left-[5px] top-[5px] z-30 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipX className="pointer-events-none absolute right-[5px] top-[5px] z-30 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipY className="pointer-events-none absolute bottom-[5px] left-[5px] z-30 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipX flipY className="pointer-events-none absolute bottom-[5px] right-[5px] z-30 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />

          {/* Inset past the double border by the parent's padding, exactly as
              the codex's reading pane is, so the toolbar and both scrollbar
              tracks sit inside the frame rather than across it. */}
          <PdfViewer
            className="flex-1"
            src={src}
            title={title}
            download={download}
            onClose={handleClose}
          />
        </div>
      </div>
    </m.div>
  );
}
