/**
 * Runtime feature switches and timing budgets — one place to turn a feature
 * off, slow it down, or tune it for weaker hardware.
 *
 * Everything here is read at module scope by the feature that owns it, so a
 * flag flipped to `false` removes the work *and* the UI, never just hides it.
 * The types are written out (rather than inferred with `as const`) so a flag
 * stays a `boolean` and flipping one never narrows into dead code.
 *
 * Keep the shape flat and boring: this file is meant to be edited by someone
 * who has not read the code around it.
 */

interface Features {
  /** The refinement panel behind the search bar (lib/search + components/search). */
  advancedSearch: boolean;
  /** The dynamic message block under the title (lib/herald + components/herald). */
  herald: boolean;
}

export const FEATURES: Features = {
  advancedSearch: true,
  herald: true,
};

interface DossierConfig {
  /** Start reading dossiers as soon as the catalogue is on screen. With this
   *  off, the crawl waits until an advanced criterion actually needs it. */
  warmOnIdle: boolean;
  /** Parallel requests. Small on purpose — browsers cap ~6 per origin and the
   *  codex must never queue behind the index. */
  concurrency: number;
  /** Floor between progress notifications, so streaming facts cannot turn into
   *  a re-render storm (completion always notifies immediately). */
  notifyThrottleMs: number;
}

/**
 * The dossier facts index (lib/dossier): one `*.bio.json` per listed entry,
 * read in the background so name/date search and the herald's "on this day"
 * lookup have something to work with.
 *
 * This is the app's only many-request feature, so it is deliberately shy: few
 * sockets, idle-scheduled batches, throttled re-renders. At catalogue scale
 * (~10³ entries) it stays a background trickle; if that ever stops being
 * acceptable, the escape hatch is a precomputed digest in `pages/` plugged in
 * behind `factsStore`'s loader — no caller changes.
 */
export const DOSSIER: DossierConfig = {
  warmOnIdle: true,
  concurrency: 4,
  notifyThrottleMs: 500,
};

interface HeraldConfig {
  /** Show "on this day" instead of the default line after this long. A range,
   *  picked once per visit, so two tabs do not flip in lockstep. */
  revealDelayMs: readonly [number, number];
  /** How long each message stays before the next one takes its place. */
  rotateMs: number;
  /** Include birth/death anniversaries in the rotation. */
  anniversaries: boolean;
  /** Include the localized book of sayings (pages/quotes/). */
  quotes: boolean;
}

/** Herald timings (lib/herald). Milliseconds. */
export const HERALD: HeraldConfig = {
  revealDelayMs: [5_000, 10_000],
  rotateMs: 30_000,
  anniversaries: true,
  quotes: true,
};
