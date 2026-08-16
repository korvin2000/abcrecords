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
    <span className={clsx("fx-clef", className)} style={inkShiftStyle()} aria-hidden>
      <span className={clsx("fx-clef-glyph", spin && "fx-clef-glyph--spin")}>{CLEF}</span>
    </span>
  );
});

const CLEF = "\u{1D11E}";

/** Fallback shift for engines without ink metrics — the Segoe UI Symbol value. */
const FALLBACK_SHIFT = 0.129;

/**
 * How far to lift the glyph so its **ink** sits in the middle of the box.
 *
 * Centring a box centres the *line box*, and a clef is nowhere near centred
 * inside its own em: it hangs far below the baseline, which lands it visibly
 * low. The correction is pure font metrics, so rather than guess a nudge that
 * would only be right on one platform (this stack resolves to Segoe UI Symbol
 * on Windows, Apple Symbols on macOS, Noto Music elsewhere) we measure the real
 * ink box once per page — `measureText` on a detached canvas, no layout, no
 * reflow — and express the answer in `em`, so it holds at any font size.
 */
function measureInkShift(): number {
  const probe = document.createElement("span");
  try {
    probe.className = "fx-clef-glyph";
    probe.style.cssText = "position:absolute;visibility:hidden";
    document.body.append(probe);

    const style = getComputedStyle(probe);
    const size = parseFloat(style.fontSize);
    const context = document.createElement("canvas").getContext("2d");
    if (!context || !size) return FALLBACK_SHIFT;
    context.font = `${size}px ${style.fontFamily}`;
    const m = context.measureText(CLEF);

    // All in em, measured from the top of a `line-height: 1` line box.
    const content = (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) / size;
    const baseline = (1 - content) / 2 + m.fontBoundingBoxAscent / size;
    const inkCentre = baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / size / 2;
    const shift = inkCentre - 0.5;
    return Number.isFinite(shift) ? shift : FALLBACK_SHIFT;
  } catch {
    return FALLBACK_SHIFT; // no canvas / no ink metrics
  } finally {
    probe.remove();
  }
}

/** Measured once, on the first clef rendered — never at import time. */
let cachedShift: CSSProperties | null = null;
function inkShiftStyle(): CSSProperties {
  return (cachedShift ??= { "--fx-clef-ink": `${measureInkShift().toFixed(4)}em` } as CSSProperties);
}
