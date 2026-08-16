import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import type { Lang } from "@/lib/languages";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { LanguageMenu } from "../LanguageMenu";
import { CornerOrnament } from "../OrnateFrame";
import { CodexScrollProvider } from "./codexScroll";

interface Props {
  /** Identifies the open entry; a change returns the pane to the top. */
  slug: string;
  ariaLabel: string;
  /** Editions this entry exists in; the menu appears only when there are 2+. */
  langs: Lang[];
  contentLang: Lang;
  onContentLang: (lang: Lang) => void;
  onClose: () => void;
  /** Turn to the previous/next entry in the current order. */
  onTurn: (dir: -1 | 1) => void;
  children: ReactNode;
}

/**
 * The book itself — everything around the content: backdrop, 3D page-turn
 * panel, filigree corners, close/prev/next, the per-entry language menu, the
 * scrolling reading pane and the closing line. It knows nothing about
 * biographies, dossiers or tabs.
 *
 * Layout invariants worth keeping:
 * - The reading pane is `absolute inset-[11px]` (not h-full) so its whole
 *   scrollbar track — top to bottom — stays inside the double border.
 * - The close/nav buttons sit at left-9/right-9, clear of the 44px corner
 *   filigree, so neither covers the other.
 * - The body scroll-lock belongs to App (single owner); do not add one here.
 *
 * **One shell, many entries.** App deliberately does *not* key this component
 * on the slug: ← → changes `slug` in place. Remounting instead put two of
 * these on screen at once for the length of the crossfade, and two stacked
 * translucent backdrops do not add up to one — `1-(1-0.55a)(1-0.55b)` dips to
 * ~0.47 mid-turn, which is the page visibly showing through — while the
 * incoming panel replayed the whole 0.85 s opening turn and a second
 * full-viewport `backdrop-filter` was composited over the first.
 *
 * **Closing is one movement, not two.** The dismissal used to run the panel's
 * CSS turn (450 ms) and *then* let App's `AnimatePresence` fade the backdrop
 * (250 ms) — 700 ms to put a book down that took ~500 ms to open, with the
 * dimmed backdrop hanging on after the panel had gone. Both now run together
 * on one `CLOSE_MS` clock, and the exit is instant because there is nothing
 * left to fade by the time this unmounts.
 */

/** Panel turn and backdrop fade share this; it must match `.page-turn-close`
 *  in index.css. Zero under reduced motion — with the animations clamped to
 *  nothing there is no movement to wait for, only a delay. */
const CLOSE_MS = 320;
export function CodexShell({
  slug,
  ariaLabel,
  langs,
  contentLang,
  onContentLang,
  onClose,
  onTurn,
  children,
}: Props) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const closeMs = reduced ? 0 : CLOSE_MS;
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  // A different entry or a different edition starts at the top of the page.
  useEffect(scrollToTop, [scrollToTop, slug, contentLang]);

  useEffect(() => {
    audio.open();
    return () => window.clearTimeout(closeTimer.current);
  }, []);

  // The panel turns shut and the backdrop lifts on the same clock; App unmounts
  // the shell when both have finished.
  const handleClose = useCallback(() => {
    setClosing((was) => {
      if (!was) {
        audio.close();
        closeTimer.current = window.setTimeout(onClose, closeMs);
      }
      return true;
    });
  }, [onClose, closeMs]);

  // A page already on its way out does not turn — the incoming entry would be
  // rendered into a panel that is mid-dismissal and about to unmount.
  const handleTurn = useCallback(
    (dir: -1 | 1) => {
      if (!closing) onTurn(dir);
    },
    [closing, onTurn],
  );

  // ESC to close · ← → to leaf between entries. Overlays above the codex
  // (LanguageMenu, ImageViewer) capture Escape first and stop it — keep that
  // ordering when adding nested overlays.
  //
  // The handlers travel through a ref so the listener is bound once per open
  // codex: `onTurn` is rebuilt by App whenever the result order changes, which
  // is every keystroke in the search box behind the modal.
  const keys = useRef({ handleClose, handleTurn });
  keys.current = { handleClose, handleTurn };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") keys.current.handleClose();
      else if (e.key === "ArrowLeft") keys.current.handleTurn(-1);
      else if (e.key === "ArrowRight") keys.current.handleTurn(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <m.div
      className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      // Nothing is left to fade: `closing` has already taken this to zero.
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ duration: closing ? closeMs / 1000 : 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Backdrop — dimmed sepia, like a reading desk in lamplight */}
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={handleClose} />

      {/* Book panel with 3D page-turn */}
      <div
        className={clsx(
          "preserve-3d relative z-10 flex h-full max-h-[94vh] w-full max-w-6xl flex-col",
          closing ? "page-turn-close" : "page-turn-open",
        )}
      >
        <div className="parchment ornate-border relative flex-1 overflow-hidden rounded-sm">
          {/* Minimal musical corners — same restrained motif as the catalogue cards */}
          <CornerOrnament className="pointer-events-none absolute left-[5px] top-[5px] z-10 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipX className="pointer-events-none absolute right-[5px] top-[5px] z-10 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipY className="pointer-events-none absolute bottom-[5px] left-[5px] z-10 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipX flipY className="pointer-events-none absolute bottom-[5px] right-[5px] z-10 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />

          {/* Close control stays inset past the corner mark. */}
          <button onClick={handleClose} className="btn-rpg absolute left-9 top-4 z-20" aria-label={t("codex.close")}>
            <span className="hidden sm:inline">{t("codex.close")}</span>
            <span className="sm:hidden" aria-hidden>
              ✕
            </span>
          </button>

          {/* Language of this entry — only when the chronicle exists in
              several tongues; switches the open page on the fly. */}
          {langs.length > 1 && (
            <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2">
              <LanguageMenu
                variant="codex"
                value={contentLang}
                options={langs}
                onSelect={onContentLang}
                title={t("lang.entry")}
                heading={t("lang.entry")}
              />
            </div>
          )}

          {/* Prev / next page turns — inset past the corner filigree */}
          <div className="absolute right-9 top-4 z-20 flex gap-2">
            <button onClick={() => handleTurn(-1)} className="btn-rpg !px-3" aria-label={t("codex.prev")} title={t("codex.prev")}>
              ←
            </button>
            <button onClick={() => handleTurn(1)} className="btn-rpg !px-3" aria-label={t("codex.next")} title={t("codex.next")}>
              →
            </button>
          </div>

          {/* Reading pane — anchored to the frame so the scrollbar track and
              the very last line both live inside the border */}
          <div ref={scrollRef} className="codex-scroll absolute inset-[11px] overflow-y-auto px-4 pb-6 pt-16 sm:px-9 sm:pt-14">
            <div className="mx-auto max-w-5xl">
              <CodexScrollProvider value={scrollToTop}>{children}</CodexScrollProvider>

              <footer className="mt-10 text-center font-body text-xs italic text-sepia-600/70">{t("codex.end")}</footer>
            </div>
          </div>
        </div>
      </div>
    </m.div>
  );
}
