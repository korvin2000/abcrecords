import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import type { Lang } from "@/lib/languages";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { usePreference } from "@/lib/settings";
import { Glyph } from "../Glyph";
import { LanguageMenu } from "../LanguageMenu";
import { CornerOrnament } from "../OrnateFrame";
import { SIGN, TURN_REF } from "@/lib/signs";
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
 * panel, filigree corners, close/prev/next, the reading-size steps, the
 * per-entry language menu, the scrolling reading pane and the closing line. It knows nothing about
 * biographies, dossiers or tabs.
 *
 * Layout invariants worth keeping:
 * - The reading pane is inset from the frame (not h-full) so its whole
 *   scrollbar track — top to bottom — stays inside the double border.
 * - The controls share one flex row, held one corner gutter outside that
 *   pane and pushed `--codex-scrollbar-guard` clear of it on the trailing
 *   side, so no amount of narrowing can make two of them overlap or put one
 *   under the scrollbar — overlay scrollbars included, which is what the
 *   *guard* in that name is about. Every number is derived from
 *   `--codex-pane-inset`; see the chain in tokens.css. The row's margins are
 *   its own padding, never a child's: the edition menu drops out on a narrow
 *   panel and the two corners must not notice.
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

/**
 * The reading-size ladder behind the row's `-` / `+`.
 *
 * A *ratio*, deliberately, and not a font size: the article already sizes
 * itself from the width of its own column (see `.bio-article` in article.css),
 * so what the reader is adjusting is that whole fluid scale at once — which is
 * why one pair of buttons can serve a phone, a tablet and a desk without any
 * of them needing their own numbers. It is spent as `zoom` on the reading
 * pane's contents (`.codex-read`), so figures, tables and the dossier grid
 * follow the prose instead of being left behind by it.
 *
 * The bounds are what the layout survives rather than taste: below 0.8 the
 * captions stop being legible, and above 1.6 a two-column record grid in a
 * 320 px pane has nowhere left to go. The step is coarse enough that three
 * taps make a visible difference on a phone.
 */
const TEXT_SCALE = { min: 0.8, max: 1.6, step: 0.1 } as const;

/** Rounded to one decimal: 0.1 steps accumulate float dust otherwise, and the
 *  value is persisted, so the dust would be stored too. */
