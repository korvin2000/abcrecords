import type { EntryBundle, EntryData, Gender, IndexEntry, NameIndex } from "./types";
import { localizeContentPath, resolveContentPath } from "./paths";
import { isBiography, isDocumentEntry, isListed, slugOf } from "./entry";
import { displayName } from "./names";
import { entryLangs, type Lang } from "./languages";

/**
 * The catalogue store: fetches pages/index.json and pages/index-<lang>.json,
 * validates and normalizes them, and assembles the read model the UI works
 * with. Nothing is bundled — all content stays in the served pages/ tree.
 *
 * Per-entry editions (json + md) live in pages/<lang>/ and are cached per
 * (entry, language), so switching tongues on an open codex is instant after
 * the first read.
 */

/* --------------------------------------------------------------- read model */

/** An index row plus everything derivable from it in the reader's language. */
export interface CatalogRecord {
  entry: IndexEntry;
  id: string;
  slug: string;
  /** Editions this entry exists in (index.json `lang`); never empty. */
  langs: Lang[];
  listed: boolean;
  biography: boolean;
  /** The declared site-root-relative PDF path when this entry *is* a document
   *  (index.json `pdf`, no `md`) — opening it shows the viewer, not a codex.
   *  Undefined for every ordinary entry. See docs/Catalog-Index.md §9. */
  pdf?: string;
  /** Localized name, or index.json's Latin `title` when none is declared. */
  display: string;
}

export interface Catalog {
  /** Every row — hidden entries included, because they stay routable. */
  records: CatalogRecord[];
  /** What the grid, the search, the facets and the page-turn order see. */
  listed: CatalogRecord[];
  /** Route and cross-link resolution; keyed over *all* records. */
  bySlug: ReadonlyMap<string, CatalogRecord>;
  names: NameIndex;
}

/** Pure: index rows + localized names → the one object everything reads. */
export function buildCatalog(entries: IndexEntry[], names: NameIndex): Catalog {
  const records: CatalogRecord[] = entries.map((entry) => ({
    entry,
    id: entry.id,
    slug: slugOf(entry),
    langs: entryLangs(entry),
    listed: isListed(entry),
    biography: isBiography(entry),
    pdf: isDocumentEntry(entry) ? entry.pdf : undefined,
    display: displayName(names, entry.id, entry.title),
  }));

  return {
    records,
    listed: records.filter((r) => r.listed),
    bySlug: new Map(records.map((r) => [r.slug, r])),
    names,
  };
}

const EMPTY_NAMES: NameIndex = {};

/** Stable stand-in while the index loads, so consumers need no null checks. */
export const EMPTY_CATALOG: Catalog = buildCatalog([], EMPTY_NAMES);

/* ------------------------------------------------------- index.json loading */

function warnDev(message: string): void {
  if (import.meta.env.DEV) console.warn(`[catalog] ${message}`);
}

const ISO2 = /^[a-z]{2}$/;

function isGender(value: string): value is Gender {
  return value === "m" || value === "f" || value === "mixed";
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function lower(value: unknown): string | undefined {
  return text(value)?.toLowerCase();
}

/**
 * One raw row → a usable entry, or null when it can be neither joined nor
 * routed: no `id`, or neither of the two files that can name it (`md` for an
 * article, `pdf` for a document — docs/Catalog-Index.md §9). This is the
 * single boundary where case is settled: `country` uppercase, the rest lower.
 */
function normalizeRow(raw: unknown): IndexEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const id = typeof row.id === "number" ? String(row.id) : text(row.id);
  const md = text(row.md);
  const pdf = text(row.pdf);
  if (!id || (!md && !pdf)) return null;

  const rawGender = lower(row.gender);
  const gender = rawGender && isGender(rawGender) ? rawGender : undefined;
  if (rawGender && !gender) warnDev(`entry ${id}: unknown gender "${rawGender}"`);

  const rawCountry = lower(row.country);
  const country = rawCountry && ISO2.test(rawCountry) ? rawCountry.toUpperCase() : undefined;
  if (rawCountry && !country) warnDev(`entry ${id}: country "${rawCountry}" is not an ISO alpha-2 code`);

  return {
    id,
    md,
    pdf,
    title: text(row.title) ?? id,
    type: lower(row.type) ?? "",
    lang: lower(row.lang),
    gender,
    country,
    json: text(row.json),
    img: text(row.img),
  };
}

