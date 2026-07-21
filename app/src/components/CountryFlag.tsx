import { useId } from "react";
import type { ReactNode } from "react";

/**
 * Colorful inline SVG flags keyed by ISO 3166-1 alpha-2 country code, for the
 * Lore tab's "Country" row. Same rationale and look as the language flags in
 * Flag.tsx — deliberately NOT emoji (Windows renders flag emoji as bare letter
 * pairs) — but keyed by country rather than UI language, so any entry's
 * `metadata.country` can be shown as a flag.
 *
 * This is a curated set (the catalogue's current countries plus common music
 * nations); a few designs with intricate emblems are drawn in a simplified,
 * still-recognizable form. `hasCountryFlag()` reports coverage so callers can
 * fall back to the plain country name when a flag isn't available.
 */

/** 5-pointed star polygon points (US canton, PRC). */
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

/** Horizontal tricolour helper (three equal bands, top→bottom). */
function H3(a: string, b: string, c: string) {
  return (
    <>
      <rect width="24" height="5.34" fill={a} />
      <rect y="5.33" width="24" height="5.34" fill={b} />
      <rect y="10.66" width="24" height="5.34" fill={c} />
    </>
  );
}

/** Vertical tricolour helper (three equal bands, left→right). */
function V3(a: string, b: string, c: string) {
  return (
    <>
      <rect width="8" height="16" fill={a} />
      <rect x="8" width="8" height="16" fill={b} />
      <rect x="16" width="8" height="16" fill={c} />
    </>
  );
}

