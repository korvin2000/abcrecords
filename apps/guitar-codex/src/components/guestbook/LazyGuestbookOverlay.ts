import { lazy } from "react";

/**
 * The async boundary for the guestbook feature — the same shape as
 * `LazyCodexModal` and `LazyPdfModal`.
 *
 * `GuestbookOverlay` imports `@guitar-codex/guestbook` statically, so this one
 * dynamic import is what keeps the package, its i18next instance and its
 * stylesheet out of the initial bundle. Nothing in the startup path may import
 * `./GuestbookOverlay` directly (docs/react-modular-architecture.md §34.1) —
 * that is why the barrel beside this file re-exports only the lazy entry.
 */
const importGuestbookOverlay = () =>
  import("./GuestbookOverlay").then(({ GuestbookOverlay }) => ({ default: GuestbookOverlay }));

let pending: ReturnType<typeof importGuestbookOverlay> | undefined;
const loadGuestbookOverlay = () => (pending ??= importGuestbookOverlay());

export const LazyGuestbookOverlay = lazy(loadGuestbookOverlay);

/** Warm the chunk on intent — the footer entry does it on hover, so the panel
 *  is usually already in memory by the time the click lands. */
export const preloadGuestbookOverlay = () => void loadGuestbookOverlay();
