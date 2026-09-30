import { useEffect, useState } from "react";
import { PDF } from "@/config";

/**
 * A document's pages as pictures — the image reader's side of the contract
 * with `scripts/prerender-pdf.mjs`.
 *
 * pdf.js on a small phone has to hold a 40–60 MB scan, decode it at full
 * resolution and paint it on the main thread. A page *image* needs none of
 * that: the browser's own decoder, lazy loading and cache do the work, and it
 * opens on engines where pdf.js cannot start at all. So an issue may be
 * accompanied by a directory of pre-rendered pages:
 *
 *     magazine/2017/IGvL_2(21)_2017.pdf
 *     magazine/2017/IGvL_2(21)_2017.pages/manifest.json
 *     magazine/2017/IGvL_2(21)_2017.pages/p-001.jpg …
 *
 * Static files beside the PDF, made offline — nothing on the server renders
 * anything. A document without the directory simply has no image reader; the
 * question costs one small request the first time it is opened.
 */

export interface PagesManifest {
  /** Number of page images. */
  readonly pages: number;
  /** Size of the PDF itself in bytes, when the script recorded it. */
  readonly bytes: number;
  /** Pixel size of each image, in page order. */
  readonly sizes: readonly (readonly [number, number])[];
  /** Directory the images are in, with a trailing slash. */
  readonly base: string;
  /** Changes whenever the pages are rendered again; rides on every image URL
   *  so a long-cached `p-003.jpg` is never shown beside a newer manifest. */
  readonly rev: string;
}

/** `…/issue.pdf` → `…/issue.pages/`. */
function pagesBase(src: string): string {
  return `${src.split(/[?#]/, 1)[0].replace(/\.pdf$/i, "")}.pages/`;
}

/** `p-001.jpg` — the name the script gives page `n` (1-based). */
export function pageImage(manifest: PagesManifest, n: number): string {
  const file = `${manifest.base}p-${String(n).padStart(3, "0")}.jpg`;
  return manifest.rev ? `${file}?v=${manifest.rev}` : file;
}

const MANIFEST_TIMEOUT_MS = 2500;

const known = new Map<string, Promise<PagesManifest | null>>();

function parse(raw: unknown, base: string): PagesManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  const sizes = Array.isArray(doc.sizes) ? doc.sizes : null;
  if (doc.v !== 1 || !sizes || sizes.length === 0) return null;

  const clean: [number, number][] = [];
  for (const size of sizes) {
    if (!Array.isArray(size) || !(size[0] > 0) || !(size[1] > 0)) return null;
    clean.push([Number(size[0]), Number(size[1])]);
  }
  const bytes = typeof doc.bytes === "number" && doc.bytes > 0 ? doc.bytes : 0;
  return {
    pages: clean.length,
    bytes,
    sizes: clean,
    base,
    rev: typeof doc.rev === "string" && /^[\w.-]{1,48}$/.test(doc.rev) ? doc.rev : bytes ? String(bytes) : "",
  };
}

/**
 * The manifest beside a PDF, or null. Asked once per document per session.
 * Anything short of a well-formed manifest is "no image reader" — including
 * the development server's habit of answering a missing file with the app's
 * own HTML.
 *
 * Only an *answer* is remembered. A timeout or a dropped connection is not
 * one: remembering it would deny a weak phone its image reader for the rest
 * of the session because one request was slow, so the next open asks again.
 */
export function loadPagesManifest(src: string): Promise<PagesManifest | null> {
  let request = known.get(src);
  if (!request) {
    const base = pagesBase(src);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
    let answered = false;
    request = fetch(`${base}manifest.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          answered = true; // "there is no such file" is an answer
          return null;
        }
        return (res.json() as Promise<unknown>).then(
          (raw) => {
            answered = true;
            return raw;
          },
          () => {
            // Not JSON is an answer too; a body cut short by the timeout is not.
            answered = !controller.signal.aborted;
            return null;
          },
        );
      })
      .then((raw) => parse(raw, base))
      .catch(() => null)
      .finally(() => {
        window.clearTimeout(timer);
        if (!answered) known.delete(src);
      });
    known.set(src, request);
  }
  return request;
}

/** `undefined` while the question is open, then the manifest or null. */
export function usePagesManifest(src: string): PagesManifest | null | undefined {
  const [state, setState] = useState<{ src: string; manifest: PagesManifest | null } | null>(null);

  useEffect(() => {
    if (!PDF.lite) return;
    let alive = true;
    void loadPagesManifest(src).then((manifest) => {
      if (alive) setState({ src, manifest });
    });
    return () => {
      alive = false;
    };
  }, [src]);

  if (!PDF.lite) return null;
  return state && state.src === src ? state.manifest : undefined;
}
