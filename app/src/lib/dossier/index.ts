/** The dossier facts index — cross-entry `*.bio.json` metadata, read lazily. */
export { type EntryFacts, type FactsBySlug, NO_FACTS, factsFrom, emptyFacts } from "./facts";
export { type FactsSnapshot, FactsIndex, factsIndexFor } from "./factsStore";
export { useFacts } from "./useFacts";
