/**
 * MetaData.json field helpers (docs/MetaData.md parsing rules):
 *  - dates are DD.MM.YYYY and must NEVER go straight into `new Date(string)`;
 *  - multi-value fields are comma-separated strings, split on demand;
 *  - countries are ISO alpha-2 in *.bio.json but free text in index.json.
 */

export interface Dmy {
  d: number;
  m: number;
  y: number;
}

export function parseDmy(s: string | undefined | null): Dmy | null {
  if (!s) return null;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return { d, m: mo, y };
}

/** "05.05.1885" → "5 мая 1885" (locale-aware, explicit parse first). */
export function formatDmy(s: string | undefined, locale: string): string | null {
  const p = parseDmy(s);
  if (!p) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(p.y, p.m - 1, p.d)));
  } catch {
    return s ?? null;
  }
}

export function yearOf(s: string | undefined): number | null {
  return parseDmy(s)?.y ?? null;
}

/** Full years elapsed between two D.M.Y points. */
export function yearsBetween(a: Dmy, b: Dmy): number {
  let years = b.y - a.y;
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) years -= 1;
  return years;
}

/** Age today (living) or at death. Returns null when `born` is absent. */
export function ageOf(born?: string, died?: string): number | null {
  const b = parseDmy(born);
  if (!b) return null;
  const end =
    parseDmy(died) ??
    (() => {
      const now = new Date();
      return { d: now.getDate(), m: now.getMonth() + 1, y: now.getFullYear() };
    })();
  const age = yearsBetween(b, end);
  return age >= 0 ? age : null;
}

/** Comma-separated string → trimmed non-empty list. */
export function splitList(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** ISO alpha-2 → localized country name via Intl (zero-dependency). */
export function regionName(code: string | undefined, locale: string): string | null {
  if (!code) return null;
  if (!/^[A-Za-z]{2}$/.test(code)) return code; // already free text
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** index.json stores free-text English country names; map the known ones to
 *  ISO so both file conventions localize identically. Unknown → raw text. */
const COUNTRY_TEXT_TO_ISO: Record<string, string> = {
  paraguay: "PY",
  spain: "ES",
  ukraine: "UA",
  france: "FR",
  "united states": "US",
  usa: "US",
  serbia: "RS",
  russia: "RU",
  germany: "DE",
  brazil: "BR",
};

export function countryDisplay(freeText: string | undefined, locale: string): string {
  if (!freeText) return "";
  const iso = COUNTRY_TEXT_TO_ISO[freeText.trim().toLowerCase()];
  return (iso ? regionName(iso, locale) : null) ?? freeText;
}

/** Country for display: the entry's ISO metadata country (localized) when
 *  present, else the free-text country from index.json. Centralizes the
 *  fallback shared by the codex header and the Lore tab. */
export function resolveCountry(
  metaCountry: string | undefined,
  indexCountry: string | undefined,
  locale: string,
): string {
  return (metaCountry ? regionName(metaCountry, locale) : null) ?? countryDisplay(indexCountry, locale);
}

/** ISO 3166-1 alpha-2 code for an entry (uppercased) so a flag can be shown,
 *  or null when it can't be determined. Prefers the per-entry metadata code
 *  (already ISO), else maps the free-text index.json country. */
export function resolveCountryCode(
  metaCountry: string | undefined,
  indexCountry: string | undefined,
): string | null {
  if (metaCountry && /^[A-Za-z]{2}$/.test(metaCountry.trim())) {
    return metaCountry.trim().toUpperCase();
  }
  const iso = indexCountry ? COUNTRY_TEXT_TO_ISO[indexCountry.trim().toLowerCase()] : undefined;
  return iso ?? null;
}

/** metadata.ranking (~0–100) → 1..5 star tier (the light-theme replacement
 *  for the prototypes' fantasy "rarity"). */
export function rankStars(ranking: number | undefined): number | null {
  if (typeof ranking !== "number" || Number.isNaN(ranking)) return null;
  if (ranking >= 90) return 5;
  if (ranking >= 75) return 4;
  if (ranking >= 55) return 3;
  if (ranking >= 35) return 2;
  return 1;
}

/** FNV-1a — deterministic per-entry accent/theme seeding. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Muted antique accent palette (design brief: no neon, no bright hues). */
const ACCENTS = ["#8a6a1f", "#7a1f2b", "#54381e", "#3e5641", "#41506b", "#6b4a2a"];

export function accentFor(seed: string): string {
  return ACCENTS[fnv1a(seed) % ACCENTS.length];
}
