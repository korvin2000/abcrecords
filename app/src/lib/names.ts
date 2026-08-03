import type { NameIndex } from "./types";

/**
 * Localized names from pages/index-<lang>.json (docs/Catalog-Index.md §10):
 * `[0]` is the display name, `[1…]` are search-only aliases that are never
 * rendered. Aliases are what make CJK search work — 塞戈维亚 has no
 * romanization path a generic algorithm will find.
 *
 * The file is validated once at load (catalog.ts), so these stay lookups.
 */

const NONE: readonly string[] = [];

function namesOf(names: NameIndex, id: string): readonly string[] {
  return names[id] ?? NONE;
}

/** The rendered name, falling back to index.json's Latin `title`. */
export function displayName(names: NameIndex, id: string, fallback: string): string {
  return namesOf(names, id)[0] ?? fallback;
}

/** The search-only aliases, without the display name. */
export function aliasesOf(names: NameIndex, id: string): readonly string[] {
  return namesOf(names, id).slice(1);
}
