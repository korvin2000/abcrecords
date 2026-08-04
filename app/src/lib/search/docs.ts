import type { NameIndex } from "../types";
import type { CatalogRecord } from "../catalog";
import { aliasesOf } from "../names";
import { fold, isAscii } from "./fold";

/**
 * The searchable corpus.
 *
 * Everything that depends only on the catalogue — folding, lowercasing, the
 * ASCII test, the per-field weight — happens here, once per catalogue load and
 * per UI language. Nothing in this module may run per keystroke.
 */

/** Localized name · search-only alias · Latin title or slug. */
export type Weight = 3 | 2 | 1;

export const W_NAME: Weight = 3;
export const W_ALIAS: Weight = 2;
export const W_LATIN: Weight = 1;

export interface Field {
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
    latin: isAscii(text),
  }));
}
