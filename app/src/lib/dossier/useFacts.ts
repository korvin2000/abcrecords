import { useEffect, useSyncExternalStore } from "react";
import type { CatalogRecord } from "../catalog";
import type { Lang } from "../languages";
import { factsIndexFor, type FactsSnapshot } from "./factsStore";

/**
 * Subscribe to the dossier facts index for this catalogue slice and language.
 *
 * `enabled` is the only switch: while it is false the hook still reports the
 * (empty) snapshot, so callers need no null handling, but not a single request
 * is made. Flip it on when something actually needs cross-entry metadata —
 * the herald's "on this day" lookup, or an advanced criterion that reads a
 * dossier — and the crawl begins where it left off.
 */
export function useFacts(
  records: readonly CatalogRecord[],
  lang: Lang,
  enabled: boolean,
): FactsSnapshot {
  const index = factsIndexFor(records, lang);

  const snapshot = useSyncExternalStore(index.subscribe, index.getSnapshot, index.getSnapshot);

  useEffect(() => {
    if (enabled) index.start();
  }, [index, enabled]);

  return snapshot;
}
