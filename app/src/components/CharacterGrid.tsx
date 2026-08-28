import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { GRID } from "@/config";
import type { CatalogRecord } from "@/lib/catalog";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { CharacterCard } from "./CharacterCard";
import { Divider } from "./OrnateFrame";

interface Props {
  /** Already ordered: entries in the reader's language first, best match up. */
  records: CatalogRecord[];
  /** How many leading records are in the reader's language; the rest render
   *  as dimmed "found in another tongue" cards behind an ornate divider. */
  nativeCount: number;
  onSelect: (slug: string) => void;
}

/**
 * The catalogue grid, drawn a page at a time.
 *
 * ## Why it is paged
 *
 * A card is not cheap: an ornate frame, a portrait, a hover glow, and — on a
 * fine pointer — five motion values with two springs. At 736 entries the grid
 * used to mount all of them, and wrap them in `AnimatePresence mode="popLayout"`
 * with `layout` on every cell, which measures every cell on every frame of a
 * reflow. The first keystroke in the search box took **15.7 s** to reach the
 * next frame, with long tasks up to 879 ms; the page held 20 000 DOM nodes and
 * 100 MB of heap. None of that was the search — a query over the whole
 * catalogue measures well under a millisecond.
 *
 * So: `GRID.pageSize` cards, then more on request. Scrolling reveals the next
 * `GRID.autoPages` pages by itself (a sentinel below the last row), after
 * which the reader asks explicitly. That bound is the point — endless scroll
 * would put us back where we started, one screen at a time.
 *
 * The layout animations are gone with it. A cell still *arrives* (a short
 * fade-and-rise on mount), because that is cheap and only happens once per
 * card; what is gone is `layout` and the exit choreography, which cost their
 * price on every cell every time the result list changed.
 *
 * ## What happens off-screen
 *
 * `.grid-cell` carries layout containment always, and on touch devices also
 * `content-visibility: auto` — the browser then skips layout and paint for
 * rows that are not on screen and restores them as they scroll in, which is
 * the windowing this grid wants without any of virtualization's fixed-height
 * lies (ornate frames make row heights vary). It is limited to `(hover: none)`
 * because the paint containment it implies would clip the hover glow and lift
 * that only a fine pointer can produce; see `index.css`.
 */
export function CharacterGrid({ records, nativeCount, onSelect }: Props) {
  const { t } = useI18n();
  const [shown, setShown] = useState(GRID.pageSize);
  const [autoReveals, setAutoReveals] = useState(0);

  // A new result list starts a new first page. Adjusting state during render
  // (rather than in an effect) means the reader never sees one frame of the
  // old page count against the new results.
  const [seen, setSeen] = useState(records);
  if (seen !== records) {
    setSeen(records);
    setShown(GRID.pageSize);
    setAutoReveals(0);
  }

  const total = records.length;
  const visible = Math.min(shown, total);
  const hasMore = visible < total;

  const revealMore = useCallback(() => {
    setShown((n) => n + GRID.pageStep);
  }, []);

  const sentinel = useRef<HTMLDivElement | null>(null);
  const canAutoReveal = hasMore && autoReveals < GRID.autoPages;

  useEffect(() => {
    const node = sentinel.current;
    // No IntersectionObserver, or the free pages are spent: the button below
    // is the whole interface, and it always works.
    if (!node || !canAutoReveal || typeof IntersectionObserver !== "function") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setAutoReveals((n) => n + 1);
        revealMore();
      },
      { rootMargin: GRID.revealMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canAutoReveal, revealMore, shown]);

  if (total === 0) {
    return (
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-16 max-w-md px-6 text-center">
        <div className="mb-4 text-5xl opacity-70" aria-hidden>
          🏺
        </div>
        <p className="font-display text-2xl text-burgundy-600">{t("search.empty.title")}</p>
        <p className="mt-2 font-body italic text-sepia-600">{t("search.empty.hint")}</p>
      </m.div>
    );
  }

  // The divider sits where the reader's own language runs out — but only once
  // the page has actually reached that point.
  const nativeShown = Math.min(nativeCount, visible);
  const foreignShown = Math.max(0, visible - nativeCount);
  const hasDivider = nativeCount > 0 && nativeShown === nativeCount && foreignShown > 0;

  const card = (record: CatalogRecord, i: number, foreign: boolean) => (
    <Cell key={record.slug} index={i}>
      <CharacterCard record={record} foreign={foreign} eager={i < 4} onSelect={onSelect} />
    </Cell>
  );

  return (
    <>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        {records.slice(0, nativeShown).map((record, i) => card(record, i, false))}

        {hasDivider && (
          <div
            className="col-span-2 flex items-center justify-center gap-3 py-3 sm:col-span-3 lg:col-span-4"
            role="separator"
            aria-label={t("search.otherLangs")}
          >
            <span className="h-px max-w-40 flex-1 bg-gradient-to-r from-transparent to-burgundy-500/55" aria-hidden />
            <span className="font-heading text-[0.68rem] font-bold uppercase tracking-[0.3em] text-burgundy-600/90">
              ✦ {t("search.otherLangs")} ✦
            </span>
            <span className="h-px max-w-40 flex-1 bg-gradient-to-l from-transparent to-burgundy-500/55" aria-hidden />
          </div>
        )}

        {records
          .slice(nativeCount, nativeCount + foreignShown)
          .map((record, i) => card(record, nativeShown + i, true))}
      </div>

      {hasMore ? (
        <div className="mx-auto mt-8 max-w-6xl px-4 pb-10 text-center">
          {/* Sits above the button, so the next page is already arriving by the
              time the button would have come into view. */}
          <div ref={sentinel} aria-hidden className="h-px w-full" />
          <Divider className="mx-auto mb-5 w-full max-w-xs opacity-60" />
          <button
            type="button"
            onClick={() => {
              audio.pageTurn();
              revealMore();
            }}
            onMouseEnter={() => audio.hover()}
            className="btn-rpg"
          >
            {t("grid.more")}
          </button>
          <p className="mt-3 font-heading text-[0.66rem] uppercase tracking-[0.28em] text-sepia-600/80">
            {t("grid.shown", { n: visible, total })}
          </p>
        </div>
      ) : (
        <div className="pb-10" />
      )}
    </>
  );
}

/** Stagger only the first row or so: past that the delay is longer than the
 *  reader's patience, and the animation is what makes a page reveal cost
 *  anything at all. */
const STAGGER_LIMIT = 8;
const CELL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Cell({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <m.div
      className="grid-cell"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        ease: CELL_EASE,
        delay: Math.min(index % GRID.pageSize, STAGGER_LIMIT) * 0.04,
      }}
    >
      {children}
    </m.div>
  );
}
