import { memo, type CSSProperties } from "react";
import clsx from "clsx";
import { useFx } from "@/lib/fx";

/**
 * The treble clef that stands where a magnifying glass usually does, turning
 * about its vertical axis under a shallow perspective.
 *
 * The glyph is always drawn — it is the search box's icon, not decoration — and
 * only the turn is budgeted away when the reader switches effects off. The
 * outer span is a fixed box because the glyph narrows to a hairline as it
 * passes edge-on; without it the input's contents would breathe once per
 * revolution.
 *
 * Cost: one composited element animating `transform` alone. No JS per frame.
 */
export const ClefSpinner = memo(function ClefSpinner({ className }: { className?: string }) {
  const { spin } = useFx();
  return (
    <span className={clsx("fx-clef", className)} style={clefStyle()} aria-hidden>
      <span className={clsx("fx-clef-glyph", spin && "fx-clef-glyph--spin")}>{CLEF}</span>
    </span>
  );
});

const CLEF = "\u{1D11E}";

/**
 * The height the clef's **ink** is normalised to, in rem.
 *
 * It is exactly what the Windows stack (Segoe UI Symbol at `font-size: 1.45rem`)
 * already drew — 1.0776 em × 1.45 rem — so this normalisation changes nothing
 * where the clef already looked right and fixes every platform where it did not.
 */
const TARGET_INK_REM = 1.5625;

interface ClefMetrics {
  /** `font-size`, in rem, at which this font's ink is `TARGET_INK_REM` tall. */
  readonly size: number;
  /** Upward correction, in em, that centres the ink rather than the line box. */
  readonly ink: number;
  /** Leftward correction, in em, for ink that sits off its own advance box. */
  readonly nudge: number;
}

/** Used when an engine reports no ink metrics — the Segoe UI Symbol values. */
const FALLBACK: ClefMetrics = { size: 1.45, ink: 0.129, nudge: 0 };

/**
 * The clef is a *font* glyph, and the fonts that carry U+1D11E draw it at
 * wildly different fractions of the em: this stack resolves to Segoe UI Symbol
 * on Windows, Apple Symbols on macOS and Noto Music on Linux and Android. A
 * fixed `font-size` therefore produced a visibly different clef per platform —
 * about a fifth larger on Linux and Android, where it overhung the search box.
 *
 * So nothing here is assumed. One `measureText` on a detached canvas — no
 * layout, no reflow — reads the glyph's real ink box, and the three answers
 * below are expressed in `rem`/`em` so they hold at any root size:
 *
 *   • `size`  — the font-size that makes the ink one fixed height everywhere;
 *   • `ink`   — the lift, because a clef hangs far below its baseline and
 *               centring the line box leaves it sitting visibly low;
 *   • `nudge` — the same correction horizontally, so the turn is about the
 *               middle of the drawn clef rather than the middle of its advance.
 */
function measureClef(): ClefMetrics {
  const probe = document.createElement("span");
  try {
    probe.className = "fx-clef-glyph";
    probe.style.cssText = "position:absolute;visibility:hidden";
    document.body.append(probe);

    const style = getComputedStyle(probe);
    const size = parseFloat(style.fontSize);
    const context = document.createElement("canvas").getContext("2d");
    if (!context || !size) return FALLBACK;
    context.font = `${size}px ${style.fontFamily}`;
    const m = context.measureText(CLEF);

    // All in em, measured from the top of a `line-height: 1` line box.
    const inkHeight = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / size;
    const content = (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) / size;
    const baseline = (1 - content) / 2 + m.fontBoundingBoxAscent / size;
    const inkCentre = baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / size / 2;

    const metrics: ClefMetrics = {
      size: TARGET_INK_REM / inkHeight,
      ink: inkCentre - 0.5,
      nudge: ((m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - m.width / 2) / size,
    };
    const sane =
      Number.isFinite(metrics.size) &&
      Number.isFinite(metrics.ink) &&
      Number.isFinite(metrics.nudge) &&
      metrics.size > 0.4 &&
      metrics.size < 4;
    return sane ? metrics : FALLBACK;
  } catch {
    return FALLBACK; // no canvas / no ink metrics
  } finally {
    probe.remove();
  }
}

/** Measured once, on the first clef rendered — never at import time. */
let cached: CSSProperties | null = null;
function clefStyle(): CSSProperties {
  if (cached) return cached;
  const m = measureClef();
  return (cached = {
    "--fx-clef-size": `${m.size.toFixed(4)}rem`,
    "--fx-clef-ink": `${m.ink.toFixed(4)}em`,
    "--fx-clef-nudge": `${m.nudge.toFixed(4)}em`,
  } as CSSProperties);
}
