import type { EntryBundle, EntryData, IndexEntry } from "./types";
import { localizeContentPath, resolveContentPath, slugOf } from "./paths";
import { entryLangs, pickContentLang, type Lang } from "./languages";

/**
 * Catalogue store — fetches and caches all content from the served
 * pages/ directory. Nothing is bundled: data stays in JSON/MD files.
 *
 * Each entry's json/md pair exists once per language, in pages/<lang>/…
 * (index.json's `lang` field lists the editions). Bundles are cached per
 * (entry, language) so switching tongues on an open codex is instant after
 * the first read.
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
const jsonCache = new Map<string, Promise<EntryData | null>>();
const textCache = new Map<string, Promise<string | null>>();

function fetchJson(path: string): Promise<EntryData | null> {
  let request = jsonCache.get(path);
  if (!request) {
    request = fetch(resolveContentPath(path))
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as EntryData;
        return data && typeof data === "object" && data.metadata ? data : null;
      })
      .catch(() => null);
    jsonCache.set(path, request);
  }
  return request;
}

function fetchText(path: string): Promise<string | null> {
  let request = textCache.get(path);
  if (!request) {
    request = fetch(resolveContentPath(path))
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null);
    textCache.set(path, request);
  }
  return request;
}

/** Load (and cache) one language edition of an entry — metadata + biography
 *  in parallel. Each half fails soft: a missing file yields null. */
export function loadEntry(entry: IndexEntry, lang: Lang): Promise<EntryBundle> {
  const key = `${slugOf(entry)}::${lang}`;
  let p = bundleCache.get(key);
  if (!p) {
    p = Promise.all([
      fetchJson(localizeContentPath(entry.json, lang)),
      fetchText(localizeContentPath(entry.md, lang)),
    ]).then(([data, md]) => ({ data, md }));
    bundleCache.set(key, p);
  }
  return p;
}

/** Warm only lightweight metadata during idle time so cards can show ranking
 *  stars. Biography Markdown remains lazy until its codex is opened. */
export function prefetchAll(
  entries: IndexEntry[],
  preferredLang: Lang,
  onOne?: (slug: string, data: EntryData | null) => void,
): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;

  const queue = [...entries];
  const idle: (cb: () => void) => void =
    typeof requestIdleCallback === "function"
      ? (cb) => requestIdleCallback(() => cb(), { timeout: 2500 })
      : (cb) => void setTimeout(cb, 250);

  const step = () => {
    const next = queue.shift();
    if (!next) return;
    const lang = pickContentLang(entryLangs(next), preferredLang);
    void fetchJson(localizeContentPath(next.json, lang)).then((data) => {
      onOne?.(slugOf(next), data);
      idle(step);
    });
  };
  idle(step);
}
