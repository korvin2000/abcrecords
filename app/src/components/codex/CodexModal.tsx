import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import clsx from "clsx";
import type { EntryBundle, IndexEntry } from "@/lib/types";
import { loadEntry } from "@/lib/catalog";
import { countryDisplay, regionName, yearOf } from "@/lib/metadata";
import { audio } from "@/lib/audio";
import { typeLabel, useI18n } from "@/lib/i18n";
import { CornerOrnament } from "../OrnateFrame";
import { BiographyTab } from "./BiographyTab";
import { GalleryTab } from "./GalleryTab";
import { DocumentsTab } from "./DocumentsTab";
import { LoreTab } from "./LoreTab";

export type CodexTab = "biography" | "gallery" | "documents" | "lore";
const TABS: CodexTab[] = ["biography", "gallery", "documents", "lore"];

interface Props {
  entry: IndexEntry;
  slug: string;
  onClose: () => void;
  /** Turn to the previous/next entry in the current (filtered) order. */
  onTurn: (dir: -1 | 1) => void;
  /** Open another entry by its .bio.md path (cross-links in articles). */
  onNavigateEntry: (mdPath: string) => void;
}

/**
 * The full-screen codex — Copendum's CharacterDetail as the base (parchment,
 * ornate double border, page-turn 3D open/close, ❧ corner fleurons), extended
 * with the 4 tabs required by docs/Biography_card_Design.md.
 */
