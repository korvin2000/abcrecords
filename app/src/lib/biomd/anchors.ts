/**
 * In-document anchors: the `::: anchor` directive and the links that jump to it
 * (docs/Biography-Markup.md §19).
 *
 * The catalogue is hash-routed (`#/slug`), so an article cannot use a real
 * `href="#name"`: following one would rewrite the route and close the codex.
 * An anchor name is therefore resolved here against a namespaced element id and
 * the reading position is moved in JavaScript — the hash never moves.
 *
 * One normalisation serves both ends of the pair, the marker and the link, so
 * `#1`, `1` and `#Disc 1` name the same anchor however each end wrote it.
 */

/** The single namespace article-authored ids live in, so a name taken from
 *  content can never collide with an id the application owns. */
const ID_PREFIX = "bio-anchor-";

/** Canonical anchor name: no leading `#`, percent-decoded, folded to lower
 *  case, inner whitespace joined with `-` (an element id holds no spaces). */
export function anchorName(raw: string): string {
  return decode(raw.trim().replace(/^#+/, ""))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/** Element id carrying an anchor — the only place the prefix is applied. */
export function anchorElementId(name: string): string {
  return ID_PREFIX + name;
}

/**
 * The anchor a link points at, or null when it is not an in-document jump.
 * `#/slug` is another entry's route (lib/entry.ts) and is rejected here, so the
 * two link forms are never confused for one another.
 */
export function anchorLinkTarget(url: string): string | null {
  const raw = url.trim();
  if (!raw.startsWith("#") || raw.startsWith("#/")) return null;
  return anchorName(raw) || null;
}

/**
 * Move the reading position to an anchor. Returns false when no marker of that
 * name is in the article, so the caller can leave the link inert (and say so in
 * DEV) instead of scrolling somewhere arbitrary.
 *
 * `from` is the element that was clicked. The search is scoped to the article
 * containing it, because a ← → page turn briefly keeps the outgoing and the
 * incoming codex in the DOM together (App.tsx): a jump must land in the article
 * the reader is looking at, not in the one leaving the stage.
 */
export function scrollToAnchor(name: string, from?: Element | null): boolean {
  const target = findAnchor(anchorElementId(name), from?.closest(".bio-article"));
  if (!target) return false;
  // `scrollIntoView` walks every scrolling ancestor, so this works inside the
  // codex reading pane without knowing that the pane exists.
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  return true;
}

function findAnchor(id: string, article: Element | null | undefined): Element | null {
  if (!article) return document.getElementById(id);
  // An id taken from content may hold anything a URL fragment may hold, so it
  // is matched as a string rather than spliced into an id selector.
  return article.querySelector(`[id="${id.replace(/["\\]/g, "\\$&")}"]`);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Percent-decoding that never throws on a malformed name. */
function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