let indexRequest: Promise<IndexEntry[]> | null = null;

/** The catalogue index, fetched once per session. A rejected load is not
 *  cached, so the error screen's retry genuinely retries. */
export function loadIndex(): Promise<IndexEntry[]> {
  indexRequest ??= fetchIndex().catch((error: unknown) => {
    indexRequest = null;
    throw error;
  });
  return indexRequest;
}

async function fetchIndex(): Promise<IndexEntry[]> {
  const res = await fetch(resolveContentPath("/index.json"));
  if (!res.ok) throw new Error(`index.json: HTTP ${res.status}`);
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) throw new Error("index.json: expected an array");

  // Tolerate a bad row rather than rejecting the whole catalogue; ids and
  // slugs are join keys and routes, so a clash keeps the first row and warns.
  const entries: IndexEntry[] = [];
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const row of raw) {
    const entry = normalizeRow(row);
    if (!entry) {
      warnDev("skipped a row with no id, or with neither an md nor a pdf path");
      continue;
    }
    const slug = slugOf(entry);
    const clash = seenIds.has(entry.id) ? `id "${entry.id}"` : seenSlugs.has(slug) ? `slug "${slug}"` : null;
    if (clash) {
      warnDev(`duplicate ${clash} — keeping the first row`);
      continue;
    }
    seenIds.add(entry.id);
    seenSlugs.add(slug);
    entries.push(entry);
  }

  return entries;
}

/* --------------------------------------------------- index-<lang>.json loading */

const nameCache = new Map<Lang, Promise<NameIndex>>();

/** Localized names for a UI language. A tongue without a file is normal, so
 *  this never throws — callers fall back to index.json's Latin `title`. */
export function loadNames(lang: Lang): Promise<NameIndex> {
  let request = nameCache.get(lang);
  if (!request) {
    request = fetch(resolveContentPath(`/index-${lang}.json`))
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then(normalizeNames)
      .catch(() => {
        nameCache.delete(lang); // a network blip must not stick for the session
        return EMPTY_NAMES;
      });
    nameCache.set(lang, request);
  }
  return request;
}

/** Keep the non-empty string names; drop ids left with none. */
function normalizeNames(raw: unknown): NameIndex {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_NAMES;

  const out: Record<string, readonly string[]> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const names = value.map(text).filter((n): n is string => n !== undefined);
    if (names.length) out[id] = names;
  }
  return out;
}

/* ------------------------------------------------------------ entry editions */

/**
 * How many entry editions stay in memory.
 *
 * `jsonCache` used to be deliberately unbounded, because the facts index read
 * every dossier in the catalogue and evicting them would have meant fetching
 * them twice. That stopped being true when the index moved to a precomputed
 * digest (lib/dossier/digest.ts): nothing now reads a dossier except a codex
 * the reader has actually opened, so an unbounded map is simply a session-long
 * leak — at ~1 KB each it is the whole catalogue's metadata held for one
 * afternoon of browsing.
 *
 * A Map preserves insertion order, so evicting `keys().next()` is a plain LRU
 * once a re-read moves the key to the back. The dossier cap is the looser of
 * the two because dossiers are ~1 KB against an article's tens of KB, and the
 * Lore and Gallery tabs re-read them as the reader leafs back and forth.
 */
const ARTICLE_CACHE_LIMIT = 48;
const DOSSIER_CACHE_LIMIT = 120;

const bundleCache = new Map<string, Promise<EntryBundle>>();
/** Resolved bundles, for the synchronous `peekEntry` below. Same keys and the
 *  same eviction as `bundleCache` — one must never outlive the other. */
