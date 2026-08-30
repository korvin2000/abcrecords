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

import type { PerfTier } from "@/lib/fx/tier";

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

interface GridConfig {
  /** Cards drawn on first paint and after every change to the result list. */
  pageSize: number;
  /** How many more each reveal adds. */
  pageStep: number;
  /**
   * How many pages scrolling may reveal on its own before the reader has to
   * ask. Endless scrolling and a hard cap are both wrong here: the first is
   * how a phone ends up holding a thousand cards nobody looked at, the second
   * makes browsing a chore. A few free pages, then a deliberate click.
   */
  autoPages: number;
  /** How far below the fold the next page starts loading. */
  revealMargin: string;
}

/**
 * The catalogue grid (components/CharacterGrid).
 *
 * The numbers matter more than they look: every card is an ornate frame, a
 * portrait, a hover glow and — on a fine pointer — five motion values with two
 * springs. Drawing the whole result list was costing 15 s on the first
 * keystroke at 736 entries, so what is on screen is now bounded here rather
 * than by the size of the catalogue.
 */
export const GRID: GridConfig = {
  pageSize: 40,
  pageStep: 40,
  autoPages: 1,
  revealMargin: "800px",
};

interface EffectsConfig {
  /** Master switch. Off removes both ornaments, the capability probe and the
   *  header button that toggles them. */
  enabled: boolean;
  /** The turning clef in the search box (components/fx/ClefSpinner). */
  clef: boolean;
  /** The rising musical glyphs behind the page (components/fx/MusicalDrift). */
  drift: boolean;
  /** Glyphs on a wide screen at the top grade. Weaker grades and narrower
   *  viewports scale this down; `low` drops it to none. */
  driftCount: number;
  /** `"auto"` measures the machine once per tab (lib/fx/tier.ts). Pin a grade
   *  to see what a weaker device gets without owning one. */
  tier: PerfTier | "auto";
  /** Start with the ornaments off when the machine asks for reduced motion.
   *  This only picks the **default**; the reader's own switch always wins, and
   *  a great many corporate Windows images set that hint without their users
   *  ever knowing. Set `false` to make the ornaments opt-*out* everywhere. */
  respectReducedMotion: boolean;
}

/**
 * Decorative effects (lib/fx + components/fx). Everything here is ornament: it
 * is budgeted against a measured capability grade, switchable by the reader at
 * any moment, and nothing the catalogue does depends on it.
 */
export const EFFECTS: EffectsConfig = {
  enabled: true,
  clef: true,
  drift: true,
  driftCount: 18,
  tier: "auto",
  respectReducedMotion: true,
};

/**
 * How a chosen nation is marked in the country facet (components/search/
 * CountryFilter). One word, four looks — change it here and nowhere else.
 *
 *   "ring"   a burgundy ring held clear of the flag on all four sides.
 *   "stamp"  the same ring with a paper-coloured separator inside it, so the
 *            burgundy never touches the flag's own colours.
 *   "mount"  the flag mounted on a solid burgundy plate, like a stamp on an
 *            album leaf.
 *   "quiet"  no mark at all: the *unchosen* flags recede further instead.
 *
 * The previous treatment grew the chosen flag by 18 % with `transform: scale`
 * and ringed it with a border *and* a box-shadow. Both halves were wrong:
 * a transform changes no layout, so a grown flag ate the 4 px gap and touched
 * its neighbour, and two ring mechanisms at two radii on a clipped, rounded box
 * is what made the outline look thick in some corners and absent in others.
 * Every option here draws **one** mark, outside the flag, in space the row's
 * gap has actually reserved — see `.country-row` in search.css.
 */
export type FlagSelection = "ring" | "stamp" | "mount" | "quiet";

export const FLAG_SELECTION: FlagSelection = "ring";

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
 * (~10³ entries) it stays a background trickle, and it is **the only** place
 * these facts come from: reading them in the browser is what makes an edit to a
 * `*.bio.json` show up on the next reload instead of on the next build. A
 * generated `facts-<lang>.json` beside the index is faster and wrong — see the
 * note at the head of `lib/dossier/factsStore.ts` before proposing one again.
 * The dials below are where a slow crawl is paid for.
 */
export const DOSSIER: DossierConfig = {
  warmOnIdle: true,
  /* Six, not four: browsers cap a same-origin HTTP/1.1 host at six connections
     and multiplex freely over HTTP/2, so six is the most the slowest transport
     will actually run in parallel and no more than the fastest wants. The codex
     still cannot queue behind the index, because every worker yields to the
     browser between entries (`whenIdle` in factsStore.ts). */
  concurrency: 6,
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
