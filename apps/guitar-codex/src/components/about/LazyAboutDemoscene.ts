import { lazy } from "react";

/**
 * The async boundary for the demoscene feature — the same shape as
 * `LazyCodexModal`, `LazyPdfModal` and `LazyGuestbookOverlay`.
 *
 * `AboutDemoscene` imports `@site/demoscene` statically, so this one dynamic
 * import is the whole of what keeps ~105 kB of renderer, score and message
 * catalogues out of the initial bundle. Nothing in the startup path may import
 * `./AboutDemoscene` directly (docs/react-modular-architecture.md §34.1) —
 * which is why the barrel beside this file re-exports only the lazy entry.
 */
const importAboutDemoscene = () =>
  import("./AboutDemoscene").then(({ AboutDemoscene }) => ({ default: AboutDemoscene }));

let pending: ReturnType<typeof importAboutDemoscene> | undefined;
const loadAboutDemoscene = () => (pending ??= importAboutDemoscene());

export const LazyAboutDemoscene = lazy(loadAboutDemoscene);

/** Warm the chunk on intent. The bar's `I` does it on hover and focus, so the
 *  production usually starts building the moment the click lands rather than a
 *  network round trip later. */
export const preloadAboutDemoscene = () => void loadAboutDemoscene();
