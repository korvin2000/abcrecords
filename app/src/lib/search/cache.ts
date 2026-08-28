import type { FactsBySlug } from "../dossier/facts";
import type { Lang } from "../languages";
import type { CompiledCriteria } from "./criteria";
import type { SearchDoc } from "./docs";
import { runSearch, type SearchContext, type SearchRun } from "./engine";

/**
 * Search-as-you-type, narrowed against the previous keystroke.
 *
 * Typing a name is not a series of unrelated searches — it is one search being
 * refined, and each refinement can only ever *shrink* the answer. `сег` cannot
 * match anything `сего` does not already exclude, so the second keystroke has
 * no business scanning the whole catalogue again. This module keeps the last
 * result set and hands the engine that instead, whenever it can prove the
 * narrower corpus is sufficient.
 *
 * ## Why the containment holds
 *
 * The corpus may be narrowed when every filter is unchanged **and** the folded
 * query extends the previous one (`compile` publishes it as `text`). That is
 * enough because:
 *
 * - `fold` is per-character and order-preserving, so a longer query's folded
 *   form starts with the shorter one's, and splitting both on whitespace makes
 *   every earlier token a **prefix** of the token now in its place (later
 *   tokens are new ones, and an added token can only narrow — matching is AND
 *   across tokens);
 * - a field containing a token contains every prefix of it, so `scoreDoc` can
 *   only lose documents as the query grows;
 * - the transliterated path preserves that too: `translitVariants` expands
 *   left to right, so every spelling of `сего` begins with some spelling of
 *   `сег`, and it is compared against the same (unchanged) fields.
 *
 * ## Why the *filters* are not narrowed the same way
 *
 * Adding a country widens nothing, but *removing* one does, and a set that
 * changed identity says nothing about which way. Rather than reason about the
 * direction of every facet, the cache drops to the full corpus whenever any
 * filter moves. Filters change once per click; the query changes once per
 * character, and that is the loop worth protecting.
 *
 * ## What this is worth
 *
 * At today's 736 entries a full pass measures well under a millisecond, so the
 * gain is not yet visible — the honest reason to keep this is that it makes
 * the per-keystroke cost proportional to *what is on screen* rather than to
 * the catalogue, which is the property that has to hold at 10⁴ entries. It is
 * also why there is still no inverted index or trie here: measure first.
 */

interface Memo {
  /** The full corpus this run started from — the identity that says whether
   *  a later run is even talking about the same catalogue. */
  readonly docs: readonly SearchDoc[];
  readonly criteria: CompiledCriteria;
  readonly lang: Lang;
  readonly facts: FactsBySlug;
  readonly run: SearchRun;
}

let memo: Memo | null = null;

/**
 * Run a search, reusing the previous result set when the query has only grown.
 *
 * Deliberately module-level rather than a hook: the catalogue has one search,
 * and a per-component cache would either miss (a remount loses it) or lie (two
 * components with different criteria sharing one slot).
 */
export function searchIncremental(
  docs: readonly SearchDoc[],
  criteria: CompiledCriteria,
  context: SearchContext,
): SearchDoc[] {
  const reusable =
    memo !== null &&
    memo.docs === docs &&
    memo.lang === context.lang &&
    memo.facts === context.facts &&
    sameFilters(memo.criteria, criteria) &&
    criteria.text.startsWith(memo.criteria.text);

  // The narrowed corpus keeps catalogue order (engine.matched), so ranking it
  // breaks ties exactly as a full pass would.
  const corpus = reusable ? memo!.run.matched : docs;

  const started = import.meta.env.DEV ? performance.now() : 0;
  const run = runSearch(corpus, criteria, context);
  if (import.meta.env.DEV) record(reusable, corpus.length, performance.now() - started);

  memo = { docs, criteria, lang: context.lang, facts: context.facts, run };
  return run.ranked;
}

/** Forget the remembered pass. Only needed when a *doc* changed in place,
 *  which the catalogue never does — kept for tests and for the DEV probe. */
export function resetSearchCache(): void {
  memo = null;
}

/**
 * Everything except the free-text query. `types`/`countries` are compared by
 * identity because `compile` passes the criteria's own sets straight through
 * and `toggleValue` always builds a new one; the year bounds are compared by
 * value because `compile` builds them fresh every time.
 */
function sameFilters(a: CompiledCriteria, b: CompiledCriteria): boolean {
  return (
    a.types === b.types &&
    a.countries === b.countries &&
    a.gender === b.gender &&
    a.currentLangOnly === b.currentLangOnly &&
    a.forename === b.forename &&
    a.surname === b.surname &&
    a.needsDossier === b.needsDossier &&
    sameBounds(a.born, b.born) &&
    sameBounds(a.died, b.died)
  );
}

function sameBounds(
  a: CompiledCriteria["born"],
  b: CompiledCriteria["born"],
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.from === b.from && a.to === b.to;
}

/* ------------------------------------------------------------------- probe */

/**
 * `__search` in the console: how many passes were narrowed, how large a corpus
 * each one actually scanned, and how long it took. The claim this module makes
 * — that a keystroke costs what is on screen rather than what is in the
 * catalogue — should be checkable in ten seconds rather than reasoned about,
 * and it is what to look at first before anyone reaches for an inverted index.
 *
 * DEV only, and behind `import.meta.env.DEV` at both call sites, so the
 * production bundle carries neither the counters nor the `performance.now()`
 * calls around the hot loop.
 */
interface Stats {
  passes: number;
  narrowed: number;
  scanned: number;
  totalMs: number;
  worstMs: number;
}

const stats: Stats = { passes: 0, narrowed: 0, scanned: 0, totalMs: 0, worstMs: 0 };

function record(reused: boolean, scanned: number, ms: number): void {
  stats.passes++;
  if (reused) stats.narrowed++;
  stats.scanned += scanned;
  stats.totalMs += ms;
  stats.worstMs = Math.max(stats.worstMs, ms);
}

if (import.meta.env.DEV) {
  (window as unknown as { __search: unknown }).__search = {
    get stats() {
      const { passes, narrowed, scanned, totalMs, worstMs } = stats;
      return {
        passes,
        narrowed,
        narrowedShare: passes ? `${Math.round((narrowed / passes) * 100)}%` : "—",
        avgDocsScanned: passes ? Math.round(scanned / passes) : 0,
        avgMs: passes ? +(totalMs / passes).toFixed(3) : 0,
        worstMs: +worstMs.toFixed(3),
      };
    },
    reset() {
      Object.assign(stats, { passes: 0, narrowed: 0, scanned: 0, totalMs: 0, worstMs: 0 });
      resetSearchCache();
    },
  };
}
