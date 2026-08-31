/**
 * The demoscene feature's public surface inside the host — deliberately only
 * the lazy entry points. `AboutDemoscene` itself is *not* re-exported: it
 * imports `@site/demoscene` statically, so a barrel that carried it would pull
 * the whole package into whatever chunk read the barrel, which is precisely
 * what `LazyAboutDemoscene` exists to prevent.
 */
export { LazyAboutDemoscene, preloadAboutDemoscene } from "./LazyAboutDemoscene";
