import { loadEntryData, type CatalogRecord } from "../catalog";
import { pickContentLang, type Lang } from "../languages";
import { DOSSIER } from "@/config";
import { factsFrom, type EntryFacts, type FactsBySlug } from "./facts";

/**
 * The dossier facts index — the one place that reads every entry's
 * `*.bio.json` so that features needing *cross-entry* metadata (advanced
 * search by name and dates, the herald's "on this day" lookup) can work
 * without each of them inventing its own crawl.
 *
 * Why a store and not a hook: the crawl outlives any single component, must
 * happen at most once per (catalogue, language), and has to keep streaming
 * while React re-renders around it. So it lives at module scope and is read
 * through `useSyncExternalStore` (see useFacts.ts).
 *
 * **It is built in the browser, from `pages/`, and nowhere else.** A build step
 * did briefly project these four fields per language into a `facts-<lang>.json`
 * emitted beside the index, which made the first search instant — and made the
 * *deployed* answer a snapshot of whatever the dossiers said at build time. Fix
 * a birth year in `pages/ru/…​.bio.json` and the catalogue would keep searching
 * on the old one until someone rebuilt. Two files claiming the same fact is one
 * file too many: `pages/` is the source, this index is the only cache, and the
 * cache lives exactly as long as the tab. Do not reintroduce a generated
 * artefact here without solving invalidation first.
 *
 * How the crawl stays cheap on weak hardware:
 *   • it never starts unless something asks for it (`start()` is idempotent);
 *   • at most `DOSSIER.concurrency` requests are in flight;
 *   • each worker yields to the browser between fetches, so the crawl fills
 *     idle time instead of competing with input;
 *   • progress notifications are throttled, so 10³ arrivals cost a handful of
 *     renders rather than 10³;
 *   • every read goes through catalog.ts's per-path cache, so opening a codex
 *     afterwards is free rather than duplicated.
 */

export interface FactsSnapshot {
  /** Facts for the entries read so far — a fresh map per notification, so
   *  `useMemo` deps on it behave. */
  readonly bySlug: FactsBySlug;
  readonly loaded: number;
  readonly total: number;
  readonly done: boolean;
  /** 0…1. `1` before the crawl starts only when there is nothing to read. */
  readonly progress: number;
}

function snapshotOf(bySlug: FactsBySlug, total: number, done: boolean): FactsSnapshot {
  return {
    bySlug,
    loaded: bySlug.size,
    total,
    done,
    progress: total === 0 ? 1 : Math.min(1, bySlug.size / total),
  };
}

const EMPTY_MAP: FactsBySlug = new Map();

export class FactsIndex {
  /** Kept so the registry can tell a stale index from a live one. */
  readonly records: readonly CatalogRecord[];

  private readonly lang: Lang;
  private readonly facts = new Map<string, EntryFacts>();
  private readonly listeners = new Set<() => void>();
  private snapshot: FactsSnapshot;
  private started = false;
  private disposed = false;
  private lastNotify = 0;
  private pendingNotify: ReturnType<typeof setTimeout> | null = null;

  constructor(records: readonly CatalogRecord[], lang: Lang) {
    this.records = records;
    this.lang = lang;
    this.snapshot = snapshotOf(EMPTY_MAP, records.length, records.length === 0);
  }

  /* ------------------------------------------------------------ read side */

  readonly getSnapshot = (): FactsSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /* ----------------------------------------------------------- write side */

  /** Begin (or keep) reading dossiers. Safe to call on every render. */
  start(): void {
    if (this.started || this.disposed || !this.records.length) return;
    this.started = true;
    void this.crawl();
  }

  /** Stop a superseded index; in-flight requests still resolve into the
   *  shared path cache, so nothing already paid for is wasted. */
  dispose(): void {
    this.disposed = true;
    if (this.pendingNotify) clearTimeout(this.pendingNotify);
    this.pendingNotify = null;
    this.listeners.clear();
  }

  private async crawl(): Promise<void> {
    const cursor = { next: 0 };
    const workers = Math.min(DOSSIER.concurrency, this.records.length);
    await Promise.all(Array.from({ length: workers }, () => this.work(cursor)));
    if (!this.disposed) this.commit(true);
  }

  /** One worker draining the shared cursor, yielding between entries. */
  private async work(cursor: { next: number }): Promise<void> {
    while (!this.disposed) {
      const record = this.records[cursor.next++];
      if (!record) return;

      await whenIdle();
      if (this.disposed) return;

      const lang = pickContentLang(record.langs, this.lang);
      const data = await loadEntryData(record.entry, lang);
      if (this.disposed) return;

      this.facts.set(record.slug, factsFrom(record, data));
      this.commit(false);
    }
  }

  /** Publish a new snapshot. Intermediate ones are throttled; the final one
   *  always lands at once, because consumers wait on `done`. */
  private commit(done: boolean): void {
    const elapsed = Date.now() - this.lastNotify;
    if (!done && elapsed < DOSSIER.notifyThrottleMs) {
      this.pendingNotify ??= setTimeout(() => {
        this.pendingNotify = null;
        if (!this.disposed) this.commit(false);
      }, DOSSIER.notifyThrottleMs - elapsed);
      return;
    }

    if (this.pendingNotify) {
      clearTimeout(this.pendingNotify);
      this.pendingNotify = null;
    }
    this.lastNotify = Date.now();
    this.snapshot = snapshotOf(new Map(this.facts), this.records.length, done);
    for (const listener of this.listeners) listener();
  }
}

/* ------------------------------------------------------------- registry */

const indexes = new Map<Lang, FactsIndex>();

/**
 * The index for this catalogue slice in this language. Identity is stable for
 * a stable `records` array, which is what lets `useSyncExternalStore` subscribe
 * without resubscribing every render.
 *
 * Called during render and memoized on `records` identity, so the lookup is
 * idempotent (a double-invoked render returns the same instance). Retiring the
 * superseded index here assumes **one owner per language** — true today, since
 * only `App` reads the catalogue-wide slice. Two components asking for
 * different slices of the same language would need the retirement moved into
 * an effect.
 */
export function factsIndexFor(records: readonly CatalogRecord[], lang: Lang): FactsIndex {
  const current = indexes.get(lang);
  if (current && current.records === records) return current;

  current?.dispose();
  const created = new FactsIndex(records, lang);
  indexes.set(lang, created);
  return created;
}

/* ---------------------------------------------------------------- idling */

interface IdleWindow {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
}

/** Wait for a quiet moment — a macrotask at worst, so a slow device keeps its
 *  input responsive while the crawl runs. */
function whenIdle(): Promise<void> {
  return new Promise<void>((resolve) => {
    const idle = (window as unknown as IdleWindow).requestIdleCallback;
    if (idle) idle(() => resolve(), { timeout: 400 });
    else setTimeout(resolve, 0);
  });
}
