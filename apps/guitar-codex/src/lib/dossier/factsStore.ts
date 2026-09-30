import { loadEntryData, type CatalogRecord } from "../catalog";
import { pickContentLang, type Lang } from "../languages";
import { resolveSitePath } from "../paths";
import { perfTier } from "../fx";
import type { EntryData } from "../types";
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
 * **One request instead of seven hundred, when the server can.** Reading every
 * dossier from the browser is 736 requests on a first visit — a trickle on a
 * desk and a real cost on a phone. `server/facts.php` answers the same
 * question in one response, and it is not the artefact the paragraph above
 * warns against: it re-derives its validator from the dossiers' own
 * modification times on *every request*, so an edited birth year is in the
 * very next answer. It is asked first (`DOSSIER.endpoint`); anything short of
 * a well-formed reply — no PHP on the dev server, a static mirror, a timeout —
 * and the crawl below runs exactly as it always has.
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
  /** Latched by the first `start("demand")`, even one that arrives while an
   *  idle read is already under way — that read then must not decline. */
  private demanded = false;
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

  /**
   * Begin (or keep) reading dossiers. Safe to call on every render.
   *
   * `"demand"` — a criterion needs the facts: read them, whatever it takes.
   * `"idle"` — nothing is waiting, the herald would merely like to know who
   * was born today: ask the server's aggregate, and fall back to the crawl
   * only where seven hundred requests are affordable (see `crawlIsCheap`).
   */
  start(mode: "idle" | "demand" = "demand"): void {
    if (mode === "demand") this.demanded = true;
    if (this.started || this.disposed || !this.records.length) return;
    this.started = true;
    void this.read();
  }

  /** Stop a superseded index; in-flight requests still resolve into the
   *  shared path cache, so nothing already paid for is wasted. */
  dispose(): void {
    this.disposed = true;
    if (this.pendingNotify) clearTimeout(this.pendingNotify);
    this.pendingNotify = null;
    this.listeners.clear();
  }

  private async read(): Promise<void> {
    if (DOSSIER.endpoint && (await this.readAggregate())) {
      if (!this.disposed) this.commit(true);
      return;
    }
    if (this.disposed) return;
    // Asked *after* the await, from the latch rather than from an argument: a
    // criterion may have started needing the facts while the aggregate was
    // being fetched, and its `start("demand")` found the index already busy.
    if (!this.demanded && !crawlIsCheap()) {
      // Not now. Leave the index unstarted, so the moment a criterion does
      // need the facts, `start("demand")` reads them.
      this.started = false;
      return;
    }
    await this.crawl();
  }

  /**
   * The whole index from `server/facts.php`, or false if it could not be had.
   *
   * An entry is read in the edition the codex would open (`pickContentLang`),
   * so the reader's language is one request and each fallback language one
   * more — today that is at most one entry per language. False means *nothing
   * was claimed*: the map is left empty for the crawl to fill.
   */
  private async readAggregate(): Promise<boolean> {
    const main = await fetchAggregate(this.lang);
    if (!main || this.disposed) return false;

    const others = new Map<Lang, CatalogRecord[]>();
    for (const record of this.records) {
      const lang = pickContentLang(record.langs, this.lang);
      if (!record.entry.json || lang === this.lang) {
        this.facts.set(record.slug, factsFrom(record, dossierFrom(main, record)));
      } else {
        const group = others.get(lang);
        if (group) group.push(record);
        else others.set(lang, [record]);
      }
    }

    for (const [lang, group] of others) {
      const entries = await fetchAggregate(lang);
      if (this.disposed) return true;
      for (const record of group) {
        // A fallback language whose aggregate did not answer is a handful of
        // entries: read those the ordinary way rather than give the index up.
        const data = entries ? dossierFrom(entries, record) : await loadEntryData(record.entry, lang);
        if (this.disposed) return true;
        this.facts.set(record.slug, factsFrom(record, data));
      }
    }
    return true;
  }

  private async crawl(): Promise<void> {
    const cursor = { next: 0 };
    // Six sockets are the most HTTP/1.1 will run and no strain on a desk; a
    // machine graded below `high` is the one whose first seconds they hurt.
    const limit = perfTier() === "high" ? DOSSIER.concurrency : DOSSIER.lowConcurrency;
    const workers = Math.min(limit, this.records.length);
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

/* ------------------------------------------------------ server aggregate */

/** `basename → [forename, surname, born, died]`, as `server/facts.php` sends it. */
type Aggregate = Readonly<Record<string, unknown>>;

/** One language's aggregate, or null — never a throw, never a partial. */
async function fetchAggregate(lang: Lang): Promise<Aggregate | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOSSIER.endpointTimeoutMs);
  try {
    const res = await fetch(`${resolveSitePath(DOSSIER.endpoint)}?lang=${lang}`, {
      signal: controller.signal,
      credentials: "omit",
    });
    if (!res.ok) return null;
    const doc: unknown = await res.json();
    if (!doc || typeof doc !== "object") return null;
    const { v, entries } = doc as { v?: unknown; entries?: unknown };
    return v === 1 && entries && typeof entries === "object" && !Array.isArray(entries)
      ? (entries as Aggregate)
      : null;
  } catch {
    return null; // no such script, not JSON, too slow — the crawl will do
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The slice of a dossier the aggregate carries, in the shape `factsFrom`
 * already reads — so folding names and parsing dates stay in one place, and
 * the two sources cannot come to disagree about either. Null (a page, or a
 * dossier the server could not read) is "nothing can be asserted", exactly as
 * a failed fetch is.
 */
function dossierFrom(entries: Aggregate, record: CatalogRecord): EntryData | null {
  const path = record.entry.json;
  if (!path) return null;
  const key = path.slice(path.lastIndexOf("/") + 1).replace(/\.bio\.json$/i, "");
  const row = entries[key];
  if (!Array.isArray(row)) return null;
  const at = (i: number): string | undefined => {
    const value: unknown = row[i];
    return typeof value === "string" && value ? value : undefined;
  };
  return { metadata: { forename: at(0), surname: at(1), dates: { born: at(2), died: at(3) } } };
}

interface ConnectionHints {
  connection?: { saveData?: boolean; effectiveType?: string };
}

/**
 * Whether the fallback crawl may start with nobody waiting for it. Not on a
 * machine graded `low`, not when the reader asked the browser to save data,
 * and not over a connection the browser itself calls 2g or 3g. There the
 * herald keeps to its sayings, and the facts are read the moment a search by
 * name or year asks for them.
 */
function crawlIsCheap(): boolean {
  const { connection } = navigator as unknown as ConnectionHints;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /(^|-)2g$|^3g$/.test(connection.effectiveType)) return false;
  return perfTier() !== "low";
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
