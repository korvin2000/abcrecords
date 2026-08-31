import type { FactsBySlug } from "../dossier/facts";
import type { Lang } from "../languages";
import type { CompiledCriteria } from "./criteria";
import type { SearchDoc } from "./docs";
import { matchesDossier, matchesIndex } from "./predicates";
import { scoreDoc } from "./scoring";

/**
 * One pass, cheapest test first: index facets, then dossier facts (only when
 * something asked for them), then relevance — so the expensive work only ever
 * sees rows that already survived the free ones.
 *
 * Without a query the surviving rows keep catalogue order; with one they are
 * ranked best-first, ties keeping catalogue order (`Array.prototype.sort` is
 * stable per spec).
 */

export interface SearchContext {
  /** The reader's UI language — what `scope: "current"` means. */
  readonly lang: Lang;
  /** Dossier facts read so far; ignored unless `criteria.needsDossier`. */
  readonly facts: FactsBySlug;
}

/**
 * Both orders of one result set.
 *
 * `matched` keeps catalogue order — it is what `search/cache.ts` narrows the
 * next keystroke against, and re-ranking a *sorted* set would quietly change
 * how ties break (a stable sort keeps whatever order it was handed). `ranked`
 * is what the reader sees. With no query the two are the same array.
 */
export interface SearchRun {
  readonly matched: SearchDoc[];
  readonly ranked: SearchDoc[];
}

export function runSearch(
  docs: readonly SearchDoc[],
  criteria: CompiledCriteria,
  { lang, facts }: SearchContext,
): SearchRun {
  const ranked = criteria.tokens.length > 0;
  const matched: SearchDoc[] = [];
  const scores = ranked ? new Map<SearchDoc, number>() : null;

  for (const doc of docs) {
    if (!matchesIndex(doc.record, criteria, lang)) continue;
    if (criteria.needsDossier && !matchesDossier(facts.get(doc.record.slug), criteria)) continue;

    if (!scores) {
      matched.push(doc);
      continue;
    }

    const score = scoreDoc(doc, criteria.tokens);
    if (score > 0) {
      scores.set(doc, score);
      matched.push(doc);
    }
  }

  if (!scores) return { matched, ranked: matched };

  const sorted = [...matched].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
  return { matched, ranked: sorted };
}

/** The result list as the reader sees it: best match first, or catalogue
 *  order when nothing was typed. */
export function searchEntries(
  docs: readonly SearchDoc[],
  criteria: CompiledCriteria,
  context: SearchContext,
): SearchDoc[] {
  return runSearch(docs, criteria, context).ranked;
}
