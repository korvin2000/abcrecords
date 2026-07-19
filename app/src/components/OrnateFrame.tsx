import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * One filigree corner — engraved-style: a rounded L-bracket hugging the two
 * edges, an inner echo line, a spiral curl in the corner pocket, a small
 * diamond on the diagonal and dot "rivets" near the arm ends. Drawn for the
 * top-left; the other corners are mirrored with flipX/flipY so the curls
 * always face inward.
 */
export function CornerOrnament({
  accent = "#b8902a",
  flipX = false,
  flipY = false,
  className,
}: {
  accent?: string;
  flipX?: boolean;
  flipY?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
      style={{ transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})` }}
    >
      {/* main arm rounding the corner */}
      <path
        d="M2 52 L2 14 Q2 2 14 2 L52 2"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* inner echo line */}
      <path
        d="M7 46 L7 16 Q7 7 16 7 L46 7"
        stroke={accent}
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* spiral curl in the corner pocket */}
      <path
        d="M12 12 C22 7.5 31 12 29.5 20 C28.4 25.6 21.6 26.2 20.4 21.4 C19.5 17.9 23.4 15.9 25.6 18.2"
        stroke={accent}
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.95"
      />
      {/* leaf flicks finishing the two arms */}
      <path d="M2 52 Q2.8 55.5 6 57" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M52 2 Q55.5 2.8 57 6" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
      {/* diamond on the diagonal */}
      <path d="M34 29.8 L38.2 34 L34 38.2 L29.8 34 Z" fill={accent} opacity="0.9" />
      {/* dot rivets */}
      <circle cx="46" cy="11.5" r="1.6" fill={accent} opacity="0.8" />
      <circle cx="11.5" cy="46" r="1.6" fill={accent} opacity="0.8" />
    </svg>
  );
}

const CORNERS = [
  { pos: "left-0 top-0", flipX: false, flipY: false },
  { pos: "right-0 top-0", flipX: true, flipY: false },
  { pos: "left-0 bottom-0", flipX: false, flipY: true },
  { pos: "right-0 bottom-0", flipX: true, flipY: true },
] as const;

/**
 * Four-corner ornamental frame. Reserves a thin band around the content
 * (p-2) so the corner brackets sit *outside* the child like antique
 * photo-mount corners, their curls draping over the child's rounded
 * corners. Corners are painted after the children (on top) and mirrored
 * per corner — all four stay aligned by construction.
 */
export function OrnateFrame({
  accent = "#b8902a",
  className,
  cornerClassName = "h-8 w-8 sm:h-10 sm:w-10",
  children,
}: {
  accent?: string;
  className?: string;
  /** size/effect classes for the corner SVGs (e.g. hover brightening) */
  cornerClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={clsx("relative p-2", className)}>
      {children}
      {CORNERS.map((c) => (
        <CornerOrnament
          key={c.pos}
          accent={accent}
          flipX={c.flipX}
          flipY={c.flipY}
          className={clsx("pointer-events-none absolute z-10", c.pos, cornerClassName)}
        />
      ))}
    </div>
  );
}

/** Ornamental horizontal divider with a central diamond. */
export function Divider({ accent = "#b8902a", className }: { accent?: string; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-center gap-3 py-1", className)}>
      <span className="h-px w-16 sm:w-28" style={{ background: `linear-gradient(90deg, transparent, ${accent})` }} />
      <svg width="20" height="20" viewBox="0 0 22 22" className="anim-floaty" aria-hidden>
        <path d="M11 1 L20 11 L11 21 L2 11 Z" fill="none" stroke={accent} strokeWidth="1.2" />
        <path d="M11 6 L15 11 L11 16 L7 11 Z" fill={accent} opacity="0.85" />
      </svg>
      <span className="h-px w-16 sm:w-28" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
    </div>
  );
}

/** Renown star row (metadata.ranking → 1..5). */
export function RankStars({ count, accent = "#b8902a" }: { count: number; accent?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`renown ${count}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" style={{ opacity: i < count ? 1 : 0.22 }} aria-hidden>
          <path
            d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"
            fill={i < count ? accent : "#8a6f4d"}
          />
        </svg>
      ))}
    </span>
  );
}
