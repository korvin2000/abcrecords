import { memo, useMemo, type CSSProperties } from "react";
import clsx from "clsx";
import { useFx } from "@/lib/fx";

/**
 * Musical glyphs drifting up the page behind everything else.
 *
 * Cost, deliberately: **zero JavaScript per frame**. Each glyph is one absolutely
 * positioned span running a CSS animation over `transform` and `opacity` only —
 * the two properties every engine hands to the compositor — inside a `contain`ed,
 * `pointer-events: none` layer, so the effect can never trigger layout, never
 * repaint the page under it and never intercept a click. A canvas would cost a
 * full-viewport texture upload every frame for the same picture.
 *
 * Three things keep the cost honest:
 *
 * - **Count follows the budget** (`lib/fx`) and the viewport, so a phone gets a
 *   handful and a slow machine gets none — the layer then does not mount at all.
 * - **Sway lives in three literal keyframe sets**, not in per-glyph custom
 *   properties: a `var()` inside an animated `transform` can drop an animation
 *   off the compositor in some engines, which is exactly the device class this
 *   effect must not punish. Variety comes from the properties around it.
 * - **`paused` stops the clock** while a full-screen codex covers the layer.
 *
 * Reduced motion is handled one level up, in `lib/fx/store.ts`: it picks the
 * default for the reader's switch, and when the reader has switched the
 * ornaments on anyway, the paired rule in `index.css` re-arms the animations
 * (which is why the duration travels as `--fx-dur` rather than as a plain
 * `animation-duration` — the app's blanket reduced-motion rule clamps the
 * property with `!important`, and only a custom property survives to be
 * handed back).
 */

/** BMP note signs first — universally present. The clefs are worth the small
 *  coverage risk: they are the catalogue's own mark. */
const GLYPHS = ["♪", "♫", "♬", "♩", "♭", "♮", "♯", "\u{1D11E}", "\u{1D122}"];

/** Manuscript ink, muted gold, faded burgundy — the page's own three colours,
 *  as bare RGB triples so depth can be dialled in through the alpha. */
const INKS = ["107, 74, 42", "184, 144, 42", "122, 31, 43"];

/** Sway paths defined in `index.css` (`fx-note--0…2`). */
const PATHS = 3;

/**
 * Additive quasi-random channels — the R₃ Kronecker sequence: successive powers
 * of 1/φ₃, where φ₃ ≈ 1.2207440846 solves x⁴ = x + 1. Values spread evenly
 * instead of clumping the way uniform random does, which is what makes N glyphs
 * cover a screen, and they are deterministic, so the sky looks the same on
 * every visit.
 *
 * These three constants have to come from the **same** family and in order.
 * Seeding the horizontal channel from the *2D* set (1/ρ, ρ = the plastic
 * number) instead left the right ~18% of every viewport permanently empty —
 * worse the fewer glyphs were drawn, so phones and weak machines got a dead
 * band a quarter of the screen wide. Changing one of these is a measurement,
 * not a preference: check the largest uncovered band at n = 5…24, and check
 * that the channels stay uncorrelated (or big glyphs drift to one side).
 */
const STEPS = [0.8191725134, 0.6710436067, 0.5497004779];
const channel = (i: number, c: number) => ((i + 1) * STEPS[c] + 0.5) % 1;

interface Note {
  char: string;
  path: number;
  style: CSSProperties;
}

/** Wide screens carry the full budget; a phone gets proportionally fewer, so
 *  the glyphs stay scattered rather than crowded. */
function fitToViewport(budget: number): number {
  const scale = Math.min(1, Math.max(0.4, window.innerWidth / 1280));
  return Math.max(1, Math.round(budget * scale));
}

function scatter(count: number): Note[] {
  const notes: Note[] = [];
  for (let i = 0; i < count; i++) {
    const a = channel(i, 0);
    const b = channel(i, 1);
    const c = channel(i, 2);
    // Near glyphs are bigger, brighter and faster — parallax on the cheap.
    // One full crossing takes a minute at the slowest: the drift should read as
    // a slow current, not as traffic.
    const size = 1.1 + b * 1.7;
    const duration = 60 - b * 24;
    notes.push({
      char: GLYPHS[i % GLYPHS.length],
      path: i % PATHS,
      style: {
        left: `${a * 100}%`,
        fontSize: `${size.toFixed(2)}rem`,
        // Ink alpha is the depth cue; the keyframes only fade in and out on top
        // of it. Faint enough to stay behind the reading, strong enough to be
        // seen on parchment — under ~0.15 the effect simply is not there.
        color: `rgba(${INKS[i % INKS.length]}, ${(0.2 + b * 0.2).toFixed(3)})`,
        ["--fx-dur" as string]: `${duration.toFixed(1)}s`,
        // Negative: every glyph is already in flight on the first frame, so the
        // page opens with a full sky instead of an empty one.
        animationDelay: `${(-c * duration).toFixed(1)}s`,
      },
    });
  }
  return notes;
}

export const MusicalDrift = memo(function MusicalDrift({ paused = false }: { paused?: boolean }) {
  const { glyphs } = useFx();
  const notes = useMemo(() => (glyphs > 0 ? scatter(fitToViewport(glyphs)) : []), [glyphs]);

  if (notes.length === 0) return null;

  return (
    <div aria-hidden className={clsx("fx-drift", paused && "fx-drift--paused")}>
      {notes.map((note, i) => (
        <span key={i} className={`fx-note fx-note--${note.path}`} style={note.style}>
          {note.char}
        </span>
      ))}
    </div>
  );
});
