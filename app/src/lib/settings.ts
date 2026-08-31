import { useCallback, useSyncExternalStore } from "react";
import type { StoredSearch } from "./search/persist";

/**
 * Everything the reader has chosen, remembered between visits.
 *
 * One store, one storage key, one JSON document — because the alternative is
 * what this file replaced: a `localStorage` call wherever a preference
 * happened to live (`codex-lang` in i18n, `codex-fx` in the effects store,
 * nothing at all for sound, ambience or the search filter), each with its own
 * try/catch, its own idea of what an absent value means, and no way to see
 * what the app actually remembers.
 *
 * Three rules hold the design together:
 *
 * - **`null` means "not chosen", never "off".** A reader who has never touched
 *   the language menu must follow their browser; one who has picked Russian on
 *   an English machine must keep Russian. Only a stored `null`/absent value
 *   may be overridden by a default, so every default stays derivable *and*
 *   every choice stays sticky. `defaultsFor` in `search/persist.ts` and
 *   `detectLang` in `i18n.tsx` are the two readers of that distinction.
 * - **The owner of a preference keeps its logic.** This module persists values
 *   and notifies; it does not know that effects default to off under
 *   `prefers-reduced-motion` or that a language must be one of eleven. Domain
 *   modules read and write through it and keep their own rules.
 * - **Writes are cheap enough to do on every keystroke.** They are coalesced
 *   into one serialization per frame-ish window and flushed when the page is
 *   hidden, so persisting the search filter as it is typed costs nothing.
 *
 * Storage is best-effort throughout: private mode, a full quota or a disabled
 * store degrade to an in-memory session, never to an exception.
 */

const STORAGE_KEY = "codex-settings";
const VERSION = 1;

/** Legacy single-purpose keys, read once and folded into the document. */
const LEGACY_LANG_KEY = "codex-lang";
const LEGACY_FX_KEY = "codex-fx";

/** How long writes are coalesced. Long enough to swallow a burst of typing,
 *  short enough that a reader who closes the tab immediately keeps the change
 *  anyway (the `pagehide` flush covers the rest). */
const WRITE_DELAY_MS = 400;

export interface Preferences {
  /** ISO 639-1 UI language, or null to follow the browser. */
  readonly lang: string | null;
  /** Interface sound cues. */
  readonly sound: boolean;
  /** The ambient background music. */
  readonly ambient: boolean;
  /** Decorative effects, or null to follow `prefers-reduced-motion`. */
  readonly effects: boolean | null;
  /** The search filter as last left, or null when never refined — which is
   *  what lets a first visit seed a filter from the reader's language. */
  readonly search: StoredSearch | null;
}

export type PreferenceKey = keyof Preferences;

const DEFAULTS: Preferences = {
  lang: null,
  sound: true,
  ambient: false,
  effects: null,
  search: null,
};

let current: Preferences = load();
const listeners = new Set<() => void>();
let pendingWrite: ReturnType<typeof setTimeout> | null = null;
/** Set by the DEV reset helper, so the teardown flush cannot resurrect the
 *  document the caller just deleted (see `__settings.clear`). */
let abandoned = false;

/* ------------------------------------------------------------------ read */

/** The whole remembered document. Stable identity until something changes. */
export function preferences(): Preferences {
  return current;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ----------------------------------------------------------------- write */

/**
 * Remember one preference. Writing the value it already holds is a no-op, so
 * a controlled component may call this on every render without churning the
 * store or the subscribers.
 */
export function setPreference<K extends PreferenceKey>(key: K, value: Preferences[K]): void {
  if (Object.is(current[key], value)) return;
  current = { ...current, [key]: value };
  schedule();
  for (const listener of listeners) listener();
}

/**
 * Read one preference and get a setter for it — the `useState` shape, backed
 * by storage. Subscribing per key rather than to the whole document keeps a
 * search keystroke from re-rendering the language menu.
 */
export function usePreference<K extends PreferenceKey>(
  key: K,
): [Preferences[K], (value: Preferences[K]) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => current[key],
    () => DEFAULTS[key],
  );
  const set = useCallback((next: Preferences[K]) => setPreference(key, next), [key]);
  return [value, set];
}

/* --------------------------------------------------------------- storage */

function schedule(): void {
  if (pendingWrite !== null) return;
  pendingWrite = setTimeout(() => {
    pendingWrite = null;
    flush();
  }, WRITE_DELAY_MS);
}

/** Write now. Called on a timer, and on the last event a page reliably gets. */
export function flush(): void {
  if (pendingWrite !== null) {
    clearTimeout(pendingWrite);
    pendingWrite = null;
  }
  if (abandoned) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, ...current }));
  } catch {
    /* private mode, or the quota is full — the session keeps its own copy */
  }
}

/**
 * `pagehide` rather than `unload`: it is the one teardown event that fires on
 * iOS and survives the back/forward cache, and `visibilitychange` covers a tab
 * the reader switches away from and never returns to.
 */
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

function load(): Preferences {
  const stored = readJson(STORAGE_KEY);
  const row = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};

  return {
    // A future version writes a shape this build cannot read; falling back to
    // the defaults is better than half-applying it. Legacy keys still count.
    lang: pickString(row.v === VERSION ? row.lang : undefined) ?? legacyLang(),
    sound: pickBoolean(row.v === VERSION ? row.sound : undefined) ?? DEFAULTS.sound,
    ambient: pickBoolean(row.v === VERSION ? row.ambient : undefined) ?? DEFAULTS.ambient,
    effects: pickBoolean(row.v === VERSION ? row.effects : undefined) ?? legacyEffects(),
    search: row.v === VERSION && row.search && typeof row.search === "object"
      ? (row.search as StoredSearch)
      : null,
  };
}

function legacyLang(): string | null {
  return pickString(readRaw(LEGACY_LANG_KEY));
}

function legacyEffects(): boolean | null {
  const raw = readRaw(LEGACY_FX_KEY);
  return raw === "on" ? true : raw === "off" ? false : null;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null; // corrupted document — start over rather than crash the app
  }
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function pickBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

// One line in the console beats reading five files when a preference will not
// stick. `__settings.clear()` puts the app back into its first-visit state.
if (import.meta.env.DEV) {
  (window as unknown as { __settings: unknown }).__settings = {
    get all() {
      return { ...current };
    },
    set: setPreference,
    clear() {
      // Order matters: the reload fires `pagehide`, and a flush there would
      // write the in-memory document straight back over the one just removed.
      abandoned = true;
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_LANG_KEY);
        localStorage.removeItem(LEGACY_FX_KEY);
      } catch {
        /* ignore */
      }
      location.reload();
    },
  };
}
