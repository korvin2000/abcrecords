import { useEffect, useSyncExternalStore } from "react";
import { EFFECTS } from "@/config";
import { cachedTier, measureTier, prefersReducedMotion, staticTier, type PerfTier } from "./tier";
import { preferences, setPreference } from "@/lib/settings";

/**
 * The one place that decides which ornaments are running right now — and, since
 * the performance audit (docs/performance-analysis.md §4.3), how expensively
 * the page is *painted*.
 *
 * Three inputs, deliberately kept apart:
 *
 * - **What the machine can afford** — the measured `PerfTier`. It scales the
 *   glyph count and the paint fidelity (blurs, filters, blend layers — see
 *   `styles/perf.css`). A grade must never be able to switch an ornament off
 *   for good: it picks the *default* of the reader's switch on a weak machine,
 *   exactly as `prefers-reduced-motion` does, and the switch still wins.
 * - **What the reader asked for** — one remembered switch. Off is also the
 *   page's "lite mode": the same paint reductions a weak machine gets.
 * - **What the machine's owner asked for** — `prefers-reduced-motion`. It only
 *   picks the *default* for that switch; flipping the switch is an explicit,
 *   informed choice and wins over the hint (see `EFFECTS.respectReducedMotion`,
 *   and the paired CSS rule in `index.css` that re-arms the animations).
 *
 * The answers travel to CSS as attributes on `<html>` — `data-perf` (the
 * grade), `data-fx` (the switch: what moves) and `data-lite` (a weak machine
 * or a deliberate "off": what is painted, see `isLite`) — written here,
 * synchronously, so the very first paint is already the right one.
 *
 * A module-level store rather than a context: the grade arrives from an async
 * probe that outlives any one component, and both effects must react to the
 * same value without a provider in between (the pattern `lib/dossier` uses).
 */

/** Share of `EFFECTS.driftCount` each grade may draw. A weak machine gets a
 *  thinner sky, never an empty one. The clef is a single composited element
 *  and is not worth grading at all — it turns whenever effects are on. */
const DENSITY: Record<PerfTier, number> = {
  high: 1,
  mid: 0.6,
  low: 0.3,
};

export interface FxSnapshot {
  /** The measured (or pinned) capability grade. */
  tier: PerfTier;
  /** The reader's switch — what the header button shows and toggles. */
  on: boolean;
  /** The clef may turn. It is always *drawn*; only the motion is optional. */
  spin: boolean;
  /** Glyphs the rising layer may draw. 0 means: do not mount it at all. */
  glyphs: number;
}

let tier: PerfTier = EFFECTS.tier === "auto" ? (cachedTier() ?? staticTier()) : EFFECTS.tier;
let on = readPreference();
let snapshot = build();
let probing = false;

const listeners = new Set<() => void>();

/** Hand the two answers to the stylesheet (`styles/perf.css`, `effects.css`). */
function publish(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.perf = tier;
  root.dataset.fx = on ? "on" : "off";
  root.dataset.lite = isLite() ? "on" : "off";
}
publish();

function build(): FxSnapshot {
  const live = EFFECTS.enabled && on;
  return {
    tier,
    on,
    spin: live && EFFECTS.clef,
    glyphs: live ? glyphBudget() : 0,
  };
}

function glyphBudget(): number {
  if (!EFFECTS.drift || EFFECTS.driftCount <= 0) return 0;
  // A grade thins the sky; only the config or the reader may empty it.
  return Math.max(1, Math.round(EFFECTS.driftCount * DENSITY[tier]));
}

function emit(): void {
  const next = build();
  // Identity is the subscription contract of useSyncExternalStore: hand out a
  // fresh object only when something actually differs.
  if (
    next.tier === snapshot.tier &&
    next.on === snapshot.on &&
    next.spin === snapshot.spin &&
    next.glyphs === snapshot.glyphs
  ) {
    return;
  }
  snapshot = next;
  publish();
  for (const listener of listeners) listener();
}

/** What the machine implies when the reader has not said: off under reduced
 *  motion, and off on a machine graded `low` — where even a thin sky keeps the
 *  compositor awake for ever. One press turns it back on. */
function defaultOn(): boolean {
  if (EFFECTS.respectReducedMotion && prefersReducedMotion()) return false;
  return tier !== "low";
}

/** The reader's stored choice, or — failing that — what the machine implies. */
function readPreference(): boolean {
  return preferences().effects ?? defaultOn();
}

/** Turn every ornament on or off. Takes effect on the next frame. */
export function setEffectsEnabled(next: boolean): void {
  on = next;
  setPreference("effects", next);
  // Unconditionally: an explicit choice changes `data-lite` even when it
  // leaves the switch where a default had already put it.
  publish();
  emit();
}

/** Run the capability probe once per tab, then upgrade or downgrade in place. */
export function probeCapability(): void {
  if (probing || !EFFECTS.enabled || EFFECTS.tier !== "auto") return;
  probing = true;
  void measureTier().then((measured) => {
    tier = measured;
    // A default follows the grade; a choice does not.
    if (preferences().effects === null) on = defaultOn();
    emit();
  });
}

/** The current grade, for code that is not a component (the audio engine, the
 *  dossier crawl, the document viewer's budgets). */
export function perfTier(): PerfTier {
  return tier;
}

/**
 * "Paint cheaply": a weak machine, or a reader who has *themselves* switched
 * the ornaments off — published as `data-lite` for `styles/perf.css`.
 *
 * Deliberately not simply `!on`. The switch also defaults to off under
 * `prefers-reduced-motion`, and a great many machines carry that hint without
 * their owners knowing; it asks for less *movement*, not for a flatter page.
 * So a default-off switch stops what moves (`data-fx="off"`), and only a weak
 * machine or a deliberate choice also drops the static finish — the sepia on
 * the portraits, the grain, the parchment texture.
 */
export function isLite(): boolean {
  return tier === "low" || preferences().effects === false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): FxSnapshot {
  return snapshot;
}

/** Subscribe to the effect budget. The first caller starts the probe. */
export function useFx(): FxSnapshot {
  useEffect(probeCapability, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Why is nothing moving? One line in the console beats reading three files.
if (import.meta.env.DEV) {
  (window as unknown as { __fx: unknown }).__fx = {
    get state() {
      return { ...snapshot, reducedMotion: prefersReducedMotion(), config: EFFECTS };
    },
    set: setEffectsEnabled,
  };
}
