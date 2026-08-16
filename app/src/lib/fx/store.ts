import { useEffect, useSyncExternalStore } from "react";
import { EFFECTS } from "@/config";
import { measureTier, prefersReducedMotion, staticTier, type PerfTier } from "./tier";

/**
 * The one place that decides which ornaments are running right now.
 *
 * Three inputs, deliberately kept apart:
 *
 * - **What the machine can afford** — the measured `PerfTier`. It scales the
 *   glyph count and *nothing else*. A grade must never be able to switch an
 *   effect off: an ornament that cannot be seen at any grade is a bug, and it
 *   also leaves the reader's switch with nothing to change.
 * - **What the reader asked for** — one remembered switch. This is the only
 *   thing that turns an ornament off.
 * - **What the machine's owner asked for** — `prefers-reduced-motion`. It only
 *   picks the *default* for that switch; flipping the switch is an explicit,
 *   informed choice and wins over the hint (see `EFFECTS.respectReducedMotion`,
 *   and the paired CSS rule in `index.css` that re-arms the animations).
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

const STORAGE_KEY = "codex-fx";

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

let tier: PerfTier = EFFECTS.tier === "auto" ? staticTier() : EFFECTS.tier;
let on = readPreference();
let snapshot = build();
let probing = false;

const listeners = new Set<() => void>();

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
  for (const listener of listeners) listener();
}

/** The reader's stored choice, or — failing that — what the machine implies. */
function readPreference(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
  if (stored === "on") return true;
  if (stored === "off") return false;
  return !(EFFECTS.respectReducedMotion && prefersReducedMotion());
}

/** Turn every ornament on or off. Takes effect on the next frame. */
export function setEffectsEnabled(next: boolean): void {
  on = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    /* ignore */
  }
  emit();
}

/** Run the capability probe once per tab, then upgrade or downgrade in place. */
export function probeCapability(): void {
  if (probing || !EFFECTS.enabled || EFFECTS.tier !== "auto") return;
  probing = true;
  void measureTier().then((measured) => {
    tier = measured;
    emit();
  });
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
