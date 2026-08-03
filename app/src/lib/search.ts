import type { IndexEntry, NameIndex } from "./types";
import type { CatalogRecord } from "./catalog";
import { aliasesOf } from "./names";

/**
 * Name search across a multilingual catalogue.
 *
 * Names are authored per language (index-<lang>.json) with search-only
 * aliases beside them, and index.json carries a Latin fallback title. On top
 * of that:
 *   1. fold case + diacritics on both sides (Agustín → agustin);
 *   2. expand a *Cyrillic* query token into a bounded set of transliterations
 *      (сеговия → segovia / segoviya / …) and match those against Latin text;
 *   3. the Latin slug (jovan-jovicic) doubles as a field, so Latin queries
 *      always reach Cyrillic-named entries.
 *
 * Everything that depends only on the corpus — folding, lowercasing, the
 * ASCII test — happens once in `buildSearchIndex`. Everything that depends
 * only on the query — folding, tokenizing, transliterating — happens once per
 * query. Per keystroke the work is `docs × fields × indexOf`, nothing more.
 *
 * There is deliberately no inverted index or trie: at catalogue scale
 * (~10³ entries × ~4 fields) a linear scan is sub-millisecond, and the index
 * would be real complexity for no measurable gain. Revisit only if profiling
 * on the full legacy set says otherwise.
 */

/* ------------------------------------------------------------------ folding */

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
const CYRILLIC = /[Ѐ-ӿ]/;
const NON_ASCII = /[^\u0000-\u007F]/;

export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    // Strip combining marks from LATIN letters only (Agustín → agustin).
    // Cyrillic й and ё decompose here too, and their marks are exactly what
    // tells the transliterator й→j/y apart from и→i — NFC puts them back.
    .replace(/([a-z])[\u0300-\u036F]+/g, "$1")
    .normalize("NFC")
    .replace(/ё/g, "е");
}

/** Bounded cartesian expansion of transliteration alternatives. The first
 *  variant is always the canonical one, so truncation only ever drops the
 *  less likely spellings. */
export function translitVariants(foldedToken: string): string[] {
  let variants = [""];
  for (const ch of foldedToken) {
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

/* -------------------------------------------------------------------- index */

/** Localized name · search-only alias · Latin title or slug. */
type Weight = 3 | 2 | 1;

const W_NAME: Weight = 3;
const W_ALIAS: Weight = 2;
const W_LATIN: Weight = 1;

interface Field {
  /** Folded at build time — never re-folded per keystroke. */
  readonly text: string;
  readonly weight: Weight;
  /** ASCII-only: the only kind of text a transliterated query can match. */
  readonly latin: boolean;
}

export interface SearchDoc {
  readonly record: CatalogRecord;
  readonly fields: readonly Field[];
}

/** Build once per (records, names) — i.e. per catalogue load and per UI
 *  language, not per keystroke. */
export function buildSearchIndex(
  records: readonly CatalogRecord[],
  names: NameIndex,
): SearchDoc[] {
  return records.map((record) => ({ record, fields: fieldsOf(record, names) }));
}

function fieldsOf(record: CatalogRecord, names: NameIndex): Field[] {
  // An entry with no localized name has display === title; keep one field at
  // the higher weight rather than scanning the same text twice.
  const weights = new Map<string, Weight>();
  const add = (raw: string, weight: Weight) => {
    const text = fold(raw).trim();
    if (!text) return;
    const seen = weights.get(text);
    if (seen === undefined || weight > seen) weights.set(text, weight);
  };

  add(record.display, W_NAME);
  for (const alias of aliasesOf(names, record.id)) add(alias, W_ALIAS);
  add(record.entry.title, W_LATIN);
  add(record.slug.replace(/-/g, " "), W_LATIN);

  return [...weights].map(([text, weight]) => ({
    text,
    weight,
    latin: !NON_ASCII.test(text),
  }));
}

/* -------------------------------------------------------------------- query */

interface Token {
  readonly text: string;
  /** Latin spellings of a Cyrillic token; empty for a token that needs none. */
  readonly variants: readonly string[];
}

const NO_VARIANTS: readonly string[] = [];

function tokenize(query: string): Token[] {
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({
      text,
      // A Latin token needs no transliteration: CYR_TO_LAT would echo it back.
      variants: CYRILLIC.test(text) ? translitVariants(text) : NO_VARIANTS,
    }));
}

/* ------------------------------------------------------------------ scoring */

const EXACT = 100;
const PREFIX = 70;
const WORD_START = 50;
const CONTAINS = 25;
const TRANSLITERATED = 10;

const SPACE = 32;

/** How well one field matches one token, before the field's weight. A single
 *  scan yields all four tiers. */
function matchScore(text: string, token: string): number {
  const at = text.indexOf(token);
  if (at < 0) return 0;
  if (at > 0) return text.charCodeAt(at - 1) === SPACE ? WORD_START : CONTAINS;
  return text.length === token.length ? EXACT : PREFIX;
}

/** Every token must hit some field (AND); each contributes its best hit. */
function scoreDoc(doc: SearchDoc, tokens: readonly Token[]): number {
  let total = 0;

  for (const token of tokens) {
    let best = 0;

    for (const field of doc.fields) {
      const direct = matchScore(field.text, token.text);
      if (direct) {
        best = Math.max(best, direct * field.weight);
      } else if (field.latin && token.variants.length) {
        for (const variant of token.variants) {
          if (variant && field.text.includes(variant)) {
            best = Math.max(best, TRANSLITERATED * field.weight);
            break;
          }
        }
      }
    }

    if (!best) return 0;
    total += best;
  }

  return total;
}

/* ------------------------------------------------------------------- search */

export interface SearchFilters {
  types: Set<string>;
  countries: Set<string>;
}

function passesFilters(entry: IndexEntry, filters: SearchFilters): boolean {
  if (filters.types.size && !filters.types.has(entry.type)) return false;
  if (filters.countries.size && !(entry.country && filters.countries.has(entry.country))) return false;
  return true;
}

/** Filtered and, when there is a query, ranked best-first. Ties keep index
 *  order — `Array.prototype.sort` is stable per spec. */
export function searchEntries(
  docs: readonly SearchDoc[],
  query: string,
  filters: SearchFilters,
): SearchDoc[] {
  const matching = docs.filter((doc) => passesFilters(doc.record.entry, filters));

  const tokens = tokenize(query);
  if (!tokens.length) return matching;

  const scored: { doc: SearchDoc; score: number }[] = [];
  for (const doc of matching) {
    const score = scoreDoc(doc, tokens);
    if (score > 0) scored.push({ doc, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.doc);
}