export function CodexModal({ entry, slug, onClose, onTurn, onNavigateEntry }: Props) {
  const { t, locale } = useI18n();
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<CodexTab>("biography");
  const [bundle, setBundle] = useState<EntryBundle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load entry data (cached after first open)
  useEffect(() => {
    let alive = true;
    setBundle(null);
    void loadEntry(entry).then((b) => {
      if (alive) setBundle(b);
    });
    return () => {
      alive = false;
    };
  }, [entry]);

  // Reset to Biography when the person changes; announce the page turn.
  useEffect(() => {
    setTab("biography");
    scrollRef.current?.scrollTo({ top: 0 });
    audio.open();
  }, [slug]);

  const handleClose = useCallback(() => {
    setClosing((was) => {
      if (!was) {
        audio.close();
        window.setTimeout(onClose, 420);
      }
      return true;
    });
  }, [onClose]);

  // ESC to close · ← → to leaf between entries
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowLeft") onTurn(-1);
      else if (e.key === "ArrowRight") onTurn(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, onTurn]);

  const switchTab = (next: CodexTab) => {
    if (next === tab) return;
    audio.pageTurn();
    setTab(next);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const meta = bundle?.data?.metadata;
  // comma-lists (e.g. the project-team roster entry) get breathing room to wrap
  const forename = (meta?.forename ?? entry.forename ?? "").replace(/,\s*/g, ", ");
  const surname = meta?.surname ?? entry.surname;
  const longName = forename.length > 24;
  const born = yearOf(meta?.dates?.born);
  const died = yearOf(meta?.dates?.died);
  const years = born ? `${born} — ${died ?? "…"}` : null;
  const country =
    (meta?.country ? regionName(meta.country, locale) : null) ?? countryDisplay(entry.country, locale);
  const subtitle = [typeLabel(t, meta?.type ?? entry.type), country, years].filter(Boolean).join(" · ");

  return (
    <m.div
      className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="dialog"
      aria-modal="true"
      aria-label={entry.title}
    >
      {/* Backdrop — dimmed sepia, like a reading desk in lamplight */}
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={handleClose} />

      {/* Book panel with 3D page-turn */}
      <div
        ref={panelRef}
        className={clsx(
          "preserve-3d relative z-10 flex h-full max-h-[94vh] w-full max-w-6xl flex-col",
          closing ? "page-turn-close" : "page-turn-open",
        )}
      >
        <div className="parchment ornate-border relative flex-1 overflow-hidden rounded-sm">
          {/* Corner fleurons */}
          <div className="pointer-events-none absolute left-2 top-2 select-none text-2xl text-sepia-600/50">❧</div>
          <div className="pointer-events-none absolute right-2 top-2 rotate-90 select-none text-2xl text-sepia-600/50">❧</div>
          <div className="pointer-events-none absolute bottom-2 left-2 -rotate-90 select-none text-2xl text-sepia-600/50">❧</div>
          <div className="pointer-events-none absolute bottom-2 right-2 rotate-180 select-none text-2xl text-sepia-600/50">❧</div>

          {/* Close (dark rectangular, upper-left per design brief) */}
          <button onClick={handleClose} className="btn-rpg absolute left-4 top-4 z-20" aria-label={t("codex.close")}>
            {t("codex.close")}
          </button>

          {/* Prev / next page corners */}
          <div className="absolute right-4 top-4 z-20 flex gap-2">
            <button onClick={() => onTurn(-1)} className="btn-rpg !px-3" aria-label={t("codex.prev")} title={t("codex.prev")}>
              ←
            </button>
            <button onClick={() => onTurn(1)} className="btn-rpg !px-3" aria-label={t("codex.next")} title={t("codex.next")}>
              →
            </button>
          </div>

          {/* Scrollable interior */}
          <div ref={scrollRef} className="codex-scroll h-full overflow-y-auto px-4 pb-8 pt-16 sm:px-10 sm:pt-14">
            <div className="mx-auto max-w-5xl">
              <header className="mb-5 text-center">
                <div className="mb-2 font-display text-xs tracking-[0.4em] text-sepia-600/80">{t("codex.entry")}</div>
                <h1
                  className={clsx(
                    "font-display font-bold uppercase text-burgundy-600 [text-shadow:0_1px_0_rgba(251,243,210,0.8),0_2px_3px_rgba(51,34,15,0.25)]",
                    longName
                      ? "text-balance text-2xl tracking-[0.06em] sm:text-3xl"
                      : "text-4xl tracking-[0.12em] sm:text-5xl",
                  )}
                >
                  {forename}
                </h1>
                {surname && surname !== forename && (
                  <h2 className="mt-1 font-display text-3xl font-semibold uppercase tracking-[0.14em] text-burgundy-700 [text-shadow:0_1px_0_rgba(251,243,210,0.8),0_2px_3px_rgba(51,34,15,0.2)] sm:text-4xl">
                    {surname}
                  </h2>
                )}
                <p className="mt-2 font-body text-base italic text-sepia-600 sm:text-lg">{subtitle}</p>
                <div className="divider-ornament mt-4">
                  <span className="text-xl" aria-hidden>
                    ❦
                  </span>
                </div>
              </header>

              {/* Tab bar */}
              <nav className="mb-6 flex flex-wrap justify-center gap-1 rounded-md border border-gold-600/40 bg-paper-100/60 p-1 sm:gap-2" role="tablist">
                {TABS.map((tb) => (
                  <button
                    key={tb}
                    role="tab"
                    aria-selected={tab === tb}
                    onClick={() => switchTab(tb)}
                    onMouseEnter={() => audio.hover()}
                    className={clsx(
                      "rounded px-3 py-1.5 font-heading text-[0.72rem] uppercase tracking-[0.18em] transition-all duration-200 sm:px-5 sm:text-[0.8rem]",
                      tab === tb
                        ? "bg-burgundy-600 text-paper-50 shadow-[0_2px_10px_rgba(122,31,43,0.4)]"
                        : "text-sepia-600 hover:bg-paper-200/80 hover:text-ink-800",
                    )}
                  >
                    {t(`tabs.${tb}`)}
                  </button>
                ))}
              </nav>

              {/* Tab content — leaf-through on switch */}
              <div key={tab} className="leaf-in min-h-[40vh]">
                {bundle === null ? (
                  <CodexSkeleton />
                ) : tab === "biography" ? (
                  <BiographyTab bundle={bundle} onNavigateEntry={onNavigateEntry} />
                ) : tab === "gallery" ? (
                  <GalleryTab entry={entry} slug={slug} bundle={bundle} />
                ) : tab === "documents" ? (
                  <DocumentsTab bundle={bundle} />
                ) : (
                  <LoreTab entry={entry} bundle={bundle} />
                )}
              </div>

              <footer className="mt-10 text-center font-body text-xs italic text-sepia-600/70">{t("codex.end")}</footer>
            </div>
          </div>
        </div>
      </div>
    </m.div>
  );
}

function CodexSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-5 w-full rounded" />
      <div className="skeleton h-5 w-5/6 rounded" />
      <div className="skeleton mt-6 h-40 w-full rounded" />
    </div>
  );
}
