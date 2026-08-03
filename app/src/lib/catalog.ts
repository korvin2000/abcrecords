import type { EntryBundle, EntryData, Gender, IndexEntry, NameIndex } from "./types";
import { localizeContentPath, resolveContentPath } from "./paths";
import { isBiography, isListed, slugOf } from "./entry";
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
 * One raw row → a usable entry, or null when `id`/`md` are missing (without
 * them it can be neither joined nor routed). This is the single boundary
 * where case is settled: `country` uppercase, the other enums lowercase.
 */
function normalizeRow(raw: unknown): IndexEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const id = typeof row.id === "number" ? String(row.id) : text(row.id);
  const md = text(row.md);
  if (!id || !md) return null;

  const rawGender = lower(row.gender);
  const gender = rawGender && isGender(rawGender) ? rawGender : undefined;
  if (rawGender && !gender) warnDev(`entry ${id}: unknown gender "${rawGender}"`);

  const rawCountry = lower(row.country);
  const country = rawCountry && ISO2.test(rawCountry) ? rawCountry.toUpperCase() : undefined;
  if (rawCountry && !country) warnDev(`entry ${id}: country "${rawCountry}" is not an ISO alpha-2 code`);

  return {
    id,
    md,
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
      warnDev("skipped a row with no id or no md path");
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

const bundleCache = new Map<string, Promise<EntryBundle>>();
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

function fetchJson(path: string): Promise<EntryData | null> {
  return cached(jsonCache, path, (p) =>
    fetch(resolveContentPath(p))
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as EntryData;
        return data && typeof data === "object" && data.metadata ? data : null;
      })
      .catch(() => null),
  );
}

function fetchText(path: string): Promise<string | null> {
  return cached(textCache, path, (p) =>
    fetch(resolveContentPath(p))
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null),
  );
}

/** Load (and cache) one language edition of an entry — dossier + article in
 *  parallel. A page declares no dossier, so its `data` is null without a
 *  request; a missing file also fails soft to null. */
export function loadEntry(entry: IndexEntry, lang: Lang): Promise<EntryBundle> {
  const key = `${slugOf(entry)}::${lang}`;
  let request = bundleCache.get(key);
  if (!request) {
    request = Promise.all([
      entry.json ? fetchJson(localizeContentPath(entry.json, lang)) : Promise.resolve(null),
      fetchText(localizeContentPath(entry.md, lang)),
    ]).then(([data, md]) => ({ data, md }));
    bundleCache.set(key, request);
  }
  return request;
}