function stepScale(from: number, dir: -1 | 1): number {
  const next = Math.round((from + dir * TEXT_SCALE.step) * 10) / 10;
  return Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, next));
}

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
  // Remembered, not per-open: a reader who needs larger type needs it on every
  // entry, and being asked again at each one is the whole complaint.
  const [textScale, setTextScale] = usePreference("textScale");
  const scale = Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, textScale));
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const resize = (dir: -1 | 1) => {
    audio.click();
    setTextScale(stepScale(scale, dir));
  };

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
      className="codex-overlay fixed inset-0 z-40 flex items-center justify-center"
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
          // `dvh`, not `vh`: on a phone the URL bar is part of the viewport
          // `vh` measures and not part of the one the reader can see, so a
          // 94vh panel stood 6 % taller than the screen it was centred in.
          // The width cap rises from 72 rem to 84 rem — enough for the gallery
          // and the documents list to gain a column on a wide screen, and not
          // so much that the 48 rem reading measure inside starts to look
          // marooned. A book on a 4K desk is still a book.
          "preserve-3d relative z-10 flex h-full max-h-[94dvh] w-full max-w-[84rem] flex-col",
          closing ? "page-turn-close" : "page-turn-open",
        )}
      >
        <div className="parchment ornate-border relative flex-1 overflow-hidden rounded-sm">
          {/* Minimal musical corners — same restrained motif as the catalogue cards */}
          <CornerOrnament className="pointer-events-none absolute left-[5px] top-[5px] z-20 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipX className="pointer-events-none absolute right-[5px] top-[5px] z-20 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipY className="pointer-events-none absolute bottom-[5px] left-[5px] z-10 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />
          <CornerOrnament flipX flipY className="pointer-events-none absolute bottom-[5px] right-[5px] z-10 h-7 w-7 opacity-65 sm:h-8 sm:w-8" />

          {/* Parchment fade under the control row, so scrolled article lines do
              not surface half-hidden behind the buttons. */}
          <div className="codex-topfade" aria-hidden />

          {/* One row for every control: close, the edition menu, the two
              reading-size steps and the two page turns.
              They used to be three independent absolutely-positioned boxes —
              close at `left-9`, the language menu centred on `left-1/2`, the
              page turns at `right-9` — which is a layout that works until the
              panel is narrow enough for the middle one to reach the right one.
              Below about 360 px it did, and the edition menu sat on top of the
              back arrow. A flex row cannot overlap itself. `.codex-ctrl`
              (codex.css) is what makes each control a compact square, and
              `.codex-ctrl-row` is what puts the row in the panel's corners and
              keeps the trailing arrow clear of the reading pane's scrollbar —
              including the *overlay* scrollbars of iOS and Android, which take
              no layout width but are still painted over whatever is there. */}
          <div className="codex-ctrl-row">
            <button onClick={handleClose} className="btn-rpg codex-ctrl" aria-label={t("codex.close")} title={t("codex.close")}>
              <span className="hidden lg:inline">{t("codex.close")}</span>
              <Glyph char={SIGN.close} size="var(--codex-ctrl-glyph)" className="glyph--until-lg" />
            </button>

            <div className="codex-ctrl-group">
              {/* Language of this entry — only when the chronicle exists in
                  several tongues; switches the open page on the fly.

                  It is also the one control here that may be *dropped*: five
                  of them on a 320 px panel leaves ~2 px of slack, and this is
                  the widest (a flag, a code and a chevron) and the least often
                  wanted mid-read. `.codex-ctrl-lang` hides it below 25 rem —
                  the reader's tongue is still the header's menu, one Escape
                  away. Close stays in the leading corner and the turns in the
                  trailing one either way: the row's own padding is what holds
                  those margins, so removing a child cannot move them. */}
              {langs.length > 1 && (
                <div className="codex-ctrl-lang">
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

              {/* Reading size. Plain ASCII `-` and `+`, and that is the point:
                  every face in the text stack draws both, so unlike the signs
                  in lib/signs.ts there is no substitution to measure around
                  (see the <Glyph> note in CLAUDE.md). No indicator beside them
                  — the page itself is the indicator, and a percentage in this
                  row would be a fifth control on a phone that has room for
                  four. The bounds show as a disabled button instead. */}
              <button
                onClick={() => resize(-1)}
                disabled={scale <= TEXT_SCALE.min}
                className="btn-rpg codex-ctrl codex-ctrl-sign"
                aria-label={t("codex.textSmaller")}
                title={t("codex.textSmaller")}
              >
                <span aria-hidden>-</span>
              </button>
              <button
                onClick={() => resize(1)}
                disabled={scale >= TEXT_SCALE.max}
                className="btn-rpg codex-ctrl codex-ctrl-sign"
                aria-label={t("codex.textLarger")}
                title={t("codex.textLarger")}
              >
                <span aria-hidden>+</span>
              </button>

              {/* Solid triangles, not arrows. `←`/`→` are drawn as a hairline
                  stroke at this size — at 10 px of ink they read as a dash with
                  a smudge on one end, and thinner still on a face that renders
                  them lighter. `◀`/`▶` are filled shapes, so their weight comes
                  from area rather than from stroke width and survives any
                  rasteriser. Both are measured (`<Glyph>`, `sizedBy` the same
                  reference) so the pair is one size and one height on every
                  platform, and both carry U+FE0E — they are emoji codepoints,
                  and an unqualified triangle can be drawn in colour by a phone
                  whose font fallback reaches the emoji face first. */}
              <button onClick={() => handleTurn(-1)} className="btn-rpg codex-ctrl" aria-label={t("codex.prev")} title={t("codex.prev")}>
                <Glyph char={SIGN.prev} sizedBy={TURN_REF} size="var(--codex-ctrl-glyph)" />
              </button>
              <button onClick={() => handleTurn(1)} className="btn-rpg codex-ctrl" aria-label={t("codex.next")} title={t("codex.next")}>
                <Glyph char={SIGN.next} sizedBy={TURN_REF} size="var(--codex-ctrl-glyph)" />
              </button>
            </div>
          </div>

          {/* Reading pane — anchored to the frame so the scrollbar track and
              the very last line both live inside the border. Its geometry,
              including the top padding that clears the control row, lives in
              `.codex-pane` (codex.css) and is derived from the row rather
              than guessed alongside it; `.codex-scroll` beside it is only the
              gold scrollbar, which the document viewer shares. */}
          <div ref={scrollRef} className="codex-scroll codex-pane">
            {/* `.codex-read` spends the reader's size ratio as `zoom`, so the
                whole page grows together — prose, plates, figures, the dossier
                grid — and the column keeps its own width instead of overflowing
                it. A block laid out inside a zoomed box still fills its parent,
                so nothing here can start scrolling sideways; what changes is
                how much text fits on a line, which is what was being asked for.
                Container queries inside the article read the zoomed column, so
                a figure steps down to one track exactly when the type it sits
                beside stops fitting. */}
            <div className="codex-read mx-auto max-w-5xl" style={{ "--codex-text-scale": scale } as CSSProperties}>
              <CodexScrollProvider value={scrollToTop}>{children}</CodexScrollProvider>

              <footer className="mt-10 text-center font-body text-xs italic text-sepia-600/70">{t("codex.end")}</footer>
            </div>
          </div>
        </div>
      </div>
    </m.div>
  );
}