const COUNTRY_FLAGS: Record<string, ReactNode> = {
  // United Kingdom — Union Jack
  GB: (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0,0 L24,16 M24,0 L0,16" stroke="#ffffff" strokeWidth="3.4" />
      <path d="M0,0 L24,16 M24,0 L0,16" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M12,0 V16 M0,8 H24" stroke="#ffffff" strokeWidth="5.6" />
      <path d="M12,0 V16 M0,8 H24" stroke="#C8102E" strokeWidth="3.2" />
    </>
  ),
  // United States — 13 stripes, blue canton, stars (simplified)
  US: (
    <>
      <rect width="24" height="16" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={i * (16 / 13)} width="24" height={16 / 13} fill="#ffffff" />
      ))}
      <rect width="10" height={7 * (16 / 13)} fill="#3C3B6E" />
      {[2, 4, 6, 8].map((x) =>
        [1.6, 3.6, 5.6].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.55" fill="#ffffff" />
        )),
      )}
    </>
  ),
  // Spain — red/yellow/red with a small stylized shield
  ES: (
    <>
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
      <path d="M6,6.2 h2.8 v2.6 a1.4,1.4 0 0 1 -2.8,0 Z" fill="#AA151B" />
      <rect x="6.35" y="6.7" width="2.1" height="1.1" fill="#F1BF00" opacity="0.55" />
    </>
  ),
  // Germany — black / red / gold
  DE: H3("#000000", "#DD0000", "#FFCE00"),
  // France — blue / white / red
  FR: V3("#0055A4", "#ffffff", "#EF4135"),
  // Italy — green / white / red
  IT: V3("#009246", "#ffffff", "#CE2B37"),
  // Portugal — green/red with a stylized armillary sphere
  PT: (
    <>
      <rect width="9.6" height="16" fill="#046A38" />
      <rect x="9.6" width="14.4" height="16" fill="#DA291C" />
      <circle cx="9.6" cy="8" r="3" fill="none" stroke="#FFE900" strokeWidth="1.2" />
      <circle cx="9.6" cy="8" r="1.5" fill="#ffffff" stroke="#DA291C" strokeWidth="0.6" />
    </>
  ),
  // Russia — white / blue / red
  RU: H3("#ffffff", "#0039A6", "#D52B1E"),
  // Ukraine — blue over yellow
  UA: (
    <>
      <rect width="24" height="8" fill="#0057B7" />
      <rect y="8" width="24" height="8" fill="#FFD700" />
    </>
  ),
  // Serbia — red / blue / white (simplified, coat of arms omitted)
  RS: H3("#C6363C", "#0C4076", "#ffffff"),
  // Paraguay — red / white / blue (obverse emblem simplified out)
  PY: H3("#D52B1E", "#ffffff", "#0038A8"),
  // Netherlands — red / white / blue
  NL: H3("#AE1C28", "#ffffff", "#21468B"),
  // Austria — red / white / red
  AT: H3("#ED2939", "#ffffff", "#ED2939"),
  // Poland — white over red
  PL: (
    <>
      <rect width="24" height="8" fill="#ffffff" />
      <rect y="8" width="24" height="8" fill="#DC143C" />
    </>
  ),
  // Belgium — black / yellow / red
  BE: V3("#000000", "#FDDA24", "#EF3340"),
  // Ireland — green / white / orange
  IE: V3("#169B62", "#ffffff", "#FF883E"),
  // Brazil — green field, yellow rhombus, blue disc
  BR: (
    <>
      <rect width="24" height="16" fill="#009C3B" />
      <polygon points="12,1.6 22.4,8 12,14.4 1.6,8" fill="#FFDF00" />
      <circle cx="12" cy="8" r="3.1" fill="#002776" />
    </>
  ),
  // Argentina — light blue / white / light blue with the Sun of May
  AR: (
    <>
      {H3("#74ACDF", "#ffffff", "#74ACDF")}
      <circle cx="12" cy="8" r="1.5" fill="#F6B40E" />
    </>
  ),
  // Mexico — green / white / red with a simplified central emblem
  MX: (
    <>
      {V3("#006847", "#ffffff", "#CE1126")}
      <circle cx="12" cy="8" r="1.2" fill="none" stroke="#6b4a2a" strokeWidth="0.7" />
    </>
  ),
  // Japan — hinomaru
  JP: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      <circle cx="12" cy="8" r="4.8" fill="#BC002D" />
    </>
  ),
  // China — red field, one large + four small gold stars
  CN: (
    <>
      <rect width="24" height="16" fill="#EE1C25" />
      <polygon points={starPoints(4.5, 4.6, 2.6)} fill="#FFDE00" />
      <polygon points={starPoints(9.2, 1.9, 0.95, 0.5)} fill="#FFDE00" />
      <polygon points={starPoints(10.8, 3.8, 0.95, 0.9)} fill="#FFDE00" />
      <polygon points={starPoints(10.8, 6.2, 0.95, 1.2)} fill="#FFDE00" />
      <polygon points={starPoints(9.2, 8.1, 0.95, 0.6)} fill="#FFDE00" />
    </>
  ),
  // South Korea — taegeuk + four (stylized) trigrams
  KR: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      <circle cx="12" cy="8" r="3.4" fill="#0047A0" />
      <path d="M8.6,8 A3.4,3.4 0 1 1 15.4,8 A1.7,1.7 0 1 1 12,8 A1.7,1.7 0 1 0 8.6,8 Z" fill="#CD2E3A" />
      <Trigram x={4.6} y={3.4} angle={-33.7} />
      <Trigram x={19.4} y={3.4} angle={33.7} />
      <Trigram x={4.6} y={12.6} angle={33.7} />
      <Trigram x={19.4} y={12.6} angle={-33.7} />
    </>
  ),
};

/** True when a drawn flag exists for the given ISO alpha-2 code. */
export function hasCountryFlag(code: string | null | undefined): boolean {
  return !!code && code.toUpperCase() in COUNTRY_FLAGS;
}

export function CountryFlag({
  code,
  className,
  title,
}: {
  code: string;
  className?: string;
  /** Accessible name; omit for purely decorative use (aria-hidden). */
  title?: string;
}) {
  const shape = COUNTRY_FLAGS[code.toUpperCase()];
  // useId emits ":r1:" — colons break url(#…) references, strip them.
  const clipId = `cflag-${useId().replace(/:/g, "")}`;
  if (!shape) return null;
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
      <g clipPath={`url(#${clipId})`}>{shape}</g>
      {/* faint ink outline so light flags read on parchment */}
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
