import { memo } from "react";

/**
 * Static aged-paper backdrop. Deliberately animation-free and fixed —
 * gradients + one data-URI grain layer cost nothing on low-end devices
 * (no canvas, no particles, no background-attachment jank on iOS).
 */
export const Background = memo(function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="bg-manuscript absolute inset-0" />
      <div className="bg-grain absolute inset-0 opacity-[0.16] mix-blend-multiply" />
      {/* soft aged vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(107,74,42,0.28)]" />
    </div>
  );
});
