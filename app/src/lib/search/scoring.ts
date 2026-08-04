import type { SearchDoc } from "./docs";
import { CYRILLIC, fold, translitVariants } from "./fold";

/**
 * Free-text relevance.
 *
 * Query-side work (folding, tokenizing, transliterating) happens once in
 * `tokenize`; the per-doc loop below is only `indexOf` calls, because it runs
 * `docs × fields` times per keystroke. Measured at 0.398 ms/query over 1249
 * docs, which is why there is deliberately no inverted index or trie — one
 * would be real complexity for no measurable gain. Re-measure before adding
 * one.
 */

export interface Token {
  readonly text: string;
  /** Latin spellings of a Cyrillic token; empty for a token that needs none. */
  readonly variants: readonly string[];
}

const NO_VARIANTS: readonly string[] = [];

export function tokenize(query: string): Token[] {
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({
      text,
      // A Latin token needs no transliteration: CYR_TO_LAT would echo it back.
      variants: CYRILLIC.test(text) ? translitVariants(text) : NO_VARIANTS,
    }));
}

const EXACT = 100;
const PREFIX = 70;
const WORD_START = 50;
const CONTAINS = 25;
const TRANSLITERATED = 10;

const SPACE = 32;

/** How well one field matches one token, before the field's weight. A single
 *  scan yields all four tiers. */
export function matchScore(text: string, token: string): number {
  const at = text.indexOf(token);
  if (at < 0) return 0;
  if (at > 0) return text.charCodeAt(at - 1) === SPACE ? WORD_START : CONTAINS;
  return text.length === token.length ? EXACT : PREFIX;
}

/** Every token must hit some field (AND); each contributes its best hit.
 *  Returns 0 for "no match", which the caller reads as excluded. */
export function scoreDoc(doc: SearchDoc, tokens: readonly Token[]): number {
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
