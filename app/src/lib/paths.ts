/**
 * Content path resolution.
 *
 * index.json mixes two conventions (documented deviation):
 *   json/md — root-relative with a leading slash ("/slug.bio.json")
 *   img     — bucket-relative without one   ("photos/slug.jpg")
 * Both resolve against the application base (Vite publicDir = pages/).
 * Resources referenced inside an entry use resolveResourcePath() instead.
 */
const APP_BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Per-entry resources live outside the deployed app base by default. */
export const RESOURCE_BASE_PATH = normalizeResourceBase(
  import.meta.env.VITE_RESOURCE_BASE_PATH ?? "/pages",
);

export function isExternalUrl(p: string): boolean {
  return /^(https?:)?\/\//i.test(p);
}

export function resolveContentPath(p: string): string {
  if (!p || isExternalUrl(p)) return p;
  return `${APP_BASE}/${p.replace(/^\/+/, "")}`;
}

/**
 * Resolve media/documents referenced by *.bio.md or *.bio.json independently
 * of Vite's application base. Absolute URLs, anchors, and query refs pass
 * through unchanged. Both "music/x.mp3" and "/music/x.mp3" become
 * "/pages/music/x.mp3" with the default configuration.
 */
export function resolveResourcePath(p: string): string {
  if (!p || /^(?:[a-z][a-z\d+.-]*:|\/\/|[?#])/i.test(p)) return p;

  const relative = p.replace(/^\/+/, "").replace(/^(?:\.\/)+/, "");
  if (!relative) return RESOURCE_BASE_PATH || "/";

  // Keep already-resolved root paths stable.
  if (!isExternalUrl(RESOURCE_BASE_PATH)) {
    const rooted = `/${relative}`;
    if (rooted === RESOURCE_BASE_PATH || rooted.startsWith(`${RESOURCE_BASE_PATH}/`)) {
      return rooted;
    }
  }

  return `${RESOURCE_BASE_PATH}/${relative}`;
}

function normalizeResourceBase(value: string): string {
  const base = (value.trim() || "/pages").replace(/\/+$/, "");
  if (!base || base === "/") return "";
  return isExternalUrl(base) ? base : `/${base.replace(/^\/+/, "")}`;
}

/**
 * index.json keeps json/md paths as if the files sat at the content root
 * ("/andres-segovia.bio.md"), but each language edition physically lives in
 * a per-language directory: pages/ru/…, pages/en/…, pages/de/….
 * This maps the declared path into the chosen language's directory.
 * Applies ONLY to json/md — media/document paths inside entries stay
 * root-relative and must never be localized.
 */
export function localizeContentPath(p: string, lang: string): string {
  if (!p || isExternalUrl(p)) return p;
  return `/${lang}/${p.replace(/^\/+/, "")}`;
}

/** Stable slug for an index entry, derived from its md path
 *  ("/jovan-jovicic.bio.md" → "jovan-jovicic"). index.json has no id field. */
export function slugOf(entry: { md: string }): string {
  const file = entry.md.split("/").pop() ?? entry.md;
  return file.replace(/\.bio\.md$/i, "").replace(/\.md$/i, "");
}
