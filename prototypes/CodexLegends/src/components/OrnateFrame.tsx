import { cn } from "@/utils/cn";

/** A single ornate corner flourish. */
function Corner({
  accent,
  rotate,
}: {
  accent: string;
  rotate: number;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="absolute h-7 w-7 sm:h-9 sm:w-9 drop-glow-gold"
      style={{ transform: `rotate(${rotate}deg)` }}
      fill="none"
      aria-hidden
    >
      <path
        d="M3 26 C3 10 10 3 26 3"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 16 C3 8 8 3 16 3"
        stroke={accent}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="7" cy="7" r="2.4" fill={accent} />
      <path d="M16 16 l5 -5 M16 16 l5 5 M16 16 l-5 5 M16 16 l-5 -5" stroke={accent} strokeWidth="1" opacity="0.7" />
    </svg>
  );
}

/** Four-corner ornamental frame wrapper. */
export function OrnateFrame({
  accent = "#d4af37",
  className,
  children,
}: {
  accent?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <Corner accent={accent} rotate={0} />
      <div className="pointer-events-none absolute right-0 top-0">
        <Corner accent={accent} rotate={90} />
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0">
        <Corner accent={accent} rotate={180} />
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0">
        <Corner accent={accent} rotate={270} />
      </div>
      {children}
    </div>
  );
}

/** Ornamental horizontal divider with a central rune. */
export function Divider({
  accent = "#d4af37",
  className,
}: {
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-3 py-1", className)}>
      <span
        className="h-px w-16 sm:w-28"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent})`,
        }}
      />
      <svg width="22" height="22" viewBox="0 0 22 22" className="anim-floaty" aria-hidden>
        <path
          d="M11 1 L20 11 L11 21 L2 11 Z"
          fill="none"
          stroke={accent}
          strokeWidth="1.2"
        />
        <path d="M11 6 L15 11 L11 16 L7 11 Z" fill={accent} opacity="0.85" />
      </svg>
      <span
        className="h-px w-16 sm:w-28"
        style={{
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }}
      />
    </div>
  );
}

/** Rarity star row. */
export function RarityStars({ count, accent }: { count: number; accent: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`rarity ${count}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="11"
          height="11"
          viewBox="0 0 24 24"
          style={{ opacity: i < count ? 1 : 0.18 }}
          aria-hidden
        >
          <path
            d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"
            fill={i < count ? accent : "#64748b"}
          />
        </svg>
      ))}
    </span>
  );
}
