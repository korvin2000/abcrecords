import type { EntryBundle, EntryData, IndexEntry } from "./types";
import { resolveContentPath, slugOf } from "./paths";

/**
 * Catalogue store — fetches and caches all content from the served
 * pages/ directory. Nothing is bundled: data stays in JSON/MD files.
 */

export async function loadIndex(signal?: AbortSignal): Promise<IndexEntry[]> {
  const res = await fetch(resolveContentPath("/index.json"), { signal });
  if (!res.ok) throw new Error(`index.json: HTTP ${res.status}`);
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) throw new Error("index.json: expected an array");
  // Tolerate partial rows rather than rejecting the whole catalogue.
  return raw.filter(
    (e): e is IndexEntry =>
      !!e && typeof e === "object" && typeof (e as IndexEntry).md === "string",
  );
}

const bundleCache = new Map<string, Promise<EntryBundle>>();

async function fetchJson(path: string): Promise<EntryData | null> {
  try {
    const res = await fetch(resolveContentPath(path));
    if (!res.ok) return null;
    const data = (await res.json()) as EntryData;
    return data && typeof data === "object" && data.metadata ? data : null;
  } catch {
    return null;
  }
}

async function fetchText(path: string): Promise<string | null> {
  try {
    const res = await fetch(resolveContentPath(path));
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Load (and cache) an entry's metadata + biography in parallel.
 *  Each half fails soft: a missing file yields null, not an exception. */
export function loadEntry(entry: IndexEntry): Promise<EntryBundle> {
  const key = slugOf(entry);
  let p = bundleCache.get(key);
  if (!p) {
    p = Promise.all([fetchJson(entry.json), fetchText(entry.md)]).then(
      ([data, md]) => ({ data, md }),
    );
    bundleCache.set(key, p);
  }
  return p;
}

/** Warm the cache during idle time so opening a codex feels instant and
 *  cards can show ranking stars. Sequential on purpose — low-end friendly. */
export function prefetchAll(
  entries: IndexEntry[],
  onOne?: (slug: string, bundle: EntryBundle) => void,
): void {
  const queue = [...entries];
  const idle: (cb: () => void) => void =
    typeof requestIdleCallback === "function"
      ? (cb) => requestIdleCallback(() => cb(), { timeout: 2500 })
      : (cb) => void setTimeout(cb, 250);

  const step = () => {
    const next = queue.shift();
    if (!next) return;
    void loadEntry(next).then((bundle) => {
      onOne?.(slugOf(next), bundle);
      idle(step);
    });
  };
  idle(step);
}
