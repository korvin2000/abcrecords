/**
 * Content path resolution.
 *
 * index.json mixes two conventions (documented deviation):
 *   json/md — root-relative with a leading slash ("/slug.bio.json")
 *   img     — bucket-relative without one   ("photos/slug.jpg")
 * Both resolve against the served content root (Vite publicDir = pages/).
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

export function isExternalUrl(p: string): boolean {
  return /^(https?:)?\/\//i.test(p);
}

export function resolveContentPath(p: string): string {
  if (!p || isExternalUrl(p)) return p;
  return `${BASE}/${p.replace(/^\/+/, "")}`;
}

/** Stable slug for an index entry, derived from its md path
 *  ("/jovan-jovicic.bio.md" → "jovan-jovicic"). index.json has no id field. */
export function slugOf(entry: { md: string }): string {
  const file = entry.md.split("/").pop() ?? entry.md;
  return file.replace(/\.bio\.md$/i, "").replace(/\.md$/i, "");
}
