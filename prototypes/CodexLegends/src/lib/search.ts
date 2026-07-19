// ============================================================
//  Search engine — pure, diacritic-insensitive, token based.
//  Matches on first name OR surname, ranked by relevance.
// ============================================================

import type { Character } from "@/types/character";

/** Lower-case + strip diacritics for forgiving matching. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface SearchFilters {
  archetypes: Set<string>;
  elements: Set<string>;
}

export interface ScoredCharacter {
  character: Character;
  score: number;
}

/** Score a single character against a query (higher = better, 0 = no match). */
export function scoreMatch(c: Character, qNorm: string): number {
  if (!qNorm) return 1;
  const first = normalize(c.meta.firstName);
  const last = normalize(c.meta.surname);
  const full = `${first} ${last}`;
  const title = normalize(c.meta.title);
  const species = normalize(c.meta.species);

  let score = 0;
  if (first === qNorm || last === qNorm) score = 100;
  else if (first.startsWith(qNorm) || last.startsWith(qNorm)) score = 80;
  else if (full.includes(qNorm)) score = 60;
  else if (title.includes(qNorm) || species.includes(qNorm)) score = 30;
  else if (c.aliases.some((a) => normalize(a).includes(qNorm))) score = 25;
  return score;
}

/**
 * Stream-style pipeline: normalise → score → filter by score & facets → sort.
 * Returns a ranked list. (Functional composition of small steps.)
 */
export function searchCharacters(
  list: Character[],
  query: string,
  filters: SearchFilters
): Character[] {
  const q = normalize(query);

  return list
    .map((c) => ({ c, score: scoreMatch(c, q) }))
    .filter(({ c }) => filters.archetypes.size === 0 || filters.archetypes.has(c.meta.archetype))
    .filter(({ c }) => filters.elements.size === 0 || filters.elements.has(c.meta.element))
    .filter(({ score }) => (q ? score > 0 : true))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}
