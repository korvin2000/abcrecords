import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * A restrained musical corner: one fine bracket and a small quarter-note
 * accent. Drawn for the top-left and mirrored for the other three corners.
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
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
      style={{ transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})` }}
    >
      <path
        d="M4 38 V13 Q4 4 13 4 H38"
        stroke={accent}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <g opacity="0.82">
        <ellipse cx="15.2" cy="18" rx="2.8" ry="1.9" transform="rotate(-18 15.2 18)" fill={accent} />
        <path d="M17.7 17.4 V10.2" stroke={accent} strokeWidth="1.15" strokeLinecap="round" />
      </g>
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
 * Minimal four-corner frame. A narrow band keeps the musical marks outside
 * the content while mirroring guarantees consistent alignment.
 */
export function OrnateFrame({
  accent = "#b8902a",
  className,
  cornerClassName = "h-6 w-6 sm:h-7 sm:w-7",
  children,
}: {
  accent?: string;
  className?: string;
  /** size/effect classes for the corner SVGs (e.g. hover brightening) */
  cornerClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={clsx("relative p-1.5", className)}>
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
