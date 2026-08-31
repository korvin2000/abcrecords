import type { CatalogRecord } from "../catalog";
import type { EntryFacts } from "../dossier/facts";
import type { Lang } from "../languages";
import type { Dmy } from "../metadata";
import type { CompiledCriteria, YearBounds } from "./criteria";

/**
 * The filters, split by what they can be answered from.
 *
 * `matchesIndex` needs nothing but `index.json`, so it is free and runs first.
 * `matchesDossier` needs that entry's `*.bio.json`, so it runs only when a
 * dossier-backed criterion is actually set, and only on what survived.
 *
 * An entry whose dossier has not been read yet cannot satisfy a dossier
 * criterion — it is excluded rather than assumed to match, so a result list is
 * never wider than the evidence behind it. The index streams in, so the list
 * only ever grows towards the truth.
 */

export function matchesIndex(
  record: CatalogRecord,
  c: CompiledCriteria,
  lang: Lang,
): boolean {
  const { entry } = record;
  if (c.types && !c.types.has(entry.type)) return false;
  if (c.countries && !(entry.country && c.countries.has(entry.country))) return false;
  if (c.gender && entry.gender !== c.gender) return false;
  if (c.currentLangOnly && !record.langs.includes(lang)) return false;
  return true;
}

export function matchesDossier(facts: EntryFacts | undefined, c: CompiledCriteria): boolean {
  if (!facts) return false;
  if (c.forename && !facts.forenameKey.includes(c.forename)) return false;
  if (c.surname && !facts.surnameKey.includes(c.surname)) return false;
  if (c.born && !withinYears(facts.born, c.born)) return false;
  if (c.died && !withinYears(facts.died, c.died)) return false;
  return true;
}

/** Inclusive on both ends; an undeclared date can satisfy no range. */
function withinYears(date: Dmy | null, bounds: YearBounds): boolean {
  if (!date) return false;
  if (bounds.from !== null && date.y < bounds.from) return false;
  if (bounds.to !== null && date.y > bounds.to) return false;
  return true;
}
