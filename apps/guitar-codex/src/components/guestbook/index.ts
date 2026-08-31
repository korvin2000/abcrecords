/**
 * The guestbook feature's public surface inside the host — deliberately only
 * the lazy entry points. `GuestbookOverlay` itself is *not* re-exported: it
 * imports `@guitar-codex/guestbook` statically, so a barrel that carried it
 * would pull the whole package into whatever chunk read the barrel, which is
 * precisely what `LazyGuestbookOverlay` exists to prevent.
 */
export { LazyGuestbookOverlay, preloadGuestbookOverlay } from "./LazyGuestbookOverlay";
export { GUESTBOOK_SLUG } from "./route";
