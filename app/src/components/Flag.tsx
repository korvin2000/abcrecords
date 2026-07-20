import { useId } from "react";
import type { Lang } from "@/lib/languages";

/**
 * Colorful inline SVG flags for the ten codex languages.
 *
 * Deliberately NOT emoji: Windows renders flag emoji as bare letter pairs
 * ("DE"), so the language menu would lose its color there. Each flag is a
 * small hand-drawn 24×16 vector with rounded corners and a faint ink
 * outline so it sits nicely on parchment.
 */

/** 5-pointed star polygon points (for the PRC flag). */
function starPoints(cx: number, cy: number, r: number, rotate = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2 + rotate;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** One solid trigram bar-group for the Taegeukgi corners (stylized). */
function Trigram({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} fill="#000">
      <rect x="-2.2" y="-1.75" width="4.4" height="0.7" />
      <rect x="-2.2" y="-0.35" width="4.4" height="0.7" />
      <rect x="-2.2" y="1.05" width="4.4" height="0.7" />
    </g>
  );
}

const FLAGS: Record<Lang, React.ReactNode> = {
  // Union Jack — blue field, white/red saltires, white/red cross
  en: (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0,0 L24,16 M24,0 L0,16" stroke="#ffffff" strokeWidth="3.4" />
      <path d="M0,0 L24,16 M24,0 L0,16" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M12,0 V16 M0,8 H24" stroke="#ffffff" strokeWidth="5.6" />
      <path d="M12,0 V16 M0,8 H24" stroke="#C8102E" strokeWidth="3.2" />
    </>
  ),
  // Spain — red/yellow/red with a small stylized shield
  es: (
    <>
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
      <path d="M6,6.2 h2.8 v2.6 a1.4,1.4 0 0 1 -2.8,0 Z" fill="#AA151B" />
      <rect x="6.35" y="6.7" width="2.1" height="1.1" fill="#F1BF00" opacity="0.55" />
    </>
  ),
  // Japan — hinomaru
  ja: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      <circle cx="12" cy="8" r="4.8" fill="#BC002D" />
    </>
  ),
  // Germany — black / red / gold
  de: (
    <>
      <rect width="24" height="5.33" fill="#000000" />
      <rect y="5.33" width="24" height="5.34" fill="#DD0000" />
      <rect y="10.67" width="24" height="5.33" fill="#FFCE00" />
    </>
  ),
  // France — blue / white / red
  fr: (
    <>
      <rect width="8" height="16" fill="#0055A4" />
      <rect x="8" width="8" height="16" fill="#ffffff" />
      <rect x="16" width="8" height="16" fill="#EF4135" />
    </>
  ),
  // Italy — green / white / red
  it: (
    <>
      <rect width="8" height="16" fill="#009246" />
      <rect x="8" width="8" height="16" fill="#ffffff" />
      <rect x="16" width="8" height="16" fill="#CE2B37" />
    </>
  ),
  // Portugal — green/red with a stylized armillary sphere
  pt: (
    <>
      <rect width="9.6" height="16" fill="#046A38" />
      <rect x="9.6" width="14.4" height="16" fill="#DA291C" />
      <circle cx="9.6" cy="8" r="3" fill="none" stroke="#FFE900" strokeWidth="1.2" />
      <circle cx="9.6" cy="8" r="1.5" fill="#ffffff" stroke="#DA291C" strokeWidth="0.6" />
    </>
  ),
  // Russia — white / blue / red
  ru: (
    <>
      <rect width="24" height="5.33" fill="#ffffff" />
      <rect y="5.33" width="24" height="5.34" fill="#0039A6" />
      <rect y="10.67" width="24" height="5.33" fill="#D52B1E" />
    </>
  ),
  // China — red field, one large + four small gold stars
  zh: (
    <>
      <rect width="24" height="16" fill="#EE1C25" />
      <polygon points={starPoints(4.5, 4.6, 2.6)} fill="#FFDE00" />
      <polygon points={starPoints(9.2, 1.9, 0.95, 0.5)} fill="#FFDE00" />
      <polygon points={starPoints(10.8, 3.8, 0.95, 0.9)} fill="#FFDE00" />
      <polygon points={starPoints(10.8, 6.2, 0.95, 1.2)} fill="#FFDE00" />
      <polygon points={starPoints(9.2, 8.1, 0.95, 0.6)} fill="#FFDE00" />
    </>
  ),
  // South Korea — taegeuk + four (stylized, solid) trigrams
  ko: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      <circle cx="12" cy="8" r="3.4" fill="#0047A0" />
      <path
        d="M8.6,8 A3.4,3.4 0 1 1 15.4,8 A1.7,1.7 0 1 1 12,8 A1.7,1.7 0 1 0 8.6,8 Z"
        fill="#CD2E3A"
      />
      <Trigram x={4.6} y={3.4} angle={-33.7} />
      <Trigram x={19.4} y={3.4} angle={33.7} />
      <Trigram x={4.6} y={12.6} angle={33.7} />
      <Trigram x={19.4} y={12.6} angle={-33.7} />
    </>
  ),
};

export function Flag({
  code,
  className,
  title,
}: {
  code: Lang;
  className?: string;
  /** Accessible name; omit for purely decorative use (aria-hidden). */
  title?: string;
}) {
  // useId emits ":r1:" — colons break url(#…) references, strip them.
  const clipId = `flag-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 24 16"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={clipId}>
          <rect width="24" height="16" rx="2.2" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{FLAGS[code]}</g>
      {/* faint ink outline so light flags (Japan, Korea) read on parchment */}
      <rect
        x="0.4"
        y="0.4"
        width="23.2"
        height="15.2"
        rx="1.9"
        fill="none"
        stroke="rgba(51,34,15,0.35)"
        strokeWidth="0.8"
      />
    </svg>
  );
}
