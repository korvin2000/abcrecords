import { langInfo, type Lang } from "../languages";
import { EMPTY_CRITERIA, type GenderFilter, type LangScope, type SearchCriteria } from "./criteria";

/**
 * The search filter, written down and read back.
 *
 * `SearchCriteria` holds `Set`s and is compared by identity, neither of which
 * survives `JSON.stringify`. `StoredSearch` is its plain-JSON twin: arrays
 * instead of sets, every field optional, nothing that a hand-edited or
 * out-of-date document could turn into a crash. `restore` is total — it takes
 * `unknown` and always returns usable criteria — because a remembered filter
 * must never be the reason the catalogue fails to open.
 *
 * The free-text query is deliberately **not** remembered. A filter ("Spanish
 * guitarists") is a standing preference; a half-typed name is not, and coming
 * back to a search box with someone else's surname already in it reads as a
 * bug rather than a courtesy.
 */
export interface StoredSearch {
  readonly types?: readonly string[];
  readonly countries?: readonly string[];
  readonly gender?: string;
  readonly scope?: string;
  readonly forename?: string;
  readonly surname?: string;
  readonly born?: readonly [string, string];
  readonly died?: readonly [string, string];
}

/** Criteria → the document to remember. Empty fields are omitted, so an
 *  untouched filter serializes to `{}` and stays cheap to store. */
export function capture(c: SearchCriteria): StoredSearch {
  const out: Record<string, unknown> = {};
  if (c.types.size) out.types = [...c.types];
  if (c.countries.size) out.countries = [...c.countries];
  if (c.gender !== "any") out.gender = c.gender;
  if (c.scope !== "all") out.scope = c.scope;
  if (c.forename.trim()) out.forename = c.forename;
  if (c.surname.trim()) out.surname = c.surname;
  if (c.born.from || c.born.to) out.born = [c.born.from, c.born.to];
  if (c.died.from || c.died.to) out.died = [c.died.from, c.died.to];
  return out as StoredSearch;
}

/** A remembered document → criteria. Anything unrecognised falls back to the
 *  empty value for that field rather than rejecting the whole document. */
export function restore(raw: unknown): SearchCriteria {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const born = pair(row.born);
  const died = pair(row.died);

  return {
    ...EMPTY_CRITERIA,
    types: codes(row.types),
    countries: codes(row.countries),
    gender: pick<GenderFilter>(row.gender, ["any", "m", "f"], "any"),
    scope: pick<LangScope>(row.scope, ["all", "current"], "all"),
    forename: text(row.forename),
    surname: text(row.surname),
    born: { from: born[0], to: born[1] },
    died: { from: died[0], to: died[1] },
  };
}

/**
 * What a reader sees before they have refined anything: the catalogue narrowed
 * to their own language's country, when the catalogue actually holds entries
 * from it.
 *
 * The country comes from the language's own Intl locale (`de-DE` → `DE`,
 * `en-GB` → `GB`) rather than from a second hand-maintained table — there is
 * already one source of truth for what a tongue is, in `languages.ts`, and a
 * table that can disagree with it eventually will.
 *
 * This is a **suggestion, not a rule**: it applies once, on a visit that has
 * nothing remembered, and the moment the reader touches the filter their
 * choice is what gets stored. It also declines to narrow to nothing — Korean
 * with no Korean entries in the catalogue keeps the whole catalogue, because
 * an empty grid on first sight is worse than an unfiltered one.
 */
export function defaultsFor(lang: Lang, available: ReadonlySet<string>): SearchCriteria {
  const country = countryOfLanguage(lang);
  if (!country || !available.has(country)) return EMPTY_CRITERIA;
  return { ...EMPTY_CRITERIA, countries: new Set([country]) };
}

/** `de` → `DE`, via the language's Intl locale. Null when it declares none. */
export function countryOfLanguage(lang: Lang): string | null {
  const region = langInfo(lang).locale.split("-")[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : null;
}

/* ------------------------------------------------------------------ parsing */

function codes(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value)) return EMPTY_CRITERIA.types;
  const out = new Set<string>();
  for (const item of value) if (typeof item === "string" && item) out.add(item);
  return out.size ? out : EMPTY_CRITERIA.types;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function pair(value: unknown): [string, string] {
  return Array.isArray(value) ? [text(value[0]), text(value[1])] : ["", ""];
}
