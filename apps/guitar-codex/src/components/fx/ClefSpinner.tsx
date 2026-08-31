import { memo } from "react";
import clsx from "clsx";
import { useFx } from "@/lib/fx";
import { Glyph } from "@/components/Glyph";
import { SIGN } from "@/lib/signs";

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
 * This component used to carry its own copy of the glyph measurement, and that
 * copy was the only one in the codebase — which is precisely why the *other*
 * signs in the chrome (the gender strip, the clef beside a tablature) kept
 * being written as a bare `font-size` and kept coming out wrong on Android. The
 * measurement is now `<Glyph>`/`lib/glyph.ts`, shared, and this file is what it
 * always should have been: a clef, a box, and a rotation.
 *
 * Note what the rotation turns: the `<Glyph>` element, whose box *is* the ink
 * box. Its centre is therefore the drawn clef's centre, so the axis needs no
 * correction of its own — the old `left:` nudge existed only because the
 * element being turned was the advance box instead.
 *
 * Cost: one composited element animating `transform` alone. No JS per frame.
 */
export const ClefSpinner = memo(function ClefSpinner({ className }: { className?: string }) {
  const { spin } = useFx();
  return (
    <span className={clsx("fx-clef", className)} aria-hidden>
      <Glyph
        char={SIGN.clef}
        font="var(--font-music)"
        size={CLEF_INK}
        className={clsx("fx-clef-glyph", spin && "fx-clef-glyph--spin")}
      />
    </span>
  );
});

/**
 * The height the clef's **ink** is drawn at.
 *
 * It is exactly what the Windows stack (Segoe UI Symbol at `font-size: 1.45rem`)
 * already drew — 1.0776 em × 1.45 rem — so normalising to it changes nothing
 * where the clef already looked right and fixes every platform where it did not.
 */
const CLEF_INK = "1.5625rem";
