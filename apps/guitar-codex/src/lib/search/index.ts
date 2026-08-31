/**
 * Name search across a multilingual catalogue, in four layers:
 *
 *   fold.ts        script folding + bounded Cyrillic→Latin transliteration
 *   docs.ts        the corpus: weighted, pre-folded fields per entry
 *   scoring.ts     query tokenizing + relevance
 *   criteria.ts    the form state and its compiled form
 *   predicates.ts  the filters, split by index-only vs dossier-backed
 *   engine.ts      the one pass that puts them together
 *   cache.ts       search-as-you-type, narrowed against the last keystroke
 *   persist.ts     the filter written down, and its first-visit default
 *
 * Names are authored per language (`index-<lang>.json`) with search-only
 * aliases beside them, and `index.json` carries a Latin fallback title. On top
 * of that:
 *   1. fold case + diacritics on both sides (Agustín → agustin);
 *   2. expand a *Cyrillic* query token into a bounded set of transliterations
 *      (сеговия → segovia / segoviya / …) and match those against Latin text;
 *   3. the Latin slug (jovan-jovicic) doubles as a field, so Latin queries
 *      always reach Cyrillic-named entries.
 *
 * The split is by *what a step depends on*, not by size: corpus-only work runs
 * once per catalogue, query-only work once per query, and only `indexOf` calls
 * are left inside the per-document loop.
 */

export { fold, isAscii, translitVariants, CYRILLIC } from "./fold";
export { buildSearchIndex, type Field, type SearchDoc, type Weight } from "./docs";
export { matchScore, scoreDoc, tokenize, type Token } from "./scoring";
export {
  EMPTY_CRITERIA,
  compile,
  refinementCount,
  toggleValue,
  withoutRefinements,
  type CompiledCriteria,
  type GenderFilter,
  type LangScope,
  type SearchCriteria,
  type YearBounds,
  type YearRange,
} from "./criteria";
export { matchesDossier, matchesIndex } from "./predicates";
export { runSearch, searchEntries, type SearchContext, type SearchRun } from "./engine";
export { resetSearchCache, searchIncremental } from "./cache";
export {
  capture,
  countryOfLanguage,
  defaultsFor,
  restore,
  type StoredSearch,
} from "./persist";
