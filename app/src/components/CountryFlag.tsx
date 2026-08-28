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

/** Two horizontal bands. */
function H2(a: string, b: string) {
  return (
    <>
      <rect width="24" height="8" fill={a} />
      <rect y="8" width="24" height="8" fill={b} />
    </>
  );
}

/** Nordic cross — offset towards the hoist, as every one of them is. */
function Nordic(field: string, cross: string, outline?: string) {
  return (
    <>
      <rect width="24" height="16" fill={field} />
      {outline && (
        <>
          <rect x="7" width="5.2" height="16" fill={outline} />
          <rect y="5.4" width="24" height="5.2" fill={outline} />
        </>
      )}
      <rect x={outline ? 8.1 : 7.4} width={outline ? 3 : 4.4} height="16" fill={cross} />
      <rect y={outline ? 6.5 : 5.8} width="24" height={outline ? 3 : 4.4} fill={cross} />
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

  /* --------------------------------------------------------------------
   * The rest of the catalogue's nations. Added when the country facet
   * became a row of flags rather than a wall of names: a code with no flag
   * would have had to fall back to text and broken the row, so coverage of
   * every country present in index.json is now a requirement rather than a
   * nicety. Emblem-bearing designs stay simplified — at 24×16 on parchment
   * a heraldic eagle is three muddy pixels, and the band scheme is what the
   * eye reads at this size anyway.
   * ------------------------------------------------------------------ */

  // Armenia — red / blue / apricot
  AM: H3("#D90012", "#0033A0", "#F2A800"),
  // Australia — Union Jack canton, Commonwealth star, stylized Southern Cross
  AU: (
    <>
      <rect width="24" height="16" fill="#00247D" />
      <g>
        <rect width="12" height="8" fill="#00247D" />
        <path d="M0,0 L12,8 M12,0 L0,8" stroke="#ffffff" strokeWidth="1.7" />
        <path d="M0,0 L12,8 M12,0 L0,8" stroke="#CC142B" strokeWidth="0.7" />
        <path d="M6,0 V8 M0,4 H12" stroke="#ffffff" strokeWidth="2.8" />
        <path d="M6,0 V8 M0,4 H12" stroke="#CC142B" strokeWidth="1.6" />
      </g>
      <polygon points={starPoints(6, 12, 1.5)} fill="#ffffff" />
      <polygon points={starPoints(18, 4.4, 0.85)} fill="#ffffff" />
      <polygon points={starPoints(20.6, 8, 0.85)} fill="#ffffff" />
      <polygon points={starPoints(17.4, 11.4, 0.85)} fill="#ffffff" />
      <polygon points={starPoints(15.2, 8.6, 0.7)} fill="#ffffff" />
    </>
  ),
  // Bosnia and Herzegovina — blue field, yellow triangle, star band
  BA: (
    <>
      <rect width="24" height="16" fill="#002395" />
      <polygon points="7,0 20,0 20,16" fill="#FECB00" />
      <polygon points={starPoints(5.6, 2.4, 1)} fill="#ffffff" />
      <polygon points={starPoints(8.6, 6.2, 1)} fill="#ffffff" />
      <polygon points={starPoints(11.6, 10, 1)} fill="#ffffff" />
      <polygon points={starPoints(14.6, 13.8, 1)} fill="#ffffff" />
    </>
  ),
  // Belarus — red over green with the hoist ornament band
  BY: (
    <>
      <rect width="24" height="16" fill="#CE1720" />
      <rect y="10.7" width="24" height="5.3" fill="#007C30" />
      <rect width="4.6" height="16" fill="#ffffff" />
      <path
        d="M1.1,1.4 L2.3,2.9 L3.5,1.4 M1.1,5.4 L2.3,6.9 L3.5,5.4 M1.1,9.4 L2.3,10.9 L3.5,9.4 M1.1,13.4 L2.3,14.9 L3.5,13.4"
        stroke="#CE1720"
        strokeWidth="0.85"
        fill="none"
      />
    </>
  ),
  // Canada — red bars and a simplified maple leaf
  CA: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      <rect width="6" height="16" fill="#D80621" />
      <rect x="18" width="6" height="16" fill="#D80621" />
      <path
        d="M12,3 L12.9,5.6 L15,4.8 L14.2,7.2 L16,7.6 L12.9,10 L13.4,11.6 L12.4,11.3 L12,13.6 L11.6,11.3 L10.6,11.6 L11.1,10 L8,7.6 L9.8,7.2 L9,4.8 L11.1,5.6 Z"
        fill="#D80621"
      />
    </>
  ),
  // Switzerland — square-ish white cross on red (drawn to this ratio)
  CH: (
    <>
      <rect width="24" height="16" fill="#D52B1E" />
      <rect x="10.6" y="3" width="2.8" height="10" fill="#ffffff" />
      <rect x="7.4" y="6.6" width="9.2" height="2.8" fill="#ffffff" />
    </>
  ),
  // Chile — white/red with a blue canton and its lone star
  CL: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      <rect y="8" width="24" height="8" fill="#D52B1E" />
      <rect width="8" height="8" fill="#0039A6" />
      <polygon points={starPoints(4, 4, 2.2)} fill="#ffffff" />
    </>
  ),
  // Colombia — yellow half over blue and red quarters
  CO: (
    <>
      <rect width="24" height="8" fill="#FCD116" />
      <rect y="8" width="24" height="4" fill="#003893" />
      <rect y="12" width="24" height="4" fill="#CE1126" />
    </>
  ),
  // Cuba — five stripes, red triangle, white star
  CU: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      {[0, 2, 4].map((i) => (
        <rect key={i} y={i * 3.2} width="24" height="3.2" fill="#002A8F" />
      ))}
      <polygon points="0,0 10.4,8 0,16" fill="#CF142B" />
      <polygon points={starPoints(3.4, 8, 2)} fill="#ffffff" />
    </>
  ),
  // Czechia — white over red with the blue hoist wedge
  CZ: (
    <>
      {H2("#ffffff", "#D7141A")}
      <polygon points="0,0 11,8 0,16" fill="#11457E" />
    </>
  ),
  // Ecuador — yellow half, blue, red, with a simplified central emblem
  EC: (
    <>
      <rect width="24" height="8" fill="#FFDD00" />
      <rect y="8" width="24" height="4" fill="#034EA2" />
      <rect y="12" width="24" height="4" fill="#ED1C24" />
      <circle cx="12" cy="8" r="1.5" fill="#FFDD00" stroke="#6b4a2a" strokeWidth="0.5" />
    </>
  ),
  // Estonia — blue / black / white
  EE: H3("#0072CE", "#000000", "#ffffff"),
  // Finland — blue Nordic cross on white
  FI: Nordic("#ffffff", "#002F6C"),
  // Georgia — five crosses
  GE: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      <rect x="10.4" width="3.2" height="16" fill="#FF0000" />
      <rect y="6.4" width="24" height="3.2" fill="#FF0000" />
      {[
        [5.2, 3.2],
        [18.8, 3.2],
        [5.2, 12.8],
        [18.8, 12.8],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} fill="#FF0000">
          <rect x={x - 0.5} y={y - 1.9} width="1" height="3.8" />
          <rect x={x - 1.9} y={y - 0.5} width="3.8" height="1" />
        </g>
      ))}
    </>
  ),
  // Greece — nine stripes and the canton cross
  GR: (
    <>
      <rect width="24" height="16" fill="#0D5EAF" />
      {[1, 3, 5, 7].map((i) => (
        <rect key={i} y={(i * 16) / 9} width="24" height={16 / 9} fill="#ffffff" />
      ))}
      <rect width={(16 / 9) * 5} height={(16 / 9) * 5} fill="#0D5EAF" />
      <rect x="3.55" y="0" width="1.78" height="8.9" fill="#ffffff" />
      <rect x="0" y="3.55" width="8.9" height="1.78" fill="#ffffff" />
    </>
  ),
  // Croatia — red / white / blue with a simplified chequy shield
  HR: (
    <>
      {H3("#FF0000", "#ffffff", "#171796")}
      <g>
        <rect x="10.2" y="5" width="1.8" height="1.8" fill="#FF0000" />
        <rect x="12" y="5" width="1.8" height="1.8" fill="#ffffff" />
        <rect x="10.2" y="6.8" width="1.8" height="1.8" fill="#ffffff" />
        <rect x="12" y="6.8" width="1.8" height="1.8" fill="#FF0000" />
      </g>
    </>
  ),
  // Hungary — red / white / green
  HU: H3("#CE2939", "#ffffff", "#477050"),
  // Israel — blue bands and the Star of David
  IL: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      <rect y="2.2" width="24" height="1.9" fill="#0038B8" />
      <rect y="11.9" width="24" height="1.9" fill="#0038B8" />
      <path d="M12,4.6 L15.1,10 L8.9,10 Z" fill="none" stroke="#0038B8" strokeWidth="0.85" />
      <path d="M12,11.4 L8.9,6 L15.1,6 Z" fill="none" stroke="#0038B8" strokeWidth="0.85" />
    </>
  ),
  // Iceland — red-on-blue Nordic cross with a white border
  IS: Nordic("#02529C", "#DC1E35", "#ffffff"),
  // Kyrgyzstan — red field with the rayed sun
  KG: (
    <>
      <rect width="24" height="16" fill="#E8112D" />
      <circle cx="12" cy="8" r="3.1" fill="#FFEF00" />
      <circle cx="12" cy="8" r="1.7" fill="none" stroke="#E8112D" strokeWidth="0.5" />
      <path d="M9.6,8 h4.8 M12,5.6 v4.8" stroke="#E8112D" strokeWidth="0.45" />
    </>
  ),
  // Kazakhstan — sky blue with the sun and a stylized steppe eagle
  KZ: (
    <>
      <rect width="24" height="16" fill="#00AFCA" />
      <circle cx="13" cy="6.6" r="2.2" fill="#FEC50C" />
      <path d="M9.4,10.4 q3.6,-1.9 7.2,0" fill="none" stroke="#FEC50C" strokeWidth="0.8" />
      <rect x="1.2" y="3" width="1.5" height="10" fill="#FEC50C" opacity="0.75" />
    </>
  ),
  // Lithuania — yellow / green / red
  LT: H3("#FDB913", "#006A44", "#C1272D"),
  // Moldova — blue / yellow / red with a simplified central emblem
  MD: (
    <>
      {V3("#0046AE", "#FFD200", "#CC092F")}
      <circle cx="12" cy="8" r="1.7" fill="none" stroke="#A05A2C" strokeWidth="0.6" />
    </>
  ),
  // Norway — blue-on-red Nordic cross with a white border
  NO: Nordic("#BA0C2F", "#00205B", "#ffffff"),
  // Peru — red / white / red
  PE: V3("#D91023", "#ffffff", "#D91023"),
  // Puerto Rico — stripes, blue triangle, white star
  PR: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      {[0, 2, 4].map((i) => (
        <rect key={i} y={i * 3.2} width="24" height="3.2" fill="#ED0000" />
      ))}
      <polygon points="0,0 10.4,8 0,16" fill="#0050F0" />
      <polygon points={starPoints(3.4, 8, 2)} fill="#ffffff" />
    </>
  ),
  // Sweden — yellow Nordic cross on blue
  SE: Nordic("#006AA7", "#FECC00"),
  // Slovakia — white / blue / red with the shield towards the hoist
  SK: (
    <>
      {H3("#ffffff", "#0B4EA2", "#EE1C25")}
      <path d="M7,4.6 h4.4 v4.4 a2.2,2.2 0 0 1 -4.4,0 Z" fill="#EE1C25" stroke="#ffffff" strokeWidth="0.5" />
      <path d="M9.2,5.6 v3.6 M8.1,6.8 h2.2" stroke="#ffffff" strokeWidth="0.55" />
    </>
  ),
  // Uruguay — nine stripes, canton, Sun of May
  UY: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      {[1, 3, 5, 7].map((i) => (
        <rect key={i} y={(i * 16) / 9} width="24" height={16 / 9} fill="#0038A8" />
      ))}
      <rect width="10.6" height={(16 / 9) * 5} fill="#ffffff" />
      <polygon points={starPoints(5.3, 4.4, 2.4)} fill="#FCD116" />
    </>
  ),
  // Uzbekistan — blue / white / green with red fimbriations and the crescent
  UZ: (
    <>
      <rect width="24" height="5" fill="#0099B5" />
      <rect y="5" width="24" height="6" fill="#ffffff" />
      <rect y="11" width="24" height="5" fill="#1EB53A" />
      <rect y="4.7" width="24" height="0.6" fill="#CE1126" />
      <rect y="10.7" width="24" height="0.6" fill="#CE1126" />
      <path d="M5.6,2.5 a1.7,1.7 0 1 0 0,-0.02 a1.35,1.35 0 1 1 0,0.02 Z" fill="#ffffff" />
    </>
  ),
  // Venezuela — yellow / blue / red with the arc of stars
  VE: (
    <>
      {H3("#FFCC00", "#00247D", "#CF142B")}
      {[8, 10, 12, 14, 16].map((x, i) => (
        <polygon key={x} points={starPoints(x, 9.2 - Math.abs(i - 2) * 0.35, 0.62)} fill="#ffffff" />
      ))}
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
