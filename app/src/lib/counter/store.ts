import { useSyncExternalStore } from "react";
import { COUNTER } from "@/config";
import { preferences, setPreference } from "@/lib/settings";
import { recordVisit } from "./api";
import type { Pulse, Stats } from "./types";

/**
 * The visitor tally, held once for the whole page.
 *
 * A module store rather than state in `App` for two reasons. The odometer in
 * the header and the statistics panel are not parent and child — the panel is
 * a full-screen overlay and cannot live inside a `backdrop-filter`ed header,
 * which is a containing block for anything fixed inside it — yet both show the
 * same figures, and the panel's own request returns a *fresher* tally than the
 * one the header is showing. And the visit must be recorded exactly once per
 * page load, which a module-level flag guarantees and an effect does not:
 * StrictMode runs every effect twice in development.
 */

export type CounterStatus = "idle" | "loading" | "ready" | "failed";

export interface CounterState {
  readonly status: CounterStatus;
  readonly pulse: Pulse | null;
  /**
   * The tally as it stood at the end of the reader's last visit, or null on a
   * first one. The odometer opens on this and turns from it to `pulse`, so the
   * digits that move are the ones that actually changed.
   */
  readonly remembered: number | null;
}

let state: CounterState = {
  status: "idle",
  pulse: null,
  remembered: preferences().counter,
};

const listeners = new Set<() => void>();
/** Set before the request is made, so a second call can never double-count. */
let primed = false;

function publish(next: CounterState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The whole tally. Stable identity until something changes. */
export function useCounter(): CounterState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/**
 * Record this page view — once per page load, whoever asks first.
 *
 * Deliberately idle-scheduled: the catalogue index and the reader's first
 * screen come first, and a counter is chrome. `timeout` guarantees it happens
 * in a tab that never goes idle.
 */
export function primeCounter(lang: string): void {
  if (primed || !COUNTER.enabled) return;
  primed = true;
  publish({ ...state, status: "loading" });

  const run = () => {
    recordVisit(lang, slugFromHash())
      .then(adoptPulse)
      .catch(() => {
        // A silent counter is a missing ornament, never an error the reader
        // has to deal with: the widget simply shows the remembered number.
        publish({ ...state, status: "failed" });
      });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    window.setTimeout(run, 300);
  }
}

/**
 * Take a newer tally — from the load, or from the statistics request the panel
 * makes when a reader opens it. Also what remembers the figure for next time.
 */
export function adoptPulse(pulse: Pulse): void {
  publish({ status: "ready", pulse, remembered: state.remembered });
  setPreference("counter", pulse[COUNTER.display]);
}

/* ------------------------------------------------- the statistics document */

/** How long a fetched document may be reused. The endpoint caches its own
 *  answer for twenty seconds (APCu), so asking again inside that window can
 *  only ever return the same figures. */
const STATS_TTL_MS = 20_000;

let stats: { at: number; value: Stats } | null = null;

/** Keep the panel's document, so closing and reopening it is instant and costs
 *  no request. One document, replaced — never a cache that grows. */
export function rememberStats(value: Stats): void {
  stats = { at: Date.now(), value };
}

/** The remembered document while it is still worth showing, else null. */
export function freshStats(): Stats | null {
  return stats && Date.now() - stats.at < STATS_TTL_MS ? stats.value : null;
}

/**
 * Which entry is being read, for the "most-read entries" tally. The hash is
 * the route (`#/slug`), and reading it here rather than taking it as an
 * argument keeps the recording independent of React's render order — the
 * request goes out on an idle callback, by which time a prop could be stale.
 */
function slugFromHash(): string | null {
  const match = /^#\/([^?#]+)$/.exec(window.location.hash);
  return match ? decodeURIComponent(match[1]) : null;
}
