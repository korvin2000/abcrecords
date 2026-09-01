/**
 * Content path resolution.
 *
 * Two bases, deliberately independent:
 *   • the application base (Vite BASE_URL) — where the SPA is deployed.
 *     index.json and its json/md/img values resolve against it.
 *   • the resource base (VITE_RESOURCE_BASE_PATH, default "/pages") — where
 *     the media archive lives. Every src/target written inside a *.bio.md or
 *     *.bio.json resolves against it (docs/Biography-Markup.md §15).
 * They differ on purpose: the app can be deployed at /fable/ while its
 * photographs stay at /pages/.
 *
 * index.json mixes two conventions (docs/Catalog-Index.md §4.1):
 *   json/md — root-relative with a leading slash ("/slug.bio.json")
 *   img     — bucket-relative without one   ("photos/slug.jpg")
 * Both resolve against the application base (Vite publicDir = pages/).
 *
 * One index.json field belongs to neither base: `pdf` addresses the document
 * archive at the *site* root, beside the app rather than inside it — see
 * `resolveSitePath` below.
 */
const APP_BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Per-entry resources live outside the deployed app base by default. */
export const RESOURCE_BASE_PATH = normalizeResourceBase(
  import.meta.env.VITE_RESOURCE_BASE_PATH ?? "/pages",
);

/** The resource base split once: "https://cdn/a/pages" → "https://cdn" + ["a","pages"]. */
const [RESOURCE_ORIGIN, RESOURCE_SEGMENTS] = splitBase(RESOURCE_BASE_PATH);

/** Not ours to resolve: any URI scheme, protocol-relative, bare query/fragment. */
const OPAQUE_TARGET = /^(?:[a-z][a-z\d+.-]*:|\/\/|[?#])/i;

export function isExternalUrl(p: string): boolean {
  return /^(https?:)?\/\//i.test(p);
}

/**
 * Would fetching this URL leave the page's origin?
 *
 * Not the same question as `isExternalUrl`: legacy content spells plenty of
 * its own links out in full ("https://www.abc-guitars.com/pages/x.pdf"), and
 * on the deployed site those are the same origin as the app. The distinction
 * matters wherever the app wants to *read* a file rather than hand it to the
 * browser — the document viewer fetches its PDF with `XMLHttpRequest`, which a
 * cross-origin server has to opt into, so a document that is genuinely
 * somebody else's is opened in a tab instead (lib/pdfViewer.ts).
 */
export function isCrossOrigin(url: string): boolean {
  if (!isExternalUrl(url)) return false;
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return true;
  }
}

export function resolveContentPath(p: string): string {
  if (!p || isExternalUrl(p)) return p;
  return `${APP_BASE}/${p.replace(/^\/+/, "")}`;
}

/**
 * Resolve a media/document target written inside *.bio.md or *.bio.json,
 * independently of Vite's application base. With the default configuration:
 *
 *   photo/b/x.jpg    → /pages/photo/b/x.jpg   relative to the resource base
 *   /photo/b/x.jpg   → /pages/photo/b/x.jpg   a leading slash means the same
 *   ^/main/x.jpg     → /main/x.jpg            anchored at the resource root
 *   /../main/x.jpg   → /main/x.jpg            climbs out of the base
 *
 * `..` is collapsed here rather than left for the browser's URL parser to
 * clean up, so the emitted URL says what it means. Prefer `^` for reaching
 * the archive outside the base: it holds however deep the base is, whereas
 * `..` has to match it segment for segment.
 */
export function resolveResourcePath(p: string): string {
  if (!p || OPAQUE_TARGET.test(p)) return p;

  const mark = p.search(/[?#]/);
  const target = mark < 0 ? p : p.slice(0, mark);
  const suffix = mark < 0 ? "" : p.slice(mark);

  const anchored = target.startsWith("^");
  const relative = (anchored ? target.slice(1) : target).replace(/^\/+/, "").split("/");

  const segments = collapse([...basePrefix(relative, anchored), ...relative]);
  return `${RESOURCE_ORIGIN}/${segments.join("/")}${suffix}`;
}

/**
 * The base to prepend: nothing for a `^`-anchored target, and nothing either
 * when the target already spells the base out. That second case is a
 * back-compat shim for legacy content — "pages/photo/k/x.jpg" keeps resolving
 * to /pages/photo/k/x.jpg instead of /pages/pages/…. It is the one ambiguity
 * left in this module: a real directory named "pages" *inside* the base is
 * unaddressable. New content should omit the prefix.
 */
function basePrefix(relative: string[], anchored: boolean): string[] {
  if (anchored) return [];
  const alreadySpelledOut = RESOURCE_SEGMENTS.every((s, i) => relative[i] === s);
  return alreadySpelledOut ? [] : RESOURCE_SEGMENTS;
}

/** Apply "." and ".." segment by segment; ".." past the root is clamped. */
function collapse(segments: string[]): string[] {
  const out: string[] = [];
  for (const s of segments) {
    if (!s || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return out;
}

function normalizeResourceBase(value: string): string {
  const base = (value.trim() || "/pages").replace(/\/+$/, "");
  if (!base || base === "/") return "";
  return isExternalUrl(base) ? base : `/${base.replace(/^\/+/, "")}`;
}

function splitBase(base: string): [origin: string, segments: string[]] {
  const origin = /^(?:[a-z][a-z\d+.-]*:)?\/\/[^/]*/i.exec(base)?.[0] ?? "";
  return [origin, base.slice(origin.length).split("/").filter(Boolean)];
}

/**
 * Resolve a site-root-relative path — today only index.json's `pdf`, which
 * points into the document archive that sits *beside* the application at the
 * web root:
 *
 *   magazine/2022/issue.pdf   → /magazine/2022/issue.pdf
 *   /magazine/2022/issue.pdf  → the same
 *   https://host/x.pdf        → passed through untouched
 *
 * Neither existing base applies. The application base is where the SPA is
 * deployed (it may be /fable/, and the archive is not inside it); the resource
 * base is /pages, and the archive is not inside that either. So this is a
 * third, deliberately trivial rule: the leading slash and nothing else.
 *
 * In development the legacy-archive plugin (vite/legacy-archive.ts) serves
 * whatever publicDir lacks from the live site, so these URLs resolve there too.
 */
export function resolveSitePath(p: string): string {
  if (!p || OPAQUE_TARGET.test(p)) return p;
  return `/${p.replace(/^\/+/, "")}`;
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