const bundleReady = new Map<string, EntryBundle>();
const jsonCache = new Map<string, Promise<EntryData | null>>();
const textCache = new Map<string, Promise<string | null>>();

/** Memoize a request per path so each file is fetched at most once. */
function cached<T>(
  store: Map<string, Promise<T>>,
  path: string,
  load: (p: string) => Promise<T>,
): Promise<T> {
  let request = store.get(path);
  if (!request) {
    request = load(path);
    store.set(path, request);
  }
  return request;
}

/** Drop the least recently read entries until the store is back inside its cap. */
function evict(store: Map<string, unknown>, limit: number): void {
  while (store.size > limit) {
    const oldest = store.keys().next();
    if (oldest.done) return;
    store.delete(oldest.value);
  }
}

/** Move a key to the back of a Map's insertion order — the "recently used" end. */
function touch<T>(store: Map<string, T>, key: string): void {
  const value = store.get(key);
  if (value === undefined) return;
  store.delete(key);
  store.set(key, value);
}

function fetchJson(path: string): Promise<EntryData | null> {
  const request = cached(jsonCache, path, (p) =>
    fetch(resolveContentPath(p))
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as EntryData;
        return data && typeof data === "object" && data.metadata ? data : null;
      })
      .catch(() => null),
  );
  touch(jsonCache, path);
  evict(jsonCache, DOSSIER_CACHE_LIMIT);
  return request;
}

function fetchText(path: string): Promise<string | null> {
  return cached(textCache, path, (p) =>
    fetch(resolveContentPath(p))
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null),
  );
}

/**
 * One language edition of an entry's dossier, without its article. Callers
 * that only need metadata (the facts index behind date search and the
 * herald's "on this day" lookup) must not drag the Markdown along — but they
 * do share `loadEntry`'s cache, so warming the index makes opening a codex
 * cheaper rather than more expensive.
 *
 * A page declares no dossier, so it resolves to null without a request.
 */
export function loadEntryData(entry: IndexEntry, lang: Lang): Promise<EntryData | null> {
  return entry.json ? fetchJson(localizeContentPath(entry.json, lang)) : Promise.resolve(null);
}

/** Load (and cache) one language edition of an entry — dossier + article in
 *  parallel. A missing file fails soft to null. */
export function loadEntry(entry: IndexEntry, lang: Lang): Promise<EntryBundle> {
  const key = `${slugOf(entry)}::${lang}`;
  let request = bundleCache.get(key);
  if (request) {
    touch(bundleCache, key);
    touch(bundleReady, key);
    return request;
  }

  request = Promise.all([
    loadEntryData(entry, lang),
    // A document entry declares no article; there is nothing to read for it.
    entry.md ? fetchText(localizeContentPath(entry.md, lang)) : Promise.resolve(null),
  ]).then(([data, md]) => {
    const bundle: EntryBundle = { data, md };
    // Only remember the edition if its request is still the cached one —
    // an eviction while the fetch was in flight must not resurrect it.
    if (bundleCache.get(key) === request) {
      bundleReady.set(key, bundle);
      evict(bundleReady, ARTICLE_CACHE_LIMIT);
    }
    return bundle;
  });

  bundleCache.set(key, request);
  evict(bundleCache, ARTICLE_CACHE_LIMIT);
  evict(textCache, ARTICLE_CACHE_LIMIT);
  return request;
}

/**
 * The already-loaded edition, or null. Lets an open codex render a cached
 * entry in its first frame instead of mounting a skeleton and repainting a
 * tick later — which is what turning pages between visited entries does.
 */
export function peekEntry(entry: IndexEntry, lang: Lang): EntryBundle | null {
  return bundleReady.get(`${slugOf(entry)}::${lang}`) ?? null;
}

/** Warm an edition without caring about the result — used to fetch the pages
 *  either side of an open codex, so ← → resolves from memory. */
export function prefetchEntry(entry: IndexEntry, lang: Lang): void {
  void loadEntry(entry, lang);
}
