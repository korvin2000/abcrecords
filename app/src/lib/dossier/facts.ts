import type { CatalogRecord } from "../catalog";
import type { EntryData, Gender } from "../types";
import { parseDmy, type Dmy } from "../metadata";
import { fold } from "../search/fold";

/**
 * The searchable slice of one dossier edition.
 *
 * `index.json` answers identity, craft, country and gender; everything else a
 * reader might search on — given name, family name, the dates — lives in that
 * entry's `*.bio.json` (docs/MetaData.md). This is the projection of that file
 * down to the few fields the advanced search and the herald actually read, so
 * neither of them ever holds a whole dossier in memory.
 *
 * Prose fields are folded at build time (`forenameKey`/`surnameKey`), exactly
 * as `search/docs.ts` folds the name index: matching a typed query must never
 * re-fold the corpus.
 */
export interface EntryFacts {
  readonly slug: string;
  readonly display: string;
  readonly gender: Gender | undefined;
  /** Folded given name, or "" when the dossier declares none. */
  readonly forenameKey: string;
  /** Folded family name, or "". */
  readonly surnameKey: string;
  readonly born: Dmy | null;
  readonly died: Dmy | null;
}

/** A dossier that could not be read, so nothing can be asserted about it. The
 *  record still exists — it simply matches no dossier-backed criterion. */
export function emptyFacts(record: CatalogRecord): EntryFacts {
  return {
    slug: record.slug,
    display: record.display,
    gender: record.entry.gender,
    forenameKey: "",
    surnameKey: "",
    born: null,
    died: null,
  };
}

/** Pure projection: one index row + its dossier edition → the searchable facts. */
export function factsFrom(record: CatalogRecord, data: EntryData | null): EntryFacts {
  if (!data) return emptyFacts(record);

  const meta = data.metadata;
  const dates = meta.dates;

  return {
    slug: record.slug,
    display: record.display,
    gender: record.entry.gender,
    forenameKey: foldName(meta.forename),
    surnameKey: foldName(meta.surname),
    born: parseDmy(dates?.born),
    died: parseDmy(dates?.died),
  };
}

function foldName(value: unknown): string {
  return typeof value === "string" ? fold(value).trim() : "";
}

/** Facts by slug — the shape every consumer reads. */
export type FactsBySlug = ReadonlyMap<string, EntryFacts>;

export const NO_FACTS: FactsBySlug = new Map();
