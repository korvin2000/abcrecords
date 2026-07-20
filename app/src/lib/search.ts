import type { IndexEntry } from "./types";
import { entryLangs, type Lang } from "./languages";
import { slugOf } from "./paths";

/**
 * Name search across a bilingual catalogue.
 *
 * Titles/names appear in Latin ("Andrés Segovia") and Cyrillic ("Јован
 * Јовичић"), while users type in either script. Strategy:
 *   1. fold case + diacritics on both sides (Agustín → agustin);
 *   2. expand the *query* into a bounded set of transliteration variants
 *      (сеговия → segovia / segoviya / …) and match variants too;
 *   3. the Latin slug (jovan-jovicic) doubles as a haystack, so Latin
 *      queries always reach Cyrillic-titled entries.
 */

const CYR_TO_LAT: Record<string, string[]> = {
  а: ["a"], б: ["b"], в: ["v"], г: ["g"], д: ["d"],
  е: ["e", "ye"], ё: ["e", "yo"], ж: ["zh", "j"], з: ["z"], и: ["i"],
  й: ["y", "i", "j"], к: ["k", "c"], л: ["l"], м: ["m"], н: ["n"],
  о: ["o"], п: ["p"], р: ["r"], с: ["s"], т: ["t"], у: ["u"],
  ф: ["f"], х: ["kh", "h"], ц: ["ts", "c"], ч: ["ch", "c"],
  ш: ["sh"], щ: ["shch", "sch"], ъ: [""], ы: ["y"], ь: [""],
  э: ["e"], ю: ["yu", "iu", "u"], я: ["ya", "ia", "a"],
  // Serbian/Macedonian extras seen in the data
  ј: ["j", "y"], ћ: ["c", "ch"], ђ: ["dj", "d"], љ: ["lj"], њ: ["nj"], џ: ["dz"],
};

const MAX_VARIANTS = 64;

export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ё/g, "е");
}

/** Bounded cartesian expansion of transliteration alternatives. */
export function translitVariants(foldedQuery: string): string[] {
  let variants = [""];
  for (const ch of foldedQuery) {
    const subs = CYR_TO_LAT[ch] ?? [ch];
    const next: string[] = [];
    for (const v of variants) {
      for (const s of subs) {
        next.push(v + s);
        if (next.length >= MAX_VARIANTS) break;
      }
      if (next.length >= MAX_VARIANTS) break;
    }
    variants = next;
  }
  return variants;
}

export interface SearchDoc {
  entry: IndexEntry;
  slug: string;
  haystacks: string[];
  /** Languages this entry is available in (from index.json `lang`). */
  langs: Lang[];
}

export function buildSearchDoc(entry: IndexEntry): SearchDoc {
  const slug = slugOf(entry);
  const haystacks = [
    fold(entry.title ?? ""),
    fold(`${entry.forename ?? ""} ${entry.surname ?? ""}`),
    fold(`${entry.surname ?? ""} ${entry.forename ?? ""}`),
    slug.replace(/-/g, " "),
  ].filter(Boolean);
  return { entry, slug, haystacks, langs: entryLangs(entry) };
}

function tokenMatches(doc: SearchDoc, token: string): boolean {
  const forms = new Set([token, ...translitVariants(token)]);
  for (const hay of doc.haystacks) {
    for (const form of forms) {
      if (form && hay.includes(form)) return true;
    }
  }
  return false;
}

export interface SearchFilters {
  types: Set<string>;
  countries: Set<string>;
}

export function searchEntries(
  docs: SearchDoc[],
  query: string,
  filters: SearchFilters,
): SearchDoc[] {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  return docs.filter((doc) => {
    if (filters.types.size && !filters.types.has(doc.entry.type)) return false;
    if (filters.countries.size && !filters.countries.has(doc.entry.country)) return false;
    return tokens.every((t) => tokenMatches(doc, t));
  });
}
