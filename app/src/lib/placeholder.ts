import { accentFor } from "./metadata";

/**
 * Procedurally generated portrait placeholder — an engraved-style SVG
 * monogram on aged paper, used while a photo loads or when it is missing.
 * Deterministic per entry (name hash → accent + ornament), zero requests.
 */
export function placeholderPortrait(name: string, initials: string): string {
  const accent = accentFor(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0e6c8"/>
      <stop offset="1" stop-color="#dcc99b"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#p)"/>
  <rect x="10" y="10" width="280" height="380" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.6"/>
  <rect x="16" y="16" width="268" height="368" fill="none" stroke="#54381e" stroke-width="0.7" opacity="0.4"/>
  <circle cx="150" cy="165" r="72" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.55"/>
  <circle cx="150" cy="165" r="78" fill="none" stroke="${accent}" stroke-width="0.6" opacity="0.35"/>
  <text x="150" y="188" text-anchor="middle" font-family="Georgia,serif" font-size="64" fill="${accent}" opacity="0.85">${initials}</text>
  <text x="150" y="330" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#54381e" opacity="0.6">❦</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function initialsOf(forename?: string, surname?: string): string {
  const a = (forename ?? "").trim().charAt(0);
  const b = (surname ?? "").trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "✦";
}
