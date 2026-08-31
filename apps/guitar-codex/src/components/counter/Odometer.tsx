import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * A mechanical counter: one drum per digit, each turning to its number.
 *
 * The drums are the reference photographs in `/counter` re-cut in the
 * catalogue's palette — dark brown cylinders, ivory numerals, a seam across
 * the middle where the flap would hinge, held in a gold bezel.
 *
 * How a drum turns. Each one carries a strip of eleven cells: 0–9 and a spare
 * 0 at the foot. Turning up (3 → 7) is one transform away. Turning *over*
 * (9 → 0, or 7 → 3 when the tally is corrected downwards) must still turn
 * forwards, the way a real drum can only turn one way, so it is done in two
 * movements: forward onto the spare zero, then — with the transition off for
 * one painted frame — back to the true zero, and on to the digit from there.
 * That silent jump is what the double `requestAnimationFrame` below buys; one
 * frame is not enough, because React can commit both style changes before the
 * browser paints either, and the drum then slides visibly backwards.
 */

/** 0–9 plus the spare zero the wrap turns onto. */
const CELLS = 11;

/** Must equal `--counter-roll` in `styles/tokens.css`. */
const ROLL_MS = 640;

export function Odometer({
  value,
  digits,
  animate = true,
  className,
}: {
  /** The number on the drums. Negatives and fractions are not mechanical. */
  value: number;
  /** The narrowest the plate may read; a longer number simply adds a drum. */
  digits: number;
  /** False under reduced motion: the drums snap instead of turning. */
  animate?: boolean;
  className?: string;
}) {
  const text = String(Math.max(0, Math.round(value)));
  const padded = text.padStart(Math.max(digits, text.length), "0");

  return (
    <span className={clsx("odometer", className)} aria-hidden>
      {Array.from(padded).map((char, index) => (
        // Keyed from the right, so a number that outgrows the plate adds a
        // drum at the left instead of renumbering every drum in the row.
        <Drum key={padded.length - 1 - index} digit={Number(char)} rolling={animate} />
      ))}
    </span>
  );
}

function Drum({ digit, rolling }: { digit: number; rolling: boolean }) {
  const [cell, setCell] = useState(digit);
  const [turning, setTurning] = useState(false);
  const previous = useRef(digit);

  useEffect(() => {
    const from = previous.current;
    previous.current = digit;
    if (from === digit) return;

    if (!rolling) {
      setTurning(false);
      setCell(digit);
      return;
    }
    if (digit > from) {
      setTurning(true);
      setCell(digit);
      return;
    }

    // Turning over: forward onto the spare zero first.
    setTurning(true);
    setCell(CELLS - 1);

    let first = 0;
    let second = 0;
    const settle = window.setTimeout(() => {
      setTurning(false);
      setCell(0);
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          setTurning(true);
          setCell(digit);
        });
      });
    }, ROLL_MS);

    return () => {
      window.clearTimeout(settle);
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [digit, rolling]);

  return (
    <span className="odometer-drum">
      <span
        className={clsx("odometer-strip", turning && "odometer-strip--turning")}
        style={{ "--cell": cell } as React.CSSProperties}
      >
        {Array.from({ length: CELLS }, (_, i) => (
          <span key={i} className="odometer-cell">
            {i % 10}
          </span>
        ))}
      </span>
    </span>
  );
}
