import { lazy } from "react";

/**
 * The statistics panel is a whole document's worth of markup that most readers
 * never open, so it is a chunk of its own — preloaded the moment a pointer or
 * a focus ring reaches the counter, which is well before the click lands.
 */
const importStatsModal = () =>
  import("./StatsModal").then(({ StatsModal }) => ({ default: StatsModal }));

let pending: ReturnType<typeof importStatsModal> | undefined;
const loadStatsModal = () => (pending ??= importStatsModal());

export const LazyStatsModal = lazy(loadStatsModal);
export const preloadStatsModal = () => void loadStatsModal();
