import { useSyncExternalStore, type CSSProperties } from "react";
import clsx from "clsx";
import { fitGlyph, glyphVersion, subscribeGlyphs } from "@/lib/glyph";

/**
 * A Unicode sign drawn at a size that means the same thing on every platform.
 *
 * Use this — never a bare glyph in a `<span className="text-lg">` — for any
 * mark that is **not** in the text faces: ♀ ♂ ⚥ 𝄞 ♪ ◀ ▶ ✦ ❖ ❧. Those are drawn
 * by whichever symbol face the OS happens to install, and every one of them
 * disagrees with the others about the ink's size, its position relative to the
 * baseline, and how tall a line box it needs (see `lib/glyph.ts`). A bare glyph
 * therefore renders at one size on Windows and a fifth larger — sitting low,
 * inside a taller button — on Android and Linux.
 *
 * What this element guarantees, by construction rather than by tuning:
 *
 *   • **Its box is exactly `size` tall, on every platform.** The text inside is
 *     absolutely positioned, so no face's ascent can grow the parent. This is
 *     the half that fixes "the icons take up more vertical space on Android".
 *   • **Its ink is centred in that box.** Measured, per glyph.
 *   • **A set of signs keeps its own proportions.** Pass the same `sizedBy` to
 *     every member (`sizedBy="♂"` for the gender trio) and the set is scaled by
 *     one factor instead of each sign being stretched to a common height.
 *
 * Decorative by default (`aria-hidden`): a sign is chrome, and its meaning
 * belongs on the control around it as an `aria-label`. Pass `label` when the
 * glyph really is the only carrier of meaning.
 *
 * ```tsx
 * <Glyph char="♀" sizedBy="♂" size="0.95rem" className="text-burgundy-700" />
 * <Glyph char={CLEF} font="var(--font-music)" size="1.2rem" />
 * ```
 */
export function Glyph({
  char,
  sizedBy = char,
  font = "var(--font-symbol)",
  size = "1em",
  className,
  style,
  label,
}: {
  /** The sign to draw. */
  char: string;
  /** The glyph whose ink height sets the scale for the whole set it belongs
   *  to. Defaults to `char` — pass a shared value for a related set. Not named
   *  `ref`: in React 19 that is the element ref, and this is a string. */
  sizedBy?: string;
  /** CSS `font-family` value; `var(--font-*)` is resolved before measuring. */
  font?: string;
  /** Height of the **reference glyph's ink** — the box's block-size. Any CSS
   *  length, `clamp()` included: the fit is unitless, so fluid sizing keeps
   *  working. */
  size?: string;
  className?: string;
  style?: CSSProperties;
  /** Only when the sign carries meaning nothing around it repeats. */
  label?: string;
}) {
  // Read during render, beside the measurement it invalidates: a face that
  // arrives late re-measures everything exactly once. See lib/glyph.ts.
  useSyncExternalStore(subscribeGlyphs, glyphVersion, glyphVersion);
  const fit = fitGlyph(char, font, sizedBy);

  return (
    <span
      className={clsx("glyph", className)}
      style={{
        ...style,
        fontFamily: font,
        "--glyph-size": size,
        "--glyph-scale": fit.scale.toFixed(4),
        "--glyph-aspect": fit.aspect.toFixed(4),
        "--glyph-dx": fit.dx.toFixed(4),
        "--glyph-dy": fit.dy.toFixed(4),
        "--glyph-cx": fit.cx.toFixed(4),
      } as CSSProperties}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <span className="glyph__ink">{char}</span>
    </span>
  );
}
