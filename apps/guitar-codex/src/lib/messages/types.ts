/** Shared message shapes for the per-language dictionaries. */

export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | Plural;
