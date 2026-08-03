import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { m } from "framer-motion";
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
 */
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
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  // A different entry or a different edition starts at the top of the page.
  useEffect(scrollToTop, [scrollToTop, slug, contentLang]);

  useEffect(() => {
    audio.open();
  }, []);

  // The panel plays its closing animation before App unmounts it.
  const handleClose = useCallback(() => {
    setClosing((was) => {
      if (!was) {
        audio.close();
        window.setTimeout(onClose, 420);
      }
      return true;
    });
  }, [onClose]);

  // ESC to close · ← → to leaf between entries. Overlays above the codex
  // (LanguageMenu, ImageViewer) capture Escape first and stop it — keep that
  // ordering when adding nested overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowLeft") onTurn(-1);
      else if (e.key === "ArrowRight") onTurn(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, onTurn]);

  return (
    <m.div
      className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
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
            <button onClick={() => onTurn(-1)} className="btn-rpg !px-3" aria-label={t("codex.prev")} title={t("codex.prev")}>
              ←
            </button>
            <button onClick={() => onTurn(1)} className="btn-rpg !px-3" aria-label={t("codex.next")} title={t("codex.next")}>
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
