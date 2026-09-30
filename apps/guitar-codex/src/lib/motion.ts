import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * The two things the app used an animation library for, without the library.
 *
 * Everything that moves here is a fade, a short rise or a small scale — CSS
 * does those on the compositor, for free. What CSS cannot do alone is keep an
 * element in the document *while it leaves*, and know whether the reader asked
 * for less motion; those are the two hooks below. Together they replaced
 * `framer-motion` (32 KB gzipped in the entry bundle, and a measurable mount
 * cost per animated element on a slow phone) — see
 * docs/performance-analysis.md, N-7.
 *
 * The one genuinely physical animation, the card's pointer tilt, has its own
 * spring in lib/spring.ts.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);
  if (!media) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}

/** The machine-wide "reduce motion" hint, live. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/**
 * Keep something on screen for the length of its exit.
 *
 * Give it the value that decides whether the thing is shown — the open image,
 * the menu's "open" as `true | null` — and how long the exit takes. While the
 * value is non-null it is returned as is. When it turns null, the last value
 * is held for `ms` with `leaving: true`, so the element can stay mounted and
 * play a CSS exit (a `data-leaving` attribute is the usual hook); then it is
 * let go. A new value arriving mid-exit simply takes over.
 *
 * Pass `ms = 0` (reduced motion) to make the exit immediate.
 */
export function useLinger<T>(value: T | null, ms: number): { value: T | null; leaving: boolean } {
  const [held, setHeld] = useState<T | null>(value);

  // Adjusted during render, not in an effect: the very frame a new value
  // arrives must already show it.
  if (value !== null && value !== held) setHeld(value);

  useEffect(() => {
    if (value !== null || held === null) return;
    if (ms <= 0) {
      setHeld(null);
      return;
    }
    const timer = window.setTimeout(() => setHeld(null), ms);
    return () => window.clearTimeout(timer);
  }, [value, held, ms]);

  return { value: value ?? held, leaving: value === null && held !== null };
}
