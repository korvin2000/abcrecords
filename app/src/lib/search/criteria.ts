import { fold } from "./fold";
import { tokenize, type Token } from "./scoring";

/**
 * What the reader is looking for — the whole search state in one value.
 *
 * Two shapes, on purpose:
 *
 *   `SearchCriteria`   what the form holds. Raw, serializable, string-typed
 *                      where the input is a string, so every control stays a
 *                      plain controlled component and nothing has to guess
 *                      what a half-typed year means.
 *
 *   `CompiledCriteria` what the engine reads. Folded, parsed, with "unset"
 *                      collapsed to `null` so the hot loop tests references
 *                      instead of re-deriving anything.
 *
 * `compile` is the single boundary between them, so a new criterion is added
 * in exactly three places: the interface, `compile`, and one predicate.
 */

export type GenderFilter = "any" | "m" | "f";

/** Which editions count: every language, or only the one being read. */
export type LangScope = "all" | "current";

/** Inclusive year bounds as typed. Empty string = open end. */
export interface YearRange {
  readonly from: string;
  readonly to: string;
}

export interface SearchCriteria {
  /** The free-text name query from the main input. */
  readonly query: string;
  readonly types: ReadonlySet<string>;
  /** ISO 3166-1 alpha-2, uppercase (as normalized by catalog.ts). */
  readonly countries: ReadonlySet<string>;
  readonly gender: GenderFilter;
  readonly scope: LangScope;
  /** Dossier `metadata.forename`. */
  readonly forename: string;
  /** Dossier `metadata.surname`. */
  readonly surname: string;
  /** Dossier `metadata.dates.born`, by year. */
  readonly born: YearRange;
  /** Dossier `metadata.dates.died`, by year. */
  readonly died: YearRange;
}

const NO_YEARS: YearRange = { from: "", to: "" };
const NO_VALUES: ReadonlySet<string> = new Set();

export const EMPTY_CRITERIA: SearchCriteria = {
  query: "",
  types: NO_VALUES,
  countries: NO_VALUES,
  gender: "any",
  scope: "all",
  forename: "",
  surname: "",
  born: NO_YEARS,
  died: NO_YEARS,
};

/** Add or remove one value of a multi-select criterion, immutably. */
export function toggleValue(values: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(values);
  if (!next.delete(value)) next.add(value);
  return next;
}

/**
 * How many refinements are narrowing the search beyond the plain name query —
 * the number the panel's badge shows. Counts *fields*, not values, so picking
 * three countries reads as one refinement.
 */
export function refinementCount(c: SearchCriteria): number {
  return (
    (c.types.size ? 1 : 0) +
    (c.countries.size ? 1 : 0) +
    (c.gender !== "any" ? 1 : 0) +
    (c.scope !== "all" ? 1 : 0) +
    (c.forename.trim() ? 1 : 0) +
    (c.surname.trim() ? 1 : 0) +
    (isRangeSet(c.born) ? 1 : 0) +
    (isRangeSet(c.died) ? 1 : 0)
  );
}

function isRangeSet(range: YearRange): boolean {
  return Boolean(range.from.trim() || range.to.trim());
}

/** Drop every refinement but keep what the reader typed in the main box. */
export function withoutRefinements(c: SearchCriteria): SearchCriteria {
  return { ...EMPTY_CRITERIA, query: c.query };
}

/* ------------------------------------------------------------- compiled */

export interface YearBounds {
  readonly from: number | null;
  readonly to: number | null;
}

export interface CompiledCriteria {
  readonly tokens: readonly Token[];
  /**
   * The whole query, folded, before it was split into tokens.
   *
   * Kept beside the tokens because one string comparison answers a question
   * the token array cannot: *does this query extend the previous one?* Folding
   * is per-character and order-preserving, so `fold(q + c)` always starts with
   * `fold(q)` — which is what lets `search/cache.ts` re-rank the previous
   * result set instead of the whole catalogue.
   */
  readonly text: string;
  /** Null means "not narrowing by this" — never an empty set to re-test. */
  readonly types: ReadonlySet<string> | null;
  readonly countries: ReadonlySet<string> | null;
  readonly gender: "m" | "f" | null;
  readonly currentLangOnly: boolean;
  /** Folded, so the predicate compares against pre-folded dossier keys. */
  readonly forename: string | null;
  readonly surname: string | null;
  readonly born: YearBounds | null;
  readonly died: YearBounds | null;
  /**
   * True when at least one criterion can only be answered from a `*.bio.json`.
   * The caller uses this to decide whether the dossier index is worth reading
   * at all — with it false, the search never touches the facts map.
   */
  readonly needsDossier: boolean;
}

export function compile(c: SearchCriteria): CompiledCriteria {
  const forename = foldTerm(c.forename);
  const surname = foldTerm(c.surname);
  const born = bounds(c.born);
  const died = bounds(c.died);

  const text = fold(c.query);

  return {
    tokens: tokenize(text),
    text,
    types: c.types.size ? c.types : null,
    countries: c.countries.size ? c.countries : null,
    gender: c.gender === "any" ? null : c.gender,
    currentLangOnly: c.scope === "current",
    forename,
    surname,
    born,
    died,
    needsDossier: Boolean(forename ?? surname ?? born ?? died),
  };
}

function foldTerm(raw: string): string | null {
  const text = fold(raw).trim();
  return text || null;
}

/**
 * Two typed years → inclusive bounds, or null when neither end is set. A
 * reversed range is read the way it was surely meant (2000…1900 = 1900…2000)
 * rather than silently matching nothing.
 */
function bounds(range: YearRange): YearBounds | null {
  const a = year(range.from);
  const b = year(range.to);
  if (a === null && b === null) return null;
  if (a !== null && b !== null && a > b) return { from: b, to: a };
  return { from: a, to: b };
}

const YEAR = /^\d{1,4}$/;

function year(raw: string): number | null {
  const text = raw.trim();
  return YEAR.test(text) ? Number(text) : null;
}
