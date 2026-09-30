import { useEffect, useState, useSyncExternalStore } from "react";
import { DOSSIER } from "@/config";
import type { CatalogRecord } from "../catalog";
import type { Lang } from "../languages";
import { factsIndexFor, type FactsSnapshot } from "./factsStore";

/** How urgently the facts are wanted — see `FactsIndex.start`. */
export type FactsDemand = "off" | "idle" | "demand";

/**
 * Subscribe to the dossier facts index for this catalogue slice and language.
 *
 * `demand` is the only switch: while it is `"off"` the hook still reports the
 * (empty) snapshot, so callers need no null handling, but not a single request
 * is made. `"idle"` is the herald's "on this day" lookup — worth one request
 * to the server's aggregate, not worth a crawl on a weak machine. `"demand"`
 * is an advanced criterion that actually reads a dossier: the facts are read
 * whatever it takes, picking up where an idle read left off.
 */
export function useFacts(
  records: readonly CatalogRecord[],
  lang: Lang,
  demand: FactsDemand,
): FactsSnapshot {
  const index = factsIndexFor(records, lang);

  const snapshot = useSyncExternalStore(index.subscribe, index.getSnapshot, index.getSnapshot);

  useEffect(() => {
    if (demand !== "off") index.start(demand);
  }, [index, demand]);

  return snapshot;
}

/**
 * True once the catalogue has been on screen for `DOSSIER.warmDelayMs` — the
 * moment an *idle* read of the facts may begin. The first seconds belong to
 * the first paint, and the herald's first message is not due before then
 * anyway (`HERALD.revealDelayMs`).
 */
export function useWarmUp(ready: boolean): boolean {
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (!ready || warm) return;
    const timer = window.setTimeout(() => setWarm(true), DOSSIER.warmDelayMs);
    return () => window.clearTimeout(timer);
  }, [ready, warm]);
  return warm;
}
