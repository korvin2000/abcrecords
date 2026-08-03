import type { Gender, IndexEntry } from "./types";

/**
 * Pure facts derived from a single index row (docs/Catalog-Index.md).
 *
 * Every visibility / biography branch in the app goes through these
 * predicates instead of re-testing `type === "hidden"` or `json` inline, so
 * the two rules live in one place.
 */

/** What a slug may contain: the md basename, i.e. ASCII word characters plus
 *  dot and dash ("goya2.right"). Shared by the router and the in-article link
 *  classifier so both agree on what a slug is. */
export const SLUG_PATTERN = /^[\w.-]+$/;

/** "/jovan-jovicic.bio.md" → "jovan-jovicic". Also the route: `#/{slug}`. */
export function slugOf(entry: { md: string }): string {
  const file = entry.md.split("/").pop() ?? entry.md;
  return file.replace(/\.bio\.md$/i, "").replace(/\.md$/i, "");
}

/** A declared dossier ⟺ a biography (4-tab codex). Declared, never inferred
 *  from a failed fetch — the chrome must not reshape mid-load. */
export function isBiography(entry: IndexEntry): boolean {
  return Boolean(entry.json);
}

/** Hidden entries stay routable and linkable but leave the grid, the search
 *  results, the facets, the counts and the ← → page-turn order. */
export function isListed(entry: IndexEntry): boolean {
  return entry.type !== "hidden";
}

/** Engraved stand-ins for entries with no photograph (pages/photos/). */
const DEFAULT_PORTRAIT: Record<Gender, string> = {
  m: "photos/default-male.svg",
  f: "photos/default-female.svg",
  mixed: "photos/default-mixed.svg",
};

/** The declared portrait, else the default for the entry's gender (`mixed`
 *  also covers an absent one). Resolves against the content base. */
export function portraitPath(entry: IndexEntry): string {
  return entry.img || DEFAULT_PORTRAIT[entry.gender ?? "mixed"];
}

/** Up to two initials for the procedural placeholder portrait. Iterates code
 *  points, not UTF-16 units, so CJK and surrogate pairs survive. */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/[\s,]+/).filter(Boolean);
  if (!words.length) return "✦";
  const head = firstChar(words[0]);
  const tail = words.length > 1 ? firstChar(words[words.length - 1]) : "";
  return (head + tail).toUpperCase();
}

function firstChar(word: string): string {
  return [...word][0] ?? "";
}

/**
 * Does this link point at another catalogue entry? Recognises every in-app
 * form of docs/Biography-Markup.md §3.6 — `#/slug`, `/#/slug`,
 * `<slug>.bio.md` (a biography) and `<slug>.md` (a page) — and returns the
 * slug. Absolute URLs, other schemes and legacy `.htm` references → null.
 *
 * One classifier for the router and the article renderer alike; a second URL
 * parser is how the two drift apart.
 */
export function entryTargetSlug(url: string): string | null {
  const raw = url.trim();
  if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) return null;

  const hash = /^\/?#\/([^?#]+)$/.exec(raw);
  const slug = hash
    ? decodeSlug(hash[1])
    : /\.md$/i.test(raw)
      ? slugOf({ md: raw.split(/[?#]/, 1)[0] })
      : null;

  return slug && SLUG_PATTERN.test(slug) ? slug : null;
}

/** Percent-decoding that never throws on a malformed hash. */
export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
